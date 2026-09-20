# Roadmap

- [x] Confirm the reported mobile hook TypeScript error is absent
- [x] Configure the production bundle for Vercel
- [x] Add a safe environment variable template
- [x] Add a Sinhala free-backend and Vercel deployment guide
- [x] Require Telegram webhook authentication
- [x] Validate formatting and check for committed secrets

## Security hardening (done)
- DB: anon/authenticated revoked on all tables and coin functions (service role only)
- Balance can only change through credit_user/debit_user (DB trigger blocks any other write)
- Atomic RPCs: start_mining_v1, claim_mining_v1, claim_daily_v1, claim_reward_code_v1 (no race/double-claim)
- Rate limits (rl_hit) on sync, home, mining, daily, tasks, reward codes (8/hour brute-force cap)
- Strict input validation on every server function; DB errors never leak to the client
- Admin gate: owner Telegram id + ADMIN_PANEL_USER / ADMIN_PANEL_PASSWORD secrets (never in code)

## Open
- [x] Store ADMIN_PANEL_USER / ADMIN_PANEL_PASSWORD as encrypted server secrets
- Rotate the bot token and keys that were pasted in chat
