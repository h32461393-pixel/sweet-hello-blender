import { createServerFn } from "@tanstack/react-start";
import { rateLimit, clientIp } from "./security.server";
import { dbHint } from "./db-errors";
import { getRequest } from "@tanstack/react-start/server";

/** Strict validator: only a session string is accepted from the client. */
function vInit(d: { initData: string }) {
  if (typeof d?.initData !== "string" || !d.initData) throw new Error("Invalid session");
  return { initData: d.initData };
}

/** Turns a database error into a safe, user facing message. */
function rpcMessage(error: unknown, fallback: string): string {
  const msg = (error as { message?: string })?.message ?? "";
  if (/SUSPENDED/.test(msg)) return "SUSPENDED";
  const known = [
    "Already claimed today",
    "Nothing to claim",
    "Mining is still running",
    "Mining is already running",
    "Invalid code",
    "This code has expired",
    "This code is fully used",
    "You already used this code",
    "insufficient balance",
    "Daily limit reached",
    "Please wait a moment",
    "Add a valid BEP-20 wallet address first",
    "You already have a pending withdrawal",
    "Amount is too small after fees",
    "Please reopen the app",
    "already used by another account",
  ];
  const min = msg.match(/Minimum withdrawal is [\d,.]+ FOX/);
  if (min) return min[0];
  const hit = known.find((k) => msg.includes(k));
  if (hit) return hit;
  return dbHint(error) ?? fallback;
}


import { MINI_APP_URL, COMMUNITY_URL, PAYMENT_URL, ADMIN_TELEGRAM_ID, BANNER_URL } from "./constants";

type Ctx = Awaited<ReturnType<typeof loadCtx>>;

