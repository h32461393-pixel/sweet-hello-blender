import { useState } from "react";
import { toast } from "sonner";
import { openLink } from "@/lib/telegram-client";
import { assetUrl } from "@/lib/constants";
import logo from "@/assets/fox-logo.png.asset.json";
import { useClaimTask, useTasks, friendlyError } from "@/hooks/useFarm";

type Section = "main" | "partner" | "bot" | "miniapp";

const SECTIONS: { id: Section; label: string }[] = [
  { id: "main", label: "⭐ Main" },
  { id: "partner", label: "🤝 Partner" },
  { id: "bot", label: "🤖 Bots" },
  { id: "miniapp", label: "📱 Mini Apps" },
];

function TaskRow({
  iconUrl,
  title,
  subtitle,
  reward,
  done,
  pending,
  onGo,
}: {
  iconUrl?: string | null;
  title: string;
  subtitle: string;
  reward: number;
  done: boolean;
  pending?: boolean;
  onGo?: () => void;
}) {
  return (
    <div className={`flex items-center gap-3 rounded-2xl border border-border bg-card p-3 ${done ? "opacity-60" : ""}`}>
      <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-secondary">
        <img src={iconUrl || assetUrl(logo.url)} alt="" className="h-full w-full object-cover" loading="lazy" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold">{title}</p>
        <p className="truncate text-xs text-muted-foreground">{done ? "Completed" : subtitle}</p>
      </div>
      <div className="text-right">
        <p className="text-sm font-black text-primary">+{reward}</p>
        {onGo ? (
          <button
            disabled={done || pending}
            onClick={onGo}
            className="mt-1 rounded-lg bg-primary px-3 py-1 text-xs font-bold text-primary-foreground disabled:opacity-50"
          >
            {done ? "Done" : pending ? "…" : "Go"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function TasksTab() {
  const [section, setSection] = useState<Section>("main");
  const { data: taskData, isLoading } = useTasks();
  const claim = useClaimTask();
  const [busy, setBusy] = useState<string | null>(null);

  const all = taskData?.tasks ?? [];
  const doneCount = all.filter((t) => t.done).length;
  const leftCount = all.length - doneCount;
  const list = all.filter((t) => t.section === section).sort((a, b) => Number(a.done) - Number(b.done));
  const countFor = (s: Section) => all.filter((t) => t.section === s && !t.done).length;

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-black">📋 Tasks</h1>

      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Done", value: doneCount, cls: "text-usdt" },
          { label: "Left", value: leftCount, cls: "text-primary" },
          { label: "Total", value: all.length, cls: "text-foreground" },
        ].map((x) => (
          <div key={x.label} className="rounded-2xl border border-border bg-card p-2.5 text-center">
            <p className={`text-xl font-black tabular-nums ${x.cls}`}>{x.value}</p>
            <p className="text-[11px] font-bold text-muted-foreground">{x.label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {SECTIONS.map((t) => {
          const n = countFor(t.id);
          return (
            <button
              key={t.id}
              onClick={() => setSection(t.id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition ${
                section === t.id ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
              }`}
            >
              {t.label}
              {n > 0 ? (
                <span className="rounded-full bg-background/80 px-1.5 text-[10px] font-black text-foreground">{n}</span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="space-y-2">
        {isLoading ? (
          <p className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">Loading…</p>
        ) : list.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            No tasks here yet. New ones are coming soon 🦊
          </p>
        ) : (
          list.map((t) => (
            <TaskRow
              key={t.id}
              iconUrl={t.iconUrl}
              title={t.title}
              subtitle={`${t.verifyType === "channel" ? "Bot verified" : "Open link"}${
                t.maxCompletions > 0 ? ` · ${Math.max(0, t.maxCompletions - t.completions)} slots left` : ""
              }`}
              reward={t.reward}
              done={t.done}
              pending={busy === t.id && claim.isPending}
              onGo={() => {
                openLink(t.url);
                setBusy(t.id);
                window.setTimeout(() => {
                  claim.mutate(t.id, {
                    onSuccess: (r) => toast.success(`✅ +${r.reward} FOX`),
                    onError: (e) => toast.error(friendlyError(e)),
                    onSettled: () => setBusy(null),
                  });
                }, 5000);
              }}
            />
          ))
        )}
      </div>
    </div>
  );
}
