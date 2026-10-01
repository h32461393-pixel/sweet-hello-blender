import { useCallback, useEffect, useState } from "react";
import { getWebApp } from "@/lib/telegram-client";

export type Theme = "light" | "dark";
const KEY = "foxfarm.theme";

/** Inline script run before paint so the chosen theme never flashes. */
export const THEME_BOOT_SCRIPT = `(function(){try{var t=localStorage.getItem("${KEY}");if(!t){var w=window.Telegram&&window.Telegram.WebApp;t=(w&&w.colorScheme)||(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light")}if(t==="dark")document.documentElement.classList.add("dark")}catch(e){}})();`;

function apply(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  const bg = getComputedStyle(document.body).backgroundColor;
  const wa = getWebApp() as (ReturnType<typeof getWebApp> & { setBackgroundColor?: (c: string) => void }) | null;
  try {
    wa?.setHeaderColor?.(bg);
    wa?.setBackgroundColor?.(bg);
  } catch {
    /* older Telegram clients */
  }
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const current: Theme = document.documentElement.classList.contains("dark") ? "dark" : "light";
    setTheme(current);
    apply(current);
  }, []);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(KEY, next);
      } catch {
        /* storage blocked */
      }
      apply(next);
      return next;
    });
  }, []);

  return { theme, toggle };
}
