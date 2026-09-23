import { Check, Copy, Loader2, Send, Users } from "lucide-react";
import { toast } from "sonner";
import { GuideCard, SectionTitle } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { friendlyError, useClaimReferralRewards, useProfileState } from "@/hooks/useFarm";
import { MINI_APP_URL } from "@/lib/constants";
import { openLink } from "@/lib/telegram-client";

export function ReferTab() {
  const { data, isLoading, error, refetch } = useProfileState();
  const claim = useClaimReferralRewards();

  if (isLoading) return <p className="py-12 text-center text-sm text-muted-foreground">Loading referrals…</p>;
  if (error || !data) {
    return (
      <div className="space-y-3 py-12 text-center">
        <p className="text-sm text-destructive">{friendlyError(error)}</p>
        <Button onClick={() => refetch()}>Try again</Button>
      </div>
    );
  }

  const refs = data.referrals;
  const link = `${MINI_APP_URL}?startapp=ref${data.user.telegramId}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Invite link copied");
    } catch {
      toast.error("Could not copy the link");
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-black">👥 Refer friends</h1>

      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Referrals", value: refs.count.toLocaleString() },
          { label: "Active", value: refs.active.toLocaleString() },
          { label: "Earned", value: refs.earnedTotal.toLocaleString() },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-border bg-card p-3 text-center">
            <p className="text-lg font-black">{s.value}</p>
            <p className="text-[11px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-usdt/30 bg-usdt p-4 text-usdt-foreground shadow-lg shadow-usdt/15">
        <p className="text-xs font-semibold opacity-90">Unclaimed referral rewards</p>
        <p className="text-3xl font-black">{refs.pendingTotal.toLocaleString()} FOX</p>
        <Button
          variant="secondary"
          disabled={claim.isPending || refs.pendingTotal <= 0}
          onClick={() => claim.mutate(undefined, {
            onSuccess: (r) => toast.success(`🎉 +${r.reward.toLocaleString()} FOX claimed`),
            onError: (e) => toast.error(friendlyError(e)),
          })}
          className="mt-3 w-full"
        >
          {claim.isPending ? <Loader2 className="animate-spin" /> : <Check />}
          {refs.pendingTotal > 0 ? "Claim rewards" : "Nothing to claim"}
        </Button>
      </div>

      <div className="rounded-2xl border border-border bg-card p-3">
        <p className="mb-1 text-xs font-bold text-muted-foreground">Your invite link</p>
        <p className="truncate text-sm">{link}</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={copyLink}>
            <Copy /> Copy
          </Button>
          <Button
            onClick={() => openLink(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent("🦊 Join Fox Farm and earn FOX tokens!")}`)}
          >
            <Send /> Share
          </Button>
        </div>
      </div>

      <SectionTitle>How referral rewards work</SectionTitle>
      <div className="space-y-2 rounded-2xl border border-border bg-card p-4 text-sm">
        <p>🥚 Friend joins — <b>200 FOX</b> (pending)</p>
        <p>🌱 Friend watches 10 ads on day 1 — <b>400 FOX</b></p>
        <p>🌳 Friend watches 15 ads on day 2 — <b>600 FOX</b></p>
        <p className="border-t border-border pt-2 font-bold">Total 1,200 FOX per friend</p>
      </div>

      <SectionTitle>Referral history</SectionTitle>
      {refs.list.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
          <Users className="mx-auto mb-2 h-6 w-6" />
          No referrals yet. Share your personal link to begin.
        </p>
      ) : (
        <ul className="space-y-2">
          {refs.list.map((r) => (
            <li key={r.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary">
                {r.fake ? "⚠️" : r.status === "paid" ? "✅" : "⏳"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{r.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {r.fake ? "Invalid referral · no reward" : `Join ${r.stages.join ? "✓" : "·"}  Day 1 ${r.stages.day1 ? "✓" : "·"}  Day 2 ${r.stages.day2 ? "✓" : "·"}`}
                </p>
              </div>
              <span className="text-xs font-black text-primary">
                {r.pending > 0 ? `+${r.pending.toLocaleString()}` : r.status}
              </span>
            </li>
          ))}
        </ul>
      )}

      <GuideCard title="Fair play">
        Accounts sharing the same device or IP address are suspended, and their referral rewards
        are not paid.
      </GuideCard>
    </div>
  );
}
