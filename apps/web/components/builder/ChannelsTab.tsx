"use client";

import { Instagram, MessageCircle, Send, Webhook } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Agent } from "@/lib/types";
import { Badge, Button, CopyButton, cx, Field, Input, Textarea, Toggle } from "@/components/ui";

type ChannelKey = "whatsapp" | "instagram";

const DEFAULTS: Record<ChannelKey, any> = {
  whatsapp: { enabled: false, phone_number_id: "", access_token: "", verify_token: "" },
  instagram: { enabled: false, page_id: "", access_token: "", verify_token: "" },
};

export default function ChannelsTab({
  agent,
  toast,
}: {
  agent: Agent;
  toast: (m: string, t?: "success" | "error") => void;
}) {
  const [channels, setChannels] = useState<Record<string, any>>(agent.channels || {});
  const [info, setInfo] = useState<{ whatsapp_callback_url: string; verify_token_suggestion: string } | null>(null);
  const [testMsg, setTestMsg] = useState("Halo, saya mau tanya soal produk");
  const [testOut, setTestOut] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => setChannels(agent.channels || {}), [agent]);
  useEffect(() => {
    api(`/agents/${agent.id}/channels/webhook-info`).then(setInfo).catch(() => {});
  }, [agent.id]);

  const cfg = (k: ChannelKey) => ({ ...DEFAULTS[k], ...(channels[k] || {}) });
  const setCfg = (k: ChannelKey, patch: any) =>
    setChannels((c) => ({ ...c, [k]: { ...DEFAULTS[k], ...(c[k] || {}), ...patch } }));

  async function save() {
    await api(`/agents/${agent.id}`, { method: "PATCH", body: JSON.stringify({ channels }) });
    toast("Konfigurasi channel tersimpan");
  }

  async function runTest(channel: ChannelKey) {
    setBusy(true);
    setTestOut(null);
    try {
      const res = await api<{ reply: string; engine: string; latency_ms: number }>(
        `/agents/${agent.id}/channels/${channel}/test`,
        { method: "POST", body: JSON.stringify({ message: testMsg }) }
      );
      setTestOut(`${res.reply}\n\n— engine: ${res.engine} · ${(res.latency_ms / 1000).toFixed(1)}s`);
    } catch (e: any) {
      setTestOut(`⚠️ ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="card fade-up p-5">
        <div className="flex items-center gap-2 text-[13px] font-semibold text-ink-2">
          <Webhook size={15} /> Callback URL (daftarkan di Meta App → Webhook)
        </div>
        {info && (
          <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
            <div className="flex items-center gap-2 rounded-xl bg-[#171226] px-3 py-2 font-mono text-[10.5px] text-[#EDE9FE]">
              <span className="truncate">{info.whatsapp_callback_url}</span>
              <CopyButton text={info.whatsapp_callback_url} label="" />
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-[#171226] px-3 py-2 font-mono text-[10.5px] text-[#EDE9FE]">
              <span className="truncate">verify token: {info.verify_token_suggestion}</span>
              <CopyButton text={info.verify_token_suggestion} label="" />
            </div>
          </div>
        )}
        <p className="mt-2 text-[11.5px] leading-relaxed text-ink-3">
          Tanpa access token, channel berjalan dalam <b>mode dry-run</b>: pesan masuk tetap diproses
          & balasan tersimpan (dikembalikan di response webhook) sehingga alur bisa diuji end-to-end.
        </p>
      </div>

      {(["whatsapp", "instagram"] as ChannelKey[]).map((k) => {
        const c = cfg(k);
        const Icon = k === "whatsapp" ? MessageCircle : Instagram;
        return (
          <div key={k} className="card fade-up space-y-4 p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span
                  className={cx(
                    "flex h-10 w-10 items-center justify-center rounded-xl text-white",
                    k === "whatsapp" ? "bg-[#25D366]" : "bg-gradient-to-br from-[#F585A5] via-[#C13584] to-[#7C5CF6]"
                  )}
                >
                  <Icon size={18} />
                </span>
                <div>
                  <div className="flex items-center gap-2 text-[14.5px] font-bold capitalize">
                    {k === "whatsapp" ? "WhatsApp (Cloud API)" : "Instagram Direct"}
                    {c.enabled && <Badge tone="success" dot>aktif</Badge>}
                  </div>
                  <p className="text-[11.5px] text-ink-3">
                    {k === "whatsapp"
                      ? "Meta WhatsApp Business Cloud API — incoming webhook + kirim balasan"
                      : "Meta Instagram Messaging — webhook messaging + /me/messages"}
                  </p>
                </div>
              </div>
              <Toggle checked={!!c.enabled} onChange={(v) => setCfg(k, { enabled: v })} />
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label={k === "whatsapp" ? "Phone Number ID" : "Page / IG User ID"}>
                <Input
                  value={k === "whatsapp" ? c.phone_number_id : c.page_id}
                  onChange={(e) =>
                    setCfg(k, k === "whatsapp" ? { phone_number_id: e.target.value } : { page_id: e.target.value })
                  }
                  placeholder={k === "whatsapp" ? "104xxxxxxxxx" : "1784xxxxxxxxx"}
                />
              </Field>
              <Field label="Verify token" hint="untuk handshake Meta">
                <Input value={c.verify_token} onChange={(e) => setCfg(k, { verify_token: e.target.value })} placeholder="token-acak" />
              </Field>
            </div>
            <Field label="Access token (Graph API)" hint="kosongkan = dry-run">
              <Input
                type="password"
                value={c.access_token}
                onChange={(e) => setCfg(k, { access_token: e.target.value })}
                placeholder="EAAG…"
                autoComplete="new-password"
              />
            </Field>
          </div>
        );
      })}

      <div className="card fade-up space-y-3 p-5">
        <div className="text-[14px] font-bold">Uji pesan masuk (dry-run)</div>
        <Textarea rows={2} value={testMsg} onChange={(e) => setTestMsg(e.target.value)} />
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={busy} onClick={() => runTest("whatsapp")}>
            <Send size={13} /> Simulasikan WhatsApp
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => runTest("instagram")}>
            <Send size={13} /> Simulasikan Instagram
          </Button>
          <Button size="sm" variant="ghost" onClick={save}>
            Simpan konfigurasi
          </Button>
        </div>
        {testOut && (
          <pre className="fade-up whitespace-pre-wrap rounded-xl bg-primary-soft/60 p-3 text-[12.5px] leading-relaxed text-ink">
            {testOut}
          </pre>
        )}
      </div>
    </div>
  );
}
