import { SectionTitle } from "@/components/AppShell";
import {
  ArrowLeftRight,
  Bell,
  Globe,
  Info,
  MessageCircle,
  Trophy,
  Users,
  Wallet,
} from "lucide-react";

function Row({
  icon: Icon,
  label,
  href,
}: {
  icon: typeof Wallet;
  label: string;
  href?: string;
}) {
  const inner = (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 text-sm font-semibold active:scale-[0.99]">
      <Icon className="h-5 w-5 text-primary" />
      <span className="flex-1">{label}</span>
      <span className="text-muted-foreground">›</span>
    </div>
  );
  return href ? (
    <a href={href} target="_blank" rel="noreferrer">
      {inner}
    </a>
  ) : (
    <button className="w-full text-left">{inner}</button>
  );
}

export function ProfileTab() {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 rounded-3xl border border-border bg-card p-4">
        <div className="grid h-14 w-14 place-items-center rounded-full bg-primary text-2xl text-primary-foreground">
          🦊
        </div>
        <div>
          <p className="font-black">Farmer</p>
          <p className="text-xs text-muted-foreground">Telegram ID —</p>
        </div>
      </div>

      <SectionTitle>Finance</SectionTitle>
      <Row icon={Wallet} label="Wallet (USDT BEP-20)" />
      <Row icon={ArrowLeftRight} label="Transactions" />

      <SectionTitle>Social</SectionTitle>
      <Row icon={Users} label="Refer friends" />
      <Row icon={Trophy} label="Leaderboard" />

      <SectionTitle>Community</SectionTitle>
      <Row icon={MessageCircle} label="Community channel" href="https://t.me/foxfarm_community" />
      <Row icon={MessageCircle} label="Payment channel" href="https://t.me/foxfarmpay" />

      <SectionTitle>Preferences</SectionTitle>
      <Row icon={Bell} label="Notifications" />
      <Row icon={Globe} label="Language" />
      <Row icon={Info} label="About Fox Farm" />
    </div>
  );
}
