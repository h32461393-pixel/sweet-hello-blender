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
- [x] Add a rerunnable repair script for failed SQL updates 0002, 0004 and 0005

## Sept 24 request
- [x] Clear save errors (missing database updates / wrong server key are now named)
- [x] One wallet address = one account (also past withdrawal addresses)
- [x] Same device => auto-suspend; same device/network referrals => fake, no reward
- [x] Auto-suspend when balance does not match the ledger
- [x] Suspended screen with reason only
- [x] Payout proof link points to the Vercel site
- [x] Real ad network logos; remove "Visit sites" ads
- [x] Admin: saved reward codes list, per-user full activity view, suspend reason
- [x] Bot: daily reminder + mining-ready notification (user sets up cron-job.org)
- [x] /start on Vercel: webhook points to the Vercel domain, no delivery errors (checked Oct 3)
- [x] Ad networks temporarily disabled until Adsgram approval (re-enable: AD_NETWORKS_ENABLED + adsgram script in __root)

## Oct 2 request
- [x] Show verified payout summary and recent completed payouts at the bottom of Home
- [x] Point the withdrawal notification's admin button to the requested Telegram Mini App link
- [x] Keep the theme toggle in the Home header only, clear of balances and other tabs

## Oct 3 request — Ads back + pro upgrade
- [x] Re-enable ads: Adsgram reward 51743 / int-51744, Monetag, GigaPub, Monetix; no reward when no ad, "Try again"
- [x] Ads tab: per-network total tokens/$ summary, daily reset countdown, 5s cooldown on all buttons after an ad, reward popup
- [x] Ads on mining start/claim, reward code, referral claim (random); Adsgram int on app open and every Home visit
- [x] Withdraw flow: requirements (30 daily ads, 2 referrals, 2 daily tasks, min $0.05 / max $0.5, admin-editable) → 2 Adsgram ads → verify activity → open or auto-suspend fake
- [x] Fix Visit sites "could not verify" (reward not added)
- [x] Admin Settings tab: all values, withdrawals on/off, maintenance mode (admin exempt), changes reflected live in app
- [x] Admin Users split Active / Suspended; better Overview with online users
- [x] Broadcast to all users + community channel, HTML, buttons, links, image
- [x] Partner channels admin: add, bot-admin check, post (HTML+image, refer button), link edit, delete
