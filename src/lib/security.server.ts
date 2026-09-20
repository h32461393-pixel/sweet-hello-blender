import { createHash, timingSafeEqual } from "crypto";
import { ADMIN_TELEGRAM_ID } from "./constants";

type Db = { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> };

/**
 * Atomic, database-backed rate limit. Throws a user friendly error when the
 * caller exceeds `limit` hits inside `windowSeconds`.
 */
export async function rateLimit(
  db: Db,
  bucket: string,
  subject: string | number,
  limit: number,
  windowSeconds: number,
): Promise<void> {
  const { data, error } = await db.rpc("rl_hit", {
    _bucket: bucket,
    _subject: String(subject),
    _limit: limit,
    _window_seconds: windowSeconds,
  });
  // Fail closed: if the limiter itself breaks we refuse the action.
  if (error) throw new Error("Too many requests. Please try again later.");
  if (data === false) throw new Error("Too many requests. Please slow down.");
}

function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

/**
 * Admin gate. Requires BOTH the hard-coded owner Telegram id (verified through
 * signed Telegram initData) AND credentials stored as server secrets.
 * Credentials never live in the source code or in the client bundle.
 */
export function assertAdmin(telegramId: number, username: string, password: string): void {
  const expectedUser = process.env["ADMIN_PANEL_USER"];
  const expectedPass = process.env["ADMIN_PANEL_PASSWORD"];
  if (!expectedUser || !expectedPass) throw new Error("Admin panel is not configured");
  if (Number(telegramId) !== ADMIN_TELEGRAM_ID) throw new Error("Not allowed");
  if (!username || !password) throw new Error("Invalid credentials");
  if (!safeEqual(username, expectedUser) || !safeEqual(password, expectedPass)) {
    throw new Error("Invalid credentials");
  }
}

/** Best-effort client IP from edge headers. */
export function clientIp(headers: Headers): string {
  return (
    headers.get("cf-connecting-ip") ??
    headers.get("x-real-ip") ??
    (headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() ??
    "unknown"
  );
}
