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
  adminListCodes,
  adminSetCodeActive,
  adminUserActivity,
  adminAudit,
  adminBroadcast,
  adminListPartners,
  adminSavePartners,
  adminCheckBotAdmin,
  adminPostPartner,
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

const TABS = ["Overview", "Users", "Suspended", "Payouts", "Tasks", "Ads", "Sites", "Codes", "Notify", "Partners", "Settings", "Log"] as const;

type SiteRow = { id: string; title: string; url: string; reward: number; icon: string };

function Sites({ creds }: { creds: Creds }) {
  const getFn = useServerFn(adminGetConfig);
  const setFn = useServerFn(adminSetConfig);
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["admin-sites"],
    queryFn: () => getFn({ data: { ...creds, key: "sites" } }),
  });
  const items: SiteRow[] = (() => {
    try {
      const v = JSON.parse(data?.json ?? "{}") as { items?: SiteRow[] };
      return Array.isArray(v.items) ? v.items : [];
    } catch {
      return [];
    }
  })();
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [reward, setReward] = useState("20");
  const [icon, setIcon] = useState("");
  const save = useMutation({
    mutationFn: (next: SiteRow[]) => setFn({ data: { ...creds, key: "sites", value: { items: next } } }),
    onSuccess: () => { toast.success("Websites saved"); qc.invalidateQueries({ queryKey: ["admin-sites"] }); },
    onError: (e) => toast.error((e as Error).message),
  });
  function add() {
    if (!title.trim() || !/^https?:\/\//i.test(url.trim())) { toast.error("Enter a title and a valid link"); return; }
    const id = `s${Date.now().toString(36)}`;
    save.mutate([...items, { id, title: title.trim(), url: url.trim(), reward: Number(reward) || 0, icon: icon.trim() }]);
    setTitle(""); setUrl(""); setIcon(""); return;
  }
  return (
    <div className="space-y-3">
      <Card>
        <p className="mb-2 text-sm font-black">🌐 Add a website</p>
        <p className="mb-2 text-xs text-muted-foreground">Users watch it for 10 seconds, get the reward, then can visit again after 24 hours.</p>
        <div className="space-y-2">
          <Field label="Title" value={title} onChange={setTitle} placeholder="My partner site" />
          <Field label="Link" value={url} onChange={setUrl} placeholder="https://…" />
          <Field label="Reward (FOX)" value={reward} onChange={setReward} type="number" />
          <Field label="Icon link (optional, imgbb ok)" value={icon} onChange={setIcon} placeholder="https://i.ibb.co/…" />
          <button onClick={add} className="w-full rounded-xl bg-primary py-2 text-sm font-black text-primary-foreground">Add website</button>
        </div>
      </Card>
      {items.map((s) => (
        <Card key={s.id}>
          <div className="flex items-center gap-3">
            {s.icon ? <img src={s.icon} alt="" className="h-9 w-9 rounded-lg object-cover" /> : <span className="text-2xl">🌐</span>}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black">{s.title}</p>
              <p className="truncate text-[11px] text-muted-foreground">{s.url} · +{s.reward} FOX</p>
            </div>
            <button
              onClick={() => save.mutate(items.filter((x) => x.id !== s.id))}
              className="rounded-lg bg-destructive px-2 py-1 text-xs font-bold text-destructive-foreground"
            >
              Delete
            </button>
          </div>
        </Card>
      ))}
      {!items.length && <p className="text-center text-xs text-muted-foreground">No websites yet.</p>}
    </div>
  );
}
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
      {tab === "Users" && <Users creds={creds} status="active" />}
      {tab === "Suspended" && <Users creds={creds} status="suspended" />}
      {tab === "Partners" && <Partners creds={creds} />}
      {tab === "Settings" && <Settings creds={creds} />}
      {tab === "Payouts" && <Payouts creds={creds} />}
      {tab === "Tasks" && <Tasks creds={creds} />}
      {tab === "Ads" && <Ads creds={creds} />}
      {tab === "Sites" && <Sites creds={creds} />}
      {tab === "Codes" && <Codes creds={creds} />}
      {tab === "Notify" && <Notify creds={creds} />}
      {tab === "Log" && <Log creds={creds} />}
    </div>
  );
}

