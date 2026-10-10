import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { AdOverlay, requireAd } from "@/components/AdGate";

/** Temporary harness mirroring index.tsx: the ad trigger mounts BEFORE AdOverlay. */
function Interstitial() {
  useEffect(() => {
    requireAd("adsgram_int").catch(() => {});
  }, []);
  return null;
}

export const Route = createFileRoute("/adtest")({
  component: () => (
    <main className="p-6">
      <Interstitial />
      <h1 data-testid="marker">ADTEST</h1>
      <AdOverlay />
    </main>
  ),
});
