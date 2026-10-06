import logo from "@/assets/fox-logo.png.asset.json";
import { assetUrl } from "@/lib/constants";

type Mode = "idle" | "running" | "ready";

/** The fox digging in the field: idle (sleeping), running (digging + coins flying), ready (coin pile). */
export function MiningScene({ mode, progress }: { mode: Mode; progress: number }) {
  return (
    <div className="relative h-44 overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-sky-top to-sky-bottom">
      {/* small sun/moon */}
      <span className="absolute right-4 top-3 h-7 w-7 rounded-full bg-sun shadow-[0_0_20px_4px_var(--sun)]" />
      {/* field */}
      <div className="absolute inset-x-0 bottom-0 h-20 bg-hill-2" />
      <div className="absolute inset-x-0 bottom-0 h-14 rounded-t-[50%] bg-soil">
        {[12, 30, 55, 72, 88].map((x, i) => (
          <span key={i} className="absolute h-1.5 w-1.5 rounded-full bg-soil-dark" style={{ left: `${x}%`, top: `${30 + (i % 3) * 18}%` }} />
        ))}
      </div>
      {/* fence */}
      <div className="absolute bottom-16 left-3 flex gap-2">
        {[0, 1, 2].map((i) => (
          <span key={i} className="block h-6 w-1.5 rounded-t-sm bg-wood" />
        ))}
        <span className="absolute left-0 top-2 h-1 w-full bg-wood" />
      </div>

      {/* fox */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
        <div className="relative">
          <img
            src={assetUrl(logo.url)}
            alt="Fox miner"
            className={`h-24 w-24 object-contain drop-shadow-lg ${mode === "running" ? "animate-fox-dig" : mode === "ready" ? "animate-fox-bob" : "opacity-90"}`}
          />
          {mode === "running" && (
            <>
              <span className="animate-pick absolute -right-6 top-6 text-3xl">⛏️</span>
              {[-14, 8, 18].map((dx, i) => (
                <span
                  key={i}
                  className="animate-dirt absolute bottom-1 right-0 h-2 w-2 rounded-full bg-soil-dark"
                  style={{ ["--dx" as string]: `${dx}px`, ["--delay" as string]: `${i * 0.3}s` }}
                />
              ))}
              {[-40, 10, 45, -15].map((dx, i) => (
                <Coin
                  key={i}
                  className="animate-coin-rise absolute bottom-6 left-1/2"
                  style={{ ["--dx" as string]: `${dx}px`, ["--delay" as string]: `${i * 0.6}s` }}
                />
              ))}
            </>
          )}
          {mode === "idle" &&
            [0, 1].map((i) => (
              <span
                key={i}
                className="animate-zzz absolute -right-2 top-2 text-sm font-black text-foreground/70"
                style={{ ["--delay" as string]: `${i * 1.3}s` }}
              >
                z
              </span>
            ))}
        </div>
      </div>

      {/* coin pile when ready */}
      {mode === "ready" && (
        <div className="absolute bottom-4 right-8 flex items-end gap-0.5">
          {[0, 1, 2].map((i) => (
            <Coin key={i} className="animate-coin-bounce" style={{ ["--delay" as string]: `${i * 0.2}s` }} />
          ))}
        </div>
      )}

      {/* progress */}
      {mode === "running" && (
        <div className="absolute inset-x-3 top-3 mr-10 h-2 overflow-hidden rounded-full bg-card/70">
          <div className="h-full rounded-full bg-coin transition-all duration-1000" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      )}
    </div>
  );
}

function Coin({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <span
      className={`grid h-6 w-6 place-items-center rounded-full border-2 border-coin-edge bg-coin text-[10px] font-black text-accent-foreground shadow ${className}`}
      style={style}
    >
      F
    </span>
  );
}
