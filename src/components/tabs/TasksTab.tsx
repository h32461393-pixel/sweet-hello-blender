import { useState } from "react";
import { toast } from "sonner";
import { GuideCard } from "@/components/AppShell";
import { COMMUNITY_URL, PAYMENT_URL } from "@/lib/constants";
import { openLink } from "@/lib/telegram-client";
import {
  useClaimChannelTask,
  useClaimTask,
  useHomeState,
  useTasks,
  friendlyError,
} from "@/hooks/useFarm";

type Section = "daily" | "main" | "partner";

function TaskRow({
  icon,
  iconUrl,
  title,
  subtitle,
  reward,
  done,
  pending,
  onGo,
}: {
  icon: string;
  iconUrl?: string | null;
  title: string;
  subtitle: string;
  reward: number;
  done: boolean;
  pending?: boolean;
  onGo?: () => void;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border border-border bg-card p-3 ${
        done ? "opacity-60" : ""
      }`}
    >
      <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-secondary text-lg">
        {iconUrl ? (
          <img src={iconUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <span>{done ? "✅" : icon}</span>
        )}
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

function ChannelTask({
  kind,
  title,
  url,
  reward,
  done,
}: {
  kind: "community" | "payment";
  title: string;
  url: string;
  reward: number;
  done: boolean;
}) {
  const claim = useClaimChannelTask();
  return (
    <TaskRow
      icon="📢"
      title={title}
      subtitle="Join required — verified by the bot"
      reward={reward}
      done={done}
      pending={claim.isPending}
      onGo={() => {
        openLink(url);
        window.setTimeout(() => {
          claim.mutate({ kind } as never, {
            onSuccess: (r) => toast.success(`✅ +${r.reward} FOX`),
            onError: (e) => toast.error(friendlyError(e)),
          });
        }, 3000);
      }}
    />
  );
}

export function TasksTab() {
  const [section, setSection] = useState<Section>("daily");
  const { data } = useHomeState();
  const { data: taskData, isLoading } = useTasks();
  const claim = useClaimTask();
  const [busy, setBusy] = useState<string | null>(null);

  const reward = data?.dailyTasks.reward ?? 50;
  const done = data?.dailyTasks.done ?? [];

  const list = (taskData?.tasks ?? [])
    .filter((t) => t.section === section)
    .sort((a, b) => Number(a.done) - Number(b.done));

  const tabs: { id: Section; label: string }[] = [
    { id: "daily", label: "Daily" },
    { id: "main", label: "Main" },
    { id: "partner", label: "Partner" },
  ];

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-black">📋 Tasks</h1>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setSection(t.id)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition ${
              section === t.id
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {section === "daily" ? (
        <div className="space-y-2">
          <GuideCard title="How tasks work">
            Channel tasks are checked by the bot — if you are not a member, no reward is given.
            Daily tasks reset at 00:00 UTC.
          </GuideCard>
          {[
            {
              kind: "community" as const,
              title: "Visit community channel",
              url: COMMUNITY_URL,
              key: "daily_community",
            },
            {
              kind: "payment" as const,
              title: "Visit payment channel",
              url: PAYMENT_URL,
              key: "daily_payment",
            },
          ]
            .sort((a, b) => Number(done.includes(a.key)) - Number(done.includes(b.key)))
            .map((c) => (
              <ChannelTask
                key={c.kind}
                kind={c.kind}
                title={c.title}
                url={c.url}
                reward={reward}
                done={done.includes(c.key)}
              />
            ))}
          <TaskRow
            icon="👥"
            title="Invite 1 friend today"
            subtitle="Share your link to complete"
            reward={250}
            done={false}
          />
        </div>
      ) : (
        <div className="space-y-2">
          {isLoading ? (
            <p className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
              Loading…
            </p>
          ) : list.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
              No {section} tasks yet — added from the admin panel.
            </p>
          ) : (
            list.map((t) => (
              <TaskRow
                key={t.id}
                icon="🎯"
                iconUrl={t.iconUrl}
                title={t.title}
                subtitle={t.verifyType === "channel" ? "Join required — bot verified" : "Open the link to complete"}
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
      )}
    </div>
  );
}
