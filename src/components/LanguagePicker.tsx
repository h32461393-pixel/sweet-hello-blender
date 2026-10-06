import { useEffect, useState } from "react";
import { Check, Globe, X } from "lucide-react";
import { LANGS, hasPickedLang, setLang, useLang, type LangCode } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function LanguageGrid({ onPick }: { onPick?: () => void }) {
  const lang = useLang();
  return (
    <div className="grid grid-cols-2 gap-2">
      {LANGS.map((l) => {
        const active = lang === l.code;
        return (
          <button
            key={l.code}
            onClick={() => {
              setLang(l.code as LangCode);
              onPick?.();
            }}
            className={cn(
              "flex items-center gap-2.5 rounded-full border px-3 py-2.5 text-left transition active:scale-[0.97]",
              active ? "border-accent bg-accent/15 shadow-md shadow-accent/20" : "border-border bg-background/60",
            )}
          >
            <span className="text-xl leading-none">{l.flag}</span>
            <span className="min-w-0 flex-1">
              <span className={cn("block truncate text-sm font-bold", active && "text-primary")}>{l.label}</span>
              <span className="block truncate text-[11px] text-muted-foreground">{l.native}</span>
            </span>
            {active ? (
              <span className="grid h-5 w-5 place-items-center rounded-full bg-accent text-accent-foreground">
                <Check className="h-3 w-3" />
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/** Shown once, after the channel check and the welcome guide. */
export function LanguagePicker() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const on = () => {
      if (!hasPickedLang()) setOpen(true);
    };
    window.addEventListener("foxfarm:guide-closed", on);
    return () => window.removeEventListener("foxfarm:guide-closed", on);
  }, []);
  if (!open) return null;
  const close = () => {
    try {
      localStorage.setItem("foxfarm.lang.picked", "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  };
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-foreground/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="animate-pop-in max-h-[85vh] w-full max-w-md overflow-y-auto rounded-3xl border border-accent/40 bg-card p-4 shadow-2xl">
        <div className="mb-3 flex items-center gap-3 border-b border-border pb-3">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-accent/20 text-accent"><Globe className="h-5 w-5" /></span>
          <div className="flex-1">
            <p className="font-black">Select Language</p>
            <p className="text-xs text-muted-foreground">Choose your interface language ({LANGS.length})</p>
          </div>
          <button onClick={close} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full bg-secondary">
            <X className="h-4 w-4" />
          </button>
        </div>
        <LanguageGrid onPick={() => window.setTimeout(close, 250)} />
      </div>
    </div>
  );
}
