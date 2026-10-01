import { createFileRoute } from "@tanstack/react-router";
import { MINI_APP_URL, COMMUNITY_URL, PAYMENT_URL, BANNER_URL } from "@/lib/constants";

type Update = {
  message?: {
    chat: { id: number };
    from?: { id: number; first_name?: string };
    text?: string;
  };
};

export const Route = createFileRoute("/api/public/telegram/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = process.env["TELEGRAM_BOT_TOKEN"];
        const manual = process.env["TELEGRAM_WEBHOOK_SECRET"];
        if (!token && !manual) {
          console.error("Telegram webhook is not configured");
          return new Response("Webhook is not configured", { status: 503 });
        }
        // Accept either the manually configured secret or one derived from the bot token,
        // so a mismatched TELEGRAM_WEBHOOK_SECRET on the host can never silence /start.
        const { createHash, timingSafeEqual } = await import("crypto");
        const allowed = [manual, token ? createHash("sha256").update(`telegram-webhook:${token}`).digest("hex") : undefined].filter(
          (s): s is string => Boolean(s),
        );
        const got = Buffer.from(request.headers.get("x-telegram-bot-api-secret-token") ?? "");
        const ok = allowed.some((s) => {
          const b = Buffer.from(s);
          return b.length === got.length && timingSafeEqual(b, got);
        });
        if (!ok) {
          console.error("Telegram webhook rejected: secret token mismatch");
          return new Response("Unauthorized", { status: 401 });
        }

        const { sendPhoto, sendMessage } = await import("@/lib/telegram.server");
        let update: Update;
        try {
          update = (await request.json()) as Update;
        } catch {
          return new Response("ok");
        }

        const msg = update.message;
        if (msg?.text?.startsWith("/start")) {
          const caption = `🦊 <b>Fox Farm</b> 🌾\n\nWelcome${msg.from?.first_name ? ", " + msg.from.first_name : ""}!\n\n⛏️ Mine FOX tokens every hour\n✅ Complete daily and partner tasks\n👥 Invite friends and earn up to 1,200 FOX each\n🎁 Daily streak rewards up to 150 FOX\n💸 Withdraw in USDT (BEP-20)\n\nTap below to start farming!`;
          const buttons = [
            [{ text: "🦊 Open Mini App", url: MINI_APP_URL }],
            [{ text: "📢 Community", url: COMMUNITY_URL }],
            [{ text: "💸 Payment Channel", url: PAYMENT_URL }],
          ];
          const sent = await sendPhoto(
            msg.chat.id,
            BANNER_URL,
            caption,
            buttons,
          );
          // A remote banner can become unavailable. Never let that prevent /start.
          if (!sent) {
            const fallback = await sendMessage(msg.chat.id, caption, buttons);
            if (!fallback) return new Response("Telegram delivery failed", { status: 502 });
          }
        }

        return new Response("ok");
      },
    },
  },
});
