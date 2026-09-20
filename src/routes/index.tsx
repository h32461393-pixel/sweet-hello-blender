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

  const run = useCallback(async () => {
    const wa = getWebApp();
    wa?.ready();
    wa?.expand();
    const initData = getInitData();
    if (!initData) {
      throw new Error("Please open Fox Farm inside Telegram from @Fox_farm1_bot.");
    }
    await sync({ data: { initData } });
  }, [sync]);

  if (!ready) return <Splash onReady={onReady} run={run} />;

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
