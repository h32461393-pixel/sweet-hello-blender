import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import type { ReactNode } from "react";
import { checkRequiredChannels } from "@/lib/farm.functions";
import { getInitData, openLink } from "@/lib/telegram-client";

/** Blocks the app until the user has joined every required channel (checked by the bot on each open). */
export function ChannelGate({ children }: { children: ReactNode }) {
  const fn = useServerFn(checkRequiredChannels);
  const q = useQuery({
    queryKey: ["required-channels"],
    queryFn: () => fn({ data: { initData: getInitData() } }),
    staleTime: 0,
    refetchOnWindowFocus: true,
    retry: 2,
  });

  const missing = q.data?.missing ?? [];
  if (q.isLoading) {
    return (
      <main className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">
        Checking channels… 🦊
      </main>
    );
  }
  if (q.isError || missing.length === 0) return <>{children}</>;

  return (
    <main className="fixed inset-0 z-50 grid place-items-center bg-background/95 p-5 backdrop-blur">
      <div className="w-full max-w-sm animate-in zoom-in-95 rounded-3xl border border-border bg-card p-5 shadow-2xl">
        <div className="text-center text-5xl">📢</div>
        <h1 className="mt-2 text-center text-xl font-black">Join our channels</h1>
        <p className="mt-1 text-center text-xs text-muted-foreground">
          Join all channels below, then tap Verify to continue.
        </p>
        <ul className="mt-4 space-y-2">
          {missing.map((c) => (
            <li key={c.url}>
              <button
                onClick={() => openLink(c.url)}
                className="flex w-full items-center gap-3 rounded-2xl border border-border bg-background p-3 text-left text-sm font-bold active:scale-[0.99]"
              >
                <span className="text-lg">✈️</span>
                <span className="flex-1 truncate">{c.title}</span>
                <span className="rounded-full bg-primary px-3 py-1 text-xs text-primary-foreground">Join</span>
              </button>
            </li>
          ))}
        </ul>
        <button
          disabled={q.isFetching}
          onClick={() => q.refetch()}
          className="mt-4 w-full rounded-2xl bg-primary p-3.5 text-sm font-extrabold text-primary-foreground disabled:opacity-50"
        >
          {q.isFetching ? "Checking…" : "✅ Verify"}
        </button>
      </div>
    </main>
  );
}
