export const MINI_APP_URL = "https://t.me/Fox_farm1_bot/farm";
export const BOT_USERNAME = "Fox_farm1_bot";
export const COMMUNITY_URL = "https://t.me/foxfarm_community";
export const PAYMENT_URL = "https://t.me/foxfarmpay";
export const ADMIN_TELEGRAM_ID = 5419054691;
export const PUBLIC_APP_URL = "https://fox-farm.lovable.app";
export const SITE_URL = "https://sweet-hello-blender.vercel.app";
export const BANNER_URL = `${PUBLIC_APP_URL}/__l5e/assets-v1/d44082d7-4273-4267-9eaf-2f5a868540e4/fox-banner.png`;
export const PAYOUT_PHOTO_URL = `${PUBLIC_APP_URL}/__l5e/assets-v1/1c62dee5-315f-4f3c-ab93-68f34be54476/withdraw-success.png`;

/**
 * Asset pointers store a root-relative URL that only resolves on Lovable
 * hosting. On other hosts (Vercel) we must load them from the Lovable origin.
 */
export function assetUrl(url: string): string {
  return url.startsWith("/") ? `${PUBLIC_APP_URL}${url}` : url;
}


/** Partner sites shown in the Ads tab (rewarded visits). */
export const PARTNER_SITES: { title: string; url: string }[] = [
  { title: "Fox Farm community channel", url: COMMUNITY_URL },
  { title: "Fox Farm payout proofs", url: PAYMENT_URL },
];

/** Channels every user must join before using the mini app (bot must be admin in each). */
export const REQUIRED_CHANNELS: { title: string; chat: string; url: string }[] = [
  { title: "Fox Farm Community", chat: "@foxfarm_community", url: "https://t.me/foxfarm_community" },
  { title: "Fox Farm Payment", chat: "@foxfarmpay", url: "https://t.me/foxfarmpay" },
  { title: "Fox Farm Chat", chat: "@foxfarmchat", url: "https://t.me/foxfarmchat" },
  { title: "Earning Hub", chat: "@EarningHub1236", url: "https://t.me/EarningHub1236" },
];

/** Admin's personal invite link used on partner-channel posts by default. */
export const ADMIN_REFER_LINK = "https://t.me/Fox_farm1_bot/farm?startapp=ref5419054691";

/** Fallback logos for ad networks (used when the admin has not set a custom logo). */
export const NETWORK_LOGOS: Record<string, string> = {
  adsgram: "https://www.google.com/s2/favicons?domain=adsgram.ai&sz=128",
  adsgram_int: "https://www.google.com/s2/favicons?domain=adsgram.ai&sz=128",
  monetag: "https://www.google.com/s2/favicons?domain=monetag.com&sz=128",
  gigapub: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='%237c3aed'/><stop offset='1' stop-color='%23ec4899'/></linearGradient></defs><rect width='64' height='64' rx='14' fill='url(%23g)'/><text x='32' y='42' font-family='Arial' font-weight='900' font-size='26' fill='white' text-anchor='middle'>GP</text></svg>",
  monetix: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='%230ea5e9'/><stop offset='1' stop-color='%2310b981'/></linearGradient></defs><rect width='64' height='64' rx='14' fill='url(%23g)'/><text x='32' y='42' font-family='Arial' font-weight='900' font-size='26' fill='white' text-anchor='middle'>MX</text></svg>",
};
