"use client";

import { useEffect, useState } from "react";
import { ActivityCard, ConversationsCard, dashboardStats, StatCard } from "@/components/dashboard/Cards";
import Hero from "@/components/dashboard/Hero";
import { TopBar } from "@/components/shell/Shell";
import { api } from "@/lib/api";
import type { Agent, Overview } from "@/lib/types";

export default function DashboardPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);

  useEffect(() => {
    api<Overview>("/analytics/overview").then(setOverview).catch(() => {});
    api<Agent[]>("/agents").then(setAgents).catch(() => {});
  }, []);

  if (!overview) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-[13px] text-ink-3">
        Memuat dashboard…
      </div>
    );
  }
  const stats = dashboardStats(overview);
  const liveAgent = agents.find((a) => a.status === "live");

  return (
    <>
      <TopBar
        title={overview.greeting}
        subtitle={
          <>
            Sapa telah menangani{" "}
            <b className="font-semibold text-primary-600">{overview.conversations_today} percakapan</b>{" "}
            hari ini. Berikut ringkasannya.
          </>
        }
      />
      <Hero overview={overview} agentName={liveAgent?.name} />
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>
      <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ActivityCard overview={overview} />
        <ConversationsCard conversations={overview.recent_conversations} />
      </div>
    </>
  );
}
