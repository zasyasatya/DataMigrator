"use client";

import { ArrowLeft, MessageCircle, Rocket, X } from "lucide-react";
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
  const [simOpen, setSimOpen] = useState(false);

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
        <div className="hidden h-[calc(100vh-8rem)] min-h-[560px] xl:sticky xl:top-6 xl:block">
          <Simulator agent={agent} />
        </div>
      </div>

      {/* simulator sebagai overlay di mobile / tablet */}
      <button
        onClick={() => setSimOpen(true)}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-ink px-4 py-3 text-[13px] font-bold text-white shadow-pop xl:hidden"
      >
        <MessageCircle size={16} /> Simulator
      </button>
      {simOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-ink/50 p-3 backdrop-blur-sm xl:hidden">
          <div className="mx-auto flex h-full w-full max-w-[480px] flex-col overflow-hidden rounded-[24px] bg-white shadow-pop">
            <div className="flex items-center justify-between border-b border-line px-4 py-2">
              <span className="text-[13px] font-bold">Simulator {agent.name}</span>
              <button onClick={() => setSimOpen(false)} className="rounded-lg p-2 text-ink-3 hover:bg-primary-soft">
                <X size={16} />
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <Simulator agent={agent} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
