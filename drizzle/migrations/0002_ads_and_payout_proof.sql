CREATE TABLE public.ad_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  day DATE NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  reward BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ad_views_user_day ON public.ad_views(user_id, day);
CREATE INDEX idx_ad_views_created ON public.ad_views(user_id, created_at DESC);
GRANT ALL ON public.ad_views TO service_role;
ALTER TABLE public.ad_views ENABLE ROW LEVEL SECURITY;

INSERT INTO public.app_config(key, value) VALUES
  ('ads', '{"ad_reward":5,"ad_daily_cap":25,"ad_cooldown_seconds":30,"site_reward":10,"site_daily_cap":4,"site_cooldown_seconds":60}'::jsonb)
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
  IF _source NOT IN ('adsgram', 'site') THEN
    RAISE EXCEPTION 'Invalid request';
  END IF;
  IF _reward < 1 OR _reward > 100 THEN
    RAISE EXCEPTION 'Invalid request';
  END IF;

  PERFORM 1 FROM public.app_users WHERE id = _user_id AND suspended FOR UPDATE;
  IF FOUND THEN
    RAISE EXCEPTION 'SUSPENDED';
  END IF;

  SELECT count(*) INTO _used
  FROM public.ad_views
  WHERE user_id = _user_id AND day = _today AND source = _source;

  IF _used >= _daily_cap THEN
    RAISE EXCEPTION 'Daily limit reached';
  END IF;

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
    CASE WHEN _source = 'adsgram' THEN 'ad_view' ELSE 'site_visit' END,
    'Rewarded ' || _source,
    'ad:' || _view_id::text
  );

  SELECT balance INTO _balance FROM public.app_users WHERE id = _user_id;

  RETURN jsonb_build_object('reward', _reward, 'balance', _balance, 'used', _used + 1, 'cap', _daily_cap);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_ad_view_v1(UUID, TEXT, BIGINT, INT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_ad_view_v1(UUID, TEXT, BIGINT, INT, INT) TO service_role;