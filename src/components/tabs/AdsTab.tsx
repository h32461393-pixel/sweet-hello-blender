import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Play, Globe, ShieldCheck, ExternalLink } from "lucide-react";
import { GuideCard, SectionTitle } from "@/components/AppShell";
import { cn } from "@/lib/utils";
import { useAdsState, useClaimAdView, friendlyError } from "@/hooks/useFarm";
import { adsEnabled, showRewardedAd } from "@/lib/adsgram";
import { openLink } from "@/lib/telegram-client";
import { PARTNER_SITES } from "@/lib/constants";

const CONSENT_KEY = "foxfarm.ads.consent";

export function AdsTab() {
  const { data, isLoading } = useAdsState();
  const claim = useClaimAdView();
  const [busy, setBusy] = useState<"ad" | "site" | null>(null);
  const [consent, setConsent] = useState<boolean>(
    typeof window !== "undefined" && window.localStorage.getItem(CONSENT_KEY) === "1",
  );

  function giveConsent() {
    window.localStorage.setItem(CONSENT_KEY, "1");
    setConsent(true);
  }

  async function watchAd() {
    if (busy) return;
    setBusy("ad");
    try {
      await showRewardedAd();
      const res = await claim.mutateAsync({ source: "adsgram" as const });
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

  const ad = data?.ad;
  const site = data?.site;
  const adLeft = ad ? Math.max(0, ad.cap - ad.used) : 0;
  const siteLeft = site ? Math.max(0, site.cap - site.used) : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-black">🎬 Watch &amp; Earn</h1>
        <span className="text-sm font-bold text-primary">
          {isLoading ? "…" : `+${data?.earnedToday ?? 0} FOX today`}
        </span>
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Ads are shown only on this screen, only after you tap the button, and only as a short
        rewarded video. Mining, tasks, referrals and withdrawals all work fully without ever
        watching an ad.
      </p>

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
          <p className="mt-2 text-[11px] text-muted-foreground">
            You can simply stay on another tab if you prefer no ads.
          </p>
        </div>
      ) : (
        <>
          <SectionTitle>Rewarded video</SectionTitle>
          <div className="rounded-3xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-extrabold">Watch a short ad</p>
                <p className="text-sm text-muted-foreground">
                  +{ad?.reward ?? 5} FOX per completed view
                </p>
              </div>
              <span className="rounded-full bg-muted px-3 py-1 text-xs font-bold">
                {ad ? `${ad.used}/${ad.cap}` : "—"}
              </span>
            </div>

            <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${ad && ad.cap ? Math.min(100, (ad.used / ad.cap) * 100) : 0}%` }}
              />
            </div>

            <button
              onClick={watchAd}
              disabled={!adsEnabled() || busy !== null || adLeft === 0}
              className={cn(
                "mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 font-bold text-primary-foreground transition",
                (!adsEnabled() || busy !== null || adLeft === 0) && "opacity-50",
              )}
            >
              {busy === "ad" ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Play className="h-5 w-5" />
              )}
              {adLeft === 0 ? "Daily limit reached" : "Watch ad"}
            </button>

            {!adsEnabled() && (
              <p className="mt-2 text-center text-[11px] text-muted-foreground">
                Ads are being connected. Everything else keeps working normally.
              </p>
            )}
          </div>

          <SectionTitle>Visit a partner site</SectionTitle>
          <div className="space-y-2">
            {PARTNER_SITES.map((s) => (
              <div
                key={s.url}
                className="flex items-center justify-between rounded-2xl border border-border bg-card p-4"
              >
                <div className="min-w-0">
                  <p className="truncate font-bold">{s.title}</p>
                  <p className="text-xs text-muted-foreground">
                    Stay 15 seconds · +{site?.reward ?? 10} FOX
                  </p>
                </div>
                <button
                  onClick={() => visitSite(s.url)}
                  disabled={busy !== null || siteLeft === 0}
                  className={cn(
                    "flex shrink-0 items-center gap-1 rounded-xl bg-secondary px-3 py-2 text-sm font-bold text-secondary-foreground",
                    (busy !== null || siteLeft === 0) && "opacity-50",
                  )}
                >
                  {busy === "site" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Globe className="h-4 w-4" />
                  )}
                  Visit
                </button>
              </div>
            ))}
            <p className="text-center text-[11px] text-muted-foreground">
              {site ? `${site.used}/${site.cap} visits used today` : ""}
            </p>
          </div>
        </>
      )}

      <a
        href="/payouts"
        target="_blank"
        rel="noreferrer"
        className="flex items-center justify-between rounded-2xl border border-primary/30 bg-primary/5 p-4"
      >
        <span className="flex items-center gap-2 text-sm font-bold">
          <ShieldCheck className="h-4 w-4 text-primary" /> Public payout proof
        </span>
        <ExternalLink className="h-4 w-4 text-muted-foreground" />
      </a>

      <GuideCard title="How rewards are verified">
        A reward is added only after the ad provider confirms a fully watched ad. Daily limits and
        a short cooldown apply, and every view is recorded on our server. Rewards are intentionally
        small and realistic: {ad?.reward ?? 5} FOX per ad, up to {ad?.cap ?? 25} ads a day.
      </GuideCard>
    </div>
  );
}