async function loadCtx(initData: string) {
  const { verifyInitData } = await import("./telegram.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { user, startParam } = verifyInitData(initData);
  return { tg: user, startParam, db: supabaseAdmin };
}

async function getConfig(db: Ctx["db"], key: string) {
  const { data } = await db.from("app_config").select("value").eq("key", key).maybeSingle();
  return (data?.value ?? {}) as Record<string, number | string | number[]>;
}

async function getUserRow(ctx: Ctx) {
  const { data } = await ctx.db.from("app_users").select("*").eq("telegram_id", ctx.tg.id).maybeSingle();
  if (!data) throw new Error("Please reopen the app");
  if (data.suspended) throw new Error("SUSPENDED");
  return data;
}

const todayUTC = () => new Date().toISOString().slice(0, 10);

function publicUser(u: Record<string, unknown>) {
  return {
    id: u["id"] as string,
    telegramId: Number(u["telegram_id"]),
    username: (u["username"] as string) ?? null,
    firstName: (u["first_name"] as string) ?? null,
    photoUrl: (u["photo_url"] as string) ?? null,
    balance: Number(u["balance"] ?? 0),
    totalEarned: Number(u["total_earned"] ?? 0),
    suspended: Boolean(u["suspended"]),
    suspendReason: (u["suspend_reason"] as string) ?? null,
    walletAddress: (u["wallet_address"] as string) ?? null,
    streakDay: Number(u["streak_day"] ?? 0),
    lastDailyDate: (u["last_daily_date"] as string) ?? null,
    miningStartedAt: (u["mining_started_at"] as string) ?? null,
    miningClaimed: Boolean(u["mining_claimed"]),
    isAdmin: Number(u["telegram_id"]) === ADMIN_TELEGRAM_ID,
  };
}

/** Verifies Telegram identity, creates the account on first open, applies referral. */
export const syncUser = createServerFn({ method: "POST" })
  .inputValidator((d: { initData: string; device?: string }) => {
    const base = vInit(d);
    const device = typeof d?.device === "string" && /^[a-f0-9]{16,64}$/.test(d.device) ? d.device : null;
    return { ...base, device };
  })
  .handler(async ({ data }) => {
    const ctx = await loadCtx(data.initData);
    await rateLimit(ctx.db, "sync", ctx.tg.id, 30, 60);
    const { sendPhoto, sendMessage } = await import("./telegram.server");
    const db = ctx.db;


    let ip: string | null = null;
    try { ip = clientIp(getRequest().headers); } catch { ip = null; }
    if (ip === "unknown") ip = null;
    const existing = await db.from("app_users").select("*").eq("telegram_id", ctx.tg.id).maybeSingle();

    if (existing.data) {
      const ex = existing.data;
      const patch: Record<string, unknown> = {
        username: ctx.tg.username ?? null,
        first_name: ctx.tg.first_name ?? null,
        photo_url: ctx.tg.photo_url ?? null,
        last_seen_at: new Date().toISOString(),
      };
      if (!ex.device_hash && data.device) patch["device_hash"] = data.device;
      if (!ex.signup_ip && ip) patch["signup_ip"] = ip;
      // Auto-suspend: balance must always equal the ledger sum.
      if (!ex.suspended) {
        const led = await db.from("transactions").select("amount").eq("user_id", ex.id).limit(100000);
        if (!led.error) {
          const sum = (led.data ?? []).reduce((a, r) => a + Number(r.amount), 0);
          if (sum !== Number(ex.balance)) {
            patch["suspended"] = true;
            patch["suspend_reason"] = "Balance does not match your activity history.";
            await sendMessage(ADMIN_TELEGRAM_ID, `🚨 <b>Auto-suspended</b>\n🆔 <code>${ctx.tg.id}</code>\n⚖️ Balance ${ex.balance} ≠ ledger ${sum}`);
          }
        }
        if (data.device && !patch["suspended"]) {
          const twin = await db.from("app_users").select("id").eq("device_hash", data.device).neq("id", ex.id).limit(1);
          if ((twin.data?.length ?? 0) > 0 && ex.device_hash !== data.device) {
            patch["suspended"] = true;
            patch["suspend_reason"] = "Multiple accounts on the same device are not allowed.";
          }
        }
      }
      await db.from("app_users").update(patch).eq("id", ex.id);
      const fresh = await db.from("app_users").select("*").eq("id", existing.data.id).maybeSingle();
      return { user: publicUser(fresh.data ?? existing.data) };
    }

    const inserted = await db
      .from("app_users")
      .insert({
        telegram_id: ctx.tg.id,
        username: ctx.tg.username ?? null,
        first_name: ctx.tg.first_name ?? null,
        last_name: ctx.tg.last_name ?? null,
        photo_url: ctx.tg.photo_url ?? null,
        language_code: ctx.tg.language_code ?? null,
        signup_ip: ip,
        device_hash: data.device,
      })
      .select("*")
      .single();

    if (inserted.error || !inserted.data) throw new Error("Could not create your account");
    const me = inserted.data;

    // Anti-cheat: another account on this device => suspended; shared IP => fake referral.
    let sameDevice = false;
    let sameIpCount = 0;
    if (data.device) {
      const t = await db.from("app_users").select("id").eq("device_hash", data.device).neq("id", me.id).limit(1);
      sameDevice = (t.data?.length ?? 0) > 0;
    }
    if (ip) {
      const t = await db.from("app_users").select("id", { count: "exact", head: true }).eq("signup_ip", ip).neq("id", me.id);
      sameIpCount = t.count ?? 0;
    }
    if (sameDevice) {
      await db.from("app_users").update({ suspended: true, suspend_reason: "Multiple accounts on the same device are not allowed." }).eq("id", me.id);
      me.suspended = true;
      me.suspend_reason = "Multiple accounts on the same device are not allowed.";
    }

    // Referral (start_param = ref<telegram id>)
    const ref = ctx.startParam?.match(/^ref(\d+)$/);
    if (ref) {
      const refId = Number(ref[1]);
      if (refId !== ctx.tg.id) {
        const referrer = await db.from("app_users").select("id, telegram_id, suspended, signup_ip, device_hash").eq("telegram_id", refId).maybeSingle();
        if (referrer.data && !referrer.data.suspended) {
          const cfg = await getConfig(db, "referral");
          const joinReward = Number(cfg["join"] ?? 200);
          const fake =
            sameDevice ||
            sameIpCount >= 2 ||
            (!!ip && referrer.data.signup_ip === ip) ||
            (!!data.device && referrer.data.device_hash === data.device);
          await db.from("app_users").update({ referred_by: referrer.data.id }).eq("id", me.id);
          await db.from("referrals").insert({
            referrer_id: referrer.data.id,
            referee_id: me.id,
            status: fake ? "fake" : "pending",
            pending_reward: fake ? 0 : joinReward,
            stage_join: !fake,
            fake,
          });
          if (fake) {
            await sendMessage(referrer.data.telegram_id, `⚠️ <b>Referral marked as fake</b>\n👤 ${ctx.tg.first_name ?? "A user"} joined from the same device/network. No reward is given.`);
          } else await sendMessage(
            referrer.data.telegram_id,
            `🎉 <b>New referral!</b>\n👤 ${ctx.tg.first_name ?? "A friend"} joined using your link.\n🪙 ${joinReward} FOX is waiting in your Refer tab.`,
            [[{ text: "🦊 Open Mini App", url: MINI_APP_URL }]],
          );
        }
      }
    }

    await sendPhoto(
      ctx.tg.id,
      BANNER_URL,
      `🦊 <b>Welcome to Fox Farm!</b> 🌾\n\nStart mining FOX tokens every hour, complete tasks, invite friends and withdraw in USDT (BEP-20).\n\n🚜 Tap below to start farming!`,
      [
        [{ text: "🦊 Open Mini App", url: MINI_APP_URL }],
        [{ text: "📢 Community", url: COMMUNITY_URL }],
      ],
    );

    await sendMessage(
      ADMIN_TELEGRAM_ID,
      `🆕 <b>New user</b>\n👤 ${ctx.tg.first_name ?? ""} ${ctx.tg.username ? "(@" + ctx.tg.username + ")" : ""}\n🆔 <code>${ctx.tg.id}</code>`,
    );

    return { user: publicUser(me) };
  });

/** Everything the home screen needs. */
export const getHomeState = createServerFn({ method: "POST" })
  .inputValidator(vInit)
  .handler(async ({ data }) => {
    const ctx = await loadCtx(data.initData);
    await rateLimit(ctx.db, "home", ctx.tg.id, 120, 60);
    const u = await getUserRow(ctx);
    const mining = await getConfig(ctx.db, "mining");
    const daily = await getConfig(ctx.db, "daily");
    const dailyTask = await getConfig(ctx.db, "daily_task_reward");

    const today = todayUTC();
    const doneToday = await ctx.db
      .from("task_completions")
      .select("task_key")
      .eq("user_id", u.id)
      .eq("day", today);

    return {
      user: publicUser(u),
      mining: {
        reward: Number(mining["reward"] ?? 100),
        durationMinutes: Number(mining["duration_minutes"] ?? 60),
      },
      daily: {
        rewards: (daily["rewards"] as number[]) ?? [30, 40, 50, 70, 90, 120, 150],
        claimedToday: u.last_daily_date === today,
      },
      dailyTasks: {
        reward: Number(dailyTask["channel"] ?? 50),
        done: (doneToday.data ?? []).map((r) => r.task_key as string),
      },
      serverTime: new Date().toISOString(),
    };
  });

export const startMining = createServerFn({ method: "POST" })
  .inputValidator(vInit)
  .handler(async ({ data }) => {
    const ctx = await loadCtx(data.initData);
    await rateLimit(ctx.db, "mine_start", ctx.tg.id, 10, 60);
    const u = await getUserRow(ctx);
    const { error } = await ctx.db.rpc("start_mining_v1", { _user_id: u.id });
    if (error) throw new Error(rpcMessage(error, "Mining is already running"));
    return { ok: true };
  });

export const claimMining = createServerFn({ method: "POST" })
  .inputValidator(vInit)
  .handler(async ({ data }) => {
    const ctx = await loadCtx(data.initData);
    const { sendMessage } = await import("./telegram.server");
    await rateLimit(ctx.db, "mine_claim", ctx.tg.id, 10, 60);
    const u = await getUserRow(ctx);

    const cfg = await getConfig(ctx.db, "mining");
    const res = await ctx.db.rpc("claim_mining_v1", {
      _user_id: u.id,
      _duration_minutes: Number(cfg["duration_minutes"] ?? 60),
      _reward: Number(cfg["reward"] ?? 100),
    });
    if (res.error) throw new Error(rpcMessage(res.error, "Nothing to claim"));
    const out = res.data as { reward: number; balance: number };

    await sendMessage(
      ctx.tg.id,
      `⛏️ <b>Mining complete!</b>\n🪙 +${out.reward} FOX added to your balance.\n🌾 Start a new session to keep farming.`,
      [[{ text: "🦊 Open Mini App", url: MINI_APP_URL }]],
    );

    return { reward: Number(out.reward), balance: Number(out.balance) };
  });

export const claimDaily = createServerFn({ method: "POST" })
  .inputValidator(vInit)
  .handler(async ({ data }) => {
    const ctx = await loadCtx(data.initData);
    await rateLimit(ctx.db, "daily", ctx.tg.id, 10, 60);
    const u = await getUserRow(ctx);

    const cfg = await getConfig(ctx.db, "daily");
    const rewards = ((cfg["rewards"] as number[]) ?? [30, 40, 50, 70, 90, 120, 150]).map(Number);

    const res = await ctx.db.rpc("claim_daily_v1", { _user_id: u.id, _rewards: rewards });
    if (res.error) throw new Error(rpcMessage(res.error, "Already claimed today"));
    const out = res.data as { reward: number; day: number; balance: number };
    return { reward: Number(out.reward), day: Number(out.day), balance: Number(out.balance) };
  });

export const claimRewardCode = createServerFn({ method: "POST" })
  .inputValidator((d: { initData: string; code: string }) => {
    if (typeof d?.initData !== "string" || typeof d?.code !== "string") throw new Error("Invalid request");
    return { initData: d.initData, code: d.code };
  })
  .handler(async ({ data }) => {
    const ctx = await loadCtx(data.initData);
    // Brute-force protection: a code is a secret, so guessing is throttled hard.
    await rateLimit(ctx.db, "code", ctx.tg.id, 8, 3600);
    const u = await getUserRow(ctx);
    const code = data.code.trim().toUpperCase().slice(0, 40);
    if (!/^[A-Z0-9_-]{3,40}$/.test(code)) throw new Error("Invalid code");

    const res = await ctx.db.rpc("claim_reward_code_v1", { _user_id: u.id, _code: code });
    if (res.error) throw new Error(rpcMessage(res.error, "Invalid code"));
    const out = res.data as { reward: number; balance: number };
    return { reward: Number(out.reward), balance: Number(out.balance) };
  });

/** Daily channel tasks — membership is verified through the bot. */
export const claimChannelTask = createServerFn({ method: "POST" })
  .inputValidator((d: { initData: string; kind: "community" | "payment" }) => {
    if (typeof d?.initData !== "string") throw new Error("Invalid request");
    if (d?.kind !== "community" && d?.kind !== "payment") throw new Error("Invalid request");
    return { initData: d.initData, kind: d.kind };
  })
  .handler(async ({ data }) => {
    const ctx = await loadCtx(data.initData);
    const { isChatMember } = await import("./telegram.server");
    await rateLimit(ctx.db, "task", ctx.tg.id, 20, 300);
    const u = await getUserRow(ctx);
    const channels = await getConfig(ctx.db, "channels");
    const chat = String(channels[data.kind === "community" ? "community_chat" : "payment_chat"] ?? "");
    if (!chat) throw new Error("Channel is not configured");

    const member = await isChatMember(chat, ctx.tg.id);
    if (!member) throw new Error("NOT_JOINED");

    const today = todayUTC();
    const key = `daily_${data.kind}`;
    const ins = await ctx.db.from("task_completions").insert({ task_key: key, user_id: u.id, day: today });
    if (ins.error) throw new Error("Already claimed today");

    const cfg = await getConfig(ctx.db, "daily_task_reward");
    const reward = Number(cfg["channel"] ?? 50);
    const { data: balance } = await ctx.db.rpc("credit_user", {
      _user_id: u.id,
      _amount: reward,
      _kind: "task",
      _note: `Daily task ${data.kind}`,
      _key: `task:${key}:${u.id}:${today}`,
    });

    return { reward, balance: Number(balance ?? 0) };
  });

export const CHANNEL_LINKS = { community: COMMUNITY_URL, payment: PAYMENT_URL };

/* ---------------------------------------------------------------------------
 * Rewarded ads (Adsgram) and partner site visits.
 * Ads are always optional: no app feature is locked behind watching an ad,
 * and a reward is only paid after the ad provider reports a completed view.
 * ------------------------------------------------------------------------- */

export const AD_SOURCES = ["adsgram", "adsgram_int", "monetag", "gigapub"] as const;
export type AdSource = (typeof AD_SOURCES)[number];

type NetworkCfg = { label: string; reward: number; cap: number; cooldown: number; logo: string };
type AdsConfig = {
  networks: Record<string, NetworkCfg>;
  siteReward: number;
  siteDailyCap: number;
  siteCooldownSeconds: number;
};

const DEFAULT_NETWORKS: Record<AdSource, NetworkCfg> = {
  adsgram: { label: "Adsgram Reward", reward: 40, cap: 10, cooldown: 30, logo: "" },
  adsgram_int: { label: "Adsgram Interstitial", reward: 40, cap: 10, cooldown: 30, logo: "" },
  monetag: { label: "Monetag", reward: 30, cap: 10, cooldown: 30, logo: "" },
  gigapub: { label: "GigaPub", reward: 30, cap: 10, cooldown: 30, logo: "" },
};

async function adsConfig(db: Ctx["db"]): Promise<AdsConfig> {
  const c = (await getConfig(db, "ads")) as unknown as Record<string, unknown>;
  const raw = (c["networks"] ?? {}) as Record<string, Partial<NetworkCfg>>;
  const networks: Record<string, NetworkCfg> = {};
  for (const id of AD_SOURCES) {
    const d = DEFAULT_NETWORKS[id];
    const n = raw[id] ?? {};
    networks[id] = {
      label: String(n.label ?? d.label),
      reward: Number(n.reward ?? d.reward),
      cap: Number(n.cap ?? d.cap),
      cooldown: Number(n.cooldown ?? d.cooldown),
      logo: String(n.logo ?? ""),
    };
  }
  return {
    networks,
    siteReward: Number(c["site_reward"] ?? 10),
    siteDailyCap: Number(c["site_daily_cap"] ?? 4),
    siteCooldownSeconds: Number(c["site_cooldown_seconds"] ?? 60),
  };
}

/** Everything the Ads screen needs: limits, progress and today's earnings. */
export const getAdsState = createServerFn({ method: "POST" })
  .inputValidator(vInit)
  .handler(async ({ data }) => {
    const ctx = await loadCtx(data.initData);
    await rateLimit(ctx.db, "ads_state", ctx.tg.id, 60, 60);
    const u = await getUserRow(ctx);
    const cfg = await adsConfig(ctx.db);

    const today = todayUTC();
    const { data: rows } = await ctx.db
      .from("ad_views")
      .select("source, reward")
      .eq("user_id", u.id)
      .eq("day", today);

    const list = rows ?? [];
    const count = (s: string) => list.filter((r) => r.source === s).length;
    const earnedToday = list.reduce((sum, r) => sum + Number(r.reward ?? 0), 0);

    return {
      balance: Number(u.balance ?? 0),
      earnedToday,
      networks: AD_SOURCES.map((id) => ({
        id,
        label: cfg.networks[id]!.label,
        reward: cfg.networks[id]!.reward,
        cap: cfg.networks[id]!.cap,
        logo: cfg.networks[id]!.logo,
        used: count(id),
      })),
      site: { reward: cfg.siteReward, used: count("site"), cap: cfg.siteDailyCap },
    };
  });

/** Called only after the provider confirms the view; the server re-checks everything. */
export const claimAdView = createServerFn({ method: "POST" })
  .inputValidator((d: { initData: string; source: AdSource | "site" }) => {
    if (typeof d?.initData !== "string" || !d.initData) throw new Error("Invalid session");
    const ok = d?.source === "site" || (AD_SOURCES as readonly string[]).includes(d?.source);
    if (!ok) throw new Error("Invalid request");
    return { initData: d.initData, source: d.source };
  })
  .handler(async ({ data }) => {
    const ctx = await loadCtx(data.initData);
    await rateLimit(ctx.db, "ad_claim", ctx.tg.id, 80, 3600);
    const u = await getUserRow(ctx);
    const cfg = await adsConfig(ctx.db);
    const net = data.source === "site" ? null : cfg.networks[data.source];

    const res = await ctx.db.rpc("claim_ad_view_v1", {
      _user_id: u.id,
      _source: data.source,
      _reward: net ? net.reward : cfg.siteReward,
      _daily_cap: net ? net.cap : cfg.siteDailyCap,
      _cooldown_seconds: net ? net.cooldown : cfg.siteCooldownSeconds,
    });
    if (res.error) throw new Error(rpcMessage(res.error, "Could not verify this view"));
    const out = res.data as { reward: number; balance: number; used: number; cap: number };
    return {
      reward: Number(out.reward),
      balance: Number(out.balance),
      used: Number(out.used),
      cap: Number(out.cap),
    };
  });

/** Profile screen: user, recent transactions and referral overview. */
export const getProfileState = createServerFn({ method: "POST" })
  .inputValidator(vInit)
  .handler(async ({ data }) => {
    const ctx = await loadCtx(data.initData);
    await rateLimit(ctx.db, "profile", ctx.tg.id, 60, 60);
    const u = await getUserRow(ctx);

    const referralCfg = await getConfig(ctx.db, "referral");
    const refreshed = await ctx.db.rpc("refresh_referral_stages_v1", {
      _referrer_id: u.id,
      _day1_reward: Number(referralCfg["day1"] ?? 400),
      _day2_reward: Number(referralCfg["day2"] ?? 600),
    });
    // Older self-hosted databases may not have the latest referral RPC yet.
    // Profile data must remain available while that optional stage refresh is unavailable.
    if (refreshed.error) {
      console.error("[profile] referral stage refresh failed", refreshed.error);
    }

    const [tx, refs, referralTx] = await Promise.all([
      ctx.db
        .from("transactions")
        .select("id, kind, amount, note, created_at")
        .eq("user_id", u.id)
        .order("created_at", { ascending: false })
        .limit(30),
      ctx.db
        .from("referrals")
        .select("id, referee_id, status, pending_reward, stage_join, stage_day1, stage_day2, fake, created_at")
        .eq("referrer_id", u.id)
        .order("created_at", { ascending: false })
        .limit(50),
      ctx.db.from("transactions").select("amount").eq("user_id", u.id).eq("kind", "referral"),
    ]);

    if (tx.error || refs.error || referralTx.error) {
      console.error("[profile] data query failed", {
        transactions: tx.error,
        referrals: refs.error,
        referralTransactions: referralTx.error,
      });
      throw new Error("Could not load profile data");
    }

    const refList = refs.data ?? [];
    const refereeIds = refList.map((r) => r.referee_id as string);
    const refereeRows = refereeIds.length
      ? await ctx.db.from("app_users").select("id, username, first_name").in("id", refereeIds)
      : { data: [], error: null };
    if (refereeRows.error) {
      console.error("[profile] referral names query failed", refereeRows.error);
    }
    const refereeById = new Map(
      (refereeRows.data ?? []).map((row) => [
        row.id as string,
        { username: row.username as string | null, firstName: row.first_name as string | null },
      ]),
    );

    return {
      user: publicUser(u),
      transactions: (tx.data ?? []).map((r) => ({
        id: r.id as string,
        kind: r.kind as string,
        amount: Number(r.amount ?? 0),
        note: (r.note as string) ?? null,
        at: r.created_at as string,
      })),
      referrals: {
        count: refList.length,
        active: refList.filter((r) => !r.fake).length,
        pendingTotal: refList.reduce((n, r) => n + (r.status === "pending" ? Number(r.pending_reward ?? 0) : 0), 0),
        earnedTotal: (referralTx.data ?? []).reduce((n, r) => n + Number(r.amount ?? 0), 0),
        list: refList.map((r) => {
          const ru = refereeById.get(r.referee_id as string);
          return {
            id: r.id as string,
            name: ru?.username ? `@${ru.username}` : (ru?.firstName ?? "Fox farmer"),
            status: r.status as string,
            pending: Number(r.pending_reward ?? 0),
            stages: { join: !!r.stage_join, day1: !!r.stage_day1, day2: !!r.stage_day2 },
            fake: !!r.fake,
            at: r.created_at as string,
          };
        }),
      },
    };
  });

/** Claims every currently eligible referral reward in one locked transaction. */
export const claimReferralRewards = createServerFn({ method: "POST" })
  .inputValidator(vInit)
  .handler(async ({ data }) => {
    const ctx = await loadCtx(data.initData);
    await rateLimit(ctx.db, "ref_claim", ctx.tg.id, 10, 60);
    const u = await getUserRow(ctx);
    const cfg = await getConfig(ctx.db, "referral");
    const res = await ctx.db.rpc("claim_referral_rewards_v1", {
      _referrer_id: u.id,
      _day1_reward: Number(cfg["day1"] ?? 400),
      _day2_reward: Number(cfg["day2"] ?? 600),
    });
    if (res.error) throw new Error(rpcMessage(res.error, "Could not claim referral rewards"));
    const out = res.data as { reward: number; balance: number };
    return { reward: Number(out.reward), balance: Number(out.balance) };
  });

/** Save the user's USDT BEP-20 withdrawal address. */
export const setWallet = createServerFn({ method: "POST" })
  .inputValidator((d: { initData: string; address: string }) => {
    if (typeof d?.initData !== "string" || !d.initData) throw new Error("Invalid session");
    if (typeof d?.address !== "string") throw new Error("Invalid address");
    return { initData: d.initData, address: d.address.trim() };
  })
  .handler(async ({ data }) => {
    const ctx = await loadCtx(data.initData);
    await rateLimit(ctx.db, "wallet", ctx.tg.id, 10, 60);
    const u = await getUserRow(ctx);

    if (!/^0x[a-fA-F0-9]{40}$/.test(data.address)) {
      throw new Error("Enter a valid BEP-20 address starting with 0x");
    }

    const addr = data.address.toLowerCase();
    if (u.wallet_address && String(u.wallet_address).toLowerCase() === addr) return { ok: true, address: data.address };
    // One wallet = one account, forever: also blocks addresses used in past withdrawals.
    const [owner, usedWd] = await Promise.all([
      ctx.db.from("app_users").select("id").ilike("wallet_address", addr).neq("id", u.id).limit(1),
      ctx.db.from("withdrawals").select("id").ilike("address", addr).neq("user_id", u.id).limit(1),
    ]);
    if ((owner.data?.length ?? 0) > 0 || (usedWd.data?.length ?? 0) > 0) {
      throw new Error("This wallet address is already used by another account");
    }
    if (u.wallet_address && Number(u.withdrawal_count ?? 0) > 0) {
      const pend = await ctx.db.from("withdrawals").select("id").eq("user_id", u.id).eq("status", "pending").limit(1);
      if ((pend.data?.length ?? 0) > 0) throw new Error("You cannot change the wallet while a withdrawal is pending");
    }
    const { error } = await ctx.db.from("app_users").update({ wallet_address: data.address }).eq("id", u.id);
    if (error) {
      if (error.code === "23505") throw new Error("This wallet address is already used by another account");
      throw new Error(dbHint(error) ?? "Could not save the address");
    }
    return { ok: true, address: data.address };
  });

/** Public proof of payouts: paid withdrawals and a top earners leaderboard. */
export const getPayoutProof = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");

  const [paid, totals, top] = await Promise.all([
    db
      .from("withdrawals")
      .select("net_usd, amount_tokens, txid, processed_at, app_users(username, first_name)")
      .eq("status", "paid")
      .order("processed_at", { ascending: false })
      .limit(50),
    db.from("withdrawals").select("net_usd, status"),
    db
      .from("app_users")
      .select("username, first_name, total_earned")
      .eq("suspended", false)
      .order("total_earned", { ascending: false })
      .limit(20),
  ]);

  const mask = (u: { username?: string | null; first_name?: string | null } | null) => {
    const name = u?.username ? `@${u.username}` : (u?.first_name ?? "Fox farmer");
    return name.length > 4 ? `${name.slice(0, 4)}***` : name;
  };

  const all = totals.data ?? [];
  const sum = (s: string) =>
    all.filter((w) => w.status === s).reduce((n, w) => n + Number(w.net_usd ?? 0), 0);

  return {
    totalPaidUsd: Number(sum("paid").toFixed(4)),
    pendingUsd: Number(sum("pending").toFixed(4)),
    payouts: (paid.data ?? []).map((w) => ({
      user: mask((w as { app_users?: { username?: string | null; first_name?: string | null } }).app_users ?? null),
      usd: Number(w.net_usd ?? 0),
      tokens: Number(w.amount_tokens ?? 0),
      txid: (w.txid as string) ?? null,
      at: (w.processed_at as string) ?? null,
    })),
    leaderboard: (top.data ?? []).map((u, i) => ({
      rank: i + 1,
      user: mask(u),
      earned: Number(u.total_earned ?? 0),
    })),
  };
});

