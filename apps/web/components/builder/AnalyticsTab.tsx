"use client";

import { Clock, Database, Gauge, ThumbsDown, ThumbsUp, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { AgentAnalytics } from "@/lib/types";
import { Badge, Card, cx, Progress } from "@/components/ui";

const CHANNEL_LABEL: Record<string, string> = {
  widget: "Widget web",
  simulator: "Simulator",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  api: "API",
};

function Kpi({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string; sub?: string }) {
  return (
    <Card className="fade-up p-4">
      <div className="flex items-center gap-2 text-[11.5px] font-semibold text-ink-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full border border-line bg-white">
          <Icon size={13} />
        </span>
        {label}
      </div>
      <div className="mt-2 text-[24px] font-bold leading-none tracking-tight">{value}</div>
      {sub && <div className="mt-1 text-[11px] text-ink-3">{sub}</div>}
    </Card>
  );
}

export default function AnalyticsTab({ agentId }: { agentId: string }) {
  const [a, setA] = useState<AgentAnalytics | null>(null);

  useEffect(() => {
    api<AgentAnalytics>(`/analytics/agents/${agentId}`).then(setA).catch(() => {});
  }, [agentId]);

  if (!a) return <p className="p-8 text-center text-[13px] text-ink-3">Memuat analitik…</p>;

  const maxConv = Math.max(...a.series.map((s) => s.conversations), 1);
  const maxHour = Math.max(...a.hour_histogram, 1);
  const channelTotal = Object.values(a.by_channel).reduce((x, y) => x + y, 0) || 1;
  const fbTotal = (a.feedback.up || 0) + (a.feedback.down || 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <Kpi icon={Users} label="Percakapan" value={String(a.conversations_total)} sub={`${a.messages_total} pesan`} />
        <Kpi icon={Gauge} label="Resolusi" value={`${a.resolution_rate}%`} sub="tanpa eskalasi" />
        <Kpi icon={ThumbsUp} label="CSAT" value={a.csat ? `${a.csat}%` : "—"} sub={`${fbTotal} feedback`} />
        <Kpi icon={Clock} label="Respons rata-rata" value={`${a.avg_latency_s}s`} sub="first response" />
        <Kpi icon={Database} label="Jam sibuk" value={`${String(a.busiest_hour).padStart(2, "0")}:00`} sub="pesan terbanyak" />
      </div>

      <Card className="fade-up p-5">
        <h3 className="text-[14px] font-bold">Percakapan 14 hari terakhir</h3>
        <div className="mt-4 flex h-[120px] items-end gap-1.5">
          {a.series.map((s) => (
            <div key={s.date} className="group flex flex-1 flex-col items-center gap-1" title={`${s.date}: ${s.conversations} percakapan · ${s.messages} pesan`}>
              <div className="flex w-full flex-1 items-end">
                <div
                  className="w-full rounded-t-md bg-gradient-to-t from-primary-600 to-primary transition-all group-hover:opacity-80"
                  style={{ height: `${Math.max(4, (s.conversations / maxConv) * 100)}%` }}
                />
              </div>
              <span className="text-[9px] font-semibold text-ink-3">{s.date.slice(8)}</span>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="fade-up p-5">
          <h3 className="text-[14px] font-bold">Distribusi channel</h3>
          <div className="mt-4 space-y-3">
            {Object.entries(a.by_channel).length === 0 && (
              <p className="text-[12.5px] text-ink-3">Belum ada percakapan.</p>
            )}
            {Object.entries(a.by_channel).map(([ch, n]) => (
              <div key={ch}>
                <div className="mb-1 flex justify-between text-[12px] font-semibold">
                  <span>{CHANNEL_LABEL[ch] || ch}</span>
                  <span>
                    {n} · {Math.round((n / channelTotal) * 100)}%
                  </span>
                </div>
                <Progress value={(n / channelTotal) * 100} color={ch === "whatsapp" ? "bg-[#25D366]" : ch === "instagram" ? "bg-[#C13584]" : "bg-primary"} />
              </div>
            ))}
          </div>
          <div className="mt-5 flex items-center gap-2">
            <Badge tone="success">
              <ThumbsUp size={10} /> {a.feedback.up || 0}
            </Badge>
            <Badge tone="danger">
              <ThumbsDown size={10} /> {a.feedback.down || 0}
            </Badge>
            <span className="text-[11.5px] text-ink-3">feedback pelanggan</span>
          </div>
        </Card>

        <Card className="fade-up p-5">
          <h3 className="text-[14px] font-bold">Pola jam pesan masuk</h3>
          <div className="mt-4 flex h-[90px] items-end gap-[3px]">
            {a.hour_histogram.map((v, h) => (
              <div
                key={h}
                title={`${String(h).padStart(2, "0")}:00 → ${v} pesan`}
                className={cx(
                  "flex-1 rounded-sm transition-all",
                  h === a.busiest_hour ? "bg-primary-600" : "bg-primary/35 hover:bg-primary/60"
                )}
                style={{ height: `${Math.max(4, (v / maxHour) * 100)}%` }}
              />
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[9.5px] font-semibold text-ink-3">
            <span>00</span>
            <span>06</span>
            <span>12</span>
            <span>18</span>
            <span>23</span>
          </div>
          <div className="mt-4">
            <h4 className="text-[12.5px] font-bold">Engine</h4>
            <div className="mt-2 flex flex-wrap gap-2">
              {Object.entries(a.engine_split).map(([e, n]) => (
                <Badge key={e} tone={e === "openai" ? "violet" : "neutral"}>
                  {e} · {n}
                </Badge>
              ))}
              {Object.keys(a.engine_split).length === 0 && <span className="text-[12px] text-ink-3">—</span>}
            </div>
          </div>
        </Card>
      </div>

      <Card className="fade-up p-5">
        <h3 className="text-[14px] font-bold">Sumber knowledge paling sering dikutip</h3>
        <div className="mt-4 space-y-3">
          {a.top_sources.length === 0 && <p className="text-[12.5px] text-ink-3">Belum ada retrieval terpakai.</p>}
          {a.top_sources.map((s, i) => (
            <div key={s.title}>
              <div className="mb-1 flex justify-between text-[12px] font-semibold">
                <span>
                  {i + 1}. {s.title}
                </span>
                <span>{s.hits} hit</span>
              </div>
              <Progress value={(s.hits / (a.top_sources[0]?.hits || 1)) * 100} />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
