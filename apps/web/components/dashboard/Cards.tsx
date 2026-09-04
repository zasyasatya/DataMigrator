"use client";

import {
  CalendarCheck,
  CircleDollarSign,
  ClipboardList,
  MessageSquareText,
  Sparkles,
  Timer,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { clockTime, timeAgo } from "@/lib/api";
import type { Conversation, Overview } from "@/lib/types";
import { Badge, Card, cx, Progress } from "@/components/ui";

export function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  progress,
  color,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub: string;
  progress: number;
  color: string;
}) {
  return (
    <Card className="fade-up p-5">
      <div className="flex items-center gap-2.5 text-[13px] font-semibold text-ink-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-white text-ink">
          <Icon size={15} strokeWidth={2.2} />
        </span>
        {label}
      </div>
      <div className="mt-3 text-[30px] font-bold leading-none tracking-tight text-ink">{value}</div>
      <div className="mt-1.5 text-[12px] text-ink-3">{sub}</div>
      <div className="mt-4 flex items-center justify-between text-[12px] font-semibold text-ink-2">
        <span>Progress</span>
        <span>{Math.round(progress)}%</span>
      </div>
      <div className="mt-1.5">
        <Progress value={progress} color={color} />
      </div>
    </Card>
  );
}

const ICON_TILES: Record<string, { icon: LucideIcon; cls: string }> = {
  user: { icon: UserRound, cls: "bg-success-soft text-success" },
  spark: { icon: Sparkles, cls: "bg-primary-soft text-primary-600" },
};

export function ActivityCard({ overview }: { overview: Overview }) {
  return (
    <Card className="fade-up p-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[15px] font-bold text-ink">AI Agent activity</h3>
          <div className="mt-1 flex items-center gap-2 text-[12px] text-ink-3">
            <i className="h-1.5 w-1.5 rounded-full bg-success" /> Live · last 24 hours
          </div>
        </div>
        <Link
          href="/agents"
          className="rounded-xl border border-line bg-white/70 px-3.5 py-2 text-[12.5px] font-semibold text-ink hover:border-primary/40"
        >
          View All
        </Link>
      </div>
      <div className="mt-4 divide-y divide-line/70">
        {overview.activity.length === 0 && (
          <p className="py-6 text-center text-[13px] text-ink-3">
            Belum ada aktivitas. Coba simulator atau pasang widget di situs Anda.
          </p>
        )}
        {overview.activity.slice(0, 5).map((a) => {
          const tile = ICON_TILES[a.icon] || ICON_TILES.spark;
          const Icon = tile.icon;
          return (
            <div key={a.id} className="flex gap-3 py-3.5">
              <span className={cx("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", tile.cls)}>
                <Icon size={15} strokeWidth={2.2} />
              </span>
              <div className="min-w-0">
                <p className="text-[13.5px] leading-snug text-ink">
                  <b className="font-bold">{a.title}</b>{" "}
                  <span className="text-ink-2">{a.detail}</span>
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-[11.5px] text-ink-3">
                  <Sparkles size={11} className="text-primary" /> {a.agent} · {a.ago}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

const STATUS_TONE: Record<string, "success" | "violet" | "warning"> = {
  resolved: "success",
  open: "violet",
};

export function ConversationsCard({ conversations }: { conversations: Conversation[] }) {
  const borders = ["border-l-success", "border-l-warning", "border-l-primary", "border-l-danger"];
  return (
    <Card className="fade-up p-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[15px] font-bold text-ink">Percakapan terbaru</h3>
          <p className="mt-1 text-[12px] text-ink-3">Widget · simulator · API</p>
        </div>
        <div className="flex gap-1.5">
          <CalendarCheck size={15} className="text-ink-3" />
        </div>
      </div>
      <div className="mt-4 space-y-1">
        {conversations.length === 0 && (
          <p className="py-6 text-center text-[13px] text-ink-3">Belum ada percakapan masuk.</p>
        )}
        {conversations.map((c, i) => (
          <div
            key={c.id}
            className={cx(
              "flex items-center gap-3 rounded-xl border-l-[3px] px-3 py-3 transition hover:bg-primary-soft/50",
              borders[i % borders.length]
            )}
          >
            <div className="w-12 shrink-0">
              <div className="text-[13px] font-bold text-ink">{clockTime(c.last_message_at)}</div>
              <div className="text-[10.5px] text-ink-3">{c.message_count} pesan</div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13.5px] font-bold text-ink">
                {c.visitor_name || (c.channel === "simulator" ? "Simulator" : "Pengunjung")}
                <span className="ml-2 font-medium text-ink-3">· {c.channel}</span>
              </div>
              <div className="truncate text-[12.5px] text-ink-2">{c.last_message || "—"}</div>
            </div>
            <Badge tone={STATUS_TONE[c.status] || "neutral"} dot>
              {c.status === "resolved" ? "Resolved" : "Open"}
            </Badge>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function dashboardStats(overview: Overview) {
  return [
    {
      icon: MessageSquareText,
      label: "Percakapan hari ini",
      value: String(overview.conversations_today),
      sub: `${overview.conversations_done} selesai · ${overview.conversations_todo} berjalan`,
      progress: overview.conversations_today ? (overview.conversations_done / overview.conversations_today) * 100 : 0,
      color: "bg-primary",
    },
    {
      icon: Timer,
      label: "Rata-rata respons",
      value: `${overview.avg_response_s}s`,
      sub: "first response AI",
      progress: Math.max(5, 100 - overview.avg_response_s * 10),
      color: "bg-danger",
    },
    {
      icon: ClipboardList,
      label: "Tingkat resolusi",
      value: `${Math.round(overview.resolution_rate)}%`,
      sub: "tanpa eskalasi manusia",
      progress: overview.resolution_rate,
      color: "bg-warning",
    },
    {
      icon: CircleDollarSign,
      label: "CSAT",
      value: overview.csat ? `${Math.round(overview.csat)}%` : "—",
      sub: "dari feedback pelanggan",
      progress: overview.csat,
      color: "bg-primary",
    },
  ];
}