/** Withdrawal settings, merged with admin-editable config. */
const DEFAULT_WITHDRAW = {
  firstMin: 10000,
  nextMin: 20000,
  feeFlat: 0.01,
  feePercent: 5,
  tokensPerUsd: 100000,
};

async function withdrawConfig(db: Ctx["db"]) {
  const c = await getConfig(db, "withdraw");
  const n = (k: string, d: number) => (Number.isFinite(Number(c[k])) ? Number(c[k]) : d);
  return {
    firstMin: n("first_min", DEFAULT_WITHDRAW.firstMin),
    nextMin: n("next_min", DEFAULT_WITHDRAW.nextMin),
    feeFlat: n("fee_flat", DEFAULT_WITHDRAW.feeFlat),
    feePercent: n("fee_percent", DEFAULT_WITHDRAW.feePercent),
    tokensPerUsd: n("tokens_per_usd", DEFAULT_WITHDRAW.tokensPerUsd),
  };
}

/** Everything the Withdraw screen needs. */
export const getWithdrawState = createServerFn({ method: "POST" })
  .inputValidator(vInit)
  .handler(async ({ data }) => {
    const ctx = await loadCtx(data.initData);
    await rateLimit(ctx.db, "wd_state", ctx.tg.id, 60, 60);
    const u = await getUserRow(ctx);
    const cfg = await withdrawConfig(ctx.db);

    const { data: rows } = await ctx.db
      .from("withdrawals")
      .select("id, amount_tokens, gross_usd, fee_usd, net_usd, status, txid, created_at, processed_at")
      .eq("user_id", u.id)
      .order("created_at", { ascending: false })
      .limit(30);

    const list = rows ?? [];
    const done = Number((u as Record<string, unknown>)["withdrawal_count"] ?? 0);
    return {
      balance: Number(u.balance ?? 0),
      walletAddress: (u.wallet_address as string) ?? null,
      minTokens: done > 0 ? cfg.nextMin : cfg.firstMin,
      feeFlat: cfg.feeFlat,
      feePercent: cfg.feePercent,
      tokensPerUsd: cfg.tokensPerUsd,
      hasPending: list.some((w) => w.status === "pending"),
      history: list.map((w) => ({
        id: w.id as string,
        tokens: Number(w.amount_tokens ?? 0),
        gross: Number(w.gross_usd ?? 0),
        fee: Number(w.fee_usd ?? 0),
        net: Number(w.net_usd ?? 0),
        status: w.status as string,
        txid: (w.txid as string) ?? null,
        at: w.created_at as string,
      })),
    };
  });

