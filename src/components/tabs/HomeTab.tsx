import { useEffect, useMemo, useState } from "react";
import { Coins, Gift, HelpCircle, Moon, Pickaxe, Send, Sun, Ticket, Wallet } from "lucide-react";
import { MiningScene } from "@/components/farm/MiningScene";
import { openFarmGuide } from "@/components/farm/FarmGuide";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { GuideCard, SectionTitle, type TabKey } from "@/components/AppShell";
import logo from "@/assets/fox-logo.png.asset.json";
import { assetUrl, COMMUNITY_URL, NETWORK_LOGOS, PAYMENT_URL } from "@/lib/constants";
import { useAdsState, useTasks } from "@/hooks/useFarm";
import { openLink, haptic } from "@/lib/telegram-client";
import { useTheme } from "@/lib/theme";
import { requireAd, showRewardPopup } from "@/components/AdGate";
import { randomAdsgram } from "@/lib/adsgram";
import {
  useHomeState,
  useStartMining,
  useClaimMining,
  useClaimDaily,
  useClaimRewardCode,
  friendlyError,
} from "@/hooks/useFarm";

function useTick() {
  const [, setN] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setN((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, []);
}

function fmt(ms: number) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
}

export function HomeTab({ onTab }: { onTab?: (t: TabKey) => void }) {
  useTick();
  const { theme, toggle } = useTheme();
  const { data, isLoading, isError, refetch } = useHomeState();
  const start = useStartMining();
  const claim = useClaimMining();
  const daily = useClaimDaily();
  const code = useClaimRewardCode();
  const [codeValue, setCodeValue] = useState("");

  const miningState = useMemo(() => {
    if (!data) return { running: false, claimable: false, left: 0, progress: 0 };
    const startedAt = data.user.miningStartedAt ? new Date(data.user.miningStartedAt).getTime() : null;
    if (!startedAt || data.user.miningClaimed) return { running: false, claimable: false, left: 0, progress: 0 };
    const total = data.mining.durationMinutes * 60_000;
    const endsAt = startedAt + total;
    const left = Math.max(0, endsAt - Date.now());
    return { running: left > 0, claimable: left === 0, left, progress: total ? 1 - left / total : 0 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, Math.floor(Date.now() / 1000)]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-16 animate-pulse rounded-3xl bg-muted" />
        <div className="h-28 animate-pulse rounded-3xl bg-muted" />
        <div className="h-64 animate-pulse rounded-3xl bg-muted" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="grid place-items-center gap-3 py-16 text-center">
        <span className="text-4xl">📡</span>
        <p className="text-sm font-semibold">Network error. Could not load your farm.</p>
        <button
          onClick={() => refetch()}
          className="rounded-2xl bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground"
        >
          Retry
        </button>
      </div>
    );
  }

  const u = data.user;
  const dailyRewards = data.daily.rewards;
  const nextDay = data.daily.claimedToday ? u.streakDay : Math.min(u.streakDay % dailyRewards.length, dailyRewards.length - 1) + 1;

  return (
    <div className="space-y-4">
      {/* user header */}
      <div className="flex items-center gap-3 rounded-3xl border border-border bg-card/85 p-2.5 shadow-sm backdrop-blur">
        <img src={u.photoUrl ?? assetUrl(logo.url)} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">Hi, {u.firstName ?? "farmer"} 👋</p>
          <p className="truncate text-xs text-muted-foreground">
            {u.username ? `@${u.username}` : `ID ${u.telegramId}`}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={openFarmGuide}
          aria-label="Open the farm guide"
          title="Farm guide"
          className="h-10 w-10 shrink-0 rounded-full bg-card"
        >
          <HelpCircle />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={toggle}
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          aria-pressed={theme === "dark"}
          className="h-10 w-10 shrink-0 rounded-full bg-card"
        >
          {theme === "dark" ? <Sun /> : <Moon />}
        </Button>
      </div>

      {/* balance */}
      <div className="relative overflow-hidden rounded-3xl border-4 border-wood/70 bg-gradient-to-br from-barn via-primary to-accent p-5 text-primary-foreground shadow-xl">
        <div className="animate-shine pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-primary-foreground/15 to-transparent" />
        <span className="animate-coin-bounce absolute right-4 top-4 grid h-12 w-12 place-items-center rounded-full border-4 border-coin-edge bg-coin text-lg font-black text-accent-foreground shadow-lg">F</span>
        <p className="text-xs font-semibold opacity-90">🌾 FOX Balance</p>
        <p className="mt-1 text-4xl font-black tabular-nums">{u.balance.toLocaleString()}</p>
        <p className="mt-1 text-xs opacity-90">
          ≈ ${(u.balance / 100000).toFixed(4)} USDT · 100,000 FOX = $1
        </p>
      </div>

      {/* mining */}
      <div className="rounded-3xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 font-extrabold">
            <Pickaxe className="h-5 w-5 text-primary" /> Mining
          </p>
          <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-bold text-secondary-foreground">
            {data.mining.reward} FOX / {data.mining.durationMinutes}min
          </span>
        </div>

        <div className="my-4">
          <MiningScene
            mode={miningState.running ? "running" : miningState.claimable ? "ready" : "idle"}
            progress={miningState.progress}
          />
          <p className="mt-2 text-center text-sm font-semibold tabular-nums">
            {miningState.running
              ? fmt(miningState.left)
              : miningState.claimable
                ? "Ready to claim!"
                : "Not mining"}
          </p>
        </div>

        {miningState.claimable ? (
          <button
            disabled={claim.isPending}
            onClick={async () => {
              haptic();
              try {
                await requireAd(randomAdsgram);
              } catch (e) {
                { toast.error(friendlyError(e)); return; }
              }
              claim.mutate({} as never, {
                onSuccess: (r) => showRewardPopup(r.reward, "Mining"),
                onError: (e) => toast.error(friendlyError(e)),
              });
            }}
            className="animate-glow w-full rounded-2xl bg-usdt py-3 font-bold text-usdt-foreground disabled:opacity-50 active:scale-[0.98]"
          >
            {claim.isPending ? "Claiming…" : `Claim ${data.mining.reward} FOX`}
          </button>
        ) : (
          <button
            disabled={miningState.running || start.isPending}
            onClick={async () => {
              haptic();
              try {
                await requireAd(randomAdsgram);
              } catch (e) {
                { toast.error(friendlyError(e)); return; }
              }
              start.mutate({} as never, {
                onSuccess: () => toast.success("⛏️ Mining started!"),
                onError: (e) => toast.error(friendlyError(e)),
              });
            }}
            className="w-full rounded-2xl bg-primary py-3 font-bold text-primary-foreground disabled:opacity-50 active:scale-[0.98]"
          >
            {miningState.running ? "Mining in progress…" : start.isPending ? "Starting…" : "Start mining"}
          </button>
        )}
        <GuideCard title="How mining works">
          Start mining, wait 1 hour, then claim. Mining stops after each hour — you must claim
          before starting again. The bot messages you when it's ready.
        </GuideCard>
      </div>

      {/* quick actions */}
      <div className="grid grid-cols-3 gap-3">
        {([
          { icon: Coins, label: "Tasks", tab: "tasks" },
          { icon: Send, label: "Refer", tab: "refer" },
          { icon: Wallet, label: "Withdraw", tab: "profile" },
        ] as const).map(({ icon: Icon, label, tab }) => (
          <button
            key={label}
            onClick={() => onTab?.(tab)}
            className="flex flex-col items-center gap-1 rounded-2xl border border-border bg-card py-3 text-xs font-bold active:scale-[0.98]"
          >
            <Icon className="h-5 w-5 text-primary" />
            {label}
          </button>
        ))}
      </div>

      <QuickTasks onTab={onTab} />

      {/* reward code */}
      <SectionTitle>🎟️ Reward code</SectionTitle>
      <div className="rounded-3xl border border-border bg-card p-4">
        <div className="flex gap-2">
          <input
            value={codeValue}
            onChange={(e) => setCodeValue(e.target.value)}
            placeholder="Enter code"
            maxLength={40}
            className="flex-1 rounded-xl border border-input bg-background px-3 py-2 text-sm uppercase outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            disabled={code.isPending || !codeValue.trim()}
            onClick={async () => {
              try {
                await requireAd(randomAdsgram);
              } catch (e) {
                { toast.error(friendlyError(e)); return; }
              }
              code.mutate({ code: codeValue } as never, {
                onSuccess: (r) => {
                  showRewardPopup(r.reward, "Reward code");
                  setCodeValue("");
                },
                onError: (e) => toast.error(friendlyError(e)),
              });
            }}
            className="rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50"
          >
            {code.isPending ? "…" : "Claim"}
          </button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          <Ticket className="mr-1 inline h-3.5 w-3.5" />
          Get reward codes from our community channel.
        </p>
      </div>

      {/* daily reward */}
      <SectionTitle>📅 Daily reward</SectionTitle>
      <div className="rounded-3xl border border-border bg-card p-4">
        <div className="grid grid-cols-7 gap-1.5">
          {dailyRewards.map((amt, i) => {
            const done = data.daily.claimedToday ? i < u.streakDay : i < u.streakDay;
            return (
              <div
                key={i}
                className={`rounded-xl border p-1.5 text-center text-[10px] font-bold ${
                  done ? "border-usdt bg-usdt/10" : "border-border bg-muted/50"
                }`}
              >
                <div className="text-muted-foreground">D{i + 1}</div>
                <div>{amt}</div>
              </div>
            );
          })}
        </div>
        <button
          disabled={data.daily.claimedToday || daily.isPending}
          onClick={() => {
            haptic();
            daily.mutate({} as never, {
              onSuccess: (r) => toast.success(`🎁 Day ${r.day}: +${r.reward} FOX`),
              onError: (e) => toast.error(friendlyError(e)),
            });
          }}
          className="mt-3 w-full rounded-2xl bg-accent py-3 font-bold text-accent-foreground disabled:opacity-50 active:scale-[0.98]"
        >
          <Gift className="mr-2 inline h-4 w-4" />
          {data.daily.claimedToday ? "Claimed today — come back tomorrow" : `Claim day ${nextDay}`}
        </button>
        <GuideCard title="Streak rules">
          Claim every day to move up the streak. Miss a day and the streak restarts at day 1. All
          daily resets happen at 00:00:00 UTC.
        </GuideCard>
      </div>

      {/* channels */}
      <div className="grid grid-cols-2 gap-3 pt-1">
        <button
          onClick={() => openLink(COMMUNITY_URL)}
          className="rounded-2xl bg-secondary py-3 text-center text-sm font-bold text-secondary-foreground"
        >
          💬 Community
        </button>
        <button
          onClick={() => openLink(PAYMENT_URL)}
          className="rounded-2xl bg-usdt py-3 text-center text-sm font-bold text-usdt-foreground"
        >
          💸 Payments
        </button>
      </div>

    </div>
  );
}

