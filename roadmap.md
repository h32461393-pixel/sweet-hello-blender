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
- [x] Build real referral data, personal invite links, history and secure reward claims
- [x] Refresh the app palette and navigation surface
- Rotate the bot token and keys that were pasted in chat

## Reliability fixes (done)
- [x] Keep Profile and Refer available when referral-stage refresh is unavailable
- [x] Remove the fragile embedded referral-name relationship query
- [x] Fall back to a text welcome when the Telegram banner cannot be delivered
- [x] Log safe Telegram API errors for webhook diagnosis
- [x] Document every required self-hosted database update in execution order
- [x] Verify referral, ads and withdrawal database functions exist on the connected backend

## Sept 24 request
- [x] Clear save errors (missing database updates / wrong server key are now named)
- [x] One wallet address = one account (also past withdrawal addresses)
- [x] Same device => auto-suspend; same device/network referrals => fake, no reward
- [x] Auto-suspend when balance does not match the ledger
- [x] Suspended screen with reason only
- [x] Payout proof link points to the Vercel site
- [ ] Real ad network logos; remove "Visit sites" ads
- [ ] Admin: saved reward codes list, per-user full activity view
- [ ] Bot: daily reminder + mining-ready notification (needs a scheduled job)
- [ ] /start on Vercel: re-register webhook to the Vercel domain (user step)
