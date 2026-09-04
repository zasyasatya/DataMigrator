"use client";

import { MessageCircle } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Tombol "Tanya" yang membuka chatbot dan langsung mengirim pesan.
 *
 * Dipakai di dalam landing page yang di-render server; hanya komponen kecil ini
 * yang client-side supaya HTML statis tetap lengkap untuk SEO.
 * Bila widget belum dimuat (key belum diisi), tombol mengarahkan ke halaman
 * Integrasi dashboard agar pengguna tahu langkah berikutnya.
 */
export default function AskButton({
  message,
  variant = "solid",
  icon = true,
  className = "",
  children,
}: {
  message: string;
  variant?: "solid" | "ghost" | "soft" | "link";
  icon?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  const base = {
    solid:
      "inline-flex items-center gap-2 rounded-full bg-[#2A2016] px-5 py-2.5 text-[13px] font-bold text-white hover:bg-[#3D2F20]",
    ghost:
      "inline-flex items-center gap-2 rounded-full border border-[#DCCFBB] bg-white px-5 py-2.5 text-[13px] font-bold text-[#3D3122] hover:border-[#C0AC8D]",
    soft: "inline-flex items-center gap-2 rounded-full bg-[#F3EBDD] px-3.5 py-1.5 text-[12px] font-bold text-[#6B4E22] hover:bg-[#EADFC9]",
    link: "inline-flex items-center gap-1.5 text-[12.5px] font-bold text-[#8B5E2B] hover:underline",
  }[variant];

  const ask = () => {
    if (typeof window !== "undefined" && window.SapaAsk) window.SapaAsk(message);
    else window.location.href = "/agents";
  };

  return (
    <button type="button" onClick={ask} className={`${base} ${className}`.trim()}>
      {icon && <MessageCircle size={variant === "link" ? 13 : 15} />}
      {children ?? "Tanya asisten"}
    </button>
  );
}
