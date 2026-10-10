import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Circle, Gift, Loader2, RefreshCw, ExternalLink, X } from "lucide-react";
import logo from "@/assets/tigorix-logo.png.asset.json";
import { assetUrl } from "@/lib/constants";
import { useTigorixBonus, useClaimTigorixBonus, friendlyError } from "@/hooks/useFarm";
import { showRewardPopup } from "@/components/AdGate";
import { openLink } from "@/lib/telegram-client";
import { cn } from "@/lib/utils";

export const TIGORIX_URL = "https://t.me/Tigorixbot/play";
const TIGORIX_LOGO = assetUrl(logo.url);

function Bar({ label, value, target }: { label: string; value: number; target: number }) {
  const pct = Math.min(100, (value / Math.max(1, target)) * 100);
  const done = value >= target;
  return (
    <div>
      <div className="flex justify-between text-xs font-bold">
        <span>{label}</span>
        <span className={done ? "text-usdt" : "text-muted-foreground"}>{Math.min(value, target)}/{target}</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full transition-all duration-700", done ? "bg-usdt" : "bg-primary")} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function useClaimAction() {
  const claim = useClaimTigorixBonus();
  const { refetch } = useTigorixBonus();
  return {
    pending: claim.isPending,
    run: async (onDone?: () => void) => {
      const r = await refetch();
      if (!r.data?.ready) {
        toast.error("Not done yet — watch all the ads in both apps first.");
        return;
      }
      claim.mutate(undefined, {
        onSuccess: (res) => {
          onDone?.();
          showRewardPopup(res.reward, "Tigorix partner bonus 🎉");
        },
        onError: (e) => toast.error(friendlyError(e)),
      });
    },
  };
}

/** Pop-up shown every time the app opens until the bonus is claimed. */
let shownThisOpen = false;
export function TigorixBonusPopup() {
  const { data } = useTigorixBonus();
  const action = useClaimAction();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (shownThisOpen || !data?.enabled || data.claimed) return;
    shownThisOpen = true;
    const t = setTimeout(() => setOpen(true), 800);
    return () => clearTimeout(t);
  }, [data]);
  if (!open || !data || data.claimed) return null;
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-background/80 p-5 backdrop-blur-sm">
      <div className="relative w-full max-w-sm animate-fade-up rounded-3xl border-2 border-accent/60 bg-card p-6 text-center shadow-2xl">
        <button onClick={() => setOpen(false)} aria-label="Close" className="absolute right-4 top-4 text-muted-foreground"><X className="h-5 w-5" /></button>
        <img src={TIGORIX_LOGO} alt="Tigorix" className="animate-coin-bounce mx-auto h-24 w-24 rounded-3xl border-4 border-accent object-cover" />
        <p className="mt-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">🎁 Daily partner bonus</p>
        <p className="mt-1 text-4xl font-black text-primary">+{data.reward.toLocaleString()} FOX</p>
        <p className="mt-3 text-sm">
          Watch <b>{data.foxTarget}</b> Adsgram ads in 🦊 Fox Farm and <b>{data.tigorixTarget}</b> in 🐯 Tigorix today to claim your {data.reward.toLocaleString()} FOX!
        </p>
        <p className="mt-2 text-xs font-bold text-muted-foreground">🦊 Fox Farm {Math.min(data.foxAds, data.foxTarget)}/{data.foxTarget} · 🐯 Tigorix {Math.min(data.tigorixAds, data.tigorixTarget)}/{data.tigorixTarget}</p>
        <button onClick={() => openLink(TIGORIX_URL)} className="animate-glow mt-4 w-full rounded-2xl bg-gradient-to-r from-accent to-primary py-3 font-black text-primary-foreground">🚀 Open Tigorix</button>
        <button disabled={action.pending} onClick={() => void action.run(() => setOpen(false))} className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-secondary py-3 font-bold text-secondary-foreground disabled:opacity-50">
          {action.pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "🎁"} Check &amp; Claim
        </button>
        <button onClick={() => setOpen(false)} className="mt-2 w-full rounded-2xl border border-border py-3 font-bold text-muted-foreground">Later</button>
      </div>
    </div>
  );
}

