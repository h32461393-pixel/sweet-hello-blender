import { useEffect, useState, useSyncExternalStore } from "react";
import { Loader2, RotateCw, Tv, X, PartyPopper, MousePointerClick } from "lucide-react";
import guideImg from "@/assets/ad-tap-guide.jpg.asset.json";
import { showAd, type AdNetwork, type AdResult } from "@/lib/adsgram";

/* ------------------------------------------------------------------ store */
type Reward = { amount: number; label: string; taps?: number | undefined; percent?: number | undefined };
type State = {
  phase: "idle" | "intro" | "loading" | "failed";
  reward: Reward | null;
  cooldownUntil: number;
};
let state: State = { phase: "idle", reward: null, cooldownUntil: 0 };
const subs = new Set<() => void>();
const set = (p: Partial<State>) => {
  state = { ...state, ...p };
  subs.forEach((f) => f());
};
const subscribe = (f: () => void) => {
  subs.add(f);
  return () => subs.delete(f);
};
const useStore = () => useSyncExternalStore(subscribe, () => state, () => state);

let pending: { pick: () => AdNetwork; resolve: (r: AdResult) => void; reject: (e: Error) => void } | null = null;
export const AD_COOLDOWN_MS = 5000;
let intro: AdNetwork | null = null;

async function attempt() {
  if (!pending) return;
  intro = null;
  set({ phase: "loading" });
  try {
    const r = await showAd(pending.pick());
    const p = pending;
    pending = null;
    set({ phase: "idle", cooldownUntil: Date.now() + AD_COOLDOWN_MS });
    p.resolve(r);
  } catch {
    set({ phase: "failed" });
  }
}

/**
 * Blocks the whole app until an ad is fully watched. Resolves with the number
 * of ad taps detected and how long the ad was open. Adsgram ads show a short
 * tap tutorial first.
 */
export function requireAd(net: AdNetwork | (() => AdNetwork)): Promise<AdResult> {
  if (pending) return Promise.reject(new Error("An ad is already open"));
  return new Promise<AdResult>((resolve, reject) => {
    const chosen = typeof net === "function" ? net() : net;
    pending = { pick: () => chosen, resolve, reject };
    if (chosen === "adsgram" || chosen === "adsgram_int") {
      intro = chosen;
      set({ phase: "intro" });
    } else void attempt();
  });
}

const RULES: Record<string, { need: string; rows: [string, string][] }> = {
  adsgram: {
    need: "Tap the ad 3 times for 100%",
    rows: [["No tap", "25%"], ["1 tap", "50%"], ["2 taps", "75%"], ["3+ taps", "100%"]],
  },
  adsgram_int: {
    need: "Tap the ad 1 time for 100%",
    rows: [["Closed before 10s", "25%"], ["10–15s, no tap", "50%"], ["Watched 15s+", "75%"], ["1 tap", "100%"]],
  },
};

export function showRewardPopup(amount: number, label: string, taps?: number, percent?: number) {
  set({ reward: { amount, label, taps, percent } });
}

export function useAdCooldown() {
  const s = useStore();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (s.cooldownUntil <= now) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [s.cooldownUntil, now]);
  const left = Math.max(0, Math.ceil((s.cooldownUntil - now) / 1000));
  return { left, busy: s.phase !== "idle" || left > 0 };
}

/* -------------------------------------------------------------- overlay */
export function AdOverlay() {
  const s = useStore();
  return (
    <>
      {s.phase !== "idle" && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-background/90 p-6 backdrop-blur-sm">
          <div className="w-full max-w-xs animate-fade-up rounded-3xl border border-border bg-card p-6 text-center shadow-2xl">
            {s.phase === "intro" && intro ? (
              <>
                <MousePointerClick className="mx-auto h-9 w-9 text-primary" />
                <p className="mt-2 font-black">How to earn 100%</p>
                <p className="text-sm font-bold text-primary">{RULES[intro]!.need}</p>
                <img src={guideImg.url} alt="Tap the Join Now button in the ad" className="mt-3 w-full rounded-2xl border border-border" />
                <p className="mt-2 text-xs text-muted-foreground">Tap the big button in the ad (Join Now / Open). Opening a link, bot, mini app or channel counts as a tap. Come back to the app after each tap.</p>
                <div className="mt-3 space-y-1 text-left text-sm">
                  {RULES[intro]!.rows.map(([a, b]) => (
                    <div key={a} className="flex justify-between rounded-xl bg-secondary px-3 py-1.5 font-bold text-secondary-foreground"><span>{a}</span><span className="text-primary">{b}</span></div>
                  ))}
                </div>
                <button onClick={() => void attempt()} className="mt-4 w-full rounded-2xl bg-primary py-3 font-bold text-primary-foreground active:scale-[0.98]">Start ad</button>
                <button onClick={() => { const p = pending; pending = null; intro = null; set({ phase: "idle" }); p?.reject(new Error("AD_CANCELLED")); }} className="mt-2 w-full py-2 text-sm font-bold text-muted-foreground">Cancel</button>
              </>
            ) : s.phase === "loading" ? (
              <>
                <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
                <p className="mt-3 font-black">Loading ad…</p>
                <p className="text-xs text-muted-foreground">Tap the ad to earn more FOX.</p>
              </>
            ) : (
              <>
                <Tv className="mx-auto h-10 w-10 text-muted-foreground" />
                <p className="mt-3 font-black">No ad available right now</p>
                <p className="text-xs text-muted-foreground">No reward is given without a finished ad.</p>
                <button
                  onClick={() => void attempt()}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 font-bold text-primary-foreground active:scale-[0.98]"
                >
                  <RotateCw className="h-4 w-4" /> Try again
                </button>
                <button
                  onClick={() => {
                    const p = pending;
                    pending = null;
                    set({ phase: "idle" });
                    p?.reject(new Error("AD_CANCELLED"));
                  }}
                  className="mt-2 flex w-full items-center justify-center gap-1 rounded-2xl py-2 text-sm font-bold text-muted-foreground"
                >
                  <X className="h-4 w-4" /> Cancel
                </button>
              </>
            )}
          </div>
        </div>
      )}
      {s.reward && (
        <div className="fixed inset-0 z-[101] grid place-items-center bg-background/70 p-6 backdrop-blur-sm" onClick={() => set({ reward: null })}>
          <div className="w-full max-w-xs animate-fade-up rounded-3xl border border-usdt/40 bg-card p-6 text-center shadow-2xl">
            <PartyPopper className="mx-auto h-12 w-12 text-usdt" />
            <p className="mt-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Verified reward</p>
            <p className="text-4xl font-black text-usdt">+{s.reward.amount.toLocaleString()}</p>
            <p className="font-bold">FOX · {s.reward.label}</p>
            {s.reward.taps !== undefined && (
              <div className="mt-3 flex items-center justify-center gap-2 rounded-2xl bg-secondary px-3 py-2 text-sm font-black text-secondary-foreground">
                <MousePointerClick className="h-4 w-4" />
                {s.reward.taps} tap{s.reward.taps === 1 ? "" : "s"}
                {s.reward.percent !== undefined && <span className="text-primary">· {s.reward.percent}% reward</span>}
              </div>
            )}
            <button onClick={() => set({ reward: null })} className="mt-4 w-full rounded-2xl bg-primary py-3 font-bold text-primary-foreground">
              Awesome!
            </button>
          </div>
        </div>
      )}
    </>
  );
}
