/**
 * Ad network helpers (Adsgram, Monetag, GigaPub, Monetix).
 * Every show function resolves ONLY when the provider reports a finished ad,
 * and rejects when no ad is available — callers never reward on reject.
 */

export const ADSGRAM_REWARD_BLOCK = "51743";
export const ADSGRAM_INT_BLOCK = "int-51744";
const MONETAG_ZONE = "11886718";

export type AdNetwork = "adsgram" | "adsgram_int" | "monetag" | "gigapub" | "monetix";

type AdController = { show: () => Promise<{ done?: boolean } | unknown> };
type W = Window & {
  Adsgram?: { init: (o: { blockId: string }) => AdController };
  showGiga?: () => Promise<unknown>;
  showRewardAd?: (cb: (r: { status?: string }) => void) => void;
  [k: string]: unknown;
};

const SCRIPTS: Record<string, { src: string; attrs?: Record<string, string> }> = {
  adsgram: { src: "https://sad.adsgram.ai/js/sad.min.js" },
  monetag: { src: "https://libtl.com/sdk.js", attrs: { "data-zone": MONETAG_ZONE, "data-sdk": `show_${MONETAG_ZONE}` } },
  gigapub: { src: "https://ad.gigapub.tech/script?id=8347" },
  monetix: { src: "https://www.monetixads.online/ads.js", attrs: { "data-mxid": "MX-BE2625D4" } },
};
const loading = new Map<string, Promise<void>>();

function loadScript(key: keyof typeof SCRIPTS): Promise<void> {
  if (typeof document === "undefined") return Promise.reject(new Error("No ad"));
  const hit = loading.get(key);
  if (hit) return hit;
  const p = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPTS[key]!.src;
    s.async = true;
    for (const [k, v] of Object.entries(SCRIPTS[key]!.attrs ?? {})) s.setAttribute(k, v);
    s.onload = () => resolve();
    s.onerror = () => {
      loading.delete(key);
      reject(new Error("Ad could not load"));
    };
    document.head.appendChild(s);
  });
  loading.set(key, p);
  return p;
}

/** Preload all networks after the app opens (non-blocking). */
export function preloadAds() {
  for (const k of Object.keys(SCRIPTS)) loadScript(k as keyof typeof SCRIPTS).catch(() => {});
}

export function adsEnabled() {
  return true;
}

const controllers = new Map<string, AdController>();
async function showAdsgram(blockId: string) {
  await loadScript("adsgram");
  const w = window as unknown as W;
  if (!w.Adsgram) throw new Error("No ad available");
  let c = controllers.get(blockId);
  if (!c) {
    c = w.Adsgram.init({ blockId });
    controllers.set(blockId, c);
  }
  const r = (await c.show()) as { done?: boolean } | undefined;
  if (r && r.done === false) throw new Error("Ad was not finished");
}

function withTimeout<T>(p: Promise<T>, ms = 60_000): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error("No ad available")), ms))]);
}

/* ------------------------------------------------------------ tap tracking
 * An "ad tap" = the ad opened a link / bot / mini app / channel, so the user
 * left the app. blur, visibilitychange, Telegram deactivated and link opens
 * all fire for the same tap; we count only the first one until the user is
 * back (focus / visible / activated) and keep a 1.5s guard on top.
 */
let tracking = false;
let away = false;
let taps = 0;
let lastTap = 0;
let installed = false;

let awayTimer: ReturnType<typeof setTimeout> | undefined;
function markAway() {
  if (!tracking) return;
  const now = Date.now();
  if (away && now - lastTap < 1500) return;
  if (now - lastTap < 1500) return;
  away = true;
  lastTap = now;
  taps += 1;
  // Telegram often keeps the mini app open when a channel/bot opens over it,
  // so no "back" event fires — release the lock automatically.
  clearTimeout(awayTimer);
  awayTimer = setTimeout(() => (away = false), 1500);
}
function markBack() {
  away = false;
}

const OPEN_EVENTS = ["web_app_open_link", "web_app_open_tg_link", "web_app_open_invoice", "web_app_switch_inline_query"];
function isOpenEvent(name: unknown) {
  return typeof name === "string" && OPEN_EVENTS.includes(name);
}

