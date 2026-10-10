import { useEffect, useState, useSyncExternalStore } from "react";
import { Loader2, RotateCw, Tv, X, PartyPopper, MousePointerClick } from "lucide-react";
import { showAd, type AdNetwork, type AdResult } from "@/lib/adsgram";

/* ------------------------------------------------------------------ store */
type Reward = { amount: number; label: string; taps?: number | undefined; percent?: number | undefined };
type State = {
  phase: "idle" | "loading" | "failed";
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

async function attempt() {
  if (!pending) return;
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
 * of ad taps detected and how long the ad was open.
 */
export function requireAd(net: AdNetwork | (() => AdNetwork)): Promise<AdResult> {
  if (pending) return Promise.reject(new Error("An ad is already open"));
  return new Promise<AdResult>((resolve, reject) => {
    pending = { pick: typeof net === "function" ? net : () => net, resolve, reject };
    void attempt();
  });
}

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
            {s.phase === "loading" ? (
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
