import { type ReactNode } from "react";
import { Home, ListChecks, Play, Users, User, Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";
import { t, useLang } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";

export type TabKey = "home" | "tasks" | "ads" | "refer" | "profile";

const TABS: { key: TabKey; labelKey: string; icon: typeof Home }[] = [
  { key: "home", labelKey: "farm", icon: Home },
  { key: "tasks", labelKey: "tasks", icon: ListChecks },
  { key: "ads", labelKey: "ads", icon: Play },
  { key: "refer", labelKey: "refer", icon: Users },
  { key: "profile", labelKey: "profile", icon: User },
];

export function AppShell({
  tab,
  onTab,
  children,
}: {
  tab: TabKey;
  onTab: (t: TabKey) => void;
  children: ReactNode;
}) {
  const lang = useLang();
  const { theme, toggle } = useTheme();
  const dark = theme === "dark";
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-background shadow-2xl shadow-foreground/10 transition-colors duration-300">
      <div className="h-1.5 bg-primary" />
      <button
        type="button"
        onClick={toggle}
        aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
        aria-pressed={dark}
        className="fixed right-3 top-3 z-50 flex items-center gap-1.5 rounded-full border border-border bg-card/90 px-2.5 py-1.5 text-xs font-bold text-foreground shadow-md backdrop-blur"
      >
        <span className="relative grid h-5 w-9 items-center rounded-full bg-muted px-0.5">
          <span
            className={cn(
              "grid h-4 w-4 place-items-center rounded-full bg-primary text-primary-foreground transition-transform duration-300",
              dark && "translate-x-4",
            )}
          >
            {dark ? <Moon className="h-2.5 w-2.5" /> : <Sun className="h-2.5 w-2.5" />}
          </span>
        </span>
        {dark ? "Dark" : "Light"}
      </button>
      <main className="flex-1 px-4 pb-28 pt-4">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md border-t border-border bg-card/95 px-2 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_-16px_var(--foreground)] backdrop-blur">
        <ul className="flex items-end justify-between">
          {TABS.map(({ key, labelKey, icon: Icon }) => {
            const active = tab === key;
            const center = key === "ads";
            return (
              <li key={key} className="flex-1">
                <button
                  onClick={() => onTab(key)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex w-full flex-col items-center gap-1 py-2 text-[11px] font-semibold transition",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "grid place-items-center rounded-2xl transition",
                      center
                        ? "-mt-6 h-14 w-14 bg-primary text-primary-foreground shadow-lg shadow-primary/30"
                        : "h-9 w-9",
                      active && !center && "bg-primary/10",
                    )}
                  >
                    <Icon className={center ? "h-7 w-7" : "h-5 w-5"} />
                  </span>
                  {t(lang, labelKey)}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

export function GuideCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-accent/40 bg-accent/10 p-3 text-xs leading-relaxed text-foreground/80">
      <p className="mb-1 font-bold">💡 {title}</p>
      {children}
    </div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-2 mt-5 text-base font-extrabold tracking-tight">{children}</h2>;
}
