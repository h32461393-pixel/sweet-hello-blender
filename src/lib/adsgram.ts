/**
 * Adsgram rewarded-ad helper.
 *
 * Placement (declared for review): the Ads tab of the mini app, inside the
 * "Watch a short ad" card. The ad is rewarded-interstitial and is only shown
 * after the user taps the button. No other screen shows ads, and no feature of
 * the app is blocked or limited when a user never watches one.
 */

type AdController = { show: () => Promise<unknown> };
type AdsgramGlobal = { init: (o: { blockId: string }) => AdController };

declare global {
  interface Window {
    Adsgram?: AdsgramGlobal;
  }
}

export const ADSGRAM_BLOCK_ID: string =
  (import.meta.env["VITE_ADSGRAM_BLOCK_ID"] as string | undefined) ?? "";

let controller: AdController | null = null;

export function adsEnabled() {
  return Boolean(ADSGRAM_BLOCK_ID);
}

function getController(): AdController {
  if (!window.Adsgram) throw new Error("Ads are still loading. Please try again.");
  if (!controller) controller = window.Adsgram.init({ blockId: ADSGRAM_BLOCK_ID });
  return controller;
}

/** Resolves only when the provider reports a fully watched ad. */
export async function showRewardedAd(): Promise<void> {
  if (!adsEnabled()) throw new Error("Ads are not available right now.");
  await getController().show();
}
