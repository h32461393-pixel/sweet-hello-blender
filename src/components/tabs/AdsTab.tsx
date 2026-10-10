import { NETWORK_LOGOS } from "@/lib/constants";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Play, Globe, Sparkles, Clock, CheckCircle2, Timer } from "lucide-react";
import { GuideCard } from "@/components/AppShell";
import { cn } from "@/lib/utils";
import { useAdsState, useClaimAdView, friendlyError } from "@/hooks/useFarm";
import { requireAd, showRewardPopup, useAdCooldown } from "@/components/AdGate";
import type { AdNetwork } from "@/lib/adsgram";
import { openLink } from "@/lib/telegram-client";
import { TigorixBonus } from "@/components/TigorixBonus";


const VISIT_SECONDS = 10;
type Section = "ads" | "sites";

function fmt(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = String(Math.floor(s / 3600)).padStart(2, "0");
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const sec = String(s % 60).padStart(2, "0");
  return `${h}:${m}:${sec}`;
}
const usd = (n: number) => `$${n.toFixed(n < 0.1 ? 4 : 3)}`;

export function AdsTab() {
  const { data, isLoading } = useAdsState();
  const claim = useClaimAdView();
  const cd = useAdCooldown();
  const [section, setSection] = useState<Section>("ads");
  const [busy, setBusy] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(t);
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  async function watchAd(id: string, label: string) {
    if (busy || cd.busy) return;
    setBusy(id);
    try {
      const ad = await requireAd(id as AdNetwork);
      const res = await claim.mutateAsync({ source: id as "adsgram", taps: ad.taps, ms: ad.ms });
      showRewardPopup(res.reward, label, res.taps ?? ad.taps, res.percent);
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setBusy(null);
    }
  }

  function visitSite(id: string, url: string, title: string) {
    if (busy) return;
    setBusy(`site:${id}`);
    openLink(url);
    setCountdown(VISIT_SECONDS);
    let left = VISIT_SECONDS;
    timer.current = setInterval(async () => {
      left -= 1;
      setCountdown(left);
      if (left > 0) return;
      if (timer.current) clearInterval(timer.current);
      try {
        const res = await claim.mutateAsync({ source: "site", siteId: id });
        showRewardPopup(res.reward, title);
      } catch (e) {
        toast.error(friendlyError(e));
      } finally {
        setBusy(null);
        setCountdown(0);
      }
    }, 1000);
  }

  const networks = [...(data?.networks ?? [])].sort(
    (a, b) => Number(a.used >= a.cap) - Number(b.used >= b.cap),
  );
  const sites = data?.sites ?? [];

  return (
    <div className="space-y-4 animate-fade-up">
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-black">🎬 Watch &amp; Earn</h1>
        <span className="rounded-full bg-accent px-3 py-1 text-xs font-black text-accent-foreground">
          {isLoading ? "…" : `+${data?.earnedToday ?? 0} FOX today`}
        </span>
      </div>

      {data && (
        <div className="rounded-3xl bg-primary p-4 text-primary-foreground shadow-lg shadow-primary/20">
          <p className="text-xs font-bold opacity-90">Watch every ad today and earn</p>
          <div className="mt-1 flex items-end justify-between">
            <p className="text-3xl font-black">{data.totalTokens.toLocaleString()} FOX</p>
            <p className="text-lg font-black">≈ {usd(data.totalUsd)}</p>
          </div>
          <p className="mt-2 flex items-center gap-1 text-xs font-bold opacity-90">
            <Timer className="h-3.5 w-3.5" /> Ads reset in {fmt(data.resetAt - now)}
          </p>
        </div>
      )}

      <TigorixBonus />

      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-secondary p-1">
        {(["ads", "sites"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSection(s)}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-black transition-all",
              section === s ? "bg-primary text-primary-foreground shadow-md" : "text-secondary-foreground",
            )}
          >
            {s === "ads" ? <Play className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
            {s === "ads" ? "Watch ads" : "Visit sites"}
          </button>
        ))}
      </div>

      {section === "ads" ? (
        <div className="space-y-3">
          {networks.map((n, i) => {
            const left = Math.max(0, n.cap - n.used);
            const disabled = busy !== null || left === 0 || cd.busy;
            return (
              <div key={n.id} style={{ animationDelay: `${i * 60}ms` }} className="animate-fade-up rounded-3xl border border-border bg-card p-4">
                <div className="flex items-center gap-3">
                  {n.logo || NETWORK_LOGOS[n.id] ? (
                    <img src={n.logo || NETWORK_LOGOS[n.id]} alt={n.label} className="h-11 w-11 rounded-xl bg-muted object-cover p-1" loading="lazy" />
                  ) : (
                    <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary"><Sparkles className="h-5 w-5" /></span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-extrabold">{n.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {n.used}/{n.cap} today · total {n.totalTokens} FOX ≈ {usd(n.totalUsd)}
                    </p>
                    {(n.id === "adsgram" || n.id === "adsgram_int") && (
                      <p className="text-[11px] font-bold text-primary">👆 {n.id === "adsgram" ? "3 taps" : "1 tap"} = 100%</p>
                    )}
                  </div>
                  <span className="rounded-full bg-usdt/15 px-2.5 py-1 text-xs font-black text-usdt">+{n.reward}</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${n.cap ? Math.min(100, (n.used / n.cap) * 100) : 0}%` }} />
                </div>
                <button
                  onClick={() => watchAd(n.id, n.label)}
                  disabled={disabled}
                  className={cn("mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 font-bold text-primary-foreground active:scale-[0.98]", disabled && "opacity-50")}
                >
                  {busy === n.id ? <Loader2 className="h-5 w-5 animate-spin" /> : cd.left > 0 && left > 0 ? <Clock className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                  {left === 0 ? `Resets in ${fmt((data?.resetAt ?? now) - now)}` : cd.left > 0 ? `Ready in ${cd.left}s` : "Watch ad"}
                </button>
              </div>
            );
          })}
          <GuideCard title="How rewards are verified">
            Adsgram Reward: no tap 25%, 1 tap 50%, 2 taps 75%, 3+ taps 100%. Adsgram Interstitial: closed before 10s 25%, 10–15s 50%, watched 15s+ 75%, 1 tap 100%. Monetag, GigaPub, Monetix: tap the ad at least once. Limits reset at 00:00 UTC.
          </GuideCard>
        </div>
      ) : (
        <div className="space-y-3">
          {sites.map((s, i) => {
            const waiting = s.nextAt > now;
            const mine = busy === `site:${s.id}`;
            const disabled = waiting || (busy !== null && !mine);
            return (
              <div key={s.id} style={{ animationDelay: `${i * 60}ms` }} className="animate-fade-up rounded-3xl border border-border bg-card p-4">
                <div className="flex items-center gap-3">
                  {s.icon ? (
                    <img src={s.icon} alt="" className="h-11 w-11 rounded-xl object-cover" loading="lazy" />
                  ) : (
                    <span className="grid h-11 w-11 place-items-center rounded-xl bg-secondary text-secondary-foreground"><Globe className="h-5 w-5" /></span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-extrabold">{s.title}</p>
                    <p className="text-xs text-muted-foreground">Stay {VISIT_SECONDS}s · every 24h</p>
                  </div>
                  <span className="rounded-full bg-usdt/15 px-2.5 py-1 text-xs font-black text-usdt">+{s.reward}</span>
                </div>
                <button
                  onClick={() => visitSite(s.id, s.url, s.title)}
                  disabled={disabled || mine}
                  className={cn(
                    "mt-3 flex w-full items-center justify-center gap-2 rounded-2xl py-3 font-bold",
                    waiting ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground",
                    disabled && !waiting && "opacity-50",
                  )}
                >
                  {mine ? (
                    <><Loader2 className="h-5 w-5 animate-spin" /> {countdown > 0 ? `Wait ${countdown}s…` : "Checking…"}</>
                  ) : waiting ? (
                    <><Clock className="h-5 w-5" /> Open again in {fmt(s.nextAt - now)}</>
                  ) : (
                    <><Globe className="h-5 w-5" /> Visit site</>
                  )}
                </button>
                {waiting && (
                  <p className="mt-2 flex items-center justify-center gap-1 text-[11px] font-bold text-usdt"><CheckCircle2 className="h-3.5 w-3.5" /> Reward collected</p>
                )}
              </div>
            );
          })}
          {!sites.length && (
            <div className="rounded-3xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">🌐 No websites yet. Check back soon!</div>
          )}
          <GuideCard title="How it works">
            Tap Visit site and keep it open for {VISIT_SECONDS} seconds. Come back to collect your FOX. Each site unlocks again after 24 hours.
          </GuideCard>
        </div>
      )}
    </div>
  );
}
