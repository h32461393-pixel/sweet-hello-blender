-- Core schema for Fox Farm. All access happens through trusted server functions
-- using the service role; no direct client access is granted.

CREATE TABLE public.app_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id BIGINT NOT NULL UNIQUE,
  username TEXT,
  first_name TEXT,
  last_name TEXT,
  photo_url TEXT,
  language_code TEXT,
  balance BIGINT NOT NULL DEFAULT 0,
  total_earned BIGINT NOT NULL DEFAULT 0,
  suspended BOOLEAN NOT NULL DEFAULT FALSE,
  suspend_reason TEXT,
  wallet_address TEXT UNIQUE,
  streak_day INT NOT NULL DEFAULT 0,
  last_daily_date DATE,
  mining_started_at TIMESTAMPTZ,
  mining_claimed BOOLEAN NOT NULL DEFAULT TRUE,
  referred_by UUID REFERENCES public.app_users(id) ON DELETE SET NULL,
  signup_ip TEXT,
  device_hash TEXT,
  withdrawal_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_app_users_referred_by ON public.app_users(referred_by);
CREATE INDEX idx_app_users_device ON public.app_users(device_hash);
CREATE INDEX idx_app_users_ip ON public.app_users(signup_ip);
GRANT ALL ON public.app_users TO service_role;
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  amount BIGINT NOT NULL,
  note TEXT,
  idempotency_key TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tx_user ON public.transactions(user_id, created_at DESC);
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.app_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.app_config TO service_role;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

INSERT INTO public.app_config (key, value) VALUES
  ('mining', '{"reward":100,"duration_minutes":60}'::jsonb),
  ('daily', '{"rewards":[30,40,50,70,90,120,150]}'::jsonb),
  ('referral', '{"join":200,"day1":400,"day2":600,"daily_refer":250}'::jsonb),
  ('channels', '{"community":"https://t.me/foxfarm_community","payment":"https://t.me/foxfarmpay","community_chat":"@foxfarm_community","payment_chat":"@foxfarmpay"}'::jsonb),
  ('withdraw', '{"first_min":10000,"next_min":20000,"fee_flat":0.01,"fee_percent":5,"tokens_per_usd":100000}'::jsonb),
  ('daily_task_reward', '{"channel":50}'::jsonb);

CREATE TABLE public.reward_codes (
  code TEXT PRIMARY KEY,
  amount BIGINT NOT NULL,
  max_uses INT NOT NULL DEFAULT 0,
  uses INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.reward_codes TO service_role;
ALTER TABLE public.reward_codes ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.reward_code_claims (
  code TEXT NOT NULL REFERENCES public.reward_codes(code) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (code, user_id)
);
GRANT ALL ON public.reward_code_claims TO service_role;
ALTER TABLE public.reward_code_claims ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section TEXT NOT NULL DEFAULT 'main',
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  reward BIGINT NOT NULL DEFAULT 0,
  verify_type TEXT NOT NULL DEFAULT 'timer',
  chat_username TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.task_completions (
  task_key TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  day DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (task_key, user_id, day)
);
GRANT ALL ON public.task_completions TO service_role;
ALTER TABLE public.task_completions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  referee_id UUID NOT NULL UNIQUE REFERENCES public.app_users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  pending_reward BIGINT NOT NULL DEFAULT 0,
  stage_join BOOLEAN NOT NULL DEFAULT FALSE,
  stage_day1 BOOLEAN NOT NULL DEFAULT FALSE,
  stage_day2 BOOLEAN NOT NULL DEFAULT FALSE,
  fake BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_referrals_referrer ON public.referrals(referrer_id);
GRANT ALL ON public.referrals TO service_role;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  amount_tokens BIGINT NOT NULL,
  gross_usd NUMERIC(12,4) NOT NULL,
  fee_usd NUMERIC(12,4) NOT NULL,
  net_usd NUMERIC(12,4) NOT NULL,
  address TEXT NOT NULL,
  seq INT NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending',
  txid TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);
CREATE INDEX idx_withdrawals_user ON public.withdrawals(user_id, created_at DESC);
CREATE INDEX idx_withdrawals_status ON public.withdrawals(status);
GRANT ALL ON public.withdrawals TO service_role;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.admin_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_telegram_id BIGINT NOT NULL,
  action TEXT NOT NULL,
  target TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.admin_audit TO service_role;
ALTER TABLE public.admin_audit ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.rate_limits (
  bucket TEXT NOT NULL,
  subject TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  count INT NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, subject)
);
GRANT ALL ON public.rate_limits TO service_role;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Atomic balance credit with idempotency
CREATE OR REPLACE FUNCTION public.credit_user(
  _user_id UUID, _amount BIGINT, _kind TEXT, _note TEXT, _key TEXT
) RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE new_balance BIGINT;
BEGIN
  IF _amount <= 0 THEN
    RAISE EXCEPTION 'invalid amount';
  END IF;
  IF _key IS NOT NULL AND EXISTS (SELECT 1 FROM transactions WHERE idempotency_key = _key) THEN
    SELECT balance INTO new_balance FROM app_users WHERE id = _user_id;
    RETURN new_balance;
  END IF;
  INSERT INTO transactions (user_id, kind, amount, note, idempotency_key)
  VALUES (_user_id, _kind, _amount, _note, _key);
  UPDATE app_users
    SET balance = balance + _amount, total_earned = total_earned + _amount
    WHERE id = _user_id
    RETURNING balance INTO new_balance;
  RETURN new_balance;
END;
$$;