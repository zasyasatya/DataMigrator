"use client";

import { ArrowLeft, Rocket } from "lucide-react";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import BuilderTabs from "@/components/builder/BuilderTabs";
import Simulator from "@/components/chat/Simulator";
import { TopBar } from "@/components/shell/Shell";
import { api } from "@/lib/api";
import type { Agent } from "@/lib/types";
import { Badge, Button } from "@/components/ui";

export default function BuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [agent, setAgent] = useState<Agent | null>(null);

  useEffect(() => {
    api<Agent>(`/agents/${id}`).then(setAgent).catch(() => setAgent(null));
  }, [id]);

  async function togglePublish() {
    const updated = await api<Agent>(`/agents/${id}/publish`, { method: "POST" });
    setAgent(updated);
  }

  if (!agent) {
    return <div className="flex h-[60vh] items-center justify-center text-[13px] text-ink-3">Memuat builder…</div>;
  }

  return (
    <>
      <TopBar
        title={
          <span className="flex items-center gap-3">
            <Link href="/agents" className="rounded-xl border border-line bg-white/70 p-2 text-ink-2 hover:text-primary-600">
              <ArrowLeft size={15} />
            </Link>
            <span className="text-[22px]">
              {agent.emoji} {agent.name}
            </span>
            <Badge tone={agent.status === "live" ? "success" : "neutral"} dot>
              {agent.status === "live" ? "Live" : "Draft"}
            </Badge>
          </span>
        }
        subtitle={agent.role_title}
        right={
          <Button variant={agent.status === "live" ? "outline" : "primary"} onClick={togglePublish}>
            <Rocket size={15} />
            {agent.status === "live" ? "Unpublish" : "Publish"}
          </Button>
        }
      />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
        <BuilderTabs agent={agent} onSaved={setAgent} />
        <div className="h-[calc(100vh-8rem)] min-h-[560px] xl:sticky xl:top-6">
          <Simulator agent={agent} />
        </div>
      </div>
    </>
  );
}
