import { type ReactNode } from "react";
import { Home, ListChecks, Play, Users, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { t, useLang } from "@/lib/i18n";

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
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-background">
      <main className="flex-1 px-4 pb-28 pt-4">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md border-t border-border bg-card/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <ul className="flex items-end justify-between">
          {TABS.map(({ key, label, icon: Icon }) => {
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
                  {label}
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
