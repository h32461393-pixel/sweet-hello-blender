import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";
import { MINI_APP_URL } from "@/lib/constants";

/**
 * Bot reminders. Call every 10 minutes (e.g. cron-job.org):
 *   GET /api/public/cron/reminders  with header  Authorization: Bearer <CRON_SECRET>
 * - Mining ready: users whose hourly mining finished in the last 10 minutes.
 * - Daily reminder: once per day at 18:00 UTC run, users who have not claimed today.
 */
function authorized(req: Request): boolean {
  const secret = process.env["CRON_SECRET"] ?? process.env["LOVABLE_CRON_SECRET"];
  if (!secret) return false;
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

export const Route = createFileRoute("/api/public/cron/reminders")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!authorized(request)) return new Response("Unauthorized", { status: 401 });
        const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
        const { sendMessage } = await import("@/lib/telegram.server");
        const btn = [[{ text: "🦊 Open Mini App", url: MINI_APP_URL }]];

        const cfg = await db.from("app_config").select("value").eq("key", "mining").maybeSingle();
        const minutes = Number((cfg.data?.value as Record<string, number> | null)?.["duration_minutes"] ?? 60);
        const now = Date.now();
        const from = new Date(now - (minutes + 10) * 60_000).toISOString();
        const to = new Date(now - minutes * 60_000).toISOString();

        const ready = await db
          .from("app_users")
          .select("telegram_id")
          .eq("suspended", false)
          .eq("mining_claimed", false)
          .gt("mining_started_at", from)
          .lte("mining_started_at", to)
          .limit(2000);
        let mining = 0;
        for (const u of ready.data ?? []) {
          try {
            await sendMessage(Number(u.telegram_id), "⛏️ <b>Your mining is complete!</b>\n\n🪙 Your FOX is ready to claim. Claim now and start the next hour! 🚜", btn);
            mining++;
          } catch { /* user blocked the bot */ }
        }

        let daily = 0;
        const d = new Date(now);
        if (d.getUTCHours() === 18 && d.getUTCMinutes() < 10) {
          const today = d.toISOString().slice(0, 10);
          const pending = await db
            .from("app_users")
            .select("telegram_id")
            .eq("suspended", false)
            .or(`last_daily_date.is.null,last_daily_date.neq.${today}`)
            .limit(3000);
          for (const u of pending.data ?? []) {
            try {
              await sendMessage(Number(u.telegram_id), "🎁 <b>Daily reward waiting!</b>\n\n🔥 Don't lose your streak — claim today's reward before 00:00 UTC. ⏰", btn);
              daily++;
            } catch { /* ignore */ }
          }
        }
        return Response.json({ ok: true, mining, daily });
      },
    },
  },
});
