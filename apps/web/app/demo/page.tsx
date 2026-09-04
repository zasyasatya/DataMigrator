"use client";

import { ChevronDown, ChevronUp, ShoppingBag, Star } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

const PRODUCTS = [
  { emoji: "☕", name: "Kopi Gayo Wine 200g", price: "Rp95.000", tag: "Best seller" },
  { emoji: "🫘", name: "Toraja Sapan 200g", price: "Rp88.000", tag: "Single origin" },
  { emoji: "🧊", name: "House Blend Es Kopi 250g", price: "Rp75.000", tag: "Es kopi" },
  { emoji: "🫖", name: "Dripper V60", price: "Rp65.000", tag: "Alat seduh" },
  { emoji: "🍯", name: "Gooseneck Kettle 1L", price: "Rp185.000", tag: "Alat seduh" },
  { emoji: "🎁", name: "Gift Set Brewer", price: "Rp260.000", tag: "Bundle" },
];

function DemoInner() {
  const params = useSearchParams();
  const [key, setKey] = useState("");
  const [input, setInput] = useState("");
  const [panelOpen, setPanelOpen] = useState(true);

  useEffect(() => {
    const initial = params.get("key") || localStorage.getItem("sapa_demo_key") || "";
    setKey(initial);
    setInput(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!key) return;
    localStorage.setItem("sapa_demo_key", key);
    const s = document.createElement("script");
    s.src = `/embed/widget.js?k=${encodeURIComponent(key)}`;
    s.defer = true;
    document.body.appendChild(s);
    return () => {
      s.remove();
      document.getElementById("sapa-chat")?.remove();
    };
  }, [key]);

  return (
    <div className="min-h-screen bg-[#FBF9F6] text-[#221B15]">
      {/* fake customer storefront ------------------------------------- */}
      <header className="sticky top-0 z-10 border-b border-[#EFE7DC] bg-[#FBF9F6]/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-4">
          <span className="text-[18px] font-black tracking-tight">ACME STORE</span>
          <nav className="hidden gap-5 text-[13px] font-semibold text-[#6B5F52] md:flex">
            <span>Kopi</span>
            <span>Alat Seduh</span>
            <span>Bundle</span>
            <span>Tentang</span>
          </nav>
          <span className="ml-auto flex items-center gap-2 rounded-full bg-[#221B15] px-4 py-2 text-[12.5px] font-semibold text-white">
            <ShoppingBag size={14} /> Keranjang (0)
          </span>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 pb-10 pt-14">
        <div className="max-w-xl">
          <span className="rounded-full bg-[#F3EADB] px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-[#8A6D3B]">
            Roastery Bandung
          </span>
          <h1 className="mt-4 text-[40px] font-black leading-[1.05] tracking-tight">
            Kopi spesialti, diseduh dengan cerita.
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-[#6B5F52]">
            Ini adalah contoh website pelanggan. Popup chat di kanan bawah dimuat oleh{" "}
            <b>satu baris script</b> widget Sapa AI — coba tanyakan pengiriman, pengembalian, atau promo.
          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl grid-cols-1 gap-4 px-6 pb-16 sm:grid-cols-2 lg:grid-cols-3">
        {PRODUCTS.map((p) => (
          <div key={p.name} className="rounded-3xl border border-[#EFE7DC] bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-lg">
            <div className="flex h-32 items-center justify-center rounded-2xl bg-[#F7F1E8] text-[44px]">{p.emoji}</div>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#8A6D3B]">{p.tag}</span>
              <span className="flex items-center gap-1 text-[11px] font-semibold text-[#6B5F52]">
                <Star size={11} className="fill-[#F79009] text-[#F79009]" /> 4.9
              </span>
            </div>
            <h3 className="mt-1 text-[15px] font-bold">{p.name}</h3>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-[14px] font-black">{p.price}</span>
              <button className="rounded-xl bg-[#221B15] px-3.5 py-2 text-[12px] font-semibold text-white">+ Keranjang</button>
            </div>
          </div>
        ))}
      </section>

      {/* widget key control ------------------------------------------- */}
      <div className="fixed left-3 top-3 z-20 w-[min(320px,calc(100vw-1.5rem))] rounded-2xl border border-[#E4D9FF] bg-white/95 p-4 shadow-xl backdrop-blur sm:left-4 sm:top-4">
        <button
          onClick={() => setPanelOpen((o) => !o)}
          className="absolute right-2 top-2 rounded-lg p-1.5 text-[#6B5F52] hover:bg-[#F3EADB]"
          aria-label="minimize"
        >
          {panelOpen ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
        </button>
        {panelOpen && (<>
        <p className="text-[12px] font-bold text-[#4B3B8F]">🔌 Demo integrasi widget</p>
        <p className="mt-1 text-[11px] leading-relaxed text-[#6B5F52]">
          Tempel public key agent (tab Integrasi di dashboard), lalu Enter. Widget popup akan muncul di kanan bawah.
        </p>
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setKey(input.trim());
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="pk_…"
            className="min-w-0 flex-1 rounded-xl border border-[#E4D9FF] bg-white px-3 py-2 font-mono text-[11px] outline-none focus:border-[#7C5CF6]"
          />
          <button className="rounded-xl bg-[#7C5CF6] px-3 py-2 text-[11.5px] font-bold text-white">Muat</button>
        </form>
        {!key && (
          <p className="mt-2 text-[10.5px] text-[#B42318]">Widget belum dimuat — key kosong.</p>
        )}
        </>)}
        {!panelOpen && (
          <p className="pr-6 text-[11px] font-semibold text-[#4B3B8F]">Widget {key ? "aktif ✓" : "nonaktif"}</p>
        )}
      </div>
    </div>
  );
}

export default function DemoPage() {
  return (
    <Suspense fallback={<div className="p-10 text-sm">Memuat demo…</div>}>
      <DemoInner />
    </Suspense>
  );
}
