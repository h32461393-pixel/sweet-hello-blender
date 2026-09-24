import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Toaster } from "@/components/ui/sonner";
import { Splash } from "@/components/Splash";
import { AppShell, type TabKey } from "@/components/AppShell";
import { HomeTab } from "@/components/tabs/HomeTab";
import { TasksTab } from "@/components/tabs/TasksTab";
import { AdsTab } from "@/components/tabs/AdsTab";
import { ReferTab } from "@/components/tabs/ReferTab";
import { ProfileTab } from "@/components/tabs/ProfileTab";
import { syncUser } from "@/lib/farm.functions";
import { getInitData, getWebApp } from "@/lib/telegram-client";


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

  const run = useCallback(async () => {
    const wa = getWebApp();
    wa?.ready();
    wa?.expand();
    const initData = getInitData();
    if (!initData) {
      throw new Error("Please open Fox Farm inside Telegram from @Fox_farm1_bot.");
    }
    const res = await sync({ data: { initData, device: await deviceId() } });
    if (res.user.suspended) setSuspended(res.user.suspendReason ?? "Your account was suspended.");
  }, [sync]);

  if (!ready) return <Splash onReady={onReady} run={run} />;
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
    <>
      <AppShell tab={tab} onTab={setTab}>
        {tab === "home" && <HomeTab onTab={setTab} />}
        {tab === "tasks" && <TasksTab />}
        {tab === "ads" && <AdsTab />}
        {tab === "refer" && <ReferTab />}
        {tab === "profile" && <ProfileTab />}
      </AppShell>
      <Toaster position="top-center" />
    </>
  );

}

/** Stable per-device id (hash of device traits + a stored random seed). */
async function deviceId(): Promise<string> {
  try {
    const traits = [
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
