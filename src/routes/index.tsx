import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { AdOverlay, requireAd } from "@/components/AdGate";
import { preloadAds } from "@/lib/adsgram";
import { useServerFn } from "@tanstack/react-start";
import { Toaster } from "@/components/ui/sonner";
import { Splash } from "@/components/Splash";
import { AppShell, type TabKey } from "@/components/AppShell";
import { HomeTab } from "@/components/tabs/HomeTab";
import { TasksTab } from "@/components/tabs/TasksTab";
import { AdsTab } from "@/components/tabs/AdsTab";
import { ReferTab } from "@/components/tabs/ReferTab";
import { ProfileTab } from "@/components/tabs/ProfileTab";
import { syncUser, getAppStatus } from "@/lib/farm.functions";
import { useQuery } from "@tanstack/react-query";
import { ChannelGate } from "@/components/ChannelGate";
import { getInitData, getWebApp } from "@/lib/telegram-client";
import { MINI_APP_URL, BOT_USERNAME, assetUrl } from "@/lib/constants";
import logo from "@/assets/fox-logo.png.asset.json";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Fox Farm — Watch Ads, Complete Tasks, Earn USDT" },
      {
        name: "description",
        content:
          "Fox Farm is a Telegram mini app where you mine FOX tokens, complete tasks, refer friends and withdraw USDT.",
      },
      { property: "og:title", content: "Fox Farm — Earn USDT on Telegram" },
      {
        property: "og:description",
        content: "Mine FOX every hour, complete tasks, invite friends and withdraw USDT BEP-20.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<TabKey>("home");
  const onReady = useCallback(() => setReady(true), []);
  const sync = useServerFn(syncUser);
  const [suspended, setSuspended] = useState<string | null>(null);
  const [outside, setOutside] = useState(false);

  const run = useCallback(async () => {
    const wa = getWebApp();
    wa?.ready();
    wa?.expand();
    const initData = getInitData();
    if (!initData) {
      // Opened in a normal browser (not Telegram): show a welcome page instead of an error.
      setOutside(true);
      return;
    }
    const res = await sync({ data: { initData, device: await deviceId() } });
    if (res.user.suspended) setSuspended(res.user.suspendReason ?? "Your account was suspended.");
  }, [sync]);

  if (!ready) return <Splash onReady={onReady} run={run} />;
  if (outside) return <OpenInTelegram />;
  if (suspended)
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-8 text-center">
        <div className="text-6xl">🚫</div>
        <h1 className="text-2xl font-bold text-foreground">Account suspended</h1>
        <p className="max-w-sm text-muted-foreground">
          <span className="font-semibold text-foreground">Reason:</span> {suspended}
        </p>
        <p className="text-sm text-muted-foreground">If you think this is a mistake, contact support in our community.</p>
      </main>
    );

  return (
    <ChannelGate>
      <MaintenanceGate>
      <HomeInterstitial tab={tab} />
      <AppShell tab={tab} onTab={setTab}>
        {tab === "home" && <HomeTab onTab={setTab} />}
        {tab === "tasks" && <TasksTab />}
        {tab === "ads" && <AdsTab />}
        {tab === "refer" && <ReferTab />}
        {tab === "profile" && <ProfileTab />}
      </AppShell>
      <AdOverlay />
      <Toaster position="top-center" />
      </MaintenanceGate>
    </ChannelGate>
  );

}

/** Maintenance screen (admin exempt) and optional notice banner, both set from the admin Settings tab. */
function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const fn = useServerFn(getAppStatus);
  const q = useQuery({
    queryKey: ["app-status"],
    queryFn: () => fn({ data: { initData: getInitData() } }),
    refetchInterval: 60_000,
    retry: 1,
  });
  if (q.data?.maintenance)
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-8 text-center">
        <div className="text-6xl">🛠️</div>
        <h1 className="text-2xl font-bold text-foreground">Under maintenance</h1>
        <p className="max-w-sm text-muted-foreground">{q.data.maintenanceText}</p>
      </main>
    );
  return (
    <>
      {q.data?.notice ? (
        <div className="mx-auto max-w-md bg-accent/20 px-4 py-2 text-center text-xs font-bold text-foreground">📢 {q.data.notice}</div>
      ) : null}
      {children}
    </>
  );
}

/** Adsgram interstitial on app open and every time the user returns to Home. */
function HomeInterstitial({ tab }: { tab: TabKey }) {
  useEffect(() => {
    preloadAds();
  }, []);
  useEffect(() => {
    if (tab === "home") requireAd("adsgram_int").catch(() => {});
  }, [tab]);
  return null;
}

function OpenInTelegram() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-5 bg-background p-8 text-center">
      <img src={assetUrl(logo.url)} alt="Fox Farm" className="animate-fox-bob w-44 drop-shadow-xl" />
      <h1 className="text-3xl font-bold text-foreground">Fox Farm 🦊</h1>
      <p className="max-w-sm text-muted-foreground">
        Fox Farm is a Telegram Mini App. Mine FOX every hour, complete tasks, invite friends,
        watch rewarded ads and withdraw USDT (BEP-20).
      </p>
      <a
        href={MINI_APP_URL}
        className="rounded-2xl bg-primary px-6 py-3 font-semibold text-primary-foreground shadow-lg"
      >
        Open in Telegram
      </a>
      <div className="flex gap-4 text-sm">
        <a href={`https://t.me/${BOT_USERNAME}`} className="text-primary underline">
          @{BOT_USERNAME}
        </a>
        <a href="/payouts" className="text-primary underline">
          Payout proof
        </a>
      </div>
    </main>
  );
}

/** Stable per-device id (hash of device traits + a stored random seed). */
async function deviceId(): Promise<string> {
  try {
    let seed = localStorage.getItem("foxfarm.dev");
    if (!seed) {
      seed = crypto.randomUUID();
      localStorage.setItem("foxfarm.dev", seed);
    }
    const traits = [
      seed,
      navigator.userAgent,
      navigator.language,
      screen.width + "x" + screen.height + "x" + screen.colorDepth,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      String(navigator.hardwareConcurrency ?? ""),
    ].join("|");
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(traits));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 40);
  } catch {
    return "";
  }
}
