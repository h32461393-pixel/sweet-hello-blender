-- Fox Farm repair for failed updates 0002, 0004 and 0005.
-- Prerequisite: run 0000_fox_farm_core.sql and 0001_security_hardening.sql first.
-- This file is safe to run again after a partially completed attempt.

CREATE TABLE IF NOT EXISTS public.ad_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  day DATE NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  reward BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ad_views_user_day
  ON public.ad_views(user_id, day);
CREATE INDEX IF NOT EXISTS idx_ad_views_created
  ON public.ad_views(user_id, created_at DESC);

GRANT ALL ON public.ad_views TO service_role;
ALTER TABLE public.ad_views ENABLE ROW LEVEL SECURITY;

INSERT INTO public.app_config(key, value)
VALUES (
  'ads',
  '{"ad_reward":5,"ad_daily_cap":25,"ad_cooldown_seconds":30,"site_reward":10,"site_daily_cap":4,"site_cooldown_seconds":60}'::jsonb
)
ON CONFLICT (key) DO NOTHING;

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

  SELECT count(*) INTO _used
  FROM public.ad_views
  WHERE user_id = _user_id AND day = _today AND source = _source;
  IF _used >= _daily_cap THEN RAISE EXCEPTION 'Daily limit reached'; END IF;

  SELECT max(created_at) INTO _last
  FROM public.ad_views
  WHERE user_id = _user_id AND source = _source;
  IF _last IS NOT NULL AND _last > now() - make_interval(secs => _cooldown_seconds) THEN
    RAISE EXCEPTION 'Please wait a moment';
  END IF;

  INSERT INTO public.ad_views(user_id, source, day, reward)
  VALUES (_user_id, _source, _today, _reward)
  RETURNING id INTO _view_id;

  PERFORM public.credit_user(
    _user_id,
    _reward,
    CASE WHEN _source = 'site' THEN 'site_visit' ELSE 'ad_view' END,
    'Rewarded ' || _source,
    'ad:' || _view_id::text
  );

  SELECT balance INTO _balance FROM public.app_users WHERE id = _user_id;
  RETURN jsonb_build_object(
    'reward', _reward,
    'balance', _balance,
    'used', _used + 1,
    'cap', _daily_cap
  );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_ad_view_v1(UUID, TEXT, BIGINT, INT, INT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_ad_view_v1(UUID, TEXT, BIGINT, INT, INT)
  TO service_role;

CREATE OR REPLACE FUNCTION public.refresh_referral_stages_v1(
  _referrer_id UUID,
  _day1_reward BIGINT,
  _day2_reward BIGINT
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _day1_reward < 0 OR _day1_reward > 10000000
     OR _day2_reward < 0 OR _day2_reward > 10000000 THEN
    RAISE EXCEPTION 'invalid amount';
  END IF;

  WITH eligible AS (
    SELECT
      r.id,
      (SELECT count(*) FROM public.ad_views av
       WHERE av.user_id = r.referee_id
         AND av.day = (r.created_at AT TIME ZONE 'utc')::date) >= 10 AS day1_ready,
      (SELECT count(*) FROM public.ad_views av
       WHERE av.user_id = r.referee_id
         AND av.day = ((r.created_at AT TIME ZONE 'utc')::date + 1)) >= 15 AS day2_ready
    FROM public.referrals r
    JOIN public.app_users referee ON referee.id = r.referee_id
    WHERE r.referrer_id = _referrer_id
      AND NOT r.fake
      AND NOT referee.suspended
  )
  UPDATE public.referrals r
  SET
    pending_reward = r.pending_reward
      + CASE WHEN e.day1_ready AND NOT r.stage_day1 THEN _day1_reward ELSE 0 END
      + CASE WHEN e.day2_ready AND NOT r.stage_day2 THEN _day2_reward ELSE 0 END,
    stage_day1 = r.stage_day1 OR e.day1_ready,
    stage_day2 = r.stage_day2 OR e.day2_ready,
    status = CASE
      WHEN r.pending_reward
        + CASE WHEN e.day1_ready AND NOT r.stage_day1 THEN _day1_reward ELSE 0 END
        + CASE WHEN e.day2_ready AND NOT r.stage_day2 THEN _day2_reward ELSE 0 END > 0
      THEN 'pending'
      ELSE r.status
    END
  FROM eligible e
  WHERE r.id = e.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_referral_rewards_v1(
  _referrer_id UUID,
  _day1_reward BIGINT,
  _day2_reward BIGINT
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  amount BIGINT;
  bal BIGINT;
  claim_key TEXT;
BEGIN
  PERFORM 1
  FROM public.app_users
  WHERE id = _referrer_id AND NOT suspended
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SUSPENDED'; END IF;

  PERFORM public.refresh_referral_stages_v1(
    _referrer_id,
    _day1_reward,
    _day2_reward
  );

  -- Lock rows separately. FOR UPDATE is invalid on an aggregate sum query.
  PERFORM id
  FROM public.referrals
  WHERE referrer_id = _referrer_id
    AND NOT fake
    AND pending_reward > 0
  FOR UPDATE;

  SELECT COALESCE(sum(pending_reward), 0)::BIGINT
  INTO amount
  FROM public.referrals
  WHERE referrer_id = _referrer_id
    AND NOT fake
    AND pending_reward > 0;

  IF amount <= 0 THEN RAISE EXCEPTION 'Nothing to claim'; END IF;

  claim_key := 'referral:' || _referrer_id || ':' || gen_random_uuid();

  UPDATE public.referrals
  SET pending_reward = 0,
      status = 'paid'
  WHERE referrer_id = _referrer_id
    AND NOT fake
    AND pending_reward > 0;

  bal := public.credit_user(
    _referrer_id,
    amount,
    'referral',
    'Referral rewards',
    claim_key
  );

  RETURN jsonb_build_object('reward', amount, 'balance', bal);
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_referral_stages_v1(UUID, BIGINT, BIGINT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_referral_rewards_v1(UUID, BIGINT, BIGINT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_referral_stages_v1(UUID, BIGINT, BIGINT)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_referral_rewards_v1(UUID, BIGINT, BIGINT)
  TO service_role;