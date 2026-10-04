export const MINI_APP_URL = "https://t.me/Fox_farm1_bot/farm";
export const BOT_USERNAME = "Fox_farm1_bot";
export const COMMUNITY_URL = "https://t.me/foxfarm_community";
export const PAYMENT_URL = "https://t.me/foxfarmpay";
export const ADMIN_TELEGRAM_ID = 5419054691;
export const PUBLIC_APP_URL = "https://fox-farm.lovable.app";
export const SITE_URL = "https://sweet-hello-blender.vercel.app";
export const BANNER_URL = `${PUBLIC_APP_URL}/__l5e/assets-v1/d44082d7-4273-4267-9eaf-2f5a868540e4/fox-banner.png`;

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
