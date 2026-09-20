-- ============ Fox Farm security hardening ============

-- 1) Close the public table surface (no client talks to the DB directly)
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM authenticated;

-- 2) Atomic rate limiter
CREATE OR REPLACE FUNCTION public.rl_hit(_bucket text, _subject text, _limit int, _window_seconds int)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c int;
BEGIN
  INSERT INTO rate_limits (bucket, subject, window_start, count)
  VALUES (_bucket, _subject, now(), 1)
  ON CONFLICT (bucket, subject) DO UPDATE SET
    count = CASE WHEN rate_limits.window_start < now() - make_interval(secs => _window_seconds)
                 THEN 1 ELSE rate_limits.count + 1 END,
    window_start = CASE WHEN rate_limits.window_start < now() - make_interval(secs => _window_seconds)
                 THEN now() ELSE rate_limits.window_start END
  RETURNING count INTO c;
  RETURN c <= _limit;
END; $$;

-- 3) Balance may only move through the ledger functions
CREATE OR REPLACE FUNCTION public.guard_app_users_balance()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.balance < 0 THEN
    RAISE EXCEPTION 'balance cannot be negative';
  END IF;
  IF NEW.total_earned < OLD.total_earned THEN
    RAISE EXCEPTION 'total_earned cannot decrease';
  END IF;
  IF (NEW.balance IS DISTINCT FROM OLD.balance OR NEW.total_earned IS DISTINCT FROM OLD.total_earned)
     AND current_setting('foxfarm.ledger', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'balance can only change through the ledger';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_guard_balance ON public.app_users;
CREATE TRIGGER trg_guard_balance BEFORE UPDATE ON public.app_users
FOR EACH ROW EXECUTE FUNCTION public.guard_app_users_balance();

-- 4) Ledger functions
CREATE OR REPLACE FUNCTION public.credit_user(
  _user_id UUID, _amount BIGINT, _kind TEXT, _note TEXT, _key TEXT
) RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_balance BIGINT;
BEGIN
  IF _amount <= 0 OR _amount > 10000000 THEN
    RAISE EXCEPTION 'invalid amount';
  END IF;
  IF _key IS NOT NULL AND EXISTS (SELECT 1 FROM transactions WHERE idempotency_key = _key) THEN
    SELECT balance INTO new_balance FROM app_users WHERE id = _user_id;
    RETURN new_balance;
  END IF;
  INSERT INTO transactions (user_id, kind, amount, note, idempotency_key)
  VALUES (_user_id, _kind, _amount, _note, _key);
  PERFORM set_config('foxfarm.ledger', 'on', true);
  UPDATE app_users
     SET balance = balance + _amount, total_earned = total_earned + _amount
   WHERE id = _user_id
  RETURNING balance INTO new_balance;
  PERFORM set_config('foxfarm.ledger', 'off', true);
  RETURN new_balance;
END; $$;

CREATE OR REPLACE FUNCTION public.debit_user(
  _user_id UUID, _amount BIGINT, _kind TEXT, _note TEXT, _key TEXT
) RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_balance BIGINT; cur BIGINT;
BEGIN
  IF _amount <= 0 THEN RAISE EXCEPTION 'invalid amount'; END IF;
  IF _key IS NOT NULL AND EXISTS (SELECT 1 FROM transactions WHERE idempotency_key = _key) THEN
    SELECT balance INTO new_balance FROM app_users WHERE id = _user_id;
    RETURN new_balance;
  END IF;
  SELECT balance INTO cur FROM app_users WHERE id = _user_id FOR UPDATE;
  IF cur IS NULL OR cur < _amount THEN RAISE EXCEPTION 'insufficient balance'; END IF;
  INSERT INTO transactions (user_id, kind, amount, note, idempotency_key)
  VALUES (_user_id, _kind, -_amount, _note, _key);
  PERFORM set_config('foxfarm.ledger', 'on', true);
  UPDATE app_users SET balance = balance - _amount WHERE id = _user_id
  RETURNING balance INTO new_balance;
  PERFORM set_config('foxfarm.ledger', 'off', true);
  RETURN new_balance;
END; $$;

