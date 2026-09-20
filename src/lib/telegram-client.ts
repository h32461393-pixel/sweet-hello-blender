type WebApp = {
  initData: string;
  ready: () => void;
  expand: () => void;
  openTelegramLink?: (url: string) => void;
  HapticFeedback?: { impactOccurred: (s: string) => void };
  setHeaderColor?: (c: string) => void;
};

export function getWebApp(): WebApp | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { Telegram?: { WebApp?: WebApp } }).Telegram?.WebApp ?? null;
}

export function getInitData(): string {
  return getWebApp()?.initData ?? "";
}

export function openLink(url: string) {
  const wa = getWebApp();
  if (wa?.openTelegramLink && url.startsWith("https://t.me/")) wa.openTelegramLink(url);
  else window.open(url, "_blank", "noopener");
}

export function haptic() {
  getWebApp()?.HapticFeedback?.impactOccurred("medium");
}