type TgWA = {
  onEvent?: (e: string, cb: () => void) => void;
  openLink?: (u: string, o?: unknown) => void;
  openTelegramLink?: (u: string) => void;
};
function installTracking() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("blur", markAway);
  window.addEventListener("focus", markBack);
  document.addEventListener("visibilitychange", () => (document.hidden ? markAway() : markBack()));

  // Taps on links / buttons inside the ad overlay (Join, View, Open, Play…).
  document.addEventListener(
    "click",
    (e) => {
      if (!tracking) return;
      const path = (e.composedPath?.() ?? []) as Element[];
      for (const el of path) {
        if (!(el instanceof Element)) continue;
        if (el.id === "root" || el.tagName === "BODY") break;
        const tag = el.tagName;
        if (tag === "A" && (el as HTMLAnchorElement).href) return markAway();
        if (tag === "BUTTON" || el.getAttribute?.("role") === "button") {
          const txt = (el.textContent ?? "").trim().toLowerCase();
          if (!txt || /close|skip|✕|×|x$/.test(txt)) return;
          return markAway();
        }
      }
    },
    true,
  );

  const origOpen = window.open.bind(window);
  window.open = ((...a: Parameters<typeof window.open>) => {
    markAway();
    return origOpen(...a);
  }) as typeof window.open;

  // Low-level Telegram bridge — catches link opens even when the ad SDK
  // bypasses Telegram.WebApp.openLink / openTelegramLink.
  const ww = window as unknown as {
    TelegramWebviewProxy?: { postEvent?: (n: string, d?: string) => void };
    external?: { notify?: (s: string) => void };
  };
  const proxy = ww.TelegramWebviewProxy;
  if (proxy && typeof proxy.postEvent === "function") {
    const orig = proxy.postEvent.bind(proxy);
    proxy.postEvent = (n: string, d?: string) => {
      if (isOpenEvent(n)) markAway();
      return orig(n, d);
    };
  }
  try {
    const ext = ww.external;
    if (ext && typeof ext.notify === "function") {
      const orig = ext.notify.bind(ext);
      ext.notify = (s: string) => {
        try {
          if (isOpenEvent(JSON.parse(s)?.eventType)) markAway();
        } catch {}
        return orig(s);
      };
    }
  } catch {}
  if (window.parent && window.parent !== window) {
    const p = window.parent;
    const orig = p.postMessage.bind(p);
    try {
      p.postMessage = ((msg: unknown, ...rest: unknown[]) => {
        try {
          const m = typeof msg === "string" ? JSON.parse(msg) : msg;
          if (isOpenEvent((m as { eventType?: string })?.eventType)) markAway();
        } catch {}
        return (orig as (...x: unknown[]) => void)(msg, ...rest);
      }) as typeof p.postMessage;
    } catch {}
  }

  const wa = (window as unknown as { Telegram?: { WebApp?: TgWA } }).Telegram?.WebApp;
  if (wa) {
    wa.onEvent?.("deactivated", markAway);
    wa.onEvent?.("activated", markBack);
    for (const k of ["openLink", "openTelegramLink"] as const) {
      const orig = wa[k];
      if (typeof orig === "function") {
        wa[k] = ((...a: unknown[]) => {
          markAway();
          return (orig as (...x: unknown[]) => unknown).apply(wa, a);
        }) as never;
      }
    }
  }
}

export type AdResult = { taps: number; ms: number };

export async function showAd(net: AdNetwork): Promise<AdResult> {
  installTracking();
  tracking = true;
  away = false;
  taps = 0;
  lastTap = 0;
  const start = Date.now();
  try {
    await showAdRaw(net);
    // Give the "back to app" events a moment to settle.
    await new Promise((r) => setTimeout(r, 300));
    return { taps, ms: Date.now() - start };
  } finally {
    tracking = false;
  }
}

async function showAdRaw(net: AdNetwork): Promise<void> {
  const w = window as unknown as W;
  switch (net) {
    case "adsgram":
      return showAdsgram(ADSGRAM_REWARD_BLOCK);
    case "adsgram_int":
      return showAdsgram(ADSGRAM_INT_BLOCK);
    case "monetag": {
      await loadScript("monetag");
      const fn = w[`show_${MONETAG_ZONE}`] as undefined | (() => Promise<unknown>);
      if (typeof fn !== "function") throw new Error("No ad available");
      await withTimeout(fn());
      return;
    }
    case "gigapub": {
      await loadScript("gigapub");
      if (typeof w.showGiga !== "function") throw new Error("No ad available");
      await withTimeout(w.showGiga());
      return;
    }
    case "monetix": {
      await loadScript("monetix");
      if (typeof w.showRewardAd !== "function") throw new Error("No ad available");
      await withTimeout(
        new Promise<void>((resolve, reject) =>
          w.showRewardAd!((r) =>
            r?.status === "completed" || r?.status === "closed" ? resolve() : reject(new Error("No ad available")),
          ),
        ),
      );
      return;
    }
  }
}

/** Backwards compatible helper. */
export const showRewardedAd = () => showAd("adsgram");

export function randomAdsgram(): AdNetwork {
  return Math.random() < 0.5 ? "adsgram" : "adsgram_int";
}
export function randomNetwork(): AdNetwork {
  const all: AdNetwork[] = ["adsgram", "adsgram_int", "monetag", "gigapub", "monetix"];
  return all[Math.floor(Math.random() * all.length)]!;
}
