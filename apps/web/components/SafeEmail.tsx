/**
 * Email yang aman di-render dari server component (tanpa "use client").
 *
 * MENGAPA KOMPONEN INI ADA — insiden "tombol Tanya mati" (React #418):
 * Cloudflare Email Address Obfuscation men-scan BYTE HTML response. Email
 * literal utuh ("halo@acmestore.id") di text node diubah menjadi
 * "[email protected]" + atribut `data-cfemail`, lalu disusun ulang oleh script
 * email-decode SETELAH hidrasi React dimulai. React menemukan text content
 * yang tidak cocok dengan hasil render client → error hidrasi #418 → seluruh
 * client component di halaman itu (AskButton, ChatbotEmbed) tidak menempel
 * handler-nya → semua tombol "Tanya" mati meski JavaScript jalan.
 *
 * Solusinya bukan mematikan fitur Cloudflare, tapi memastikan byte HTML tidak
 * pernah memuat pola email yang utuh: bagian lokal, "@", dan domain dipecah ke
 * elemen <span> terpisah. Regex obfuscator tidak bisa mencocokkan pola yang
 * terpotong tag, sementara tampilan, copy-paste, dan pembacaan screen reader
 * tetap identik (elemen inline, tanpa spasi). Render server dan client
 * menghasilkan markup yang sama persis → hidrasi selamat.
 *
 * Dipakai di: apps/web/app/landing/page.tsx (FAQ + footer),
 *             apps/web/app/login/page.tsx (hint kredensial seed).
 * Dijaga oleh: scripts/test-web.mjs kelompok 1–4 dan scripts/verify-deploy.mjs
 * bagian 7 (SSR hygiene) — jangan menulis email literal di komponen lain.
 */
export default function SafeEmail({
  local,
  domain,
  className,
  style,
}: {
  local: string;
  domain: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span data-sapa-email="" className={className} style={style}>
      <span>{local}</span>
      <span>@</span>
      <span>{domain}</span>
    </span>
  );
}
