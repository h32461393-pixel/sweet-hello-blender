import { useEffect, useState } from "react";
import logo from "@/assets/fox-logo.png.asset.json";
import { assetUrl } from "@/lib/constants";

type Phase = "loading" | "error" | "done";

export function Splash({ onReady, run }: { onReady: () => void; run?: () => Promise<void> }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("Waking up the farm…");
  const [attempt, setAttempt] = useState(0);
  const [errorText, setErrorText] = useState(
    "We couldn't reach the farm. Check your internet connection and try again.",
  );


  useEffect(() => {
    let cancelled = false;
    setPhase("loading");
    setProgress(0);

    const steps = [
      "Waking up the farm…",
      "Checking your Telegram account…",
      "Loading your barn…",
      "Almost ready…",
    ];
    let i = 0;
    const tick = window.setInterval(() => {
      if (cancelled) return;
      setProgress((p) => Math.min(p + 7, 95));
      i = (i + 1) % steps.length;
      setMessage(steps[i]!);
    }, 320);

    const boot = async () => {
      try {
        // navigator.onLine is unreliable inside Telegram's Android WebView,
        // so we always try the real request and retry once on a network blip.
        if (run) {
          try {
            await run();
          } catch (err) {
            const m = err instanceof Error ? err.message : "";
            if (!/fetch|network|Failed/i.test(m)) throw err;
            await new Promise((r) => window.setTimeout(r, 1200));
            await run();
          }
        }
        else await new Promise((r) => window.setTimeout(r, 1200));
        if (cancelled) return;
        setProgress(100);
        setPhase("done");
        window.setTimeout(() => !cancelled && onReady(), 350);
      } catch (e) {
        if (cancelled) return;
        setErrorText(
          e instanceof Error && e.message
            ? e.message
            : "We couldn't reach the farm. Check your internet connection and try again.",
        );
        setPhase("error");
      }
    };
    void boot();

    return () => {
      cancelled = true;
      window.clearInterval(tick);
    };
  }, [attempt, onReady, run]);


  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <img
        src={assetUrl(logo.url)}
        alt="Fox Farm"
        className="animate-fox-bob w-56 max-w-[70vw] drop-shadow-xl"
      />

      {phase === "error" ? (
        <div className="mt-8 w-full max-w-xs rounded-2xl border border-destructive/30 bg-card p-5 shadow-sm">
          <p className="text-2xl">📡</p>
          <h2 className="mt-2 font-bold text-destructive">Something went wrong</h2>
          <p className="mt-1 text-sm text-muted-foreground">{errorText}</p>

          <button
            onClick={() => setAttempt((a) => a + 1)}
            className="mt-4 w-full rounded-xl bg-primary px-4 py-2.5 font-semibold text-primary-foreground transition hover:brightness-105 active:scale-[0.98]"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="mt-8 w-full max-w-xs">
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-3 text-sm font-medium text-muted-foreground">{message}</p>
        </div>
      )}
    </div>
  );
}
