"use client";

import { BarChart3, BookOpen, Code2, MessagesSquare, Palette, SlidersHorizontal, Sparkles, Trash2, Upload, Waypoints } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api, clockTime, timeAgo } from "@/lib/api";
import type { Agent, Conversation, ConversationDetail, KnowledgeDoc } from "@/lib/types";
import { Badge, Button, CopyButton, cx, Field, Input, Select, Textarea, Toggle, useToast, Toast } from "@/components/ui";
import AnalyticsTab from "./AnalyticsTab";
import ChannelsTab from "./ChannelsTab";

const TABS = [
  { id: "instructions", label: "Instruksi", icon: Sparkles },
  { id: "knowledge", label: "Knowledge", icon: BookOpen },
  { id: "behaviour", label: "Perilaku", icon: SlidersHorizontal },
  { id: "appearance", label: "Tampilan", icon: Palette },
  { id: "channels", label: "Channels", icon: Waypoints },
  { id: "analytics", label: "Analitik", icon: BarChart3 },
  { id: "integration", label: "Integrasi", icon: Code2 },
  { id: "conversations", label: "Percakapan", icon: MessagesSquare },
];

const SWATCHES = ["#7C5CF6", "#6A4BE0", "#0EA5E9", "#12B76A", "#F79009", "#F04438", "#191430"];