function Overview({ creds }: { creds: Creds }) {
  const fn = useServerFn(adminOverview);
  const { data } = useQuery({ queryKey: ["admin-overview"], queryFn: () => fn({ data: creds }), refetchInterval: 30_000 });
  const items = [
    ["🟢 Online now", data?.online ?? 0],
    ["📅 Active 24h", data?.active24h ?? 0],
    ["👥 Users", data?.users ?? 0],
    ["🆕 New today", data?.newToday ?? 0],
    ["🚫 Suspended", data?.suspended ?? 0],
    ["📺 Ad views today", data?.adViewsToday ?? 0],
    ["⏳ Pending payouts", data?.pendingCount ?? 0],
    ["💵 Pending USD", `$${(data?.pendingUsd ?? 0).toFixed(4)}`],
    ["✅ Paid USD", `$${(data?.paidUsd ?? 0).toFixed(4)}`],
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

function Users({ creds, status }: { creds: Creds; status: "active" | "suspended" }) {
  const [q, setQ] = useState("");
  const [amount, setAmount] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<string | null>(null);
  const search = useServerFn(adminSearchUsers);
  const adjustFn = useServerFn(adminAdjustBalance);
  const suspendFn = useServerFn(adminSetSuspended);
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["admin-users", status, q],
    queryFn: () => search({ data: { ...creds, q, status } }),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-users"] });

  const adjust = useMutation({
    mutationFn: (v: { userId: string; amount: number }) =>
      adjustFn({ data: { ...creds, ...v, note: "Admin adjustment" } }),
    onSuccess: () => { toast.success("Balance updated"); refresh(); },
    onError: (e) => toast.error((e as Error).message),
  });
  const suspend = useMutation({
    mutationFn: (v: { userId: string; suspended: boolean }) => {
      const reason = v.suspended ? (window.prompt("Suspend reason (shown to the user)", "Violation of Fox Farm rules.") ?? "") : "";
      return suspendFn({ data: { ...creds, ...v, reason } });
    },
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
              {u.suspended && (u as { suspendReason?: string | null }).suspendReason ? (
                <p className="text-xs text-destructive">🚫 {(u as { suspendReason?: string | null }).suspendReason}</p>
              ) : null}
              <p className="text-xs">🪙 {u.balance.toLocaleString()} FOX · earned {u.totalEarned.toLocaleString()}</p>
              {u.wallet ? <p className="truncate text-[10px] text-muted-foreground">{u.wallet}</p> : null}
              <button onClick={() => setOpen(open === u.id ? null : u.id)} className="mt-1 text-xs font-bold text-primary">
                {open === u.id ? "Hide activity ▲" : "View all activity ▼"}
              </button>
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
          {open === u.id && <Activity creds={creds} userId={u.id} />}
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
    onSuccess: (r) => {
      if (r.channelPosted === false) {
        toast.error("Paid ✅ but the payment channel post failed — make the bot an admin of the channel (or set PAYMENT_CHANNEL_ID).");
      } else toast.success(r.channelPosted ? "Paid ✅ and posted to the payment channel" : "Done");
      qc.invalidateQueries({ queryKey: ["admin-wd"] });
    },
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
            {w.user} · 🪙 {w.tokens.toLocaleString()} → 💵 ${w.net.toFixed(4)}
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
  maxCompletions: 0,
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
            {["main", "partner", "bot", "miniapp"].map((s) => (
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
          <Field
            label="Max completions (0 = unlimited) — raise it to add more slots"
            value={String(form.maxCompletions)}
            onChange={(v) => setForm((f) => ({ ...f, maxCompletions: Number(v) || 0 }))}
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
                {t.section as string} · +{Number(t.reward)} · {t.active ? "active" : "hidden"} · {Number(t.completions ?? 0)}/{Number(t.max_completions ?? 0) || "∞"} done
                {Number(t.max_completions ?? 0) > 0 && Number(t.completions ?? 0) >= Number(t.max_completions) ? " · FULL" : ""}
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
                  maxCompletions: Number(t.max_completions ?? 0),
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
  const [draft, setDraft] = useState<Record<string, unknown> | null>(null);
  const { data } = useQuery({
    queryKey: ["admin-ads"],
    queryFn: () => getFn({ data: { ...creds, key: "ads" } }),
  });
  const base = (() => { try { return JSON.parse(data?.json ?? "{}") as Record<string, unknown>; } catch { return {}; } })();
  const cfg = draft ?? base;
  const nets = (cfg["networks"] ?? {}) as Record<string, Record<string, unknown>>;
  const IDS = ["adsgram", "adsgram_int", "monetag", "gigapub", "monetix"];
  const setNet = (id: string, k: string, v: string) =>
    setDraft({ ...cfg, networks: { ...nets, [id]: { ...(nets[id] ?? {}), [k]: k === "label" || k === "logo" ? v : Number(v) } } });
  const save = useMutation({
    mutationFn: () => setFn({ data: { ...creds, key: "ads", value: cfg } }),
    onSuccess: () => { toast.success("Ad settings saved"); setDraft(null); },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <div className="space-y-2">
      {IDS.map((id) => {
        const n = nets[id] ?? {};
        return (
          <Card key={id}>
            <p className="mb-2 text-sm font-black">{String(n["label"] ?? id)}</p>
            <div className="grid grid-cols-3 gap-2">
              <Field label="Reward" type="number" value={String(n["reward"] ?? 40)} onChange={(v) => setNet(id, "reward", v)} />
              <Field label="Daily cap" type="number" value={String(n["cap"] ?? 10)} onChange={(v) => setNet(id, "cap", v)} />
              <Field label="Cooldown s" type="number" value={String(n["cooldown"] ?? 5)} onChange={(v) => setNet(id, "cooldown", v)} />
            </div>
          </Card>
        );
      })}
      <button onClick={() => save.mutate()} className="w-full rounded-xl bg-primary py-2 text-sm font-black text-primary-foreground">
        Save ad settings
      </button>
    </div>
  );
}

function Codes({ creds }: { creds: Creds }) {
  const [code, setCode] = useState("");
  const [reward, setReward] = useState("500");
  const [uses, setUses] = useState("100");
  const fn = useServerFn(adminCreateCode);
  const listFn = useServerFn(adminListCodes);
  const toggleFn = useServerFn(adminSetCodeActive);
  const qc = useQueryClient();
  const { data: list } = useQuery({ queryKey: ["admin-codes"], queryFn: () => listFn({ data: creds }) });
  const toggle = useMutation({
    mutationFn: (v: { code: string; active: boolean }) => toggleFn({ data: { ...creds, ...v } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-codes"] }),
    onError: (e) => toast.error((e as Error).message),
  });
  const create = useMutation({
    mutationFn: () => fn({ data: { ...creds, code, reward: Number(reward), maxUses: Number(uses) } }),
    onSuccess: () => { toast.success("Code created"); setCode(""); qc.invalidateQueries({ queryKey: ["admin-codes"] }); },
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
      <div className="mt-4 space-y-2">
        <p className="text-sm font-black">Saved codes ({list?.codes.length ?? 0})</p>
        {(list?.codes ?? []).map((c) => (
          <div key={c.code} className="flex items-center justify-between rounded-xl border border-border p-2">
            <div>
              <p className="font-mono text-sm font-bold">{c.code}</p>
              <p className="text-[11px] text-muted-foreground">🪙 {c.amount} · used {c.uses}/{c.maxUses}</p>
            </div>
            <button
              onClick={() => toggle.mutate({ code: c.code, active: !c.active })}
              className={`rounded-lg px-2 py-1 text-xs font-bold ${c.active ? "bg-secondary" : "bg-muted text-muted-foreground"}`}
            >
              {c.active ? "Active" : "Disabled"}
            </button>
          </div>
        ))}
      </div>
    </Card>
  );
}

function Activity({ creds, userId }: { creds: Creds; userId: string }) {
  const fn = useServerFn(adminUserActivity);
  const { data, isLoading } = useQuery({ queryKey: ["admin-act", userId], queryFn: () => fn({ data: { ...creds, userId } }) });
  if (isLoading || !data) return <p className="mt-2 text-xs text-muted-foreground">Loading…</p>;
  const t = (s: string) => new Date(s).toLocaleString();
  const Sec = ({ title, rows }: { title: string; rows: string[] }) => (
    <div className="mt-2">
      <p className="text-xs font-black">{title} ({rows.length})</p>
      <div className="max-h-40 space-y-0.5 overflow-y-auto">
        {rows.map((r, i) => <p key={i} className="break-all text-[10px] text-muted-foreground">{r}</p>)}
      </div>
    </div>
  );
  return (
    <div className="mt-2 rounded-xl bg-muted p-2">
      {data.info && (
        <p className="break-all text-[10px]">
          🌐 IP {data.info.ip ?? "-"} · 📱 {data.info.device?.slice(0, 12) ?? "-"} · joined {t(data.info.joined)} · seen {t(data.info.lastSeen)}
          {data.info.reason ? ` · 🚫 ${data.info.reason}` : ""}
        </p>
      )}
      <Sec title="💰 Transactions" rows={data.transactions.map((r) => `${t(r.at)} · ${r.kind} · ${r.amount > 0 ? "+" : ""}${r.amount} · ${r.note}`)} />
      <Sec title="🎬 Ads" rows={data.ads.map((r) => `${t(r.at)} · ${r.source} · +${r.reward}`)} />
      <Sec title="✅ Tasks" rows={data.tasks.map((r) => `${t(r.at)} · ${r.key}`)} />
      <Sec title="👥 Referrals" rows={data.referrals.map((r) => `${t(r.at)} · ${r.fake ? "❌ FAKE" : r.status} · pending ${r.pending}`)} />
      <Sec title="💸 Withdrawals" rows={data.withdrawals.map((r) => `${t(r.at)} · ${r.tokens} FOX · $${r.net} · ${r.status}${r.txid ? " · " + r.txid : ""}`)} />
    </div>
  );
}

function Notify({ creds }: { creds: Creds }) {
  const [text, setText] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [buttonText, setButtonText] = useState("");
  const [buttonUrl, setButtonUrl] = useState("");
  const [toUsers, setToUsers] = useState(true);
  const [toChannel, setToChannel] = useState(false);
  const [toPayment, setToPayment] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const fn = useServerFn(adminBroadcast);
  const send = useMutation({
    mutationFn: async () => {
      let offset: number | null = 0;
      let sent = 0;
      let failed = 0;
      let first: { channel: boolean | null; payment: boolean | null } | null = null;
      while (offset !== null) {
        const r = await fn({ data: { ...creds, text, imageUrl, buttonText, buttonUrl, toUsers, toChannel, toPayment, offset } });
        if (!first) first = { channel: r.channel, payment: r.payment };
        sent += r.sent;
        failed += r.failed;
        offset = r.nextOffset;
        if (toUsers) setProgress(`Sending… ${sent + failed} / ${r.total} (✅ ${sent} · ❌ ${failed})`);
      }
      return { sent, failed, ...first! };
    },
    onSuccess: (r) => {
      const extra = [
        toChannel ? (r.channel ? "community ✅" : "community ❌") : "",
        toPayment ? (r.payment ? "payment ✅" : "payment ❌ (check HTML / bot admin)") : "",
      ].filter(Boolean).join(" · ");
      toast.success(`Sent to ${r.sent} users (${r.failed} blocked/failed)${extra ? " · " + extra : ""}`);
      setProgress(null);
      setText("");
    },
    onError: (e) => { setProgress(null); toast.error((e as Error).message); },
  });
  return (
    <Card>
      <p className="mb-2 text-sm font-black">📣 Broadcast</p>
      <p className="mb-2 text-[11px] text-muted-foreground">HTML supported: &lt;b&gt;, &lt;i&gt;, &lt;a href=""&gt;, &lt;code&gt;</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        placeholder="🎉 <b>Big news</b> for all farmers…"
        className="w-full rounded-xl border border-border bg-background p-2 text-sm"
      />
      <div className="mt-2 space-y-2">
        <Field label="Image link (optional)" value={imageUrl} onChange={setImageUrl} placeholder="https://i.ibb.co/…" />
        <Field label="Button text (optional)" value={buttonText} onChange={setButtonText} placeholder="Join now" />
        <Field label="Button link (optional)" value={buttonUrl} onChange={setButtonUrl} placeholder="https://…" />
        <label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={toUsers} onChange={(e) => setToUsers(e.target.checked)} /> All users</label>
        <label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={toChannel} onChange={(e) => setToChannel(e.target.checked)} /> Community channel</label>
        <label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={toPayment} onChange={(e) => setToPayment(e.target.checked)} /> Payment channel</label>
        <p className="text-[11px] text-muted-foreground">Keep this page open until sending finishes.</p>
      </div>
      <button
        onClick={() => send.mutate()}
        disabled={send.isPending || (!toUsers && !toChannel)}
        className="mt-2 w-full rounded-xl bg-primary py-2 text-sm font-black text-primary-foreground disabled:opacity-50"
      >
        {send.isPending ? (progress ?? "Sending…") : "📣 Send"}
      </button>
    </Card>
  );
}

type PartnerRow = { id: string; title: string; chat: string; referLink: string };

function Partners({ creds }: { creds: Creds }) {
  const listFn = useServerFn(adminListPartners);
  const saveFn = useServerFn(adminSavePartners);
  const checkFn = useServerFn(adminCheckBotAdmin);
  const postFn = useServerFn(adminPostPartner);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin-partners"], queryFn: () => listFn({ data: creds }) });
  const items = (data?.partners ?? []) as PartnerRow[];
  const [title, setTitle] = useState("");
  const [chat, setChat] = useState("");
  const [link, setLink] = useState("");
  const [html, setHtml] = useState("🦊 <b>Fox Farm</b> — mine FOX every hour and withdraw USDT!");
  const [imageUrl, setImageUrl] = useState("");
  const [buttonText, setButtonText] = useState("🦊 Start earning");
  const save = useMutation({
    mutationFn: (next: PartnerRow[]) => saveFn({ data: { ...creds, partners: next } }),
    onSuccess: () => { toast.success("Partners saved"); qc.invalidateQueries({ queryKey: ["admin-partners"] }); },
    onError: (e) => toast.error((e as Error).message),
  });
  const check = useMutation({
    mutationFn: (c: string) => checkFn({ data: { ...creds, chat: c } }),
    onSuccess: (r) => (r.canPost ? toast.success("✅ Bot is admin and can post") : toast.error(`Bot is not admin (${r.status})`)),
    onError: (e) => toast.error((e as Error).message),
  });
  const post = useMutation({
    mutationFn: (p: PartnerRow) =>
      postFn({ data: { ...creds, chat: p.chat, html, imageUrl, buttonText, referLink: p.referLink || data?.defaultLink || "" } }),
    onSuccess: () => toast.success("Posted"),
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <div className="space-y-3">
      <Card>
        <p className="mb-2 text-sm font-black">🤝 Add partner channel</p>
        <div className="space-y-2">
          <Field label="Title" value={title} onChange={setTitle} placeholder="Earning Hub" />
          <Field label="Channel (@name or id)" value={chat} onChange={setChat} placeholder="@EarningHub1236" />
          <Field label="Refer link (optional — default is yours)" value={link} onChange={setLink} placeholder={data?.defaultLink ?? ""} />
          <button
            onClick={() => {
              if (!chat.trim()) { toast.error("Enter the channel"); return; }
              save.mutate([...items, { id: `p${Date.now().toString(36)}`, title: title.trim(), chat: chat.trim(), referLink: link.trim() }]);
              setTitle(""); setChat(""); setLink("");
            }}
            className="w-full rounded-xl bg-primary py-2 text-sm font-black text-primary-foreground"
          >
            Add channel
          </button>
        </div>
      </Card>
      <Card>
        <p className="mb-2 text-sm font-black">✉️ Post content (HTML)</p>
        <textarea value={html} onChange={(e) => setHtml(e.target.value)} rows={5} className="w-full rounded-xl border border-border bg-background p-2 text-sm" />
        <div className="mt-2 space-y-2">
          <Field label="Image link (optional)" value={imageUrl} onChange={setImageUrl} placeholder="https://i.ibb.co/…" />
          <Field label="Button text" value={buttonText} onChange={setButtonText} />
        </div>
      </Card>
      {items.map((p) => (
        <Card key={p.id}>
          <p className="truncate text-sm font-black">{p.title}</p>
          <p className="truncate text-[11px] text-muted-foreground">{p.chat} · {p.referLink || "default refer link"}</p>
          <div className="mt-2 grid grid-cols-4 gap-1">
            <button onClick={() => check.mutate(p.chat)} className="rounded-lg bg-secondary py-1 text-[11px] font-bold">Check</button>
            <button onClick={() => post.mutate(p)} disabled={post.isPending} className="rounded-lg bg-primary py-1 text-[11px] font-bold text-primary-foreground disabled:opacity-50">Post</button>
            <button
              onClick={() => {
                const l = window.prompt("Refer link", p.referLink || data?.defaultLink || "");
                if (l !== null) save.mutate(items.map((x) => (x.id === p.id ? { ...x, referLink: l.trim() } : x)));
              }}
              className="rounded-lg bg-secondary py-1 text-[11px] font-bold"
            >
              Link
            </button>
            <button onClick={() => save.mutate(items.filter((x) => x.id !== p.id))} className="rounded-lg bg-destructive py-1 text-[11px] font-bold text-destructive-foreground">Delete</button>
          </div>
        </Card>
      ))}
      {!items.length && <p className="text-center text-xs text-muted-foreground">No partner channels yet.</p>}
    </div>
  );
}

function Settings({ creds }: { creds: Creds }) {
  const getFn = useServerFn(adminGetConfig);
  const setFn = useServerFn(adminSetConfig);
  const qc = useQueryClient();
  const app = useQuery({ queryKey: ["admin-cfg-app"], queryFn: () => getFn({ data: { ...creds, key: "app" } }) });
  const wd = useQuery({ queryKey: ["admin-cfg-wd"], queryFn: () => getFn({ data: { ...creds, key: "withdraw" } }) });
  const tg = useQuery({ queryKey: ["admin-cfg-tg"], queryFn: () => getFn({ data: { ...creds, key: "tigorix" } }) });
  const [tD, setTD] = useState<Record<string, unknown> | null>(null);
  const parse = (j?: string) => { try { return JSON.parse(j ?? "{}") as Record<string, unknown>; } catch { return {}; } };
  const a = parse(app.data?.json);
  const w = parse(wd.data?.json);
  const [aD, setAD] = useState<Record<string, unknown> | null>(null);
  const [wD, setWD] = useState<Record<string, unknown> | null>(null);
  const av = aD ?? a;
  const tv = tD ?? parse(tg.data?.json);
  const wv = wD ?? w;
  const save = useMutation({
    mutationFn: async () => {
      await setFn({ data: { ...creds, key: "app", value: av } });
      const nums: Record<string, number> = {};
      for (const [k, v] of Object.entries(wv)) if (v !== "" && Number.isFinite(Number(v))) nums[k] = Number(v);
      await setFn({ data: { ...creds, key: "withdraw", value: nums } });
      await setFn({ data: { ...creds, key: "tigorix", value: {
        enabled: tv["enabled"] === undefined ? true : tv["enabled"] === true,
        reward: Number(tv["reward"] ?? 1000), fox_target: Number(tv["fox_target"] ?? 20), tigorix_target: Number(tv["tigorix_target"] ?? 15),
      } } });
      setTD(null); qc.invalidateQueries({ queryKey: ["admin-cfg-tg"] });
    },
    onSuccess: () => { toast.success("Settings saved — live in the app"); setAD(null); setWD(null); qc.invalidateQueries({ queryKey: ["admin-cfg-app"] }); qc.invalidateQueries({ queryKey: ["admin-cfg-wd"] }); },
    onError: (e) => toast.error((e as Error).message),
  });
  const bool = (k: string, def: boolean) => (av[k] === undefined ? def : av[k] === true || av[k] === "true");
  const Toggle = ({ k, label, def }: { k: string; label: string; def: boolean }) => (
    <label className="flex items-center justify-between rounded-xl border border-border p-2 text-sm font-bold">
      {label}
      <input type="checkbox" checked={bool(k, def)} onChange={(e) => setAD({ ...av, [k]: e.target.checked })} />
    </label>
  );
  const num = (k: string, label: string, def: number) => (
    <Field key={k} label={label} type="number" value={String(wv[k] ?? def)} onChange={(v) => setWD({ ...wv, [k]: v })} />
  );
  return (
    <div className="space-y-3">
      <Card>
        <p className="mb-2 text-sm font-black">⚙️ App</p>
        <div className="space-y-2">
          <Toggle k="maintenance" label="🛠 Maintenance mode (you stay exempt)" def={false} />
          <Toggle k="withdrawals_enabled" label="💸 Withdrawals enabled" def={true} />
          <Field label="Maintenance message" value={String(av["maintenance_text"] ?? "")} onChange={(v) => setAD({ ...av, maintenance_text: v })} />
          <Field label="Notice banner (empty = hidden)" value={String(av["notice"] ?? "")} onChange={(v) => setAD({ ...av, notice: v })} />
        </div>
      </Card>
      <Card>
        <p className="mb-2 text-sm font-black">💵 Withdrawal rules</p>
        <div className="grid grid-cols-2 gap-2">
          {num("min_usd", "Min USD", 0.05)}
          {num("max_usd", "Max USD", 0.5)}
          {num("first_min", "1st min FOX", 10000)}
          {num("next_min", "Next min FOX", 10000)}
          {num("fee_flat", "Fee flat $", 0)}
          {num("fee_percent", "Fee %", 0)}
          {num("tokens_per_usd", "FOX per $1", 100000)}
          {num("req_daily_ads", "Daily ads needed", 30)}
          {num("req_referrals", "Referrals needed", 2)}
        </div>
      </Card>
      <Card>
        <p className="mb-2 text-sm font-black">🤝 Tigorix partner bonus</p>
        <label className="mb-2 flex items-center justify-between rounded-xl border border-border p-2 text-sm font-bold">
          Bonus enabled
          <input type="checkbox" checked={tv["enabled"] === undefined ? true : tv["enabled"] === true} onChange={(e) => setTD({ ...tv, enabled: e.target.checked })} />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Bonus FOX" type="number" value={String(tv["reward"] ?? 1000)} onChange={(v) => setTD({ ...tv, reward: v })} />
          <Field label="Fox Farm Adsgram ads" type="number" value={String(tv["fox_target"] ?? 20)} onChange={(v) => setTD({ ...tv, fox_target: v })} />
          <Field label="Tigorix Adsgram ads" type="number" value={String(tv["tigorix_target"] ?? 15)} onChange={(v) => setTD({ ...tv, tigorix_target: v })} />
        </div>
      </Card>
      <button onClick={() => save.mutate()} disabled={save.isPending} className="w-full rounded-xl bg-primary py-3 text-sm font-black text-primary-foreground disabled:opacity-50">
        {save.isPending ? "Saving…" : "Save settings"}
      </button>
    </div>
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
