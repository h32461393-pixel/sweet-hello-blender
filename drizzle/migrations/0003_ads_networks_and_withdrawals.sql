ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS icon_url TEXT;

INSERT INTO public.app_config(key, value) VALUES ('ads', '{}'::jsonb)
ON CONFLICT (key) DO NOTHING;

UPDATE public.app_config SET value = jsonb_build_object(
  'networks', jsonb_build_object(
    'adsgram',     jsonb_build_object('label','Adsgram Reward','reward',40,'cap',10,'cooldown',30,'logo',''),
    'adsgram_int', jsonb_build_object('label','Adsgram Interstitial','reward',40,'cap',10,'cooldown',30,'logo',''),
    'monetag',     jsonb_build_object('label','Monetag','reward',30,'cap',10,'cooldown',30,'logo',''),
    'gigapub',     jsonb_build_object('label','GigaPub','reward',30,'cap',10,'cooldown',30,'logo','')
  ),
  'site_reward', 10,
  'site_daily_cap', 4,
  'site_cooldown_seconds', 60
), updated_at = now()
WHERE key = 'ads';

CREATE OR REPLACE FUNCTION public.claim_ad_view_v1(
  _user_id UUID,
  _source TEXT,
  _reward BIGINT,
  _daily_cap INT,
  _cooldown_seconds INT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _today DATE := (now() AT TIME ZONE 'utc')::date;
  _used INT;
  _last TIMESTAMPTZ;
  _view_id UUID;
  _balance BIGINT;
BEGIN
  IF _source NOT IN ('adsgram', 'adsgram_int', 'monetag', 'gigapub', 'site') THEN
    RAISE EXCEPTION 'Invalid request';
  END IF;
  IF _reward < 1 OR _reward > 1000 THEN RAISE EXCEPTION 'Invalid request'; END IF;
  IF _daily_cap < 0 OR _daily_cap > 500 THEN RAISE EXCEPTION 'Invalid request'; END IF;

  PERFORM 1 FROM public.app_users WHERE id = _user_id AND suspended FOR UPDATE;
  IF FOUND THEN RAISE EXCEPTION 'SUSPENDED'; END IF;

  SELECT count(*) INTO _used FROM public.ad_views
  WHERE user_id = _user_id AND day = _today AND source = _source;
  IF _used >= _daily_cap THEN RAISE EXCEPTION 'Daily limit reached'; END IF;

  SELECT max(created_at) INTO _last FROM public.ad_views
  WHERE user_id = _user_id AND source = _source;
  IF _last IS NOT NULL AND _last > now() - make_interval(secs => _cooldown_seconds) THEN
    RAISE EXCEPTION 'Please wait a moment';
  END IF;

  INSERT INTO public.ad_views(user_id, source, day, reward)
  VALUES (_user_id, _source, _today, _reward) RETURNING id INTO _view_id;

  PERFORM public.credit_user(
    _user_id, _reward,
    CASE WHEN _source = 'site' THEN 'site_visit' ELSE 'ad_view' END,
    'Rewarded ' || _source, 'ad:' || _view_id::text);

  SELECT balance INTO _balance FROM public.app_users WHERE id = _user_id;
  RETURN jsonb_build_object('reward', _reward, 'balance', _balance, 'used', _used + 1, 'cap', _daily_cap);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_ad_view_v1(UUID, TEXT, BIGINT, INT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_ad_view_v1(UUID, TEXT, BIGINT, INT, INT) TO service_role;

CREATE OR REPLACE FUNCTION public.create_withdrawal_v1(
  _user_id UUID,
  _tokens BIGINT,
  _first_min BIGINT,
  _next_min BIGINT,
  _fee_flat NUMERIC,
  _fee_percent NUMERIC,
  _tokens_per_usd NUMERIC
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  u RECORD; _min BIGINT; _gross NUMERIC; _fee NUMERIC; _net NUMERIC; _id UUID; _seq BIGINT;
BEGIN
  SELECT * INTO u FROM public.app_users WHERE id = _user_id FOR UPDATE;
  IF u IS NULL THEN RAISE EXCEPTION 'Please reopen the app'; END IF;
  IF u.suspended THEN RAISE EXCEPTION 'SUSPENDED'; END IF;
  IF u.wallet_address IS NULL OR u.wallet_address !~ '^0x[0-9a-fA-F]{40}$' THEN
    RAISE EXCEPTION 'Add a valid BEP-20 wallet address first';
  END IF;
  IF EXISTS (SELECT 1 FROM public.withdrawals WHERE user_id = _user_id AND status = 'pending') THEN
    RAISE EXCEPTION 'You already have a pending withdrawal';
  END IF;

  _min := CASE WHEN u.withdrawal_count > 0 THEN _next_min ELSE _first_min END;
  IF _tokens < _min THEN RAISE EXCEPTION 'Minimum withdrawal is % FOX', _min; END IF;
  IF _tokens > u.balance THEN RAISE EXCEPTION 'insufficient balance'; END IF;

  _gross := round((_tokens::numeric / _tokens_per_usd)::numeric, 4);
  _fee   := round((_fee_flat + _gross * _fee_percent / 100)::numeric, 4);
  _net   := round((_gross - _fee)::numeric, 4);
  IF _net <= 0 THEN RAISE EXCEPTION 'Amount is too small after fees'; END IF;

  _id := gen_random_uuid();
  PERFORM public.debit_user(_user_id, _tokens, 'withdraw', 'Withdrawal request', 'wd:' || _id::text);

  INSERT INTO public.withdrawals(id, user_id, address, amount_tokens, gross_usd, fee_usd, net_usd, status)
  VALUES (_id, _user_id, u.wallet_address, _tokens, _gross, _fee, _net, 'pending')
  RETURNING seq INTO _seq;

  RETURN jsonb_build_object('id', _id, 'seq', _seq, 'gross', _gross, 'fee', _fee, 'net', _net,
                            'tokens', _tokens, 'address', u.wallet_address);
END;
$$;
REVOKE ALL ON FUNCTION public.create_withdrawal_v1(UUID, BIGINT, BIGINT, BIGINT, NUMERIC, NUMERIC, NUMERIC) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_withdrawal_v1(UUID, BIGINT, BIGINT, BIGINT, NUMERIC, NUMERIC, NUMERIC) TO service_role;

CREATE OR REPLACE FUNCTION public.process_withdrawal_v1(
  _withdrawal_id UUID, _action TEXT, _txid TEXT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE w RECORD;
BEGIN
  IF _action NOT IN ('paid', 'rejected') THEN RAISE EXCEPTION 'Invalid request'; END IF;
  SELECT * INTO w FROM public.withdrawals WHERE id = _withdrawal_id FOR UPDATE;
  IF w IS NULL THEN RAISE EXCEPTION 'Withdrawal not found'; END IF;
  IF w.status <> 'pending' THEN RAISE EXCEPTION 'Already processed'; END IF;

  IF _action = 'paid' THEN
    IF _txid IS NULL OR length(_txid) < 6 THEN RAISE EXCEPTION 'A transaction id is required'; END IF;
    UPDATE public.withdrawals SET status = 'paid', txid = _txid, processed_at = now() WHERE id = w.id;
    PERFORM set_config('foxfarm.ledger', 'on', true);
    UPDATE public.app_users SET withdrawal_count = withdrawal_count + 1 WHERE id = w.user_id;
    PERFORM set_config('foxfarm.ledger', 'off', true);
  ELSE
    UPDATE public.withdrawals SET status = 'rejected', processed_at = now() WHERE id = w.id;
    PERFORM public.credit_user(w.user_id, w.amount_tokens, 'refund', 'Withdrawal rejected',
                               'wdref:' || w.id::text);
  END IF;

  RETURN jsonb_build_object('id', w.id, 'seq', w.seq, 'status', _action, 'user_id', w.user_id,
                            'tokens', w.amount_tokens, 'net', w.net_usd, 'fee', w.fee_usd,
                            'gross', w.gross_usd, 'address', w.address, 'txid', _txid);
END;
$$;
REVOKE ALL ON FUNCTION public.process_withdrawal_v1(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_withdrawal_v1(UUID, TEXT, TEXT) TO service_role;