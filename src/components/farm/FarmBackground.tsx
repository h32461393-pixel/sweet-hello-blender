/**
 * Animated farm backdrop: sky, sun/moon, drifting clouds, birds or stars, rolling hills,
 * a barn and swaying grass. Pure CSS transforms (GPU-friendly) so it stays smooth on phones.
 */
export function FarmBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-0 mx-auto h-[100dvh] max-w-md overflow-hidden"
    >
      {/* sky */}
      <div className="absolute inset-0 bg-gradient-to-b from-sky-top via-sky-bottom to-background" />

      {/* sun (light) */}
      <div className="absolute right-6 top-6 dark:hidden">
        <div className="animate-sun relative h-20 w-20">
          {Array.from({ length: 12 }).map((_, i) => (
            <span
              key={i}
              className="absolute left-1/2 top-1/2 h-1.5 w-9 -translate-y-1/2 origin-left rounded-full bg-sun/50"
              style={{ transform: `rotate(${i * 30}deg)` }}
            />
          ))}
        </div>
        <div className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sun shadow-[0_0_40px_10px_var(--sun)]" />
      </div>

      {/* moon + stars (dark) */}
      <div className="absolute right-8 top-8 hidden h-12 w-12 rounded-full bg-sun shadow-[0_0_36px_6px_var(--sun)] dark:block">
        <span className="absolute left-2 top-3 h-2.5 w-2.5 rounded-full bg-foreground/10" />
        <span className="absolute bottom-3 right-3 h-1.5 w-1.5 rounded-full bg-foreground/10" />
      </div>
      <div className="absolute inset-x-0 top-0 hidden h-64 dark:block">
        {STARS.map(([x, y, d], i) => (
          <span
            key={i}
            className="animate-twinkle absolute h-1 w-1 rounded-full bg-sun"
            style={{ left: `${x}%`, top: `${y}%`, ["--dur" as string]: `${2 + d}s`, ["--delay" as string]: `${d}s` }}
          />
        ))}
      </div>

      {/* clouds */}
      {CLOUDS.map((c, i) => (
        <div
          key={i}
          className="animate-cloud absolute left-0"
          style={{ top: c.top, ["--dur" as string]: c.dur, ["--delay" as string]: c.delay }}
        >
          <Cloud scale={c.scale} />
        </div>
      ))}

      {/* birds (light) */}
      <div className="animate-bird absolute left-0 top-28 text-foreground/40 dark:hidden" style={{ ["--delay" as string]: "-6s" }}>
        <Bird />
      </div>

      {/* hills + barn */}
      <svg className="absolute inset-x-0 bottom-16 w-full" viewBox="0 0 400 180" preserveAspectRatio="none">
        <path d="M0 90 Q80 40 170 80 T400 60 V180 H0Z" className="fill-hill-1" />
        <g transform="translate(300 52)">
          <rect x="0" y="16" width="44" height="34" rx="2" className="fill-barn" />
          <path d="M-4 18 L22 0 L48 18Z" className="fill-wood" />
          <rect x="15" y="30" width="14" height="20" className="fill-card" opacity=".85" />
          <path d="M15 30 L29 50 M29 30 L15 50" className="stroke-barn" strokeWidth="2" />
        </g>
        <path d="M0 120 Q100 80 210 115 T400 105 V180 H0Z" className="fill-hill-2" />
        <path d="M0 150 Q120 125 240 148 T400 140 V180 H0Z" className="fill-hill-3" />
      </svg>
      <div className="absolute inset-x-0 bottom-0 h-16 bg-hill-3" />

      {/* grass tufts */}
      <div className="absolute inset-x-0 bottom-16 flex justify-around px-4">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <span
            key={i}
            className="animate-sway block h-5 w-3 rounded-t-full bg-hill-2"
            style={{ ["--delay" as string]: `${i * -0.4}s`, ["--dur" as string]: `${2.6 + (i % 3) * 0.5}s` }}
          />
        ))}
      </div>
    </div>
  );
}

const CLOUDS = [
  { top: "3.5rem", dur: "70s", delay: "-10s", scale: 1 },
  { top: "8rem", dur: "95s", delay: "-50s", scale: 0.7 },
  { top: "1.5rem", dur: "120s", delay: "-80s", scale: 0.55 },
];

const STARS: [number, number, number][] = [
  [8, 12, 0.2], [20, 30, 1.4], [33, 8, 0.8], [45, 22, 2], [58, 10, 0.5], [70, 35, 1.1],
  [12, 48, 1.7], [28, 60, 0.3], [52, 44, 1.9], [64, 58, 0.9], [84, 50, 1.3], [92, 20, 0.6],
];

function Cloud({ scale }: { scale: number }) {
  return (
    <svg width={140 * scale} height={60 * scale} viewBox="0 0 140 60" className="fill-cloud drop-shadow-sm">
      <ellipse cx="40" cy="38" rx="32" ry="20" />
      <ellipse cx="72" cy="28" rx="30" ry="24" />
      <ellipse cx="102" cy="40" rx="30" ry="18" />
      <rect x="20" y="38" width="105" height="20" rx="10" />
    </svg>
  );
}

function Bird() {
  return (
    <svg width="36" height="14" viewBox="0 0 36 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M2 8 Q6 2 10 8 Q14 2 18 8" />
      <path d="M22 5 Q25 1 28 5 Q31 1 34 5" opacity=".7" />
    </svg>
  );
}
