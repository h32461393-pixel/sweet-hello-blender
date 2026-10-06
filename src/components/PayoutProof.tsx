import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BadgeCheck, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PAYMENT_URL, SITE_URL } from "@/lib/constants";
import { getPayoutProof } from "@/lib/farm.functions";
import { openLink } from "@/lib/telegram-client";

/** Public proof of completed USDT payouts (shown on the Withdraw screen). */
export function PayoutProof() {
  const payoutFn = useServerFn(getPayoutProof);
  const proof = useQuery({
    queryKey: ["payout-proof"],
    queryFn: () => payoutFn(),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
  return (
      <section aria-labelledby="payout-proof-title" className="space-y-3 border-t border-border pt-5">
        <div className="flex items-center justify-between gap-2">
          <h2 id="payout-proof-title" className="flex items-center gap-2 text-lg font-extrabold">
            <BadgeCheck className="h-5 w-5 text-usdt" /> Proof of Payouts
          </h2>
          <span className="text-xs font-bold text-usdt">PUBLIC</span>
        </div>
        <p className="text-sm text-muted-foreground">
          Completed USDT withdrawals with transaction IDs you can verify on BscScan.
        </p>
        <div className="grid grid-cols-2 gap-3 border-y border-border py-3">
          <div>
            <p className="text-xs text-muted-foreground">Total paid out</p>
            <p className="text-xl font-extrabold tabular-nums">{proof.isLoading ? "…" : `$${(proof.data?.totalPaidUsd ?? 0).toFixed(4)}`}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Recent payouts</p>
            <p className="text-xl font-extrabold tabular-nums">{proof.isLoading ? "…" : (proof.data?.payouts.length ?? 0)}</p>
          </div>
        </div>
        {proof.isError ? (
          <p className="text-sm text-destructive">Payouts could not be loaded right now.</p>
        ) : proof.data?.payouts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No completed payouts yet.</p>
        ) : (
          <div className="space-y-2">
            {proof.data?.payouts.slice(0, 5).map((p, i) => (
              <div key={`${p.txid ?? p.at}-${i}`} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{p.user} · {p.tokens.toLocaleString()} FOX</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {p.at ? new Date(p.at).toLocaleString("en-GB", { timeZone: "UTC", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) + " UTC" : "—"}
                    {p.txid ? ` · ${p.txid.slice(0, 10)}…` : ""}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold text-usdt">${p.usd.toFixed(4)}</p>
                  {p.txid && (
                    <Button variant="link" className="h-auto p-0 text-xs" onClick={() => openLink(`https://bscscan.com/tx/${p.txid}`)}>
                      Verify <ExternalLink className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="grid gap-2 pt-1">
          <Button className="w-full" onClick={() => openLink(PAYMENT_URL)}>View payout proofs channel</Button>
          <Button variant="outline" className="w-full" onClick={() => openLink(`${SITE_URL}/payouts`)}>Public payout page <ExternalLink /></Button>
        </div>
      </section>
  );
}
