import { useState } from "react";
import { toast } from "sonner";
import { SectionTitle } from "@/components/AppShell";
import { friendlyError, useProfileState, useSetWallet } from "@/hooks/useFarm";
import { getPayoutProof } from "@/lib/farm.functions";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { LANGS, setLang, t, useLang, type LangCode } from "@/lib/i18n";
import { COMMUNITY_URL, MINI_APP_URL, PAYMENT_URL } from "@/lib/constants";
import { openLink } from "@/lib/telegram-client";
import {
  ArrowLeft,
  ArrowLeftRight,
  Bell,
  BellOff,
  Copy,
  Globe,
  Info,
  MessageCircle,
  Trophy,
  Users,
  Wallet,
} from "lucide-react";

type Screen =
  | "main"
  | "wallet"
  | "withdraw"
  | "transactions"
  | "refer"
  | "leaderboard"
  | "notifications"
  | "language"
  | "about";

function Row({
  icon: Icon,
  label,
  href,
  onClick,
  trailing,
}: {
  icon: typeof Wallet;
  label: string;
  href?: string;
  onClick?: () => void;
  trailing?: string | undefined;
}) {
  const inner = (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 text-sm font-semibold active:scale-[0.99]">
      <Icon className="h-5 w-5 shrink-0 text-primary" />
      <span className="flex-1 truncate">{label}</span>
      {trailing ? <span className="text-xs text-muted-foreground">{trailing}</span> : null}
      <span className="text-muted-foreground">›</span>
    </div>
  );
  return href ? (
    <button className="w-full text-left" onClick={() => openLink(href)}>
      {inner}
    </button>
  ) : (
    <button className="w-full text-left" onClick={onClick}>
      {inner}
    </button>
  );
}

function SubHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <button onClick={onBack} className="mb-3 flex items-center gap-2 text-sm font-bold text-primary">
      <ArrowLeft className="h-4 w-4" /> {title}
    </button>
  );
}

const NOTIFY_KEY = "foxfarm.notify";