/** Creates a pending withdrawal; all checks happen inside the database. */
export const createWithdrawal = createServerFn({ method: "POST" })
  .inputValidator((d: { initData: string; tokens: number }) => {
    if (typeof d?.initData !== "string" || !d.initData) throw new Error("Invalid session");
    const tokens = Math.floor(Number(d?.tokens));
    if (!Number.isFinite(tokens) || tokens <= 0 || tokens > 100_000_000) {
      throw new Error("Enter a valid amount");
    }
    return { initData: d.initData, tokens };
  })
  .handler(async ({ data }) => {
    const ctx = await loadCtx(data.initData);
    await rateLimit(ctx.db, "wd_create", ctx.tg.id, 5, 3600);
    const u = await getUserRow(ctx);
    const cfg = await withdrawConfig(ctx.db);

    const res = await ctx.db.rpc("create_withdrawal_v1", {
      _user_id: u.id,
      _tokens: data.tokens,
      _first_min: cfg.firstMin,
      _next_min: cfg.nextMin,
      _fee_flat: cfg.feeFlat,
      _fee_percent: cfg.feePercent,
      _tokens_per_usd: cfg.tokensPerUsd,
    });
    if (res.error) throw new Error(rpcMessage(res.error, "Could not create the withdrawal"));

    const out = res.data as { id: string; net_usd: number; gross_usd: number; fee_usd: number };
    try {
      const { sendMessage } = await import("./telegram.server");
      await sendMessage(
        ctx.tg.id,
        `💸 <b>Withdrawal requested</b>\n\n🪙 ${data.tokens.toLocaleString()} FOX\n💵 You receive: <b>$${Number(out.net_usd).toFixed(4)}</b>\n⏳ Status: pending admin approval\n\nYou will get a message here as soon as it is paid. 🦊`,
      );
    } catch {
      /* notification is best-effort */
    }
    return {
      id: String(out.id),
      net: Number(out.net_usd),
      gross: Number(out.gross_usd),
      fee: Number(out.fee_usd),
    };
  });

