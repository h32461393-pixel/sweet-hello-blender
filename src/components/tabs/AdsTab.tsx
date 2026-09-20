import { useState } from "react";
import { GuideCard } from "@/components/AppShell";
import { cn } from "@/lib/utils";

export function AdsTab() {
  const [mode, setMode] = useState<"ads" | "sites">("ads");

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-black">🎬 Earn</h1>

      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-muted p-1">
        {(["ads", "sites"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={cn(
              "rounded-xl py-2 text-sm font-bold transition",
              mode === m ? "bg-card shadow-sm" : "text-muted-foreground",
            )}
          >
            {m === "ads" ? "Watch ads" : "Visit sites"}
          </button>
        ))}
      </div>

      <div className="rounded-3xl border border-border bg-card p-6 text-center">
        <p className="text-5xl">{mode === "ads" ? "📺" : "🌐"}</p>
        <p className="mt-3 font-extrabold">
          {mode === "ads" ? "Watch ads to earn FOX" : "Visit sites to earn FOX"}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          The ad provider is not connected yet. Rewards are paid only after the provider confirms a
          completed view on our server.
        </p>
        <button
          disabled
          className="mt-4 w-full rounded-2xl bg-primary py-3 font-bold text-primary-foreground opacity-50"
        >
          Coming soon
        </button>
      </div>

      <GuideCard title="Why rewards are delayed">
        Every view is checked on our server before coins are added. Views that cannot be verified
        do not pay out.
      </GuideCard>
    </div>
  );
}
