import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { AdOverlay, requireAd } from "@/components/AdGate";

/** Temporary harness: reproduces the auto-open interstitial flow. */
export const Route = createFileRoute("/adtest")({
  component: () => {
    useEffect(() => {
      requireAd("adsgram_int").catch(() => {});
    }, []);
    return (
      <main className="p-6">
        <h1 data-testid="marker">ADTEST</h1>
        <AdOverlay />
      </main>
    );
  },
});