/* ---------------------------------------------------------------------------
 * Main / partner tasks (managed from the admin panel)
 * ------------------------------------------------------------------------ */

const ONE_TIME_DAY = "1970-01-01";

/** Active main and partner tasks, with the user's completion state. */
export const getTasks = createServerFn({ method: "POST" })
  .inputValidator(vInit)
  .handler(async ({ data }) => {
    const ctx = await loadCtx(data.initData);
    await rateLimit(ctx.db, "tasks", ctx.tg.id, 60, 60);
    const u = await getUserRow(ctx);

    const [list, done] = await Promise.all([
      ctx.db
        .from("tasks")
        .select("id, section, title, url, reward, verify_type, icon_url, sort_order")
        .eq("active", true)
        .order("sort_order", { ascending: true }),
      ctx.db.from("task_completions").select("task_key").eq("user_id", u.id),
    ]);

    const doneKeys = new Set((done.data ?? []).map((r) => r.task_key as string));
    return {
      tasks: (list.data ?? []).map((t) => ({
        id: t.id as string,
        section: (t.section as string) === "partner" ? "partner" : "main",
        title: t.title as string,
        url: t.url as string,
        reward: Number(t.reward ?? 0),
        verifyType: (t.verify_type as string) ?? "timer",
        iconUrl: (t.icon_url as string) ?? null,
        done: doneKeys.has(`task:${t.id as string}`),
      })),
    };
  });

