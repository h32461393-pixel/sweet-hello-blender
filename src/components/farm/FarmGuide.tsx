import { useEffect, useState } from "react";
import logo from "@/assets/fox-logo.png.asset.json";
import { assetUrl } from "@/lib/constants";

const KEY = "foxfarm.guide.v1";
const EVENT = "foxfarm:open-guide";

/** Re-open the welcome guide from anywhere (e.g. the "?" button on Home). */
export function openFarmGuide() {
  window.dispatchEvent(new Event(EVENT));
}

const STEPS = [
  { icon: "🦊", title: "Welcome to Fox Farm!", text: "Earn FOX and turn it into real USDT." },
  { icon: "⛏️", title: "Mine every hour", text: "Tap Start mining, wait 1 hour, then Claim." },
  { icon: "✅", title: "Tasks & ads", text: "Finish tasks and watch ads for extra FOX." },
  { icon: "👥", title: "Invite friends", text: "Share your link and earn from real friends." },
  { icon: "💸", title: "Withdraw USDT", text: "100,000 FOX = $1. Withdraw from Profile. Play fair — cheating means suspension." },
];

export function FarmGuide() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setOpen(true);
      else window.dispatchEvent(new Event("foxfarm:guide-closed"));
    } catch {
      /* storage blocked */
    }
    const onOpen = () => {
      setStep(0);
      setOpen(true);
    };
    window.addEventListener(EVENT, onOpen);
    return () => window.removeEventListener(EVENT, onOpen);
  }, []);

  if (!open) return null;
  const s = STEPS[step]!;
  const last = step === STEPS.length - 1;

  const close = () => {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
    window.dispatchEvent(new Event("foxfarm:guide-closed"));
  };

  return (
    <div className="fixed inset-0 z-[60] grid place-items-end bg-foreground/50 p-3 backdrop-blur-sm sm:place-items-center" role="dialog" aria-modal="true" aria-labelledby="farm-guide-title">
      <div key={step} className="animate-pop-in mx-auto w-full max-w-md overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
        <div className="relative h-36 bg-gradient-to-b from-sky-top to-sky-bottom">
          <span className="absolute right-5 top-4 h-8 w-8 rounded-full bg-sun shadow-[0_0_24px_6px_var(--sun)]" />
          <div className="absolute inset-x-0 bottom-0 h-10 rounded-t-[50%] bg-hill-2" />
          <img src={assetUrl(logo.url)} alt="" className="animate-fox-bob absolute bottom-2 left-6 h-24 w-24 object-contain drop-shadow-lg" />
          <span className="animate-coin-bounce absolute bottom-10 right-10 text-5xl">{s.icon}</span>
        </div>
        <div className="p-5">
          <p className="text-xs font-bold text-primary">
            Step {step + 1} of {STEPS.length}
          </p>
          <h2 id="farm-guide-title" className="mt-1 text-xl font-black">{s.title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.text}</p>

          <div className="mt-4 flex justify-center gap-1.5">
            {STEPS.map((_, i) => (
              <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30"}`} />
            ))}
          </div>

          <div className="mt-5 flex gap-2">
            {step > 0 ? (
              <button onClick={() => setStep(step - 1)} className="flex-1 rounded-2xl border border-border py-3 text-sm font-bold">
                Back
              </button>
            ) : (
              <button onClick={close} className="flex-1 rounded-2xl border border-border py-3 text-sm font-bold text-muted-foreground">
                Skip
              </button>
            )}
            <button
              onClick={() => (last ? close() : setStep(step + 1))}
              className="flex-[2] rounded-2xl bg-primary py-3 text-sm font-black text-primary-foreground shadow-lg shadow-primary/30"
            >
              {last ? "Start farming 🌾" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
