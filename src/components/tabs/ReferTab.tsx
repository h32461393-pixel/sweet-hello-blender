import { GuideCard, SectionTitle } from "@/components/AppShell";

const LINK = "https://t.me/Fox_farm1_bot/farm";

export function ReferTab() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-black">👥 Refer friends</h1>

      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Referrals", value: "0" },
          { label: "Active", value: "0" },
          { label: "Earned", value: "0" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-border bg-card p-3 text-center">
            <p className="text-lg font-black">{s.value}</p>
            <p className="text-[11px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="rounded-3xl bg-gradient-to-br from-usdt to-secondary p-4 text-usdt-foreground">
        <p className="text-xs font-semibold opacity-90">Unclaimed referral rewards</p>
        <p className="text-3xl font-black">0 FOX</p>
        <button className="mt-3 w-full rounded-2xl bg-card py-2.5 font-bold text-foreground">
          Claim
        </button>
      </div>

      <div className="rounded-2xl border border-border bg-card p-3">
        <p className="mb-1 text-xs font-bold text-muted-foreground">Your invite link</p>
        <p className="truncate text-sm">{LINK}</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button className="rounded-xl bg-secondary py-2 text-sm font-bold text-secondary-foreground">
            Copy
          </button>
          <a
            href={`https://t.me/share/url?url=${encodeURIComponent(LINK)}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl bg-primary py-2 text-center text-sm font-bold text-primary-foreground"
          >
            Share
          </a>
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
      <p className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
        No referrals yet.
      </p>

      <GuideCard title="Fair play">
        Accounts sharing the same device or IP address are suspended, and their referral rewards
        are not paid.
      </GuideCard>
    </div>
  );
}
