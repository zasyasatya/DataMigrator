"use client";

import { BookOpen, MessageSquare, Plus, Rocket } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { TopBar } from "@/components/shell/Shell";
import { api } from "@/lib/api";
import type { Agent } from "@/lib/types";
import { Badge, Button, Card } from "@/components/ui";

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = () => api<Agent[]>("/agents").then(setAgents).finally(() => setLoaded(true));
  useEffect(() => {
    load();
  }, []);

  async function create() {
    const a = await api<Agent>("/agents", {
      method: "POST",
      body: JSON.stringify({ name: `Agent Baru ${agents.length + 1}` }),
    });
    location.href = `/agents/${a.id}`;
  }

  async function toggle(a: Agent) {
    await api(`/agents/${a.id}/publish`, { method: "POST" });
    load();
  }

  return (
    <>
      <TopBar
        title="AI Agents"
        subtitle="Training instruksi, knowledge, dan behaviour — lalu embed ke website pelanggan."
        right={
          <Button onClick={create}>
            <Plus size={16} /> Agent baru
          </Button>
        }
      />
      {!loaded ? (
        <p className="text-[13px] text-ink-3">Memuat…</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {agents.map((a) => (
            <Card key={a.id} className="fade-up group p-5 transition hover:shadow-pop">
              <div className="flex items-start gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-100 to-primary text-[22px] shadow-[0_8px_20px_-8px_rgba(124,92,246,.7)]">
                  {a.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-[15px] font-bold">{a.name}</h3>
                    <Badge tone={a.status === "live" ? "success" : "neutral"} dot>
                      {a.status === "live" ? "Live" : "Draft"}
                    </Badge>
                  </div>
                  <p className="mt-0.5 truncate text-[12.5px] text-ink-2">{a.role_title}</p>
                </div>
              </div>
              <p className="mt-3 line-clamp-2 min-h-[36px] text-[12.5px] leading-relaxed text-ink-2">
                {a.instructions?.slice(0, 140) || "Belum ada instruksi."}
              </p>
              <div className="mt-4 flex items-center gap-4 text-[11.5px] font-semibold text-ink-3">
                <span className="inline-flex items-center gap-1.5">
                  <BookOpen size={13} /> {a.document_count} dokumen
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <MessageSquare size={13} /> {a.conversation_count} percakapan
                </span>
              </div>
              <div className="mt-4 flex gap-2">
                <Link href={`/agents/${a.id}`} className="flex-1">
                  <Button className="w-full" variant="primary" size="sm">
                    Buka builder
                  </Button>
                </Link>
                <Button variant="outline" size="sm" onClick={() => toggle(a)}>
                  <Rocket size={13} />
                  {a.status === "live" ? "Unpublish" : "Publish"}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