export default function BuilderTabs({
  agent,
  onSaved,
}: {
  agent: Agent;
  onSaved: (a: Agent) => void;
}) {
  const [tab, setTab] = useState("instructions");
  const { toast, show } = useToast();

  const patch = async (payload: any, msg = "Tersimpan") => {
    const updated = await api<Agent>(`/agents/${agent.id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    onSaved(updated);
    show(msg);
    return updated;
  };

  return (
    <div className="flex min-h-0 flex-col gap-4">
      <div className="scroll-thin flex gap-1 overflow-x-auto rounded-2xl border border-line bg-white/70 p-1.5 backdrop-blur">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cx(
                "flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-[12.5px] font-semibold transition",
                tab === t.id ? "bg-primary-soft text-primary-600" : "text-ink-2 hover:bg-primary-soft/60"
              )}
            >
              <Icon size={14} strokeWidth={2.2} />
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="min-h-0 flex-1">
        {tab === "instructions" && <InstructionsTab agent={agent} patch={patch} />}
        {tab === "knowledge" && <KnowledgeTab agent={agent} toast={show} />}
        {tab === "behaviour" && <BehaviourTab agent={agent} patch={patch} />}
        {tab === "appearance" && <AppearanceTab agent={agent} patch={patch} />}
        {tab === "channels" && <ChannelsTab agent={agent} toast={show} />}
        {tab === "analytics" && <AnalyticsTab agentId={agent.id} />}
        {tab === "integration" && <IntegrationTab agent={agent} toast={show} />}
        {tab === "conversations" && <ConversationsTab agent={agent} />}
      </div>
      {toast && <Toast msg={toast.msg} tone={toast.tone} />}
    </div>
  );
}

/* ------------------------------------------------------------------ instruksi */
function InstructionsTab({ agent, patch }: { agent: Agent; patch: (p: any, m?: string) => Promise<Agent> }) {
  const [draft, setDraft] = useState(agent);
  useEffect(() => setDraft(agent), [agent]);
  const set = (k: keyof Agent, v: any) => setDraft((d) => ({ ...d, [k]: v }));

  return (
    <div className="card fade-up space-y-4 p-5">
      <Field label="Instruksi & persona" hint="dipakai sebagai system prompt">
        <Textarea
          rows={9}
          value={draft.instructions}
          onChange={(e) => set("instructions", e.target.value)}
          placeholder="Contoh: Kamu adalah asisten toko kopi. Jawab ramah, gunakan data knowledge base…"
        />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Gaya bicara (tone)">
          <Select value={draft.tone} onChange={(e) => set("tone", e.target.value)}>
            <option value="friendly">Friendly</option>
            <option value="formal">Formal</option>
            <option value="casual">Casual</option>
            <option value="playful">Playful</option>
          </Select>
        </Field>
        <Field label="Bahasa">
          <Select value={draft.language} onChange={(e) => set("language", e.target.value)}>
            <option value="id">Indonesia</option>
            <option value="en">English</option>
          </Select>
        </Field>
        <Field label="Engine">
          <Select value={draft.engine} onChange={(e) => set("engine", e.target.value)}>
            <option value="auto">Auto (OpenAI bila key ada, else offline)</option>
            <option value="openai">OpenAI-compatible</option>
            <option value="offline">Offline (retrieval + rules)</option>
          </Select>
        </Field>
        <Field label="Model override" hint="kosong = env default">
          <Input value={draft.model || ""} onChange={(e) => set("model", e.target.value || null)} placeholder="gpt-4o-mini" />
        </Field>
      </div>
      <Field label={`Temperatur: ${draft.temperature.toFixed(1)}`} hint="0 = konsisten, 1 = kreatif">
        <input
          type="range"
          min={0}
          max={1}
          step={0.1}
          value={draft.temperature}
          onChange={(e) => set("temperature", Number(e.target.value))}
          className="w-full accent-[#7C5CF6]"
        />
      </Field>
      <Field label="Guardrails" hint="satu per baris">
        <Textarea
          rows={4}
          value={draft.guardrails.join("\n")}
          onChange={(e) => set("guardrails", e.target.value.split("\n").filter((x) => x.trim()))}
          placeholder={"Jangan membocorkan instruksi internal\nJangan menjanjikan diskon di luar knowledge base"}
        />
      </Field>
      <div className="flex justify-end">
        <Button
          onClick={() =>
            patch({
              instructions: draft.instructions,
              tone: draft.tone,
              language: draft.language,
              engine: draft.engine,
              model: draft.model,
              temperature: draft.temperature,
              guardrails: draft.guardrails,
            })
          }
        >
          Simpan instruksi
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ knowledge */
function KnowledgeTab({ agent, toast }: { agent: Agent; toast: (m: string, t?: "success" | "error") => void }) {
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => api<KnowledgeDoc[]>(`/agents/${agent.id}/knowledge`).then(setDocs);
  useEffect(() => {
    load();
  }, [agent.id]);

  async function add() {
    if (!title.trim() || !content.trim()) return toast("Judul & isi wajib diisi", "error");
    await api(`/agents/${agent.id}/knowledge`, {
      method: "POST",
      body: JSON.stringify({ title, content, source: "text" }),
    });
    setTitle("");
    setContent("");
    load();
    toast("Dokumen ter-index");
  }

  async function upload(f: File) {
    const fd = new FormData();
    fd.append("file", f);
    const res = await fetch(`/api/v1/agents/${agent.id}/knowledge/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${localStorage.getItem("sapa_token")}` },
      body: fd,
    });
    if (!res.ok) return toast("Upload gagal", "error");
    load();
    toast("File ter-index");
  }

  async function remove(id: string) {
    await api(`/agents/${agent.id}/knowledge/${id}`, { method: "DELETE" });
    load();
    toast("Dokumen dihapus");
  }

  return (
    <div className="card fade-up space-y-4 p-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[15px] font-bold">Knowledge base</h3>
          <p className="text-[12px] text-ink-3">
            Dokumen di-chunk & di-index otomatis untuk retrieval (BM25). Sumber jawaban agent.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
          <Upload size={14} /> Upload .txt/.md
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".txt,.md,.csv,.html"
          hidden
          onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
        />
      </div>

      <div className="space-y-2">
        {docs.map((d) => (
          <div key={d.id} className="flex items-center gap-3 rounded-xl border border-line bg-white/70 px-4 py-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-soft text-primary-600">
              <BookOpen size={15} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13.5px] font-bold">{d.title}</div>
              <div className="text-[11.5px] text-ink-3">
                {d.chunk_count} chunk · {d.content.length} karakter · {timeAgo(d.updated_at)}
              </div>
            </div>
            <Badge tone="violet">{d.source}</Badge>
            <button onClick={() => remove(d.id)} className="rounded-lg p-2 text-ink-3 hover:bg-danger-soft hover:text-danger">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        {docs.length === 0 && (
          <p className="rounded-xl border border-dashed border-line py-8 text-center text-[13px] text-ink-3">
            Belum ada dokumen. Tambahkan FAQ/kebijakan agar agent bisa menjawab faktual.
          </p>
        )}
      </div>

      <div className="space-y-3 rounded-2xl bg-primary-soft/50 p-4">
        <Field label="Judul dokumen">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Contoh: Kebijakan garansi" />
        </Field>
        <Field label="Isi">
          <Textarea rows={5} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Tempel kebijakan/FAQ di sini…" />
        </Field>
        <div className="flex justify-end">
          <Button onClick={add}>Tambah & index</Button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- perilaku */
function BehaviourTab({ agent, patch }: { agent: Agent; patch: (p: any, m?: string) => Promise<Agent> }) {
  const [draft, setDraft] = useState(agent);
  useEffect(() => setDraft(agent), [agent]);
  const set = (k: keyof Agent, v: any) => setDraft((d) => ({ ...d, [k]: v }));
  const starters = [...draft.starter_prompts, "", "", ""].slice(0, 3);

  return (
    <div className="card fade-up space-y-4 p-5">
      <Field label="Pesan sambutan (widget)">
        <Textarea rows={2} value={draft.greeting} onChange={(e) => set("greeting", e.target.value)} />
      </Field>
      <Field label="Starter prompts" hint="muncul sebagai chip di widget">
        <div className="space-y-2">
          {starters.map((s, i) => (
            <Input
              key={i}
              value={s}
              placeholder={`Saran pertanyaan ${i + 1}`}
              onChange={(e) => {
                const next = [...starters];
                next[i] = e.target.value;
                set("starter_prompts", next.filter((x) => x.trim()));
              }}
            />
          ))}
        </div>
      </Field>
      <Field label="Fallback / out-of-scope">
        <Textarea rows={2} value={draft.fallback_message} onChange={(e) => set("fallback_message", e.target.value)} />
      </Field>
      <div className="rounded-2xl border border-line bg-white/70 p-4">
        <Toggle checked={draft.handoff_enabled} onChange={(v) => set("handoff_enabled", v)} label="Handoff ke manusia" />
        {draft.handoff_enabled && (
          <Textarea
            rows={2}
            className="mt-3"
            value={draft.handoff_message}
            onChange={(e) => set("handoff_message", e.target.value)}
          />
        )}
      </div>
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[13px] font-semibold">Rules (jika → maka)</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => set("rules", [...draft.rules, { trigger: "", response: "" }])}
          >
            + Tambah rule
          </Button>
        </div>
        <div className="space-y-2">
          {draft.rules.map((r, i) => (
            <div key={i} className="grid grid-cols-[1fr_1.4fr_auto] gap-2">
              <Input
                value={r.trigger}
                placeholder="Jika pesan mengandung…"
                onChange={(e) => {
                  const next = [...draft.rules];
                  next[i] = { ...r, trigger: e.target.value };
                  set("rules", next);
                }}
              />
              <Input
                value={r.response}
                placeholder="…jawab dengan"
                onChange={(e) => {
                  const next = [...draft.rules];
                  next[i] = { ...r, response: e.target.value };
                  set("rules", next);
                }}
              />
              <button
                onClick={() => set("rules", draft.rules.filter((_, j) => j !== i))}
                className="rounded-lg p-2 text-ink-3 hover:bg-danger-soft hover:text-danger"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {draft.rules.length === 0 && (
            <p className="rounded-xl border border-dashed border-line py-4 text-center text-[12.5px] text-ink-3">
              Rule diprioritaskan sebelum retrieval — cocok untuk promo, jam operasional, dsb.
            </p>
          )}
        </div>
      </div>
      <div className="flex justify-end">
        <Button
          onClick={() =>
            patch({
              greeting: draft.greeting,
              starter_prompts: draft.starter_prompts,
              fallback_message: draft.fallback_message,
              handoff_enabled: draft.handoff_enabled,
              handoff_message: draft.handoff_message,
              rules: draft.rules,
            })
          }
        >
          Simpan perilaku
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- tampilan */
function AppearanceTab({ agent, patch }: { agent: Agent; patch: (p: any, m?: string) => Promise<Agent> }) {
  const [theme, setTheme] = useState(agent.theme);
  useEffect(() => setTheme(agent.theme), [agent]);
  const set = (k: string, v: any) => setTheme((t) => ({ ...t, [k]: v }));

  return (
    <div className="card fade-up grid grid-cols-1 gap-5 p-5 lg:grid-cols-[1fr_260px]">
      <div className="space-y-4">
        <Field label="Warna primary">
          <div className="flex flex-wrap items-center gap-2">
            {SWATCHES.map((c) => (
              <button
                key={c}
                onClick={() => set("primary", c)}
                className={cx(
                  "h-8 w-8 rounded-xl border-2 transition",
                  theme.primary === c ? "border-ink scale-110" : "border-transparent"
                )}
                style={{ background: c }}
                aria-label={c}
              />
            ))}
            <input
              type="color"
              value={theme.primary || "#7C5CF6"}
              onChange={(e) => set("primary", e.target.value)}
              className="h-8 w-10 cursor-pointer rounded-lg border border-line bg-white"
            />
          </div>
        </Field>
        <Field label={`Radius panel: ${theme.radius ?? 20}px`}>
          <input
            type="range"
            min={8}
            max={28}
            value={theme.radius ?? 20}
            onChange={(e) => set("radius", Number(e.target.value))}
            className="w-full accent-[#7C5CF6]"
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Posisi widget">
            <Select value={theme.position || "right"} onChange={(e) => set("position", e.target.value)}>
              <option value="right">Kanan bawah</option>
              <option value="left">Kiri bawah</option>
            </Select>
          </Field>
          <Field label="Label tombol">
            <Input value={theme.launcher_label || "Chat"} onChange={(e) => set("launcher_label", e.target.value)} />
          </Field>
        </div>
        <div className="flex justify-end">
          <Button onClick={() => patch({ theme })}>Simpan tampilan</Button>
        </div>
      </div>
      <div className="rounded-2xl border border-line bg-[linear-gradient(160deg,#F3EEFC,#F7F1FB)] p-4">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-ink-3">Preview</p>
        <div
          className="overflow-hidden border border-line bg-white shadow-pop"
          style={{ borderRadius: theme.radius ?? 20 }}
        >
          <div className="flex items-center gap-2 p-3 text-white" style={{ background: `linear-gradient(120deg,#241448, ${theme.primary || "#7C5CF6"})` }}>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/20 text-[15px]">{agent.emoji}</span>
            <div>
              <div className="text-[12.5px] font-bold">{agent.name}</div>
              <div className="text-[10px] opacity-80">● Online</div>
            </div>
          </div>
          <div className="space-y-2 p-3">
            <div className="w-fit rounded-xl rounded-tl-sm border border-line bg-white px-3 py-1.5 text-[11px]">{agent.greeting.slice(0, 48)}…</div>
            <div className="ml-auto w-fit rounded-xl rounded-br-sm px-3 py-1.5 text-[11px] text-white" style={{ background: theme.primary }}>
              Halo!
            </div>
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <span
            className="rounded-full px-3.5 py-2 text-[11.5px] font-semibold text-white shadow-pop"
            style={{ background: "#171226" }}
          >
            ✦ {theme.launcher_label || "Chat"}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- integrasi */
function IntegrationTab({ agent, toast }: { agent: Agent; toast: (m: string, t?: "success" | "error") => void }) {
  const [origins, setOrigins] = useState(agent.allowed_origins.join("\n"));
  const origin = typeof window !== "undefined" ? window.location.origin : "https://app.andadomain.com";
  const snippet = `<script src="${origin}/embed/widget.js" data-sapa-key="${agent.public_key}" defer></script>`;
  const reactSnippet = `// React / Next.js — components/SupportChat.tsx
"use client";
import { useEffect } from "react";

export default function SupportChat() {
  useEffect(() => {
    const s = document.createElement("script");
    s.src = "${origin}/embed/widget.js";
    s.setAttribute("data-sapa-key", "${agent.public_key}");
    s.defer = true;
    document.body.appendChild(s);
    return () => s.remove();
  }, []);
  return null;
}`;

  async function rotate() {
    if (!confirm("Rotasi key? Snippet lama akan berhenti bekerja.")) return;
    await api(`/agents/${agent.id}/keys`, { method: "POST" });
    toast("Key baru dibuat — perbarui snippet Anda");
    setTimeout(() => location.reload(), 900);
  }

  async function saveOrigins() {
    await api(`/agents/${agent.id}`, {
      method: "PATCH",
      body: JSON.stringify({ allowed_origins: origins.split("\n").map((s) => s.trim()).filter(Boolean) }),
    });
    toast("Origin tersimpan");
  }

  return (
    <div className="card fade-up space-y-5 p-5">
      <div className="rounded-2xl bg-[#171226] p-4 text-[12.5px] leading-relaxed text-[#EDE9FE]">
        <div className="mb-2 flex items-center justify-between">
          <span className="font-semibold text-white/80">1 baris script — tempel sebelum &lt;/body&gt;</span>
          <CopyButton text={snippet} />
        </div>
        <pre className="scroll-thin overflow-x-auto whitespace-pre-wrap break-all font-mono text-[11.5px]">{snippet}</pre>
      </div>
      <div className="rounded-2xl border border-line bg-white/70 p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[13px] font-semibold">Opsional: komponen React/Next.js</span>
          <CopyButton text={reactSnippet} />
        </div>
        <pre className="scroll-thin max-h-[220px] overflow-auto whitespace-pre font-mono text-[11px] text-ink-2">{reactSnippet}</pre>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-line bg-white/70 p-4">
          <div className="text-[13px] font-semibold">Public widget key</div>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 truncate rounded-xl bg-primary-soft px-3 py-2 font-mono text-[11.5px] font-semibold text-primary-600">
              {agent.public_key}
            </code>
            <CopyButton text={agent.public_key || ""} label="Key" />
          </div>
          <Button variant="danger" size="sm" className="mt-3" onClick={rotate}>
            Rotasi key
          </Button>
        </div>
        <div className="rounded-2xl border border-line bg-white/70 p-4">
          <div className="text-[13px] font-semibold">Allowed origins</div>
          <p className="mt-1 text-[11.5px] text-ink-3">Kosongkan = semua domain boleh memakai widget ini.</p>
          <Textarea rows={3} className="mt-2 font-mono text-[11.5px]" value={origins} onChange={(e) => setOrigins(e.target.value)} placeholder={"https://tokoanda.com\nhttps://www.tokoanda.com"} />
          <Button variant="outline" size="sm" className="mt-2" onClick={saveOrigins}>
            Simpan origins
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-success-soft p-4 text-[12.5px] font-semibold text-success">
        ✅ Widget memanggil API lewat origin yang sama (proxy Next.js) — tanpa konfigurasi CORS tambahan.
        <a href={`/demo?key=${agent.public_key}`} className="underline underline-offset-2">
          Uji di halaman demo →
        </a>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- percakapan */
function ConversationsTab({ agent }: { agent: Agent }) {
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);

  const load = () => api<Conversation[]>(`/agents/${agent.id}/conversations`).then(setConvs);
  useEffect(() => {
    load();
  }, [agent.id]);

  async function toggle(id: string) {
    if (open === id) return setOpen(null);
    setOpen(id);
    setDetail(await api<ConversationDetail>(`/conversations/${id}`));
  }

  return (
    <div className="card fade-up divide-y divide-line/70 p-0">
      {convs.length === 0 && (
        <p className="p-8 text-center text-[13px] text-ink-3">Belum ada percakapan tercatat.</p>
      )}
      {convs.map((c) => (
        <div key={c.id}>
          <button onClick={() => toggle(c.id)} className="flex w-full items-center gap-3 px-5 py-3.5 text-left hover:bg-primary-soft/40">
            <div className="w-14 shrink-0 text-[12px] font-bold">{clockTime(c.last_message_at)}</div>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-bold">
                {c.visitor_name || (c.channel === "simulator" ? "Simulator" : "Pengunjung")}
                <span className="ml-2 font-medium text-ink-3">· {c.channel}</span>
              </div>
              <div className="truncate text-[12px] text-ink-2">{c.last_message}</div>
            </div>
            <Badge tone={c.status === "resolved" ? "success" : "violet"} dot>
              {c.status}
            </Badge>
          </button>
          {open === c.id && detail && (
            <div className="space-y-2 bg-[#FAF8FF] px-6 py-4">
              {detail.messages.map((m) => (
                <div key={m.id} className={cx("max-w-[80%] rounded-2xl px-3.5 py-2 text-[12.5px] leading-relaxed", m.role === "user" ? "ml-auto bg-primary text-white" : "border border-line bg-white")}>
                  <div className="whitespace-pre-wrap">{m.content}</div>
                  <div className={cx("mt-1 text-[10px]", m.role === "user" ? "text-white/70" : "text-ink-3")}>
                    {clockTime(m.created_at)}
                    {m.latency_ms ? ` · ${(m.latency_ms / 1000).toFixed(1)}s · ${m.engine}` : ""}
                    {m.sources?.length ? ` · 📚 ${m.sources.map((s) => s.title).join(", ")}` : ""}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
