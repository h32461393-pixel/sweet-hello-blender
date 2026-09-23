import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast, Toaster } from "sonner";
import { getInitData } from "@/lib/telegram-client";
import {
  adminLogin,
  adminOverview,
  adminSearchUsers,
  adminAdjustBalance,
  adminSetSuspended,
  adminWithdrawals,
  adminProcessWithdrawal,
  adminGetConfig,
  adminSetConfig,
  adminListTasks,
  adminSaveTask,
  adminDeleteTask,
  adminCreateCode,
  adminAudit,
  adminBroadcast,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
  head: () => ({
    meta: [
      { title: "Fox Farm — Admin panel" },
      { name: "description", content: "Private management panel for the Fox Farm mini app." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Fox Farm — Admin panel" },
      { property: "og:description", content: "Private management panel for the Fox Farm mini app." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Creds = { initData: string; username: string; password: string };
const SESSION_KEY = "foxfarm.admin";

const TABS = ["Overview", "Users", "Payouts", "Tasks", "Ads", "Codes", "Notify", "Log"] as const;
type Tab = (typeof TABS)[number];

function Field(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold text-muted-foreground">{props.label}</span>
      <input
        type={props.type ?? "text"}
        value={props.value}
        placeholder={props.placeholder}
        onChange={(e) => props.onChange(e.target.value)}
        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
      />
    </label>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-border bg-card p-3">{children}</div>;
}

function AdminPage() {
  const [creds, setCreds] = useState<Creds | null>(() => {
    if (typeof window === "undefined") return null;
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Creds) : null;
  });

  if (!creds) return <Login onLogin={setCreds} />;
  return <Panel creds={creds} onLogout={() => { sessionStorage.removeItem(SESSION_KEY); setCreds(null); }} />;
}

function Login({ onLogin }: { onLogin: (c: Creds) => void }) {
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const fn = useServerFn(adminLogin);
  const login = useMutation({
    mutationFn: () => fn({ data: { initData: getInitData(), username: u, password: p } }),
  });

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-5">
      <Toaster position="top-center" richColors />
      <h1 className="text-center text-2xl font-black">🔐 Fox Farm Admin</h1>
      <p className="text-center text-xs text-muted-foreground">
        Open this page inside Telegram with the owner account.
      </p>
      <Card>
        <div className="space-y-3">
          <Field label="Username" value={u} onChange={setU} />
          <Field label="Password" value={p} onChange={setP} type="password" />
          <button
            disabled={login.isPending}
            onClick={() =>
              login.mutate(undefined, {
                onSuccess: () => {
                  const c = { initData: getInitData(), username: u, password: p };
                  sessionStorage.setItem(SESSION_KEY, JSON.stringify(c));
                  onLogin(c);
                },
                onError: (e) => toast.error((e as Error).message),
              })
            }
            className="w-full rounded-xl bg-primary py-3 text-sm font-black text-primary-foreground disabled:opacity-50"
          >
            {login.isPending ? "Checking…" : "Sign in"}
          </button>
        </div>
      </Card>
    </div>
  );
}

function Panel({ creds, onLogout }: { creds: Creds; onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>("Overview");
  return (
    <div className="mx-auto max-w-lg space-y-3 p-4 pb-16">
      <Toaster position="top-center" richColors />
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black">🛠️ Admin panel</h1>
        <button onClick={onLogout} className="rounded-lg bg-secondary px-3 py-1 text-xs font-bold">
          Log out
        </button>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${
              tab === t ? "bg-primary text-primary-foreground" : "bg-secondary"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Overview" && <Overview creds={creds} />}
      {tab === "Users" && <Users creds={creds} />}
      {tab === "Payouts" && <Payouts creds={creds} />}
      {tab === "Tasks" && <Tasks creds={creds} />}
      {tab === "Ads" && <Ads creds={creds} />}
      {tab === "Codes" && <Codes creds={creds} />}
      {tab === "Notify" && <Notify creds={creds} />}
      {tab === "Log" && <Log creds={creds} />}
    </div>
  );
}

function Overview({ creds }: { creds: Creds }) {
  const fn = useServerFn(adminOverview);
  const { data } = useQuery({ queryKey: ["admin-overview"], queryFn: () => fn({ data: creds }) });
  const items = [
    ["👥 Users", data?.users ?? 0],
    ["🆕 New today", data?.newToday ?? 0],
    ["🚫 Suspended", data?.suspended ?? 0],
    ["📺 Ad views today", data?.adViewsToday ?? 0],
    ["⏳ Pending payouts", data?.pendingCount ?? 0],
    ["💵 Pending USD", `$${(data?.pendingUsd ?? 0).toFixed(2)}`],
    ["✅ Paid USD", `$${(data?.paidUsd ?? 0).toFixed(2)}`],
  ] as const;
  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map(([label, v]) => (
        <Card key={label}>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-black">{v}</p>
        </Card>
      ))}
    </div>
  );
}

function Users({ creds }: { creds: Creds }) {
  const [q, setQ] = useState("");
  const [amount, setAmount] = useState<Record<string, string>>({});
  const search = useServerFn(adminSearchUsers);
  const adjustFn = useServerFn(adminAdjustBalance);
  const suspendFn = useServerFn(adminSetSuspended);
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["admin-users", q],
    queryFn: () => search({ data: { ...creds, q } }),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-users"] });

  const adjust = useMutation({
    mutationFn: (v: { userId: string; amount: number }) =>
      adjustFn({ data: { ...creds, ...v, note: "Admin adjustment" } }),
    onSuccess: () => { toast.success("Balance updated"); refresh(); },
    onError: (e) => toast.error((e as Error).message),
  });
  const suspend = useMutation({
    mutationFn: (v: { userId: string; suspended: boolean }) => suspendFn({ data: { ...creds, ...v } }),
    onSuccess: () => { toast.success("Account updated"); refresh(); },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="space-y-2">
      <Field label="Search by Telegram ID or username" value={q} onChange={setQ} placeholder="5419054691" />
      {(data?.users ?? []).map((u) => (
        <Card key={u.id}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">
                {u.firstName ?? "User"} {u.username ? `(@${u.username})` : ""}
              </p>
              <p className="text-xs text-muted-foreground">🆔 {u.telegramId}</p>
              <p className="text-xs">🪙 {u.balance.toLocaleString()} FOX · earned {u.totalEarned.toLocaleString()}</p>
              {u.wallet ? <p className="truncate text-[10px] text-muted-foreground">{u.wallet}</p> : null}
            </div>
            <button
              onClick={() => suspend.mutate({ userId: u.id, suspended: !u.suspended })}
              className={`shrink-0 rounded-lg px-2 py-1 text-xs font-bold ${
                u.suspended ? "bg-secondary" : "bg-destructive text-destructive-foreground"
              }`}
            >
              {u.suspended ? "Unsuspend" : "Suspend"}
            </button>
          </div>
          <div className="mt-2 flex gap-2">
            <input
              value={amount[u.id] ?? ""}
              onChange={(e) => setAmount((s) => ({ ...s, [u.id]: e.target.value }))}
              placeholder="e.g. 500 or -500"
              className="w-full rounded-lg border border-border bg-background px-2 py-1 text-xs"
            />
            <button
              onClick={() => adjust.mutate({ userId: u.id, amount: Number(amount[u.id] ?? 0) })}
              className="shrink-0 rounded-lg bg-primary px-3 py-1 text-xs font-bold text-primary-foreground"
            >
              Apply
            </button>
          </div>
        </Card>
      ))}
    </div>
  );
}

function Payouts({ creds }: { creds: Creds }) {
  const [status, setStatus] = useState("pending");
  const [tx, setTx] = useState<Record<string, string>>({});
  const listFn = useServerFn(adminWithdrawals);
  const processFn = useServerFn(adminProcessWithdrawal);
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["admin-wd", status],
    queryFn: () => listFn({ data: { ...creds, status } }),
  });
  const process = useMutation({
    mutationFn: (v: { id: string; action: "paid" | "rejected"; txid?: string }) =>
      processFn({ data: { ...creds, ...v } }),
    onSuccess: () => { toast.success("Done"); qc.invalidateQueries({ queryKey: ["admin-wd"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        {["pending", "paid", "rejected"].map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              status === s ? "bg-primary text-primary-foreground" : "bg-secondary"
            }`}
          >
            {s}
          </button>
        ))}
      </div>
      {(data?.withdrawals ?? []).length === 0 ? (
        <p className="p-4 text-center text-sm text-muted-foreground">Nothing here.</p>
      ) : null}
      {(data?.withdrawals ?? []).map((w) => (
        <Card key={w.id}>
          <p className="text-sm font-bold">
            {w.user} · 🪙 {w.tokens.toLocaleString()} → 💵 ${w.net.toFixed(2)}
          </p>
          <p className="break-all text-[11px] text-muted-foreground">{w.address}</p>
          {w.txid ? <p className="break-all text-[11px] text-primary">{w.txid}</p> : null}
          {w.status === "pending" ? (
            <div className="mt-2 space-y-2">
              <input
                value={tx[w.id] ?? ""}
                onChange={(e) => setTx((s) => ({ ...s, [w.id]: e.target.value }))}
                placeholder="0x transaction hash"
                className="w-full rounded-lg border border-border bg-background px-2 py-1 text-xs"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => process.mutate({ id: w.id, action: "paid", txid: tx[w.id] ?? "" })}
                  className="flex-1 rounded-lg bg-primary py-1.5 text-xs font-bold text-primary-foreground"
                >
                  ✅ Approve & post proof
                </button>
                <button
                  onClick={() => process.mutate({ id: w.id, action: "rejected" })}
                  className="rounded-lg bg-secondary px-3 py-1.5 text-xs font-bold"
                >
                  ❌ Reject
                </button>
              </div>
            </div>
          ) : null}
        </Card>
      ))}
    </div>
  );
}

const EMPTY_TASK = {
  id: null as string | null,
  section: "main",
  title: "",
  url: "",
  reward: 100,
  verifyType: "timer",
  chatUsername: "",
  iconUrl: "",
  active: true,
  sortOrder: 0,
};

function Tasks({ creds }: { creds: Creds }) {
  const [form, setForm] = useState({ ...EMPTY_TASK });
  const listFn = useServerFn(adminListTasks);
  const saveFn = useServerFn(adminSaveTask);
  const delFn = useServerFn(adminDeleteTask);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin-tasks"], queryFn: () => listFn({ data: creds }) });
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-tasks"] });

  const save = useMutation({
    mutationFn: () => saveFn({ data: { ...creds, ...form } }),
    onSuccess: () => { toast.success("Task saved"); setForm({ ...EMPTY_TASK }); refresh(); },
    onError: (e) => toast.error((e as Error).message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => delFn({ data: { ...creds, id } }),
    onSuccess: () => { toast.success("Deleted"); refresh(); },
  });

  return (
    <div className="space-y-2">
      <Card>
        <div className="space-y-2">
          <div className="flex gap-2">
            {["main", "partner"].map((s) => (
              <button
                key={s}
                onClick={() => setForm((f) => ({ ...f, section: s }))}
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  form.section === s ? "bg-primary text-primary-foreground" : "bg-secondary"
                }`}
              >
                {s}
              </button>
            ))}
            {["timer", "channel"].map((s) => (
              <button
                key={s}
                onClick={() => setForm((f) => ({ ...f, verifyType: s }))}
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  form.verifyType === s ? "bg-accent text-accent-foreground" : "bg-secondary"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <Field label="Title" value={form.title} onChange={(v) => setForm((f) => ({ ...f, title: v }))} />
          <Field label="Link" value={form.url} onChange={(v) => setForm((f) => ({ ...f, url: v }))} placeholder="https://" />
          <Field
            label="Icon link (imgbb https://…)"
            value={form.iconUrl}
            onChange={(v) => setForm((f) => ({ ...f, iconUrl: v }))}
          />
          {form.verifyType === "channel" ? (
            <Field
              label="Channel username (@name)"
              value={form.chatUsername}
              onChange={(v) => setForm((f) => ({ ...f, chatUsername: v }))}
            />
          ) : null}
          <Field
            label="Reward (FOX)"
            value={String(form.reward)}
            onChange={(v) => setForm((f) => ({ ...f, reward: Number(v) || 0 }))}
          />
          <button
            onClick={() => save.mutate()}
            className="w-full rounded-xl bg-primary py-2 text-sm font-black text-primary-foreground"
          >
            {form.id ? "Update task" : "Add task"}
          </button>
        </div>
      </Card>

      {(data?.tasks ?? []).map((t) => (
        <Card key={t.id as string}>
          <div className="flex items-center gap-2">
            {t.icon_url ? (
              <img src={t.icon_url as string} alt="" className="h-9 w-9 rounded-lg object-cover" />
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{t.title as string}</p>
              <p className="text-xs text-muted-foreground">
                {t.section as string} · +{Number(t.reward)} · {t.active ? "active" : "hidden"}
              </p>
            </div>
            <button
              onClick={() =>
                setForm({
                  id: t.id as string,
                  section: (t.section as string) ?? "main",
                  title: (t.title as string) ?? "",
                  url: (t.url as string) ?? "",
                  reward: Number(t.reward ?? 0),
                  verifyType: (t.verify_type as string) ?? "timer",
                  chatUsername: (t.chat_username as string) ?? "",
                  iconUrl: (t.icon_url as string) ?? "",
                  active: Boolean(t.active),
                  sortOrder: Number(t.sort_order ?? 0),
                })
              }
              className="rounded-lg bg-secondary px-2 py-1 text-xs font-bold"
            >
              Edit
            </button>
            <button
              onClick={() => remove.mutate(t.id as string)}
              className="rounded-lg bg-destructive px-2 py-1 text-xs font-bold text-destructive-foreground"
            >
              Del
            </button>
          </div>
        </Card>
      ))}
    </div>
  );
}

function Ads({ creds }: { creds: Creds }) {
  const getFn = useServerFn(adminGetConfig);
  const setFn = useServerFn(adminSetConfig);
  const [draft, setDraft] = useState<string | null>(null);
  const { data } = useQuery({
    queryKey: ["admin-ads"],
    queryFn: () => getFn({ data: { ...creds, key: "ads" } }),
  });
  const value = draft ?? data?.json ?? "";
  const save = useMutation({
    mutationFn: () => setFn({ data: { ...creds, key: "ads", value: JSON.parse(value) } }),
    onSuccess: () => toast.success("Ad settings saved"),
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Card>
      <p className="mb-2 text-xs text-muted-foreground">
        Rewards and daily limits per ad network. Change the numbers only.
      </p>
      <textarea
        value={value}
        onChange={(e) => setDraft(e.target.value)}
        rows={14}
        className="w-full rounded-xl border border-border bg-background p-2 font-mono text-[11px]"
      />
      <button
        onClick={() => save.mutate()}
        className="mt-2 w-full rounded-xl bg-primary py-2 text-sm font-black text-primary-foreground"
      >
        Save ad settings
      </button>
    </Card>
  );
}

function Codes({ creds }: { creds: Creds }) {
  const [code, setCode] = useState("");
  const [reward, setReward] = useState("500");
  const [uses, setUses] = useState("100");
  const fn = useServerFn(adminCreateCode);
  const create = useMutation({
    mutationFn: () => fn({ data: { ...creds, code, reward: Number(reward), maxUses: Number(uses) } }),
    onSuccess: () => { toast.success("Code created"); setCode(""); },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <Card>
      <div className="space-y-2">
        <Field label="Code" value={code} onChange={setCode} placeholder="FOX2026" />
        <Field label="Reward (FOX)" value={reward} onChange={setReward} />
        <Field label="Max uses" value={uses} onChange={setUses} />
        <button
          onClick={() => create.mutate()}
          className="w-full rounded-xl bg-primary py-2 text-sm font-black text-primary-foreground"
        >
          Create reward code
        </button>
      </div>
    </Card>
  );
}

function Notify({ creds }: { creds: Creds }) {
  const [text, setText] = useState("");
  const fn = useServerFn(adminBroadcast);
  const send = useMutation({
    mutationFn: () => fn({ data: { ...creds, text } }),
    onSuccess: (r) => { toast.success(`Sent to ${r.sent} users`); setText(""); },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <Card>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        placeholder="🎉 Big news for all farmers…"
        className="w-full rounded-xl border border-border bg-background p-2 text-sm"
      />
      <button
        onClick={() => send.mutate()}
        disabled={send.isPending}
        className="mt-2 w-full rounded-xl bg-primary py-2 text-sm font-black text-primary-foreground disabled:opacity-50"
      >
        {send.isPending ? "Sending…" : "📣 Send to everyone"}
      </button>
    </Card>
  );
}

function Log({ creds }: { creds: Creds }) {
  const fn = useServerFn(adminAudit);
  const { data } = useQuery({ queryKey: ["admin-log"], queryFn: () => fn({ data: creds }) });
  return (
    <div className="space-y-2">
      {(data?.entries ?? []).map((e) => (
        <Card key={e.id as string}>
          <p className="text-sm font-bold">{e.action as string}</p>
          <p className="break-all text-[11px] text-muted-foreground">
            {(e.target as string) ?? ""} · {new Date(e.created_at as string).toLocaleString()}
          </p>
        </Card>
      ))}
    </div>
  );
}