export function TigorixBonus({ compact = false }: { compact?: boolean }) {
  const { data, isFetching, refetch } = useTigorixBonus();
  const claim = useClaimTigorixBonus();
  const action = useClaimAction();
  if (!data || !data.enabled) return null;
  if (compact) {
    if (data.claimed) return null;
    return (
      <div className="animate-fade-up rounded-3xl border border-accent/40 bg-secondary/60 p-3">
        <div className="flex items-center gap-3">
          <img src={TIGORIX_LOGO} alt="Tigorix" className="h-14 w-14 rounded-2xl border-2 border-accent object-cover" />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">🎁 Daily partner bonus</p>
            <p className="text-xl font-black text-primary">+{data.reward.toLocaleString()} FOX</p>
            <p className="text-[11px] font-bold text-muted-foreground">🦊 Fox Farm {Math.min(data.foxAds, data.foxTarget)}/{data.foxTarget} · 🐯 Tigorix {Math.min(data.tigorixAds, data.tigorixTarget)}/{data.tigorixTarget}</p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button onClick={() => openLink(TIGORIX_URL)} className="rounded-2xl bg-gradient-to-r from-accent to-primary py-2.5 text-sm font-black text-primary-foreground">🚀 Open Tigorix</button>
          <button disabled={action.pending} onClick={() => void action.run()} className="flex items-center justify-center gap-1 rounded-2xl border border-border bg-card py-2.5 text-sm font-bold disabled:opacity-50">
            {action.pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "🎁"} Check &amp; Claim
          </button>
        </div>
      </div>
    );
  }

  const Req = ({ ok, text }: { ok: boolean; text: string }) => (
    <li className="flex items-center gap-2 text-sm font-bold">
      {ok ? <CheckCircle2 className="h-4 w-4 text-usdt" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
      {text}
    </li>
  );

  return (
    <div className="animate-fade-up rounded-3xl border border-primary/30 bg-card p-4 shadow-lg shadow-primary/10">
      <div className="flex items-center gap-3">
        <img src={TIGORIX_LOGO} alt="Tigorix" className="h-12 w-12 rounded-xl bg-muted object-cover" />
        <div className="min-w-0 flex-1">
          <p className="font-black">🤝 Tigorix Partner Bonus</p>
          <p className="text-xs text-muted-foreground">One-time reward</p>
        </div>
        <span className="rounded-full bg-usdt/15 px-2.5 py-1 text-xs font-black text-usdt">+{data.reward.toLocaleString()}</span>
      </div>

      <ul className="mt-3 space-y-1.5">
        <Req ok={data.started} text="Start the Tigorix mini app" />
        <Req ok={data.tigorixAds >= data.tigorixTarget} text="Watch all ads in Tigorix today" />
        <Req ok={data.foxAds >= data.foxTarget} text="Watch all Adsgram ads in Fox Farm today" />
      </ul>

      {!data.linked && (
        <p className="mt-3 rounded-2xl bg-muted/60 px-3 py-2 text-[11px] font-bold text-muted-foreground">
          Tigorix ads can&apos;t be counted yet — this site isn&apos;t connected to Tigorix.
        </p>
      )}

      <div className="mt-3 space-y-2">
        <Bar label="Fox Farm ads" value={data.foxAds} target={data.foxTarget} />
        <Bar label="Tigorix ads" value={data.tigorixAds} target={data.tigorixTarget} />
      </div>

      {data.claimed ? (
        <p className="mt-3 flex items-center justify-center gap-1 rounded-2xl bg-usdt/15 py-3 text-sm font-black text-usdt">
          <CheckCircle2 className="h-4 w-4" /> Bonus claimed
        </p>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button onClick={() => openLink(TIGORIX_URL)} className="flex items-center justify-center gap-1 rounded-2xl bg-secondary py-2.5 text-sm font-bold text-secondary-foreground">
              <ExternalLink className="h-4 w-4" /> Open Tigorix
            </button>
            <button onClick={() => void refetch()} disabled={isFetching} className="flex items-center justify-center gap-1 rounded-2xl bg-secondary py-2.5 text-sm font-bold text-secondary-foreground disabled:opacity-50">
              <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} /> Check Progress
            </button>
          </div>
          <button
            disabled={!data.ready || claim.isPending}
            onClick={() =>
              claim.mutate(undefined, {
                onSuccess: (r) => showRewardPopup(r.reward, "Tigorix partner bonus 🎉"),
                onError: (e) => toast.error(friendlyError(e)),
              })
            }
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 font-black text-primary-foreground disabled:opacity-50"
          >
            {claim.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Gift className="h-5 w-5" />}
            Claim {data.reward.toLocaleString()} Fox Coins
          </button>
        </>
      )}
    </div>
  );
}
