"use client";

import { Cpu, KeyRound, Plus, Trash2, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { TopBar } from "@/components/shell/Shell";
import { api, timeAgo } from "@/lib/api";
import type { ApiKeyRow, LLMSettings } from "@/lib/types";
import { Badge, Button, Card, CopyButton, Field, Input, useToast, Toast } from "@/components/ui";

export default function SettingsPage() {
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [llm, setLlm] = useState<LLMSettings | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("https://api.openai.com/v1");
  const [model, setModel] = useState("gpt-4o-mini");
  const [testRes, setTestRes] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [label, setLabel] = useState("Server key");
  const [created, setCreated] = useState<string | null>(null);
  const { toast, show } = useToast();

  const load = () => api<ApiKeyRow[]>("/keys").then(setKeys);
  useEffect(() => {
    load();
    api<LLMSettings>("/settings/llm").then((s) => {
      setLlm(s);
      setBaseUrl(s.base_url);
      setModel(s.model);
    });
  }, []);

  async function saveLlm() {
    const next = await api<LLMSettings>("/settings/llm", {
      method: "PUT",
      body: JSON.stringify({ api_key: apiKey || null, base_url: baseUrl, model }),
    });
    setLlm(next);
    setApiKey("");
    show("Provider tersimpan");
  }

  async function testLlm() {
    setTesting(true);
    setTestRes(null);
    const r = await api<{ ok: boolean; latency_ms?: number; model?: string; reply?: string; error?: string }>("/settings/llm/test", {
      method: "POST",
    });
    setTestRes(
      r.ok
        ? `✅ Terhubung! model=${r.model ?? "-"} · ${r.latency_ms}ms · reply: "${r.reply}"`
        : `⚠️ ${r.error}`
    );
    setTesting(false);
  }

  async function create(kind: "public" | "secret") {
    const res = await api<ApiKeyRow & { secret?: string }>("/keys", {
      method: "POST",
      body: JSON.stringify({ label, kind }),
    });
    setCreated(res.secret || res.public_key || null);
    load();
    show("Key dibuat");
  }

  async function revoke(id: string) {
    await api(`/keys/${id}`, { method: "DELETE" });
    load();
    show("Key dicabut");
  }

  return (
    <>
      <TopBar
        title="Integrasi & API Keys"
        subtitle="Secret key untuk server-to-server (Bearer sk_…), public key otomatis per agent untuk widget."
      />
      <Card className="mb-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#0EA5E9] to-primary text-white">
              <Cpu size={18} />
            </span>
            <div>
              <h3 className="text-[15px] font-bold">Provider LLM (OpenAI-compatible)</h3>
              <p className="text-[12px] text-ink-3">
                Status:{" "}
                {llm ? (
                  llm.has_key ? (
                    <b className="text-success">terhubung via {llm.source} {llm.key_masked}</b>
                  ) : (
                    <b className="text-warning">offline engine (key belum diset)</b>
                  )
                ) : ("…")}
                {" · "}agent dengan engine “auto/openai” akan memakai provider ini.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={testLlm} disabled={testing}>
              <Zap size={14} /> {testing ? "Menguji…" : "Tes koneksi"}
            </Button>
            <Button size="sm" onClick={saveLlm}>
              Simpan
            </Button>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field label="API key" hint="kosongkan = pakai env / offline">
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={llm?.key_masked ? `tersimpan ${llm.key_masked}` : "sk-…"}
              autoComplete="new-password"
            />
          </Field>
          <Field label="Base URL" hint="OpenAI / Groq / OpenRouter / Ollama">
            <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.openai.com/v1" />
          </Field>
          <Field label="Model default">
            <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="gpt-4o-mini" />
          </Field>
        </div>
        {testRes && (
          <p className="fade-up mt-3 rounded-xl bg-primary-soft/60 px-3 py-2 text-[12.5px] font-semibold text-ink">{testRes}</p>
        )}
      </Card>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_380px]">
        <Card className="p-5">
          <h3 className="text-[15px] font-bold">Keys workspace</h3>
          <div className="mt-4 space-y-2">
            {keys.map((k) => (
              <div key={k.id} className="flex items-center gap-3 rounded-xl border border-line bg-white/70 px-4 py-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-soft text-primary-600">
                  <KeyRound size={15} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[13px] font-bold">
                    {k.label}
                    <Badge tone={k.kind === "secret" ? "warning" : "violet"}>{k.kind}</Badge>
                    {k.revoked && <Badge tone="danger">revoked</Badge>}
                  </div>
                  <div className="truncate font-mono text-[11.5px] text-ink-3">
                    {k.public_key || `${k.prefix}••••••••••••••••`} · {timeAgo(k.created_at)}
                  </div>
                </div>
                {k.public_key && <CopyButton text={k.public_key} />}
                {!k.revoked && (
                  <button onClick={() => revoke(k.id)} className="rounded-lg p-2 text-ink-3 hover:bg-danger-soft hover:text-danger">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </Card>
        <Card className="h-fit space-y-4 p-5">
          <h3 className="text-[15px] font-bold">Buat key</h3>
          <Field label="Label">
            <Input value={label} onChange={(e) => setLabel(e.target.value)} />
          </Field>
          <div className="flex gap-2">
            <Button onClick={() => create("secret")} className="flex-1">
              <Plus size={15} /> Secret
            </Button>
            <Button variant="outline" onClick={() => create("public")} className="flex-1">
              <Plus size={15} /> Public
            </Button>
          </div>
          {created && (
            <div className="rounded-xl bg-success-soft p-3">
              <p className="text-[11.5px] font-semibold text-success">Simpan sekarang — hanya ditampilkan sekali:</p>
              <code className="mt-1 block break-all font-mono text-[11px] text-ink">{created}</code>
              <div className="mt-2">
                <CopyButton text={created} />
              </div>
            </div>
          )}
          <div className="rounded-xl border border-line bg-white/70 p-3 text-[11.5px] leading-relaxed text-ink-2">
            Contoh pemanggilan server-to-server:
            <pre className="mt-2 overflow-x-auto rounded-lg bg-[#171226] p-2 font-mono text-[10.5px] text-[#EDE9FE]">
{`curl -X POST $\{API\}/w/<pk>/chat \\
  -H "Content-Type: application/json" \\
  -d '{"message":"halo"}'`}
            </pre>
          </div>
        </Card>
      </div>
      {toast && <Toast msg={toast.msg} tone={toast.tone} />}
    </>
  );
}
