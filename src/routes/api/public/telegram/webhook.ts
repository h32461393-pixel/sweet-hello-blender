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
        const secret = process.env["TELEGRAM_WEBHOOK_SECRET"];
        if (!secret) {
          console.error("TELEGRAM_WEBHOOK_SECRET is not configured");
          return new Response("Webhook is not configured", { status: 503 });
        }
        if (request.headers.get("x-telegram-bot-api-secret-token") !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { sendPhoto } = await import("@/lib/telegram.server");
        let update: Update;
        try {
          update = (await request.json()) as Update;
        } catch {
          return new Response("ok");
        }

        const msg = update.message;
        if (msg?.text?.startsWith("/start")) {
          await sendPhoto(
            msg.chat.id,
            BANNER_URL,
            `🦊 <b>Fox Farm</b> 🌾\n\nWelcome${msg.from?.first_name ? ", " + msg.from.first_name : ""}!\n\n⛏️ Mine FOX tokens every hour\n✅ Complete daily and partner tasks\n👥 Invite friends and earn up to 1,200 FOX each\n🎁 Daily streak rewards up to 150 FOX\n💸 Withdraw in USDT (BEP-20)\n\nTap below to start farming!`,
            [
              [{ text: "🦊 Open Mini App", url: MINI_APP_URL }],
              [{ text: "📢 Community", url: COMMUNITY_URL }],
              [{ text: "💸 Payment Channel", url: PAYMENT_URL }],
            ],
          );
        }

        return new Response("ok");
      },
    },
  },
});
