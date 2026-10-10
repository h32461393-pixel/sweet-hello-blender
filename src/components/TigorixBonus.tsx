import { toast } from "sonner";
import { CheckCircle2, Circle, Gift, Loader2, RefreshCw, ExternalLink } from "lucide-react";
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

export function TigorixBonus() {
  const { data, isFetching, refetch } = useTigorixBonus();
  const claim = useClaimTigorixBonus();
  if (!data || !data.enabled) return null;

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
        <Req ok={data.tigorixAds >= data.tigorixTarget} text="Watch all Adsgram ads in Tigorix today" />
        <Req ok={data.foxAds >= data.foxTarget} text="Watch all Adsgram ads in Fox Farm today" />
      </ul>

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