/** Two unfinished tasks + two ad networks with views left; refresh automatically as they complete. */
function QuickTasks({ onTab }: { onTab?: ((t: TabKey) => void) | undefined }) {
  const tasks = useTasks();
  const ads = useAdsState();
  const openTasks = (tasks.data?.tasks ?? []).filter((t) => !t.done).slice(0, 2);
  const openAds = (ads.data?.networks ?? []).filter((n) => n.used < n.cap).slice(0, 2);
  if (!openTasks.length && !openAds.length) return null;
  return (
    <>
      <SectionTitle>⚡ Quick tasks</SectionTitle>
      <div className="space-y-2">
        {openTasks.map((t) => (
          <button key={t.id} onClick={() => onTab?.("tasks")} className="animate-fade-up flex w-full items-center gap-3 rounded-2xl border border-primary/20 bg-gradient-to-r from-card to-primary/10 p-3 text-left shadow-sm active:scale-[0.99]">
            <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-secondary ring-2 ring-primary/20">
              <img src={t.iconUrl || assetUrl(logo.url)} alt="" className="h-full w-full object-cover" loading="lazy" />
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-bold">{t.title}</span>
            <span className="animate-glow rounded-lg bg-primary px-3 py-1 text-xs font-black text-primary-foreground">🪙 +{t.reward}</span>
          </button>
        ))}
        {openAds.map((n) => (
          <button key={n.id} onClick={() => onTab?.("ads")} className="animate-fade-up flex w-full items-center gap-3 rounded-2xl border border-usdt/25 bg-gradient-to-r from-card to-usdt/10 p-3 text-left shadow-sm active:scale-[0.99]">
            <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-muted ring-2 ring-usdt/25">
              <img src={n.logo || NETWORK_LOGOS[n.id] || assetUrl(logo.url)} alt={n.label} className="h-full w-full object-cover p-1" loading="lazy" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold">{n.label}</span>
              <span className="block text-xs text-muted-foreground">{n.cap - n.used} ads left today</span>
            </span>
            <span className="rounded-lg bg-usdt/15 px-3 py-1 text-xs font-black text-usdt">+{n.reward}</span>
          </button>
        ))}
      </div>
    </>
  );
}
