import { dbHint } from "./db-errors";
import { createServerFn } from "@tanstack/react-start";
import { rateLimit, assertAdmin } from "./security.server";
import { MINI_APP_URL, PAYMENT_URL } from "./constants";

type Auth = { initData: string; username: string; password: string };

function vAuth<T extends Auth>(d: T): T {
  if (typeof d?.initData !== "string" || !d.initData) throw new Error("Invalid session");
  if (typeof d?.username !== "string" || typeof d?.password !== "string") {
    throw new Error("Invalid credentials");
  }
  return d;
}

/** Verifies Telegram identity + admin secrets, returns the privileged db client. */
async function adminCtx(d: Auth) {
  const { verifyInitData } = await import("./telegram.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { user } = verifyInitData(d.initData);
  await rateLimit(supabaseAdmin, "admin", user.id, 120, 60);
  assertAdmin(user.id, d.username, d.password);
  return { db: supabaseAdmin, adminId: user.id };
}

async function audit(
  ctx: { db: any; adminId: number }, // eslint-disable-line @typescript-eslint/no-explicit-any
  action: string,
  target: string | null,
  details: Record<string, unknown>,
) {
  await ctx.db
    .from("admin_audit")
    .insert({ admin_telegram_id: ctx.adminId, action, target, details });
}

/** Login check only — the client stores nothing but the credentials it typed. */
export const adminLogin = createServerFn({ method: "POST" })
  .inputValidator(vAuth)
  .handler(async ({ data }) => {
    await adminCtx(data);
    return { ok: true };
  });

export const adminOverview = createServerFn({ method: "POST" })
  .inputValidator(vAuth)
  .handler(async ({ data }) => {
    const ctx = await adminCtx(data);
    const db = ctx.db;
    const today = new Date().toISOString().slice(0, 10);

    const [users, newToday, suspended, pending, paid, adsToday] = await Promise.all([
      db.from("app_users").select("id", { count: "exact", head: true }),
      db.from("app_users").select("id", { count: "exact", head: true }).gte("created_at", `${today}T00:00:00Z`),
      db.from("app_users").select("id", { count: "exact", head: true }).eq("suspended", true),
      db.from("withdrawals").select("net_usd").eq("status", "pending"),
      db.from("withdrawals").select("net_usd").eq("status", "paid"),
      db.from("ad_views").select("id", { count: "exact", head: true }).eq("day", today),
    ]);

    const sum = (rows: { net_usd: number }[] | null) =>
      (rows ?? []).reduce((a, r) => a + Number(r.net_usd ?? 0), 0);

    return {
      users: users.count ?? 0,
      newToday: newToday.count ?? 0,
      suspended: suspended.count ?? 0,
      pendingCount: (pending.data ?? []).length,
      pendingUsd: sum(pending.data as never),
      paidUsd: sum(paid.data as never),
      adViewsToday: adsToday.count ?? 0,
    };
  });

export const adminSearchUsers = createServerFn({ method: "POST" })
  .inputValidator((d: Auth & { q: string }) => ({ ...vAuth(d), q: String(d.q ?? "").slice(0, 60) }))
  .handler(async ({ data }) => {
    const ctx = await adminCtx(data);
    const q = data.q.trim();
    let query = ctx.db
      .from("app_users")
      .select("id, telegram_id, username, first_name, balance, total_earned, suspended, wallet_address, created_at")
      .order("created_at", { ascending: false })
      .limit(25);
    if (q) {
      query = /^\d+$/.test(q)
        ? query.eq("telegram_id", Number(q))
        : query.ilike("username", `%${q.replace(/[%_]/g, "")}%`);
    }
    const { data: rows } = await query;
    return {
      users: (rows ?? []).map((u) => ({
        id: u.id as string,
        telegramId: Number(u.telegram_id),
        username: (u.username as string) ?? null,
        firstName: (u.first_name as string) ?? null,
        balance: Number(u.balance ?? 0),
        totalEarned: Number(u.total_earned ?? 0),
        suspended: Boolean(u.suspended),
        wallet: (u.wallet_address as string) ?? null,
      })),
    };
  });

/** Adds or removes coins — always through the ledger, never a raw balance write. */
export const adminAdjustBalance = createServerFn({ method: "POST" })
  .inputValidator((d: Auth & { userId: string; amount: number; note: string }) => {
    vAuth(d);
    if (!/^[0-9a-f-]{36}$/i.test(String(d.userId))) throw new Error("Invalid request");
    const amount = Math.trunc(Number(d.amount));
    if (!Number.isFinite(amount) || amount === 0 || Math.abs(amount) > 10_000_000) {
      throw new Error("Invalid amount");
    }
    return { ...d, amount, note: String(d.note ?? "").slice(0, 100) };
  })
  .handler(async ({ data }) => {
    const ctx = await adminCtx(data);
    const { sendMessage } = await import("./telegram.server");
    const key = `admin:${Date.now()}:${data.userId}`;
    const note = data.note || "Admin adjustment";

    const res =
      data.amount > 0
        ? await ctx.db.rpc("credit_user", {
            _user_id: data.userId,
            _amount: data.amount,
            _kind: "admin",
            _note: note,
            _key: key,
          })
        : await ctx.db.rpc("debit_user", {
            _user_id: data.userId,
            _amount: Math.abs(data.amount),
            _kind: "admin",
            _note: note,
            _key: key,
          });
    if (res.error) throw new Error(res.error.message?.includes("insufficient") ? "Not enough balance" : "Could not update balance");

    await audit(ctx, data.amount > 0 ? "balance_add" : "balance_remove", data.userId, {
      amount: data.amount,
      note,
    });

    const { data: u } = await ctx.db
      .from("app_users")
      .select("telegram_id, balance")
      .eq("id", data.userId)
      .maybeSingle();
    if (u) {
      await sendMessage(
        Number(u.telegram_id),
        data.amount > 0
          ? `🎁 <b>Balance updated!</b>\n🪙 +${data.amount} FOX was added by the team.\n💰 New balance: <b>${Number(u.balance)}</b> FOX`
          : `⚠️ <b>Balance updated</b>\n🪙 ${data.amount} FOX was adjusted by the team.\n💰 New balance: <b>${Number(u.balance)}</b> FOX`,
        [[{ text: "🦊 Open Mini App", url: MINI_APP_URL }]],
      );
    }
    return { balance: Number(u?.balance ?? 0) };
  });

export const adminSetSuspended = createServerFn({ method: "POST" })
  .inputValidator((d: Auth & { userId: string; suspended: boolean }) => {
    vAuth(d);
    if (!/^[0-9a-f-]{36}$/i.test(String(d.userId))) throw new Error("Invalid request");
    return { ...d, suspended: Boolean(d.suspended) };
  })
  .handler(async ({ data }) => {
    const ctx = await adminCtx(data);
    const { error } = await ctx.db
      .from("app_users")
      .update({ suspended: data.suspended })
      .eq("id", data.userId);
    if (error) throw new Error("Could not update the account");
    await audit(ctx, data.suspended ? "suspend" : "unsuspend", data.userId, {});
    return { ok: true };
  });

export const adminWithdrawals = createServerFn({ method: "POST" })
  .inputValidator((d: Auth & { status: string }) => ({
    ...vAuth(d),
    status: ["pending", "paid", "rejected"].includes(String(d.status)) ? String(d.status) : "pending",
  }))
  .handler(async ({ data }) => {
    const ctx = await adminCtx(data);
    const { data: rows } = await ctx.db
      .from("withdrawals")
      .select("id, user_id, amount_tokens, net_usd, fee_usd, address, status, txid, created_at, app_users(telegram_id, username, first_name)")
      .eq("status", data.status)
      .order("created_at", { ascending: false })
      .limit(50);

    return {
      withdrawals: (rows ?? []).map((w) => {
        const u = (w as { app_users?: { telegram_id?: number; username?: string; first_name?: string } }).app_users;
        return {
          id: w.id as string,
          tokens: Number(w.amount_tokens ?? 0),
          net: Number(w.net_usd ?? 0),
          fee: Number(w.fee_usd ?? 0),
          address: w.address as string,
          status: w.status as string,
          txid: (w.txid as string) ?? null,
          createdAt: w.created_at as string,
          user: u?.username ? `@${u.username}` : u?.first_name ?? "User",
          telegramId: Number(u?.telegram_id ?? 0),
        };
      }),
    };
  });

/** Approves (with txid) or rejects a withdrawal and posts the payout proof. */
export const adminProcessWithdrawal = createServerFn({ method: "POST" })
  .inputValidator((d: Auth & { id: string; action: "paid" | "rejected"; txid?: string }) => {
    vAuth(d);
    if (!/^[0-9a-f-]{36}$/i.test(String(d.id))) throw new Error("Invalid request");
    if (d.action !== "paid" && d.action !== "rejected") throw new Error("Invalid request");
    const txid = String(d.txid ?? "").trim().slice(0, 120);
    if (d.action === "paid" && !/^0x[a-fA-F0-9]{10,}$/.test(txid)) throw new Error("Enter a valid transaction hash");
    return { ...d, txid };
  })
  .handler(async ({ data }) => {
    const ctx = await adminCtx(data);
    const { sendMessage } = await import("./telegram.server");

    const res = await ctx.db.rpc("process_withdrawal_v1", {
      _withdrawal_id: data.id,
      _action: data.action,
      _txid: (data.action === "paid" ? data.txid : "") as string,
    });
    if (res.error) throw new Error("Could not process this withdrawal");

    const { data: w } = await ctx.db
      .from("withdrawals")
      .select("amount_tokens, net_usd, address, txid, app_users(telegram_id, username, first_name)")
      .eq("id", data.id)
      .maybeSingle();
    const u = (w as { app_users?: { telegram_id?: number; username?: string; first_name?: string } } | null)?.app_users;
    const name = u?.username ? `@${u.username}` : u?.first_name ?? "A farmer";
    const scan = w?.txid ? `https://bscscan.com/tx/${w.txid}` : null;

    if (u?.telegram_id) {
      await sendMessage(
        Number(u.telegram_id),
        data.action === "paid"
          ? `✅ <b>Withdrawal paid!</b>\n🪙 ${Number(w?.amount_tokens ?? 0)} FOX\n💵 <b>$${Number(w?.net_usd ?? 0).toFixed(2)} USDT</b> (BEP-20)\n📬 <code>${w?.address}</code>\n\n🎉 Thank you for farming with us!`
          : `❌ <b>Withdrawal rejected</b>\n🪙 ${Number(w?.amount_tokens ?? 0)} FOX has been returned to your balance.\n💬 Contact support if you think this is a mistake.`,
        scan
          ? [[{ text: "🔎 View transaction", url: scan }], [{ text: "🦊 Open Mini App", url: MINI_APP_URL }]]
          : [[{ text: "🦊 Open Mini App", url: MINI_APP_URL }]],
      );
    }

    // Public payout proof in the payment channel.
    if (data.action === "paid") {
      const channel = PAYMENT_URL.split("/").pop();
      if (channel) {
        await sendMessage(
          `@${channel}`,
          `💸 <b>PAYMENT SENT</b> 💸\n\n👤 ${name}\n🪙 ${Number(w?.amount_tokens ?? 0)} FOX\n💵 <b>$${Number(w?.net_usd ?? 0).toFixed(2)} USDT</b> (BEP-20)\n⛓️ BNB Smart Chain\n\n🦊 Fox Farm pays every day!`,
          scan
            ? [
                [{ text: "🔎 View transaction", url: scan }],
                [{ text: "🦊 Open Mini App", url: MINI_APP_URL }],
              ]
            : [[{ text: "🦊 Open Mini App", url: MINI_APP_URL }]],
        );
      }
    }

    await audit(ctx, `withdrawal_${data.action}`, data.id, { txid: data.txid });
    return { ok: true };
  });

/** Reads / writes a JSON settings row (ads, mining, daily, withdraw, referral…). */
export const adminGetConfig = createServerFn({ method: "POST" })
  .inputValidator((d: Auth & { key: string }) => ({ ...vAuth(d), key: String(d.key ?? "").slice(0, 40) }))
  .handler(async ({ data }) => {
    const ctx = await adminCtx(data);
    const { data: row } = await ctx.db.from("app_config").select("value").eq("key", data.key).maybeSingle();
    return { json: JSON.stringify(row?.value ?? {}) };
  });

export const adminSetConfig = createServerFn({ method: "POST" })
  .inputValidator((d: Auth & { key: string; value: unknown }) => {
    vAuth(d);
    const key = String(d.key ?? "");
    if (!/^[a-z_]{2,40}$/.test(key)) throw new Error("Invalid request");
    if (typeof d.value !== "object" || d.value === null) throw new Error("Invalid settings");
    if (JSON.stringify(d.value).length > 8000) throw new Error("Settings are too large");
    return { ...d, key };
  })
  .handler(async ({ data }) => {
    const ctx = await adminCtx(data);
    const { error } = await ctx.db
      .from("app_config")
      .upsert({ key: data.key, value: data.value as never }, { onConflict: "key" });
    if (error) throw new Error("Could not save settings");
    await audit(ctx, "config_set", data.key, { value: data.value as never });
    return { ok: true };
  });

export const adminListTasks = createServerFn({ method: "POST" })
  .inputValidator(vAuth)
  .handler(async ({ data }) => {
    const ctx = await adminCtx(data);
    const { data: rows } = await ctx.db
      .from("tasks")
      .select("id, section, title, url, reward, verify_type, chat_username, icon_url, active, sort_order")
      .order("sort_order", { ascending: true })
      .limit(100);
    return { tasks: rows ?? [] };
  });

export const adminSaveTask = createServerFn({ method: "POST" })
  .inputValidator(
    (
      d: Auth & {
        id?: string | null;
        section: string;
        title: string;
        url: string;
        reward: number;
        verifyType: string;
        chatUsername?: string | null;
        iconUrl?: string | null;
        active: boolean;
        sortOrder?: number;
      },
    ) => {
      vAuth(d);
      const title = String(d.title ?? "").trim().slice(0, 80);
      const url = String(d.url ?? "").trim().slice(0, 300);
      if (!title) throw new Error("Title is required");
      if (!/^https?:\/\//i.test(url)) throw new Error("Enter a valid link");
      const reward = Math.trunc(Number(d.reward));
      if (!Number.isFinite(reward) || reward < 0 || reward > 100000) throw new Error("Invalid reward");
      const icon = String(d.iconUrl ?? "").trim().slice(0, 300);
      if (icon && !/^https:\/\//i.test(icon)) throw new Error("Icon link must start with https://");
      return {
        ...d,
        title,
        url,
        reward,
        iconUrl: icon || null,
        section: d.section === "partner" ? "partner" : "main",
        verifyType: d.verifyType === "channel" ? "channel" : "timer",
        chatUsername: String(d.chatUsername ?? "").trim().slice(0, 60) || null,
        sortOrder: Math.trunc(Number(d.sortOrder ?? 0)) || 0,
        active: Boolean(d.active),
      };
    },
  )
  .handler(async ({ data }) => {
    const ctx = await adminCtx(data);
    const row = {
      section: data.section,
      title: data.title,
      url: data.url,
      reward: data.reward,
      verify_type: data.verifyType,
      chat_username: data.chatUsername,
      icon_url: data.iconUrl,
      active: data.active,
      sort_order: data.sortOrder,
    };
    const res = data.id
      ? await ctx.db.from("tasks").update(row).eq("id", data.id)
      : await ctx.db.from("tasks").insert(row);
    if (res.error) {
      throw new Error(dbHint(res.error) ?? "Could not save the task");
    }
    await audit(ctx, data.id ? "task_update" : "task_create", data.id ?? data.title, row);
    return { ok: true };
  });

export const adminDeleteTask = createServerFn({ method: "POST" })
  .inputValidator((d: Auth & { id: string }) => {
    vAuth(d);
    if (!/^[0-9a-f-]{36}$/i.test(String(d.id))) throw new Error("Invalid request");
    return d;
  })
  .handler(async ({ data }) => {
    const ctx = await adminCtx(data);
    await ctx.db.from("tasks").delete().eq("id", data.id);
    await audit(ctx, "task_delete", data.id, {});
    return { ok: true };
  });

export const adminCreateCode = createServerFn({ method: "POST" })
  .inputValidator((d: Auth & { code: string; reward: number; maxUses: number }) => {
    vAuth(d);
    const code = String(d.code ?? "").trim().toUpperCase().slice(0, 40);
    if (!/^[A-Z0-9_-]{3,40}$/.test(code)) throw new Error("Invalid code");
    const reward = Math.trunc(Number(d.reward));
    if (!Number.isFinite(reward) || reward <= 0 || reward > 1_000_000) throw new Error("Invalid reward");
    const maxUses = Math.trunc(Number(d.maxUses));
    if (!Number.isFinite(maxUses) || maxUses <= 0 || maxUses > 1_000_000) throw new Error("Invalid uses");
    return { ...d, code, reward, maxUses };
  })
  .handler(async ({ data }) => {
    const ctx = await adminCtx(data);
    const { error } = await ctx.db
      .from("reward_codes")
      .insert({ code: data.code, amount: data.reward, max_uses: data.maxUses });
    if (error) throw new Error("This code already exists");
    await audit(ctx, "code_create", data.code, { reward: data.reward, maxUses: data.maxUses });
    return { ok: true };
  });

export const adminAudit = createServerFn({ method: "POST" })
  .inputValidator(vAuth)
  .handler(async ({ data }) => {
    const ctx = await adminCtx(data);
    const { data: rows } = await ctx.db
      .from("admin_audit")
      .select("id, action, target, details, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    return { entries: rows ?? [] };
  });

/** Broadcast an announcement to every user through the bot. */
export const adminBroadcast = createServerFn({ method: "POST" })
  .inputValidator((d: Auth & { text: string }) => {
    vAuth(d);
    const text = String(d.text ?? "").trim().slice(0, 900);
    if (text.length < 3) throw new Error("Message is too short");
    return { ...d, text };
  })
  .handler(async ({ data }) => {
    const ctx = await adminCtx(data);
    const { sendMessage } = await import("./telegram.server");
    const { data: rows } = await ctx.db
      .from("app_users")
      .select("telegram_id")
      .eq("suspended", false)
      .limit(3000);
    let sent = 0;
    for (const r of rows ?? []) {
      try {
        await sendMessage(Number(r.telegram_id), `📣 <b>Fox Farm</b>\n\n${data.text}`, [
          [{ text: "🦊 Open Mini App", url: MINI_APP_URL }],
        ]);
        sent += 1;
      } catch {
        /* skip blocked users */
      }
    }
    await audit(ctx, "broadcast", null, { sent });
    return { sent };
  });

export const adminListCodes = createServerFn({ method: "POST" })
  .inputValidator(vAuth)
  .handler(async ({ data }) => {
    const ctx = await adminCtx(data);
    const { data: rows, error } = await ctx.db
      .from("reward_codes")
      .select("code, amount, max_uses, uses, active, expires_at, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(dbHint(error) ?? "Could not load codes");
    return {
      codes: (rows ?? []).map((r) => ({
        code: String(r.code),
        amount: Number(r.amount),
        maxUses: Number(r.max_uses),
        uses: Number(r.uses),
        active: Boolean(r.active),
      })),
    };
  });

export const adminSetCodeActive = createServerFn({ method: "POST" })
  .inputValidator((d: Auth & { code: string; active: boolean }) => {
    vAuth(d);
    const code = String(d.code ?? "").toUpperCase();
    if (!/^[A-Z0-9_-]{3,40}$/.test(code)) throw new Error("Invalid code");
    return { ...d, code, active: Boolean(d.active) };
  })
  .handler(async ({ data }) => {
    const ctx = await adminCtx(data);
    const { error } = await ctx.db.from("reward_codes").update({ active: data.active }).eq("code", data.code);
    if (error) throw new Error(dbHint(error) ?? "Could not update code");
    await audit(ctx, data.active ? "code_enable" : "code_disable", data.code, {});
    return { ok: true };
  });

/** Full activity for one user: ledger, ads, withdrawals, referrals, tasks. */
export const adminUserActivity = createServerFn({ method: "POST" })
  .inputValidator((d: Auth & { userId: string }) => {
    vAuth(d);
    if (!/^[0-9a-f-]{36}$/i.test(String(d.userId ?? ""))) throw new Error("Invalid user");
    return d;
  })
  .handler(async ({ data }) => {
    const ctx = await adminCtx(data);
    const db = ctx.db;
    const [u, tx, ads, wd, refs, tasks] = await Promise.all([
      db.from("app_users").select("signup_ip, device_hash, suspend_reason, created_at, last_seen_at, streak_day, withdrawal_count").eq("id", data.userId).maybeSingle(),
      db.from("transactions").select("kind, amount, note, created_at").eq("user_id", data.userId).order("created_at", { ascending: false }).limit(100),
      db.from("ad_views").select("source, reward, created_at").eq("user_id", data.userId).order("created_at", { ascending: false }).limit(50),
      db.from("withdrawals").select("amount_tokens, net_usd, status, address, txid, created_at").eq("user_id", data.userId).order("created_at", { ascending: false }).limit(30),
      db.from("referrals").select("status, fake, pending_reward, created_at").eq("referrer_id", data.userId).order("created_at", { ascending: false }).limit(100),
      db.from("task_completions").select("task_key, day, created_at").eq("user_id", data.userId).order("created_at", { ascending: false }).limit(50),
    ]);
    const ledger = (tx.data ?? []).reduce((a, r) => a + Number(r.amount), 0);
    return {
      info: u.data
        ? {
            ip: (u.data.signup_ip as string) ?? null,
            device: (u.data.device_hash as string) ?? null,
            reason: (u.data.suspend_reason as string) ?? null,
            joined: String(u.data.created_at),
            lastSeen: String(u.data.last_seen_at),
            withdrawals: Number(u.data.withdrawal_count),
          }
        : null,
      ledgerRecent: ledger,
      transactions: (tx.data ?? []).map((r) => ({ kind: String(r.kind), amount: Number(r.amount), note: (r.note as string) ?? "", at: String(r.created_at) })),
      ads: (ads.data ?? []).map((r) => ({ source: String(r.source), reward: Number(r.reward), at: String(r.created_at) })),
      withdrawals: (wd.data ?? []).map((r) => ({ tokens: Number(r.amount_tokens), net: Number(r.net_usd), status: String(r.status), txid: (r.txid as string) ?? null, at: String(r.created_at) })),
      referrals: (refs.data ?? []).map((r) => ({ status: String(r.status), fake: Boolean(r.fake), pending: Number(r.pending_reward), at: String(r.created_at) })),
      tasks: (tasks.data ?? []).map((r) => ({ key: String(r.task_key), at: String(r.created_at) })),
    };
  });
