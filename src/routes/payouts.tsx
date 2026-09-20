import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Trophy, BadgeCheck, Clock } from "lucide-react";
import { getPayoutProof } from "@/lib/farm.functions";
import { MINI_APP_URL, PAYMENT_URL } from "@/lib/constants";

export const Route = createFileRoute("/payouts")({
  head: () => ({
    meta: [
      { title: "Fox Farm — Payout Proof & Leaderboard" },
      {
        name: "description",
        content:
          "Public, verifiable list of USDT payouts made by Fox Farm, with transaction IDs, totals paid out and the top earners leaderboard.",
      },
      { property: "og:title", content: "Fox Farm — Payout Proof & Leaderboard" },
      {
        property: "og:description",
        content: "Every Fox Farm USDT payout with its BEP-20 transaction ID, updated live.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Payouts,
});

function Payouts() {
  const fn = useServerFn(getPayoutProof);
  const { data, isLoading } = useQuery({
    queryKey: ["payout-proof"],
    queryFn: () => fn(),
    refetchInterval: 60_000,
  });

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-black">🦊 Fox Farm payout proof</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Every completed withdrawal is listed here with its BEP-20 transaction ID, so anyone can
        verify on-chain that Fox Farm really pays its users. Updated automatically.
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Total paid out</p>
          <p className="text-2xl font-black text-primary">
            ${isLoading ? "…" : (data?.totalPaidUsd ?? 0).toFixed(2)}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Pending</p>
          <p className="text-2xl font-black">
            ${isLoading ? "…" : (data?.pendingUsd ?? 0).toFixed(2)}
          </p>
        </div>
      </div>

      <h2 className="mt-8 flex items-center gap-2 text-lg font-extrabold">
        <BadgeCheck className="h-5 w-5 text-primary" /> Completed payouts
      </h2>
      <div className="mt-2 space-y-2">
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && (data?.payouts.length ?? 0) === 0 && (
          <p className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
            No payouts completed yet. Every payout will appear here the moment it is sent, and is
            also posted in our{" "}
            <a className="font-bold text-primary" href={PAYMENT_URL}>
              payment channel
            </a>
            .
          </p>
        )}
        {data?.payouts.map((p, i) => (
          <div key={i} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <span className="font-bold">{p.user}</span>
              <span className="font-black text-primary">${p.usd.toFixed(2)}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {p.tokens.toLocaleString()} FOX ·{" "}
              {p.at ? new Date(p.at).toLocaleDateString() : "—"}
            </p>
            {p.txid && (
              <a
                className="mt-1 block truncate text-xs font-semibold text-primary"
                href={`https://bscscan.com/tx/${p.txid}`}
                target="_blank"
                rel="noreferrer"
              >
                {p.txid}
              </a>
            )}
          </div>
        ))}
      </div>

      <h2 className="mt-8 flex items-center gap-2 text-lg font-extrabold">
        <Trophy className="h-5 w-5 text-primary" /> Top earners
      </h2>
      <div className="mt-2 overflow-hidden rounded-2xl border border-border bg-card">
        {(data?.leaderboard ?? []).map((r) => (
          <div
            key={r.rank}
            className="flex items-center justify-between border-b border-border/60 px-4 py-2 text-sm last:border-0"
          >
            <span className="font-bold">
              #{r.rank} {r.user}
            </span>
            <span className="text-muted-foreground">{r.earned.toLocaleString()} FOX</span>
          </div>
        ))}
        {!isLoading && (data?.leaderboard.length ?? 0) === 0 && (
          <p className="p-4 text-sm text-muted-foreground">No farmers yet.</p>
        )}
      </div>

      <p className="mt-8 flex items-center gap-2 text-xs text-muted-foreground">
        <Clock className="h-4 w-4" /> Withdrawals are reviewed and paid manually in USDT (BEP-20).
      </p>
      <a
        href={MINI_APP_URL}
        className="mt-4 block rounded-2xl bg-primary py-3 text-center font-bold text-primary-foreground"
      >
        Open Fox Farm
      </a>
    </div>
  );
}
