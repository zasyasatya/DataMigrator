"use client";

import { Bot, RotateCcw, Send, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { streamChat } from "@/lib/api";
import type { Agent } from "@/lib/types";
import { Badge, cx } from "@/components/ui";

interface SimMsg {
  role: "user" | "assistant";
  content: string;
  sources?: { title: string; score: number }[];
  latency?: number;
  engine?: string;
}

export default function Simulator({ agent }: { agent: Agent }) {
  const [messages, setMessages] = useState<SimMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [cid, setCid] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = useCallback(
    async (raw?: string) => {
      const text = (raw ?? input).trim();
      if (!text || busy) return;
      setInput("");
      setBusy(true);
      setMessages((m) => [...m, { role: "user", content: text }]);
      setMessages((m) => [...m, { role: "assistant", content: "" }]);
      let acc = "";
      try {
        await streamChat(
          `/agents/${agent.id}/simulate`,
          { message: text, conversation_id: cid },
          {
            onMeta: (d) => setCid(d.conversation_id),
            onDelta: (t) => {
              acc += t;
              setMessages((m) => {
                const next = [...m];
                next[next.length - 1] = { role: "assistant", content: acc };
                return next;
              });
            },
            onDone: (d) => {
              setMessages((m) => {
                const next = [...m];
                next[next.length - 1] = {
                  ...next[next.length - 1],
                  sources: d.sources,
                  latency: d.latency_ms,
                  engine: d.engine,
                };
                return next;
              });
            },
          }
        );
      } catch (e: any) {
        setMessages((m) => {
          const next = [...m];
          next[next.length - 1] = { role: "assistant", content: `⚠️ ${e.message}` };
          return next;
        });
      } finally {
        setBusy(false);
      }
    },
    [agent.id, busy, cid, input]
  );

  const reset = () => {
    setCid(null);
    setMessages([]);
  };

  return (
    <div className="card flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex items-center gap-3 border-b border-line px-4 py-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-700 text-[16px] text-white shadow-[0_6px_16px_-6px_rgba(124,92,246,.7)]">
          {agent.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[14px] font-bold">{agent.name}</span>
            <Badge tone={agent.status === "live" ? "success" : "neutral"} dot>
              {agent.status === "live" ? "Live" : "Draft"}
            </Badge>
          </div>
          <div className="text-[11.5px] text-ink-3">Simulator · perubahan tersimpan langsung teruji</div>
        </div>
        <button
          onClick={reset}
          title="Reset sesi simulasi"
          className="rounded-lg p-2 text-ink-3 transition hover:bg-primary-soft hover:text-primary-600"
        >
          <RotateCcw size={15} />
        </button>
      </div>

      <div ref={scrollRef} className="scroll-thin flex-1 space-y-3 overflow-y-auto bg-[linear-gradient(180deg,#FAF8FF,#FDFCFF)] px-4 py-4">
        {messages.length === 0 && (
          <div className="fade-up mx-auto max-w-[260px] rounded-2xl rounded-tl-md border border-line bg-white px-4 py-3 text-[13px] leading-relaxed text-ink shadow-[0_1px_2px_rgba(23,15,60,.05)]">
            {agent.greeting}
          </div>
        )}
        {messages.map((m, i) =>
          m.role === "user" ? (
            <div
              key={i}
              className="fade-up ml-auto max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-[13px] leading-relaxed text-white shadow-[0_6px_16px_-6px_rgba(124,92,246,.6)]"
            >
              {m.content}
            </div>
          ) : (
            <div key={i} className="fade-up max-w-[88%]">
              <div className="whitespace-pre-wrap rounded-2xl rounded-tl-md border border-line bg-white px-4 py-2.5 text-[13px] leading-relaxed text-ink shadow-[0_1px_2px_rgba(23,15,60,.05)]">
                {m.content || (
                  <span className="typing">
                    <i />
                    <i />
                    <i />
                  </span>
                )}
              </div>
              {(m.sources?.length || m.latency != null) && (
                <div className="mt-1 flex flex-wrap items-center gap-2 px-1 text-[10.5px] text-ink-3">
                  {m.engine && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 font-semibold text-primary-600">
                      <Sparkles size={9} /> {m.engine}
                    </span>
                  )}
                  {m.latency != null && <span>{(m.latency / 1000).toFixed(1)}s</span>}
                  {m.sources?.map((s) => (
                    <span key={s.title} className="rounded-full border border-line bg-white px-2 py-0.5 font-medium">
                      📚 {s.title}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )
        )}
      </div>

      {messages.length === 0 && agent.starter_prompts.length > 0 && (
        <div className="flex flex-wrap gap-2 px-4 pb-2">
          {agent.starter_prompts.slice(0, 3).map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="rounded-full border border-line bg-white px-3 py-1.5 text-[11.5px] font-semibold text-primary-600 transition hover:border-primary hover:bg-primary-soft"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="border-t border-line bg-white p-3">
        <div
          className={cx(
            "flex items-end gap-2 rounded-2xl border border-line bg-[#FBFAFF] px-3 py-2 transition",
            "focus-within:border-primary focus-within:ring-3 focus-within:ring-primary/15"
          )}
        >
          <textarea
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={`Coba tanya ${agent.name}…`}
            className="max-h-[110px] min-h-[24px] flex-1 resize-none bg-transparent text-[13px] outline-none placeholder:text-ink-3"
          />
          <button
            onClick={() => send()}
            disabled={busy || !input.trim()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-white transition hover:bg-primary-600 disabled:opacity-40"
          >
            {busy ? <Bot size={16} className="animate-pulse" /> : <Send size={16} />}
          </button>
        </div>
        <p className="mt-1.5 text-center text-[10.5px] text-ink-3">
          Enter kirim · Shift+Enter baris baru · mesin: {agent.engine}
        </p>
      </div>
    </div>
  );
}
