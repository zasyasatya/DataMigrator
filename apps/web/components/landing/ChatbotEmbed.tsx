"use client";

import { MessageCircle, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

/**
 * Memuat chatbot Sapa AI ke halaman (satu-satunya bagian yang butuh JavaScript).
 *
 * Dibuat sebagai komponen client terpisah supaya isi landing page tetap
 * di-render di server (SEO + first paint cepat): `useSearchParams()` di dalam
 * Suspense membuat seluruh halaman bailout ke client-side rendering bila
 * dipasang di page utama.
 *
 * Sumber key (urutan prioritas):
 *   1. query `?key=pk_…` (atau `?k=pk_…`)
 *   2. `localStorage["sapa_landing_key"]`
 *
 * Komponen ini juga memasang bridge global `window.SapaAsk(text)` yang dipakai
 * tombol-tombol "Tanya" di seluruh halaman.
 */

declare global {
  interface Window {
    SapaChat?: {
      open: () => void;
      close: () => void;
      send: (t: string) => void;
      identify: (n?: string, e?: string) => void;
      on: (evt: string, cb: (p?: unknown) => void) => () => void;
    };
    SapaAsk?: (text: string) => void;
  }
}

function Embed({ onStateChange }: { onStateChange?: (hasKey: boolean) => void }) {
  const params = useSearchParams();
  const [pubKey, setPubKey] = useState("");

  useEffect(() => {
    const fromQuery = params.get("key") || params.get("k") || "";
    const stored = window.localStorage.getItem("sapa_landing_key") || "";
    const key = fromQuery || stored;
    if (key) window.localStorage.setItem("sapa_landing_key", key);
    setPubKey(key);
    onStateChange?.(!!key);
  }, [params, onStateChange]);

  useEffect(() => {
    if (!pubKey) return;
    const s = document.createElement("script");
    // ⬇⬇ SATU-SATUNYA BARIS INTEGRASI YANG DIBUTUHKAN ⬇⬇
    s.src = `/embed/widget.js?k=${encodeURIComponent(pubKey)}`;
    s.defer = true;
    document.body.appendChild(s);

    // Bridge agar tombol statis di halaman bisa membuka chat & mengirim pesan.
    window.SapaAsk = (text: string) => {
      if (window.SapaChat) {
        window.SapaChat.open();
        window.SapaChat.send(text);
      }
    };

    return () => {
      s.remove();
      document.getElementById("sapa-chat")?.remove();
      delete window.SapaChat;
      delete window.SapaAsk;
    };
  }, [pubKey]);

  return null;
}

function Hint({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed bottom-5 left-1/2 z-50 w-[min(560px,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border border-[#EADFCF] bg-white/95 p-4 shadow-[0_18px_50px_-18px_rgba(59,38,20,.45)] backdrop-blur">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#F3EBDD] text-[#7A5A2E]">
          <MessageCircle size={16} />
        </span>
        <div className="min-w-0 flex-1 text-[13px] leading-relaxed text-[#4A3B2A]">
          <b className="text-[#2A2016]">Chatbot belum aktif.</b> Halaman ini butuh public key agent.
          Ambil di dashboard → <b>Builder → tab Integrasi</b>, lalu buka{" "}
          <code className="rounded bg-[#F6F1E8] px-1.5 py-0.5 text-[12px] font-semibold">
            /landing?key=pk_…
          </code>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <a
              href="/agents"
              className="rounded-lg bg-[#2A2016] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[#3D2F20]"
            >
              Buka dashboard
            </a>
            <a
              href="/demo"
              className="rounded-lg border border-[#E3D8C6] px-3 py-1.5 text-[12px] font-semibold text-[#4A3B2A] hover:bg-[#FAF6EF]"
            >
              Halaman demo
            </a>
          </div>
        </div>
        <button onClick={onClose} className="shrink-0 rounded-lg p-1 text-[#9A8B77] hover:bg-[#F6F1E8]">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

export default function ChatbotEmbed() {
  const [hasKey, setHasKey] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  return (
    <>
      <Suspense fallback={null}>
        <Embed onStateChange={setHasKey} />
      </Suspense>
      {!hasKey && !dismissed && <Hint onClose={() => setDismissed(true)} />}
    </>
  );
}
