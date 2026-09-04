"use client";

import { Sparkles } from "lucide-react";
import type { Overview } from "@/lib/types";

function MiniBars({ series }: { series: number[] }) {
  const max = Math.max(...series, 1);
  return (
    <div className="mini-bars">
      {series.map((v, i) => (
        <i key={i} style={{ height: `${Math.max(18, (v / max) * 100)}%` }} />
      ))}
    </div>
  );
}

export default function Hero({ overview, agentName }: { overview: Overview; agentName?: string }) {
  const tiles = [
    { label: "Percakapan Hari Ini", value: String(overview.conversations_today), sub: `${overview.conversations_done} selesai · ${overview.conversations_todo} aktif` },
    { label: "Waktu Hemat", value: `${overview.time_saved_h}h`, sub: "AI reminders active" },
    { label: "Resolusi", value: `${Math.round(overview.resolution_rate)}%`, sub: `CSAT ${overview.csat || "-"}%` },
  ];
  return (
    <section className="hero-grad fade-up relative overflow-hidden rounded-[24px] p-6 text-white shadow-pop">
      <div className="flex flex-wrap items-center gap-6">
        <div className="relative">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[#A87CFF] via-primary to-[#5A3ECB] shadow-[0_0_44px_rgba(168,124,255,.75)]">
            <Sparkles size={30} className="text-white" />
          </div>
          <div className="absolute inset-0 -z-10 animate-pulse rounded-full bg-primary/40 blur-2xl" />
        </div>

        <div className="min-w-[240px] flex-1">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10.5px] font-bold uppercase tracking-widest">
              <i className="h-1.5 w-1.5 rounded-full bg-[#34D399] shadow-[0_0_8px_#34D399]" />
              AI Agent · Live
            </span>
            <span className="wave" aria-hidden>
              <i /><i /><i /><i /><i /><i />
            </span>
          </div>
          <h2 className="mt-3 text-[19px] font-bold tracking-tight">
            {agentName || "Sapa"} sedang menangani {overview.tasks_now} percakapan sekarang
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[12px] font-medium">
              {overview.agents_live} agent live
            </span>
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[12px] font-medium">
              {overview.messages_today} pesan hari ini
            </span>
          </div>
        </div>

        <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-3">
          {tiles.map((t) => (
            <div key={t.label} className="tile-grad rounded-2xl p-4">
              <div className="flex items-center gap-2 text-[11.5px] font-semibold text-white/70">
                <i className="h-3.5 w-3.5 rounded-md border border-white/25 bg-white/10" />
                {t.label}
              </div>
              <div className="mt-2 flex items-end justify-between gap-3">
                <span className="text-[26px] font-bold leading-none tracking-tight">{t.value}</span>
                <MiniBars series={overview.week_series} />
              </div>
              <div className="mt-2 text-[11px] text-white/60">{t.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
