import { createHmac, timingSafeEqual } from "crypto";

export type TgUser = {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  photo_url?: string;
  language_code?: string;
};

const MAX_AGE_SECONDS = 60 * 60 * 24;

/** Verify Telegram WebApp initData. Returns the user only when the signature is valid. */
export function verifyInitData(initData: string): { user: TgUser; startParam: string | null } {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  if (!token) throw new Error("Bot is not configured");
  if (!initData || initData.length > 8192) throw new Error("Invalid session");

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) throw new Error("Invalid session");
  params.delete("hash");

  const dataCheckString = [...params.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("\n");

  const secret = createHmac("sha256", "WebAppData").update(token).digest();
  const expected = createHmac("sha256", secret).update(dataCheckString).digest("hex");

  const a = Buffer.from(hash);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error("Invalid session");

  const authDate = Number(params.get("auth_date") ?? 0);
  if (!authDate || Date.now() / 1000 - authDate > MAX_AGE_SECONDS) {
    throw new Error("Session expired");
  }

  const rawUser = params.get("user");
  if (!rawUser) throw new Error("Invalid session");
  const user = JSON.parse(rawUser) as TgUser;
  if (!user || typeof user.id !== "number") throw new Error("Invalid session");

  return { user, startParam: params.get("start_param") };
}

const API = () => `https://api.telegram.org/bot${process.env["TELEGRAM_BOT_TOKEN"]}`;

export async function tgCall<T = unknown>(method: string, body: Record<string, unknown>): Promise<T | null> {
  try {
    if (!process.env["TELEGRAM_BOT_TOKEN"]) {
      console.error(`[telegram] ${method} failed: TELEGRAM_BOT_TOKEN is not configured`);
      return null;
    }
    const res = await fetch(`${API()}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as {
      ok: boolean;
      result?: T;
      error_code?: number;
      description?: string;
    };
    if (!res.ok || !json.ok) {
      console.error(`[telegram] ${method} failed`, {
        status: res.status,
        errorCode: json.error_code,
        description: json.description,
      });
      return null;
    }
    return json.result ?? null;
  } catch (error) {
    console.error(`[telegram] ${method} request failed`, error);
    return null;
  }
}

export function sendMessage(chatId: number | string, text: string, buttons?: { text: string; url: string }[][]) {
  return tgCall("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...(buttons ? { reply_markup: { inline_keyboard: buttons } } : {}),
  });
}

export function sendPhoto(
  chatId: number | string,
  photo: string,
  caption: string,
  buttons?: { text: string; url: string }[][],
) {
  return tgCall("sendPhoto", {
    chat_id: chatId,
    photo,
    caption,
    parse_mode: "HTML",
    ...(buttons ? { reply_markup: { inline_keyboard: buttons } } : {}),
  });
}

/** Returns true when the user is a member of the given @channel. */
export async function isChatMember(chat: string, userId: number): Promise<boolean> {
  const result = await tgCall<{ status: string }>("getChatMember", { chat_id: chat, user_id: userId });
  if (!result) return false;
  return ["creator", "administrator", "member"].includes(result.status);
}
