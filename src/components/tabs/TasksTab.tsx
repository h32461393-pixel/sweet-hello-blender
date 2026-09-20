import { GuideCard, SectionTitle } from "@/components/AppShell";

type Task = { title: string; reward: number; note: string };

const daily: Task[] = [
  { title: "Visit community channel", reward: 50, note: "Join required — verified by the bot" },
  { title: "Visit payment channel", reward: 50, note: "Join required — verified by the bot" },
  { title: "Invite 1 friend today", reward: 250, note: "Share your link to complete" },
];

function TaskRow({ t }: { t: Task }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary text-lg">
        ✅
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold">{t.title}</p>
        <p className="truncate text-xs text-muted-foreground">{t.note}</p>
      </div>
      <div className="text-right">
        <p className="text-sm font-black text-primary">+{t.reward}</p>
        <button className="mt-1 rounded-lg bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">
          Go
        </button>
      </div>
    </div>
  );
}

export function TasksTab() {
  return (
    <div className="space-y-3">
      <h1 className="text-xl font-black">📋 Tasks</h1>
      <GuideCard title="How tasks work">
        Channel tasks are checked by the bot — if you are not a member, no reward is given. Mini
        app tasks unlock a Claim button 5 seconds after you open the link.
      </GuideCard>

      <SectionTitle>Daily tasks</SectionTitle>
      <div className="space-y-2">
        {daily.map((t) => (
          <TaskRow key={t.title} t={t} />
        ))}
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
