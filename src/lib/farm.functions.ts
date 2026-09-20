import { createServerFn } from "@tanstack/react-start";
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
  .inputValidator((d: { initData: string }) => d)
  .handler(async ({ data }) => {
    const ctx = await loadCtx(data.initData);
    const { sendPhoto, sendMessage } = await import("./telegram.server");
    const db = ctx.db;

    const existing = await db.from("app_users").select("*").eq("telegram_id", ctx.tg.id).maybeSingle();

    if (existing.data) {
      await db
        .from("app_users")
        .update({
          username: ctx.tg.username ?? null,
          first_name: ctx.tg.first_name ?? null,
          photo_url: ctx.tg.photo_url ?? null,
          last_seen_at: new Date().toISOString(),
        })
        .eq("id", existing.data.id);
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
      })
      .select("*")
      .single();

    if (inserted.error || !inserted.data) throw new Error("Could not create your account");
    const me = inserted.data;

    // Referral (start_param = ref<telegram id>)
    const ref = ctx.startParam?.match(/^ref(\d+)$/);
    if (ref) {
      const refId = Number(ref[1]);
      if (refId !== ctx.tg.id) {
        const referrer = await db.from("app_users").select("id, telegram_id, suspended").eq("telegram_id", refId).maybeSingle();
        if (referrer.data && !referrer.data.suspended) {
          const cfg = await getConfig(db, "referral");
          const joinReward = Number(cfg["join"] ?? 200);
          await db.from("app_users").update({ referred_by: referrer.data.id }).eq("id", me.id);
          await db.from("referrals").insert({
            referrer_id: referrer.data.id,
            referee_id: me.id,
            status: "pending",
            pending_reward: joinReward,
            stage_join: true,
          });
          await sendMessage(
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
  .inputValidator((d: { initData: string }) => d)
  .handler(async ({ data }) => {
    const ctx = await loadCtx(data.initData);
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
  .inputValidator((d: { initData: string }) => d)
  .handler(async ({ data }) => {
    const ctx = await loadCtx(data.initData);
    const u = await getUserRow(ctx);
    if (u.mining_started_at && !u.mining_claimed) throw new Error("Mining is already running");
    await ctx.db
      .from("app_users")
      .update({ mining_started_at: new Date().toISOString(), mining_claimed: false })
      .eq("id", u.id);
    return { ok: true };
  });

export const claimMining = createServerFn({ method: "POST" })
  .inputValidator((d: { initData: string }) => d)
  .handler(async ({ data }) => {
    const ctx = await loadCtx(data.initData);
    const { sendMessage } = await import("./telegram.server");
    const u = await getUserRow(ctx);
    if (!u.mining_started_at || u.mining_claimed) throw new Error("Nothing to claim");

    const cfg = await getConfig(ctx.db, "mining");
    const duration = Number(cfg["duration_minutes"] ?? 60) * 60_000;
    const started = new Date(u.mining_started_at).getTime();
    if (Date.now() - started < duration) throw new Error("Mining is still running");

    const reward = Number(cfg["reward"] ?? 100);
    const key = `mining:${u.id}:${u.mining_started_at}`;
    const marked = await ctx.db
      .from("app_users")
      .update({ mining_claimed: true, mining_started_at: null })
      .eq("id", u.id)
      .eq("mining_claimed", false)
      .select("id");
    if (!marked.data?.length) throw new Error("Already claimed");

    const { data: balance } = await ctx.db.rpc("credit_user", {
      _user_id: u.id,
      _amount: reward,
      _kind: "mining",
      _note: "Hourly mining",
      _key: key,
    });

    await sendMessage(
      ctx.tg.id,
      `⛏️ <b>Mining complete!</b>\n🪙 +${reward} FOX added to your balance.\n🌾 Start a new session to keep farming.`,
      [[{ text: "🦊 Open Mini App", url: MINI_APP_URL }]],
    );

    return { reward, balance: Number(balance ?? 0) };
  });

export const claimDaily = createServerFn({ method: "POST" })
  .inputValidator((d: { initData: string }) => d)
  .handler(async ({ data }) => {
    const ctx = await loadCtx(data.initData);
    const u = await getUserRow(ctx);
    const today = todayUTC();
    if (u.last_daily_date === today) throw new Error("Already claimed today");

    const cfg = await getConfig(ctx.db, "daily");
    const rewards = ((cfg["rewards"] as number[]) ?? [30, 40, 50, 70, 90, 120, 150]);

    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const nextDay = u.last_daily_date === yesterday ? (Number(u.streak_day) % rewards.length) + 1 : 1;
    const reward = rewards[nextDay - 1] ?? rewards[0]!;

    const updated = await ctx.db
      .from("app_users")
      .update({ streak_day: nextDay, last_daily_date: today })
      .eq("id", u.id)
      .neq("last_daily_date", today)
      .select("id");
    if (!updated.data?.length) throw new Error("Already claimed today");

    const { data: balance } = await ctx.db.rpc("credit_user", {
      _user_id: u.id,
      _amount: reward,
      _kind: "daily",
      _note: `Daily reward day ${nextDay}`,
      _key: `daily:${u.id}:${today}`,
    });

    return { reward, day: nextDay, balance: Number(balance ?? 0) };
  });

export const claimRewardCode = createServerFn({ method: "POST" })
  .inputValidator((d: { initData: string; code: string }) => d)
  .handler(async ({ data }) => {
    const ctx = await loadCtx(data.initData);
    const u = await getUserRow(ctx);
    const code = data.code.trim().toUpperCase().slice(0, 40);
    if (!code) throw new Error("Enter a code");

    const row = await ctx.db.from("reward_codes").select("*").eq("code", code).maybeSingle();
    if (!row.data || !row.data.active) throw new Error("Invalid code");
    if (row.data.expires_at && new Date(row.data.expires_at).getTime() < Date.now()) throw new Error("This code has expired");
    if (row.data.max_uses > 0 && row.data.uses >= row.data.max_uses) throw new Error("This code is fully used");

    const claim = await ctx.db.from("reward_code_claims").insert({ code, user_id: u.id });
    if (claim.error) throw new Error("You already used this code");

    await ctx.db.from("reward_codes").update({ uses: row.data.uses + 1 }).eq("code", code);

    const { data: balance } = await ctx.db.rpc("credit_user", {
      _user_id: u.id,
      _amount: row.data.amount,
      _kind: "reward_code",
      _note: `Reward code ${code}`,
      _key: `code:${code}:${u.id}`,
    });

    return { reward: Number(row.data.amount), balance: Number(balance ?? 0) };
  });

/** Daily channel tasks — membership is verified through the bot. */
export const claimChannelTask = createServerFn({ method: "POST" })
  .inputValidator((d: { initData: string; kind: "community" | "payment" }) => d)
  .handler(async ({ data }) => {
    const ctx = await loadCtx(data.initData);
    const { isChatMember } = await import("./telegram.server");
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
