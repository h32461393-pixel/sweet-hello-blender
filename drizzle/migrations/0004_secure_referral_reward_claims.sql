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
  IF _day1_reward < 0 OR _day1_reward > 10000000 OR _day2_reward < 0 OR _day2_reward > 10000000 THEN
    RAISE EXCEPTION 'invalid amount';
  END IF;

  WITH eligible AS (
    SELECT
      r.id,
      (SELECT count(*) FROM ad_views av
       WHERE av.user_id = r.referee_id
         AND av.day = (r.created_at AT TIME ZONE 'utc')::date) >= 10 AS day1_ready,
      (SELECT count(*) FROM ad_views av
       WHERE av.user_id = r.referee_id
         AND av.day = ((r.created_at AT TIME ZONE 'utc')::date + 1)) >= 15 AS day2_ready
    FROM referrals r
    JOIN app_users referee ON referee.id = r.referee_id
    WHERE r.referrer_id = _referrer_id
      AND NOT r.fake
      AND NOT referee.suspended
  )
  UPDATE referrals r
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
  PERFORM 1 FROM app_users WHERE id = _referrer_id AND NOT suspended FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SUSPENDED'; END IF;

  PERFORM refresh_referral_stages_v1(_referrer_id, _day1_reward, _day2_reward);

  SELECT COALESCE(sum(pending_reward), 0)::BIGINT
    INTO amount
    FROM referrals
   WHERE referrer_id = _referrer_id
     AND NOT fake
     AND pending_reward > 0
   FOR UPDATE;

  IF amount <= 0 THEN RAISE EXCEPTION 'Nothing to claim'; END IF;

  claim_key := 'referral:' || _referrer_id || ':' || gen_random_uuid();

  UPDATE referrals
     SET pending_reward = 0,
         status = 'paid'
   WHERE referrer_id = _referrer_id
     AND NOT fake
     AND pending_reward > 0;

  bal := credit_user(
    _referrer_id,
    amount,
    'referral',
    'Referral rewards',
    claim_key
  );

  RETURN jsonb_build_object('reward', amount, 'balance', bal);
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_referral_stages_v1(uuid, bigint, bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_referral_rewards_v1(uuid, bigint, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_referral_stages_v1(uuid, bigint, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_referral_rewards_v1(uuid, bigint, bigint) TO service_role;