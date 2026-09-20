import { useEffect, useState } from "react";
import { Coins, Gift, Pickaxe, Send, Ticket, Wallet } from "lucide-react";
import { GuideCard, SectionTitle } from "@/components/AppShell";
import logo from "@/assets/fox-logo.png.asset.json";

const COMMUNITY = "https://t.me/foxfarm_community";
const PAYMENTS = "https://t.me/foxfarmpay";

function useCountdown(endsAt: number | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  if (!endsAt) return null;
  const left = Math.max(0, endsAt - now);
  const h = Math.floor(left / 3600000);
  const m = Math.floor((left % 3600000) / 60000);
  const s = Math.floor((left % 60000) / 1000);
  return { left, text: `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s` };
}

const DAILY = [30, 40, 50, 70, 90, 120, 150];

export function HomeTab() {
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const cd = useCountdown(endsAt);
  const mining = cd !== null && cd.left > 0;
  const claimable = endsAt !== null && cd !== null && cd.left === 0;

  return (
    <div className="space-y-4">
      {/* user header */}
      <div className="flex items-center gap-3">
        <img src={logo.url} alt="" className="h-11 w-11 rounded-full" />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">Hi, farmer 👋</p>
          <p className="truncate text-xs text-muted-foreground">Telegram account pending</p>
        </div>
      </div>

      {/* balance */}
      <div className="rounded-3xl bg-gradient-to-br from-primary to-accent p-5 text-primary-foreground shadow-lg">
        <p className="text-xs font-semibold opacity-90">🌾 FOX Balance</p>
        <p className="mt-1 text-4xl font-black tabular-nums">0</p>
        <p className="mt-1 text-xs opacity-90">≈ $0.0000 USDT · 100,000 FOX = $1</p>
      </div>

      {/* mining */}
      <div className="rounded-3xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 font-extrabold">
            <Pickaxe className="h-5 w-5 text-primary" /> Mining
          </p>
          <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-bold text-secondary-foreground">
            100 FOX / hour
          </span>
        </div>

        <div className="my-4 grid place-items-center">
          <div
            className={`grid h-28 w-28 place-items-center rounded-full border-4 ${mining ? "animate-pulse border-primary" : "border-muted"}`}
          >
            <span className="text-3xl">{mining ? "⛏️" : claimable ? "🎉" : "🦊"}</span>
          </div>
          <p className="mt-2 text-sm font-semibold tabular-nums">
            {mining ? cd.text : claimable ? "Ready to claim!" : "Not mining"}
          </p>
        </div>

        {claimable ? (
          <button
            onClick={() => setEndsAt(null)}
            className="w-full rounded-2xl bg-usdt py-3 font-bold text-usdt-foreground active:scale-[0.98]"
          >
            Claim 100 FOX
          </button>
        ) : (
          <button
            disabled={mining}
            onClick={() => setEndsAt(Date.now() + 3600_000)}
            className="w-full rounded-2xl bg-primary py-3 font-bold text-primary-foreground disabled:opacity-50 active:scale-[0.98]"
          >
            {mining ? "Mining in progress…" : "Start mining"}
          </button>
        )}
        <GuideCard title="How mining works">
          Start mining, wait 1 hour, then claim. Mining stops after each hour — you must claim
          before starting again. The bot messages you when it's ready.
        </GuideCard>
      </div>

      {/* quick actions */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: Coins, label: "Tasks" },
          { icon: Send, label: "Refer" },
          { icon: Wallet, label: "Withdraw" },
        ].map(({ icon: Icon, label }) => (
          <button
            key={label}
            className="flex flex-col items-center gap-1 rounded-2xl border border-border bg-card py-3 text-xs font-bold active:scale-[0.98]"
          >
            <Icon className="h-5 w-5 text-primary" />
            {label}
          </button>
        ))}
      </div>

      {/* reward code */}
      <SectionTitle>🎟️ Reward code</SectionTitle>
      <div className="rounded-3xl border border-border bg-card p-4">
        <div className="flex gap-2">
          <input
            placeholder="Enter code"
            className="flex-1 rounded-xl border border-input bg-background px-3 py-2 text-sm uppercase outline-none focus:ring-2 focus:ring-ring"
          />
          <button className="rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground">
            Claim
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
          {DAILY.map((amt, i) => (
            <div
              key={i}
              className="rounded-xl border border-border bg-muted/50 p-1.5 text-center text-[10px] font-bold"
            >
              <div className="text-muted-foreground">D{i + 1}</div>
              <div>{amt}</div>
            </div>
          ))}
        </div>
        <button className="mt-3 w-full rounded-2xl bg-accent py-3 font-bold text-accent-foreground active:scale-[0.98]">
          <Gift className="mr-2 inline h-4 w-4" />
          Claim day 1
        </button>
        <GuideCard title="Streak rules">
          Claim every day to move up the streak. Miss a day and the streak restarts at day 1. All
          daily resets happen at 00:00:00 UTC.
        </GuideCard>
      </div>

      {/* channels */}
      <div className="grid grid-cols-2 gap-3 pt-1">
        <a
          href={COMMUNITY}
          target="_blank"
          rel="noreferrer"
          className="rounded-2xl bg-secondary py-3 text-center text-sm font-bold text-secondary-foreground"
        >
          💬 Community
        </a>
        <a
          href={PAYMENTS}
          target="_blank"
          rel="noreferrer"
          className="rounded-2xl bg-usdt py-3 text-center text-sm font-bold text-usdt-foreground"
        >
          💸 Payments
        </a>
      </div>
    </div>
  );
}
