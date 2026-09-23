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

  PERFORM id
    FROM referrals
   WHERE referrer_id = _referrer_id
     AND NOT fake
     AND pending_reward > 0
   FOR UPDATE;

  SELECT COALESCE(sum(pending_reward), 0)::BIGINT
    INTO amount
    FROM referrals
   WHERE referrer_id = _referrer_id
     AND NOT fake
     AND pending_reward > 0;

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

REVOKE ALL ON FUNCTION public.claim_referral_rewards_v1(uuid, bigint, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_referral_rewards_v1(uuid, bigint, bigint) TO service_role;