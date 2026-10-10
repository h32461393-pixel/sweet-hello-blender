import { PayoutProof } from "@/components/PayoutProof";
import { useState } from "react";
import { toast } from "sonner";
import { SectionTitle } from "@/components/AppShell";
import {
  friendlyError,
  useCreateWithdrawal,
  useProfileState,
  useSetWallet,
  useWithdrawState,
  useVerifyWithdraw,
} from "@/hooks/useFarm";
import { getPayoutProof } from "@/lib/farm.functions";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { LANGS, t, useLang } from "@/lib/i18n";
import { LanguageGrid } from "@/components/LanguagePicker";
import { COMMUNITY_URL, MINI_APP_URL, PAYMENT_URL, SITE_URL } from "@/lib/constants";
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
  Banknote,
  ShieldCheck,
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

  const wd = useWithdrawState(screen === "withdraw");
  const wdMut = useCreateWithdrawal();
  const verifyMut = useVerifyWithdraw();
  const [wdStep, setWdStep] = useState<"req" | "form">("req");
  const [wdInput, setWdInput] = useState("");

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

  if (screen === "withdraw") {
    const w = wd.data;
    const tokens = Math.floor(Number(wdInput) || 0);
    const gross = w ? tokens / w.tokensPerUsd : 0;
    const fee = w ? w.feeFlat + (gross * w.feePercent) / 100 : 0;
    const net = Math.max(0, gross - fee);
    const canSend =
      !!w && !w.hasPending && !!w.walletAddress && tokens >= w.minTokens && tokens <= Math.min(w.balance, w.maxTokens);

    if (wd.isLoading || !w) {
      return (
        <div>
          <SubHeader title={t(lang, "back")} onBack={() => setScreen("main")} />
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      );
    }

    // Step 1: requirements
    if (wdStep === "req") {
      return (
        <div>
          <SubHeader title={t(lang, "back")} onBack={() => setScreen("main")} />
          <div className="rounded-3xl bg-gradient-to-br from-primary to-accent p-5 text-primary-foreground shadow-lg">
            <div className="flex items-center gap-3">
              <UsdtLogo className="h-12 w-12" />
              <div>
                <p className="text-xs opacity-80">Withdrawal requirements</p>
                <p className="text-lg font-black">Complete all to continue</p>
              </div>
            </div>
          </div>
          <ul className="mt-3 space-y-2">
            {w.requirements.map((r) => (
              <li key={r.key} className="rounded-2xl border border-border bg-card p-3.5">
                <div className="flex items-center justify-between text-sm font-bold">
                  <span>{r.done ? "✅" : "⏳"} {r.label}</span>
                  <span className={r.done ? "text-primary" : "text-muted-foreground"}>
                    {Math.min(r.have, r.need)}/{r.need}
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${Math.min(100, (r.have / Math.max(1, r.need)) * 100)}%` }}
                  />
                </div>
              </li>
            ))}
            <li className="rounded-2xl border border-border bg-card p-3.5 text-xs text-muted-foreground">
              💵 Min ${w.minUsd} · Max ${w.maxUsd} per withdrawal · from {w.minTokens.toLocaleString()} FOX
            </li>
          </ul>
          {!w.withdrawalsEnabled ? (
            <p className="mt-3 rounded-2xl bg-muted p-3 text-center text-xs font-semibold">⏸ Withdrawals are paused right now.</p>
          ) : (
            <button
              disabled={!w.requirementsDone || verifyMut.isPending}
              onClick={() =>
                verifyMut.mutate(undefined, {
                  onSuccess: () => setWdStep("form"),
                  onError: (e) => {
                    if (String((e as Error).message).includes("SUSPENDED")) window.location.reload();
                    else toast.error(friendlyError(e));
                  },
                })
              }
              className="mt-3 w-full rounded-2xl bg-primary p-3.5 text-sm font-extrabold text-primary-foreground disabled:opacity-50"
            >
              {verifyMut.isPending ? "Verifying…" : w.requirementsDone ? "Continue →" : "Complete the requirements"}
            </button>
          )}
          <WithdrawHistory items={w.history} />
          <div className="mt-5"><PayoutProof /></div>
        </div>
      );
    }

    return (
      <div>
        <SubHeader title={t(lang, "back")} onBack={() => setWdStep("req")} />
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-accent p-5 text-primary-foreground shadow-lg">
          <UsdtLogo className="absolute -right-4 -top-4 h-28 w-28 opacity-20" />
          <p className="text-xs opacity-80">Available balance</p>
          <p className="text-3xl font-black">{w.balance.toLocaleString()} FOX</p>
          <p className="text-sm font-bold opacity-90">≈ ${(w.balance / w.tokensPerUsd).toFixed(4)} USDT</p>
        </div>

        <div className="mt-3 rounded-3xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm font-bold">
            <UsdtLogo className="h-6 w-6" /> USDT · BNB Smart Chain (BEP-20)
          </div>
          {!w.walletAddress ? (
            <button
              onClick={() => setScreen("wallet")}
              className="mt-3 w-full rounded-2xl bg-secondary p-3 text-sm font-bold text-secondary-foreground"
            >
              Add your USDT (BEP-20) address first
            </button>
          ) : (
            <p className="mt-2 truncate rounded-xl bg-muted px-3 py-2 font-mono text-[11px] text-muted-foreground">
              {w.walletAddress}
            </p>
          )}

          <div className="mt-3 flex items-center gap-2 rounded-2xl border border-border bg-background p-1 pl-3 focus-within:border-primary">
            <input
              value={wdInput}
              onChange={(e) => setWdInput(e.target.value.replace(/[^0-9]/g, ""))}
              inputMode="numeric"
              placeholder={`${w.minTokens}`}
              className="w-full bg-transparent py-2.5 text-sm outline-none"
            />
            <button
              onClick={() => setWdInput(String(Math.min(w.balance, w.maxTokens)))}
              className="shrink-0 rounded-xl bg-secondary px-3 py-2 text-xs font-bold text-secondary-foreground"
            >
              MAX
            </button>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {w.minTokens.toLocaleString()} – {w.maxTokens.toLocaleString()} FOX · fee ${w.feeFlat} + {w.feePercent}%
          </p>
          <div className="mt-3 space-y-1 rounded-2xl bg-muted p-3 text-xs">
            <div className="flex justify-between"><span>Amount</span><span>${gross.toFixed(4)}</span></div>
            <div className="flex justify-between"><span>Fee</span><span>-${Math.min(fee, gross).toFixed(4)}</span></div>
            <div className="flex justify-between text-sm font-black">
              <span>You receive</span>
              <span className="flex items-center gap-1 text-primary"><UsdtLogo className="h-4 w-4" />${net.toFixed(4)}</span>
            </div>
          </div>

          {w.hasPending ? (
            <p className="mt-3 rounded-2xl bg-muted p-3 text-center text-xs font-semibold">
              ⏳ You already have a pending withdrawal.
            </p>
          ) : (
            <button
              disabled={!canSend || wdMut.isPending}
              onClick={() =>
                wdMut.mutate(tokens, {
                  onSuccess: (r) => {
                    setWdInput("");
                    toast.success(`💸 Request sent · $${r.net.toFixed(4)}`);
                  },
                  onError: (e) => toast.error(friendlyError(e)),
                })
              }
              className="mt-3 w-full rounded-2xl bg-primary p-3.5 text-sm font-extrabold text-primary-foreground disabled:opacity-50"
            >
              {wdMut.isPending ? "…" : "Request withdrawal"}
            </button>
          )}
        </div>
        <WithdrawHistory items={w.history} />
          <div className="mt-5"><PayoutProof /></div>
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
              <li key={r.id} className={`flex items-center gap-3 rounded-2xl border bg-card p-3 text-sm ${r.fake ? "border-destructive/40" : "border-border"}`}>
                <span className={`grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full text-sm font-black ${r.fake ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary"}`}>
                  {r.photoUrl ? <img src={r.photoUrl} alt="" className="h-full w-full object-cover" loading="lazy" /> : r.fake ? "!" : (r.name || "?").replace("@", "").slice(0, 1).toUpperCase()}
                </span>
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
        <LeaderboardView data={board.data} loading={board.isLoading} />
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
        <LanguageGrid />
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
      <Row icon={Banknote} label="Withdraw USDT" onClick={() => { setWdStep("req"); setScreen("withdraw"); }} />
      <Row icon={ArrowLeftRight} label={t(lang, "transactions")} onClick={() => setScreen("transactions")} />

      <SectionTitle>{t(lang, "social")}</SectionTitle>
      <Row icon={Users} label={t(lang, "referFriends")} onClick={() => setScreen("refer")} trailing={String(data.referrals.count)} />
      <Row icon={Trophy} label={t(lang, "leaderboard")} onClick={() => setScreen("leaderboard")} />

      <SectionTitle>{t(lang, "community")}</SectionTitle>
      <Row icon={MessageCircle} label={t(lang, "communityChannel")} href={COMMUNITY_URL} />
      <Row icon={MessageCircle} label={t(lang, "paymentChannel")} href={PAYMENT_URL} />
      <Row
        icon={ShieldCheck}
        label="Public payout proof"
        onClick={() => openLink(`${SITE_URL}/payouts`)}
      />

      <SectionTitle>{t(lang, "preferences")}</SectionTitle>
      <Row icon={Bell} label={t(lang, "notifications")} onClick={() => setScreen("notifications")} trailing={notify ? "On" : "Off"} />
      <Row icon={Globe} label={t(lang, "language")} onClick={() => setScreen("language")} trailing={LANGS.find((l) => l.code === lang)?.label} />
      <Row icon={Info} label={t(lang, "about")} onClick={() => setScreen("about")} />

      {u.isAdmin ? (
        <>
          <SectionTitle>Admin</SectionTitle>
          <Row icon={ShieldCheck} label="Admin panel" onClick={() => { window.location.href = "/admin"; }} />
        </>
      ) : null}
    </div>
  );
}

function UsdtLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-label="USDT">
      <circle cx="16" cy="16" r="16" fill="#26A17B" />
      <path
        fill="#fff"
        d="M17.9 17.4v0c-.1 0-.7.1-1.9.1-1 0-1.7 0-1.9-.1v0c-3.7-.2-6.5-.8-6.5-1.6s2.8-1.4 6.5-1.6v2.5c.2 0 .9.1 1.9.1 1.2 0 1.8-.1 1.9-.1v-2.5c3.7.2 6.4.8 6.4 1.6s-2.7 1.4-6.4 1.6m0-3.4V11.8h5.2V8.3H8.9v3.5h5.2V14c-4.2.2-7.4 1-7.4 2s3.2 1.8 7.4 2v7h3.8v-7c4.2-.2 7.4-1 7.4-2s-3.2-1.8-7.4-2"
      />
    </svg>
  );
}

function WithdrawHistory({
  items,
}: {
  items: { id: string; tokens: number; net: number; status: string; txid: string | null; at: string }[];
}) {
  return (
    <>
      <SectionTitle>📜 Withdrawal history</SectionTitle>
      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">No withdrawals yet.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((h) => {
            const tone =
              h.status === "paid"
                ? "bg-primary/15 text-primary"
                : h.status === "rejected"
                  ? "bg-destructive/15 text-destructive"
                  : "bg-muted text-muted-foreground";
            return (
              <li key={h.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 text-sm">
                <UsdtLogo className="h-9 w-9 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-black">${h.net.toFixed(4)} USDT</p>
                  <p className="text-[11px] text-muted-foreground">
                    {h.tokens.toLocaleString()} FOX · {new Date(h.at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${tone}`}>{h.status}</span>
                  {h.txid ? (
                    <button onClick={() => openLink(`https://bscscan.com/tx/${h.txid}`)} className="text-[11px] font-bold text-primary">
                      View tx ↗
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

type BoardRow = { rank: number; user: string; photo?: string | null; value: number };

function LeaderboardView({
  data,
  loading,
}: {
  data?: { leaderboard: { rank: number; user: string; photo?: string | null; earned: number }[]; referralBoard?: { rank: number; user: string; photo?: string | null; count: number }[] };
  loading: boolean;
}) {
  const [kind, setKind] = useState<"earn" | "ref">("earn");
  const rows: BoardRow[] =
    kind === "earn"
      ? (data?.leaderboard ?? []).map((r) => ({ ...r, value: r.earned }))
      : (data?.referralBoard ?? []).map((r) => ({ ...r, value: r.count }));
  const unit = kind === "earn" ? "FOX" : "refs";
  const podium = [rows[1], rows[0], rows[2]];
  const medal = ["🥈", "🥇", "🥉"];
  const heights = ["h-20", "h-28", "h-16"];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-secondary p-1">
        {(["earn", "ref"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            className={`rounded-xl py-2 text-sm font-black transition-all ${kind === k ? "bg-primary text-primary-foreground shadow-md" : "text-secondary-foreground"}`}
          >
            {k === "earn" ? "🏆 Top earners" : "👥 Top referrers"}
          </button>
        ))}
      </div>
      {loading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No data yet</p>
      ) : (
        <>
          <div className="grid grid-cols-3 items-end gap-2 rounded-3xl bg-gradient-to-b from-primary/15 to-card p-4">
            {podium.map((r, i) =>
              r ? (
                <div key={r.rank} className="animate-fade-up flex flex-col items-center gap-1" style={{ animationDelay: `${i * 100}ms` }}>
                  <span className="text-2xl">{medal[i]}</span>
                  <Avatar name={r.user} photo={r.photo} big={i === 1} />
                  <p className="w-full truncate text-center text-xs font-bold">{r.user}</p>
                  <div className={`flex w-full flex-col items-center justify-start rounded-t-2xl bg-primary pt-2 text-primary-foreground ${heights[i]}`}>
                    <span className="text-xs font-black">{r.value.toLocaleString()}</span>
                    <span className="text-[10px] opacity-80">{unit}</span>
                  </div>
                </div>
              ) : (
                <div key={i} />
              ),
            )}
          </div>
          <ul className="space-y-2">
            {rows.slice(3).map((r, i) => (
              <li key={r.rank} style={{ animationDelay: `${i * 40}ms` }} className="animate-fade-up flex items-center gap-3 rounded-2xl border border-border bg-card p-3 text-sm">
                <span className="w-6 text-center font-black text-muted-foreground">{r.rank}</span>
                <Avatar name={r.user} photo={r.photo} />
                <span className="flex-1 truncate font-semibold">{r.user}</span>
                <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-black text-primary">
                  {r.value.toLocaleString()} {unit}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function Avatar({ name, photo, big }: { name: string; photo?: string | null; big?: boolean }) {
  const size = big ? "h-14 w-14 ring-4 ring-primary/40" : "h-10 w-10";
  return (
    <span className={`grid shrink-0 place-items-center overflow-hidden rounded-full bg-primary/15 font-black text-primary ${size}`}>
      {photo ? <img src={photo} alt="" className="h-full w-full object-cover" loading="lazy" /> : name.replace("@", "").slice(0, 1).toUpperCase()}
    </span>
  );
}