/** Claims a main/partner task once; channel tasks are verified through the bot. */
export const claimTask = createServerFn({ method: "POST" })
  .inputValidator((d: { initData: string; taskId: string }) => {
    if (typeof d?.initData !== "string" || !d.initData) throw new Error("Invalid session");
    if (typeof d?.taskId !== "string" || !/^[0-9a-f-]{36}$/i.test(d.taskId)) {
      throw new Error("Invalid request");
    }
    return { initData: d.initData, taskId: d.taskId };
  })
  .handler(async ({ data }) => {
    const ctx = await loadCtx(data.initData);
    await rateLimit(ctx.db, "task_claim", ctx.tg.id, 40, 3600);
    const u = await getUserRow(ctx);

    const { data: task } = await ctx.db
      .from("tasks")
      .select("id, title, reward, verify_type, chat_username, active")
      .eq("id", data.taskId)
      .maybeSingle();
    if (!task || !task.active) throw new Error("This task is no longer available");

    if (task.verify_type === "channel" && task.chat_username) {
      const { isChatMember } = await import("./telegram.server");
      const member = await isChatMember(String(task.chat_username), ctx.tg.id);
      if (!member) throw new Error("NOT_JOINED");
    }

    const key = `task:${task.id as string}`;
    const ins = await ctx.db
      .from("task_completions")
      .insert({ task_key: key, user_id: u.id, day: ONE_TIME_DAY });
    if (ins.error) throw new Error("Already completed");

    const reward = Number(task.reward ?? 0);
    const { data: balance } = await ctx.db.rpc("credit_user", {
      _user_id: u.id,
      _amount: reward,
      _kind: "task",
      _note: `Task: ${String(task.title).slice(0, 60)}`,
      _key: `${key}:${u.id}`,
    });
    return { reward, balance: Number(balance ?? 0) };
  });