export function ProfileTab() {
  const lang = useLang();
  const [screen, setScreen] = useState<Screen>("main");
  const { data, isLoading, error } = useProfileState();
  const walletMut = useSetWallet();
  const payoutFn = useServerFn(getPayoutProof);
  const board = useQuery({
    queryKey: ["payout-proof"],
    queryFn: () => payoutFn(),
    enabled: screen === "leaderboard",
    staleTime: 60_000,
  });

  const [walletInput, setWalletInput] = useState<string | null>(null);
  const [notify, setNotify] = useState<boolean>(() =>
    typeof window === "undefined" ? true : window.localStorage.getItem(NOTIFY_KEY) !== "off",
  );

  if (isLoading) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Loading profile… 🦊</p>;
  }
  if (error || !data) {
    return (
      <p className="py-10 text-center text-sm text-destructive">{friendlyError(error)}</p>
    );
  }

  const u = data.user;

  if (screen === "wallet") {
    const value = walletInput ?? u.walletAddress ?? "";
    return (
      <div>
        <SubHeader title={t(lang, "back")} onBack={() => setScreen("main")} />
        <SectionTitle>💳 {t(lang, "wallet")}</SectionTitle>
        <p className="mb-3 text-xs text-muted-foreground">
          Withdrawals are sent in USDT on the BNB Smart Chain (BEP-20). Double-check the address —
          payments to a wrong address cannot be recovered.
        </p>
        <input
          value={value}
          onChange={(e) => setWalletInput(e.target.value)}
          placeholder="0x…"
          spellCheck={false}
          autoComplete="off"
          className="w-full rounded-2xl border border-border bg-card p-3.5 font-mono text-xs outline-none focus:border-primary"
        />
        <button
          disabled={walletMut.isPending}
          onClick={() =>
            walletMut.mutate(value, {
              onSuccess: () => toast.success(t(lang, "saved")),
              onError: (e) => toast.error(friendlyError(e)),
            })
          }
          className="mt-3 w-full rounded-2xl bg-primary p-3.5 text-sm font-extrabold text-primary-foreground disabled:opacity-50"
        >
          {walletMut.isPending ? "…" : t(lang, "save")}
        </button>
      </div>
    );
  }

  if (screen === "transactions") {
    return (
      <div>
        <SubHeader title={t(lang, "back")} onBack={() => setScreen("main")} />
        <SectionTitle>🔁 {t(lang, "transactions")}</SectionTitle>
        {data.transactions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No transactions yet.</p>
        ) : (
          <ul className="space-y-2">
            {data.transactions.map((tx) => (
              <li
                key={tx.id}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 text-sm"
              >
                <span className="text-lg">{tx.amount >= 0 ? "🪙" : "💸"}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{tx.note ?? tx.kind}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(tx.at).toLocaleString()}
                  </p>
                </div>
                <span className={tx.amount >= 0 ? "font-bold text-primary" : "font-bold text-destructive"}>
                  {tx.amount >= 0 ? "+" : ""}
                  {tx.amount.toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  if (screen === "refer") {
    return (
      <div>
        <SubHeader title={t(lang, "back")} onBack={() => setScreen("main")} />
        <SectionTitle>👥 {t(lang, "referFriends")}</SectionTitle>
        <div className="mb-3 grid grid-cols-2 gap-2 text-center">
          <div className="rounded-2xl border border-border bg-card p-3">
            <p className="text-xl font-black">{data.referrals.count}</p>
            <p className="text-[11px] text-muted-foreground">Friends</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-3">
            <p className="text-xl font-black">{data.referrals.pendingTotal.toLocaleString()}</p>
            <p className="text-[11px] text-muted-foreground">Pending FOX</p>
          </div>
        </div>
        <button
          onClick={() => {
            const link = `https://t.me/Fox_farm1_bot/farm?startapp=ref${u.telegramId}`;
            void navigator.clipboard?.writeText(link).catch(() => {});
            openLink(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent("🦊 Join Fox Farm and earn FOX tokens!")}`);
          }}
          className="mb-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary p-3.5 text-sm font-extrabold text-primary-foreground"
        >
          <Copy className="h-4 w-4" /> Share invite link
        </button>
        {data.referrals.list.length === 0 ? (
          <p className="text-sm text-muted-foreground">No referrals yet — share your link to earn up to 1,200 FOX per friend.</p>
        ) : (
          <ul className="space-y-2">
            {data.referrals.list.map((r) => (
              <li key={r.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 text-sm">
                <span className="text-lg">{r.fake ? "⚠️" : r.status === "paid" ? "✅" : "⏳"}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{r.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {r.fake
                      ? "Fake / same device — no reward"
                      : `Join ${r.stages.join ? "✓" : "…"} · Day 1 ${r.stages.day1 ? "✓" : "…"} · Day 2 ${r.stages.day2 ? "✓" : "…"}`}
                  </p>
                </div>
                <span className="font-bold text-primary">
                  {r.pending > 0 ? `+${r.pending.toLocaleString()}` : r.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  if (screen === "leaderboard") {
    return (
      <div>
        <SubHeader title={t(lang, "back")} onBack={() => setScreen("main")} />
        <SectionTitle>🏆 {t(lang, "leaderboard")}</SectionTitle>
        {board.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <ul className="space-y-2">
            {(board.data?.leaderboard ?? []).map((r) => (
              <li key={r.rank} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 text-sm">
                <span className="w-8 text-center text-lg">
                  {r.rank === 1 ? "🥇" : r.rank === 2 ? "🥈" : r.rank === 3 ? "🥉" : r.rank}
                </span>
                <span className="flex-1 truncate font-semibold">{r.user}</span>
                <span className="font-bold text-primary">{r.earned.toLocaleString()} FOX</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  if (screen === "notifications") {
    return (
      <div>
        <SubHeader title={t(lang, "back")} onBack={() => setScreen("main")} />
        <SectionTitle>🔔 {t(lang, "notifications")}</SectionTitle>
        <button
          onClick={() => {
            const next = !notify;
            setNotify(next);
            window.localStorage.setItem(NOTIFY_KEY, next ? "on" : "off");
          }}
          className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3.5 text-sm font-semibold"
        >
          {notify ? <Bell className="h-5 w-5 text-primary" /> : <BellOff className="h-5 w-5 text-muted-foreground" />}
          <span className="flex-1 text-left">Bot notifications</span>
          <span className={notify ? "text-primary" : "text-muted-foreground"}>{notify ? "On" : "Off"}</span>
        </button>
        <p className="mt-3 text-xs text-muted-foreground">
          Mining-complete alerts, referral updates and withdrawal status messages are sent by the
          Fox Farm bot in Telegram. Turn this off to mute in-app reminders; important security
          messages are always delivered.
        </p>
      </div>
    );
  }

  if (screen === "language") {
    return (
      <div>
        <SubHeader title={t(lang, "back")} onBack={() => setScreen("main")} />
        <SectionTitle>🌐 {t(lang, "language")}</SectionTitle>
        <ul className="space-y-2">
          {LANGS.map((l) => (
            <li key={l.code}>
              <button
                onClick={() => setLang(l.code as LangCode)}
                className={`flex w-full items-center gap-3 rounded-2xl border p-3.5 text-sm font-semibold ${
                  lang === l.code ? "border-primary bg-primary/10" : "border-border bg-card"
                }`}
              >
                <span className="text-lg">{l.flag}</span>
                <span className="flex-1 text-left">{l.label}</span>
                {lang === l.code ? <span className="text-primary">✓</span> : null}
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (screen === "about") {
    return (
      <div>
        <SubHeader title={t(lang, "back")} onBack={() => setScreen("main")} />
        <SectionTitle>ℹ️ {t(lang, "about")}</SectionTitle>
        <div className="space-y-3 rounded-3xl border border-border bg-card p-4 text-sm leading-relaxed">
          <p>
            🦊 <b>Fox Farm</b> is a Telegram mini app where you earn FOX tokens by mining every
            hour, keeping your daily streak, completing tasks, watching optional ads and inviting
            friends.
          </p>
          <p>
            💰 100,000 FOX = $1. Withdraw in USDT (BEP-20): first withdrawal from 10,000 FOX,
            then from 20,000 FOX. A small fee of $0.01 + 5% applies.
          </p>
          <p>
            🔒 Balances are calculated on the server — nobody can change their coins from outside.
            Accounts that share a device or network to farm referrals are suspended.
          </p>
          <p className="text-xs text-muted-foreground">
            Bot: @{MINI_APP_URL.split("/")[3]} · Community: {COMMUNITY_URL} · Payments: {PAYMENT_URL}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 rounded-3xl border border-border bg-card p-4">
        {u.photoUrl ? (
          <img src={u.photoUrl} alt="" className="h-14 w-14 rounded-full object-cover" />
        ) : (
          <div className="grid h-14 w-14 place-items-center rounded-full bg-primary text-2xl text-primary-foreground">
            🦊
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate font-black">{u.firstName ?? "Farmer"}{u.username ? ` · @${u.username}` : ""}</p>
          <p className="text-xs text-muted-foreground">Telegram ID: {u.telegramId}</p>
          <p className="text-xs font-bold text-primary">{u.balance.toLocaleString()} FOX</p>
        </div>
      </div>

      <SectionTitle>{t(lang, "finance")}</SectionTitle>
      <Row icon={Wallet} label={t(lang, "wallet")} onClick={() => setScreen("wallet")} trailing={u.walletAddress ? "✓" : undefined} />
      <Row icon={ArrowLeftRight} label={t(lang, "transactions")} onClick={() => setScreen("transactions")} />

      <SectionTitle>{t(lang, "social")}</SectionTitle>
      <Row icon={Users} label={t(lang, "referFriends")} onClick={() => setScreen("refer")} trailing={String(data.referrals.count)} />
      <Row icon={Trophy} label={t(lang, "leaderboard")} onClick={() => setScreen("leaderboard")} />

      <SectionTitle>{t(lang, "community")}</SectionTitle>
      <Row icon={MessageCircle} label={t(lang, "communityChannel")} href={COMMUNITY_URL} />
      <Row icon={MessageCircle} label={t(lang, "paymentChannel")} href={PAYMENT_URL} />

      <SectionTitle>{t(lang, "preferences")}</SectionTitle>
      <Row icon={Bell} label={t(lang, "notifications")} onClick={() => setScreen("notifications")} trailing={notify ? "On" : "Off"} />
      <Row icon={Globe} label={t(lang, "language")} onClick={() => setScreen("language")} trailing={LANGS.find((l) => l.code === lang)?.label} />
      <Row icon={Info} label={t(lang, "about")} onClick={() => setScreen("about")} />
    </div>
  );
}