-- 5) Atomic daily claim (also fixes the NULL last_daily_date race)
CREATE OR REPLACE FUNCTION public.claim_daily_v1(_user_id UUID, _rewards BIGINT[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE u app_users%ROWTYPE; today DATE := (now() AT TIME ZONE 'utc')::date; nd INT; rw BIGINT; bal BIGINT;
BEGIN
  SELECT * INTO u FROM app_users WHERE id = _user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'no user'; END IF;
  IF u.suspended THEN RAISE EXCEPTION 'SUSPENDED'; END IF;
  IF u.last_daily_date = today THEN RAISE EXCEPTION 'Already claimed today'; END IF;
  IF u.last_daily_date = today - 1
    THEN nd := (u.streak_day % array_length(_rewards, 1)) + 1;
    ELSE nd := 1;
  END IF;
  rw := _rewards[nd];
  UPDATE app_users SET streak_day = nd, last_daily_date = today WHERE id = _user_id;
  bal := credit_user(_user_id, rw, 'daily', 'Daily reward day ' || nd, 'daily:' || _user_id || ':' || today);
  RETURN jsonb_build_object('reward', rw, 'day', nd, 'balance', bal);
END; $$;

-- 6) Atomic reward-code claim
CREATE OR REPLACE FUNCTION public.claim_reward_code_v1(_user_id UUID, _code TEXT)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c reward_codes%ROWTYPE; bal BIGINT;
BEGIN
  SELECT * INTO c FROM reward_codes WHERE code = _code FOR UPDATE;
  IF NOT FOUND OR NOT c.active THEN RAISE EXCEPTION 'Invalid code'; END IF;
  IF c.expires_at IS NOT NULL AND c.expires_at < now() THEN RAISE EXCEPTION 'This code has expired'; END IF;
  IF c.max_uses > 0 AND c.uses >= c.max_uses THEN RAISE EXCEPTION 'This code is fully used'; END IF;
  IF EXISTS (SELECT 1 FROM reward_code_claims WHERE code = _code AND user_id = _user_id) THEN
    RAISE EXCEPTION 'You already used this code';
  END IF;
  INSERT INTO reward_code_claims (code, user_id) VALUES (_code, _user_id);
  UPDATE reward_codes SET uses = uses + 1 WHERE code = _code;
  bal := credit_user(_user_id, c.amount, 'reward_code', 'Reward code ' || _code, 'code:' || _code || ':' || _user_id);
  RETURN jsonb_build_object('reward', c.amount, 'balance', bal);
END; $$;

-- 7) Atomic mining claim
CREATE OR REPLACE FUNCTION public.claim_mining_v1(_user_id UUID, _duration_minutes INT, _reward BIGINT)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE u app_users%ROWTYPE; bal BIGINT; k TEXT;
BEGIN
  SELECT * INTO u FROM app_users WHERE id = _user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'no user'; END IF;
  IF u.suspended THEN RAISE EXCEPTION 'SUSPENDED'; END IF;
  IF u.mining_started_at IS NULL OR u.mining_claimed THEN RAISE EXCEPTION 'Nothing to claim'; END IF;
  IF now() - u.mining_started_at < make_interval(mins => _duration_minutes) THEN
    RAISE EXCEPTION 'Mining is still running';
  END IF;
  k := 'mining:' || _user_id || ':' || u.mining_started_at;
  UPDATE app_users SET mining_claimed = true, mining_started_at = NULL WHERE id = _user_id;
  bal := credit_user(_user_id, _reward, 'mining', 'Hourly mining', k);
  RETURN jsonb_build_object('reward', _reward, 'balance', bal);
END; $$;

-- 8) Atomic mining start
CREATE OR REPLACE FUNCTION public.start_mining_v1(_user_id UUID)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE u app_users%ROWTYPE;
BEGIN
  SELECT * INTO u FROM app_users WHERE id = _user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'no user'; END IF;
  IF u.suspended THEN RAISE EXCEPTION 'SUSPENDED'; END IF;
  IF u.mining_started_at IS NOT NULL AND NOT u.mining_claimed THEN
    RAISE EXCEPTION 'Mining is already running';
  END IF;
  UPDATE app_users SET mining_started_at = now(), mining_claimed = false WHERE id = _user_id;
  RETURN true;
END; $$;

-- 9) These helpers are server-only: no RLS policy references them.
REVOKE ALL ON FUNCTION public.rl_hit(text, text, int, int) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.credit_user(uuid, bigint, text, text, text) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.debit_user(uuid, bigint, text, text, text) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.claim_daily_v1(uuid, bigint[]) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.claim_reward_code_v1(uuid, text) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.claim_mining_v1(uuid, int, bigint) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.start_mining_v1(uuid) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.rl_hit(text, text, int, int) FROM authenticated;
REVOKE ALL ON FUNCTION public.credit_user(uuid, bigint, text, text, text) FROM authenticated;
REVOKE ALL ON FUNCTION public.debit_user(uuid, bigint, text, text, text) FROM authenticated;
REVOKE ALL ON FUNCTION public.claim_daily_v1(uuid, bigint[]) FROM authenticated;
REVOKE ALL ON FUNCTION public.claim_reward_code_v1(uuid, text) FROM authenticated;
REVOKE ALL ON FUNCTION public.claim_mining_v1(uuid, int, bigint) FROM authenticated;
REVOKE ALL ON FUNCTION public.start_mining_v1(uuid) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.rl_hit(text, text, int, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.credit_user(uuid, bigint, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.debit_user(uuid, bigint, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_daily_v1(uuid, bigint[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_reward_code_v1(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_mining_v1(uuid, int, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.start_mining_v1(uuid) TO service_role;