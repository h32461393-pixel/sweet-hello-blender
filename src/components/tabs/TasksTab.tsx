import { toast } from "sonner";
import { GuideCard, SectionTitle } from "@/components/AppShell";
import { COMMUNITY_URL, PAYMENT_URL } from "@/lib/constants";
import { openLink } from "@/lib/telegram-client";
import { useClaimChannelTask, useHomeState, friendlyError } from "@/hooks/useFarm";

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
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary text-lg">
        {done ? "✅" : "📢"}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold">{title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {done ? "Completed today" : "Join required — verified by the bot"}
        </p>
      </div>
      <div className="text-right">
        <p className="text-sm font-black text-primary">+{reward}</p>
        <button
          disabled={done || claim.isPending}
          onClick={() => {
            openLink(url);
            window.setTimeout(() => {
              claim.mutate({ kind } as never, {
                onSuccess: (r) => toast.success(`✅ +${r.reward} FOX`),
                onError: (e) => toast.error(friendlyError(e)),
              });
            }, 3000);
          }}
          className="mt-1 rounded-lg bg-primary px-3 py-1 text-xs font-bold text-primary-foreground disabled:opacity-50"
        >
          {done ? "Done" : claim.isPending ? "…" : "Go"}
        </button>
      </div>
    </div>
  );
}

export function TasksTab() {
  const { data } = useHomeState();
  const reward = data?.dailyTasks.reward ?? 50;
  const done = data?.dailyTasks.done ?? [];

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-black">📋 Tasks</h1>
      <GuideCard title="How tasks work">
        Channel tasks are checked by the bot — if you are not a member, no reward is given. Mini
        app tasks unlock a Claim button 5 seconds after you open the link.
      </GuideCard>

      <SectionTitle>Daily tasks</SectionTitle>
      <div className="space-y-2">
        <ChannelTask
          kind="community"
          title="Visit community channel"
          url={COMMUNITY_URL}
          reward={reward}
          done={done.includes("daily_community")}
        />
        <ChannelTask
          kind="payment"
          title="Visit payment channel"
          url={PAYMENT_URL}
          reward={reward}
          done={done.includes("daily_payment")}
        />
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary text-lg">
            👥
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">Invite 1 friend today</p>
            <p className="truncate text-xs text-muted-foreground">Share your link to complete</p>
          </div>
          <p className="text-sm font-black text-primary">+250</p>
        </div>
      </div>


      <SectionTitle>Main tasks</SectionTitle>
      <p className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
        No main tasks yet — added from the admin panel.
      </p>

      <SectionTitle>Partner tasks</SectionTitle>
      <p className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
        No partner tasks yet — added from the admin panel.
      </p>
    </div>
  );
}
