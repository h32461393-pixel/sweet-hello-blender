import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Play, Globe, Sparkles } from "lucide-react";
import { GuideCard } from "@/components/AppShell";
import { cn } from "@/lib/utils";
import { useAdsState, useClaimAdView, friendlyError } from "@/hooks/useFarm";
import { adsEnabled, showRewardedAd } from "@/lib/adsgram";
import { openLink } from "@/lib/telegram-client";
const NETWORK_LOGOS: Record<string, string> = {
  adsgram: "https://www.google.com/s2/favicons?domain=adsgram.ai&sz=128",
  adsgram_int: "https://www.google.com/s2/favicons?domain=adsgram.ai&sz=128",
  monetag: "https://www.google.com/s2/favicons?domain=monetag.com&sz=128",
  gigapub: "https://www.google.com/s2/favicons?domain=gigapub.tech&sz=128",
};

const CONSENT_KEY = "foxfarm.ads.consent";

type Section = "ads" | "sites";

export function AdsTab() {
  const { data, isLoading } = useAdsState();
  const claim = useClaimAdView();
  const [section, setSection] = useState<Section>("ads");
  const [busy, setBusy] = useState<string | null>(null);
  const [consent, setConsent] = useState<boolean>(
    typeof window !== "undefined" && window.localStorage.getItem(CONSENT_KEY) === "1",
  );

  function giveConsent() {
    window.localStorage.setItem(CONSENT_KEY, "1");
    setConsent(true);
  }

  async function watchAd(id: string, label: string) {
    if (busy) return;
    setBusy(id);
    try {
      if (id === "adsgram" || id === "adsgram_int") {
        await showRewardedAd();
      } else {
        throw new Error(`${label} is being connected. Please try another one.`);
      }
      const res = await claim.mutateAsync({ source: id as "adsgram" });
      toast.success(`🎬 +${res.reward} FOX added`);
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setBusy(null);
    }
  }

  async function visitSite(url: string) {
    if (busy) return;
    setBusy("site");
    openLink(url);
    try {
      await new Promise((r) => setTimeout(r, 15_000));
      const res = await claim.mutateAsync({ source: "site" as const });
      toast.success(`🌐 +${res.reward} FOX added`);
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setBusy(null);
    }
  }

  const networks = data?.networks ?? [];
  const site = data?.site;
  const siteLeft = site ? Math.max(0, site.cap - site.used) : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-black">🎬 Watch &amp; Earn</h1>
        <span className="text-sm font-bold text-primary">
          {isLoading ? "…" : `+${data?.earnedToday ?? 0} FOX today`}
        </span>
      </div>

      {!consent ? (
        <div className="rounded-3xl border border-border bg-card p-5 text-center">
          <p className="text-4xl">📺</p>
          <p className="mt-2 font-extrabold">Turn on rewarded ads?</p>
          <p className="mt-1 text-sm text-muted-foreground">
            You choose to see ads here. You can keep using every other part of Fox Farm without
            them.
          </p>
          <button
            onClick={giveConsent}
            className="mt-4 w-full rounded-2xl bg-primary py-3 font-bold text-primary-foreground"
          >
            Yes, show me ads
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {networks.map((n) => {
            const left = Math.max(0, n.cap - n.used);
            const disabled = busy !== null || left === 0 || !adsEnabled();
            return (
              <div key={n.id} className="rounded-3xl border border-border bg-card p-4">
                <div className="flex items-center gap-3">
                  {(n.logo || NETWORK_LOGOS[n.id]) ? (
                    <img
                      src={n.logo || NETWORK_LOGOS[n.id]}
                      alt={n.label}
                      className="h-10 w-10 rounded-xl object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                      <Sparkles className="h-5 w-5" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-extrabold">{n.label}</p>
                    <p className="text-xs text-muted-foreground">
                      +{n.reward} FOX per ad · {n.used}/{n.cap} today
                    </p>
                  </div>
                </div>

                <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${n.cap ? Math.min(100, (n.used / n.cap) * 100) : 0}%` }}
                  />
                </div>

                <button
                  onClick={() => watchAd(n.id, n.label)}
                  disabled={disabled}
                  className={cn(
                    "mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 font-bold text-primary-foreground transition",
                    disabled && "opacity-50",
                  )}
                >
                  {busy === n.id ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Play className="h-5 w-5" />
                  )}
                  {left === 0 ? "Daily limit reached" : "Watch ad"}
                </button>
              </div>
            );
          })}

          {!adsEnabled() && (
            <p className="text-center text-[11px] text-muted-foreground">
              Ads are being connected. Everything else keeps working normally.
            </p>
          )}

          <GuideCard title="How rewards are verified">
            A reward is added only after the ad provider confirms a fully watched ad. Daily limits
            and a short cooldown apply, and every view is recorded on our server.
          </GuideCard>
        </div>
      )}
    </div>
  );
}
