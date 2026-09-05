import {
  ArrowRight,
  BadgeCheck,
  Coffee,
  Leaf,
  ShieldCheck,
  Sparkles,
  Star,
  Truck,
} from "lucide-react";
import type { Metadata } from "next";
import AskButton from "@/components/landing/AskButton";
import ChatbotEmbed from "@/components/landing/ChatbotEmbed";

/**
 * Contoh LANDING PAGE dengan chatbot Sapa AI terintegrasi.
 *
 * Halaman ini berperan sebagai "website pelanggan" biasa — bukan bagian
 * dashboard. Seluruh integrasi chatbot-nya hanyalah komponen <ChatbotEmbed/>
 * yang menyuntikkan satu baris:
 *
 *   <script src="/embed/widget.js" data-sapa-key="pk_…"></script>
 *
 * Isi halaman sengaja di-render sebagai SERVER COMPONENT (tanpa "use client")
 * supaya HTML-nya lengkap untuk SEO/first-paint; hanya ChatbotEmbed & AskButton
 * yang client-side. FAQ memakai <details> bawaan HTML agar tetap berfungsi
 * tanpa JavaScript.
 *
 * Coba:  /landing?key=pk_XXXX     (key dari Builder → tab Integrasi)
 * Versi tanpa build untuk situs eksternal: examples/landing/index.html
 */

export const metadata: Metadata = {
  title: "Acme Store — Kopi Specialty Indonesia, Disangrai Minggu Ini",
  description:
    "Contoh landing page dengan chatbot Sapa AI terintegrasi satu baris script. Kirim hari yang sama, garansi rasa 7 hari.",
};

const PRODUCTS = [
  { emoji: "☕", name: "Kopi Gayo Wine 200g", price: "Rp95.000", tag: "Best seller", note: "Fruity, winey, body tebal" },
  { emoji: "🫘", name: "Toraja Sapan 200g", price: "Rp88.000", tag: "Single origin", note: "Earthy, spicy, low acidity" },
  { emoji: "🧊", name: "House Blend Es Kopi 250g", price: "Rp75.000", tag: "Es kopi", note: "Diformulasi untuk susu & es" },
  { emoji: "🫖", name: "Dripper V60 Keramik", price: "Rp65.000", tag: "Alat seduh", note: "Ukuran 02, termasuk filter" },
];

const FEATURES = [
  { icon: Truck, title: "Kirim hari yang sama", body: "Bayar sebelum 15.00 WIB, paket dijemput kurir hari itu juga. Jabodetabek sampai 1-2 hari kerja." },
  { icon: Leaf, title: "Roasting mingguan", body: "Biji disangrai tiap Senin & Kamis, jadi kopi yang Anda terima tidak pernah lebih dari 7 hari pasca-roast." },
  { icon: ShieldCheck, title: "Garansi rasa 7 hari", body: "Tidak cocok? Kembalikan dalam 7 hari selama segel utuh — refund diproses maksimal 3 hari kerja." },
  { icon: BadgeCheck, title: "Traceable ke petani", body: "Setiap batch mencantumkan nama petani, ketinggian tanam, dan proses pasca-panennya." },
];

const TESTIMONIALS = [
  { name: "Rina Ardianti", role: "Home barista, Jakarta", text: "Pengiriman ke Jakarta cuma sehari. Gayo Wine-nya luar biasa, aroma wine-nya jelas tanpa terasa fermentasi berlebihan." },
  { name: "Budi Santoso", role: "Pemilik kafe, Bandung", text: "Saya order 5kg per minggu untuk kafe. Konsisten, dan CS-nya cepat banget menjawab pertanyaan soal profil roast." },
  { name: "Maya Prasetya", role: "Pelanggan baru, Surabaya", text: "Sempat salah pilih grinder, tapi retur diproses tanpa drama. Jarang ada toko kopi yang serapi ini layanannya." },
];

const FAQ = [
  { q: "Berapa lama pengiriman ke luar Jawa?", a: "3-6 hari kerja. Ongkir flat Rp20.000, dan gratis untuk pembelian di atas Rp250.000." },
  { q: "Bisa bayar di tempat?", a: "Belum. Metode pembayaran yang tersedia: transfer BCA/Mandiri, QRIS, kartu kredit, dan cicilan 0% untuk order di atas Rp500.000." },
  { q: "Apakah dikirim dalam bentuk biji atau bubuk?", a: "Default biji utuh. Kalau mau digiling, sebutkan metode seduh Anda di catatan pesanan — kami giling sesaat sebelum dikirim." },
  { q: "Bagaimana cara mengajukan pengembalian?", a: "Kirim foto produk dan nomor pesanan ke halo@acmestore.id atau lewat chat ini dalam 7 hari sejak paket diterima. Refund diproses maksimal 3 hari kerja." },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#FBF7F0] text-[#2A2016]">
      {/* chatbot: satu-satunya bagian yang butuh JS */}
      <ChatbotEmbed />

      {/* header ---------------------------------------------------------- */}
      <header className="sticky top-0 z-30 border-b border-[#EFE5D6] bg-[#FBF7F0]/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-8 px-6 py-4">
          <span className="flex items-center gap-2 text-[17px] font-black tracking-tight">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#2A2016] text-white">
              <Coffee size={16} />
            </span>
            ACME STORE
          </span>
          <nav className="hidden gap-6 text-[13.5px] font-semibold text-[#6B5B47] md:flex">
            <a href="#produk" className="hover:text-[#2A2016]">Produk</a>
            <a href="#kenapa" className="hover:text-[#2A2016]">Kenapa kami</a>
            <a href="#ulasan" className="hover:text-[#2A2016]">Ulasan</a>
            <a href="#faq" className="hover:text-[#2A2016]">FAQ</a>
          </nav>
          <div className="ml-auto flex items-center gap-2.5">
            <AskButton
              message="Halo, saya mau tanya soal produk kopi kalian"
              variant="ghost"
              className="hidden sm:inline-flex"
            >
              Tanya CS
            </AskButton>
            <a
              href="#produk"
              className="flex items-center gap-1.5 rounded-full bg-[#2A2016] px-4 py-2 text-[12.5px] font-semibold text-white hover:bg-[#3D2F20]"
            >
              Belanja <ArrowRight size={14} />
            </a>
          </div>
        </div>
      </header>

      {/* hero ------------------------------------------------------------ */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(46rem 26rem at 82% -8%, rgba(214,178,124,.35), transparent 62%), radial-gradient(38rem 24rem at 4% 8%, rgba(176,133,86,.20), transparent 60%)",
          }}
        />
        <div className="relative mx-auto grid max-w-6xl gap-12 px-6 pb-16 pt-16 lg:grid-cols-[1.05fr_.95fr] lg:pt-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-[#E3D8C6] bg-white/70 px-3.5 py-1.5 text-[12px] font-semibold text-[#7A5A2E]">
              <Sparkles size={13} /> Roasting tiap Senin &amp; Kamis
            </span>
            <h1 className="mt-6 text-[42px] font-black leading-[1.06] tracking-tight sm:text-[56px]">
              Kopi specialty Indonesia,
              <span className="block bg-gradient-to-r from-[#8B5E2B] to-[#C08A3E] bg-clip-text text-transparent">
                disangrai minggu ini.
              </span>
            </h1>
            <p className="mt-6 max-w-[52ch] text-[16px] leading-relaxed text-[#5D4E3C]">
              Dari dataran tinggi Gayo, Toraja, dan Kintamani langsung ke dapur Anda. Kami kirim
              hari yang sama untuk pemesanan sebelum 15.00 WIB — dan kalau rasanya tidak cocok,
              kembalikan saja dalam 7 hari.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href="#produk"
                className="flex items-center gap-2 rounded-full bg-[#2A2016] px-6 py-3.5 text-[14px] font-bold text-white shadow-[0_14px_34px_-14px_rgba(42,32,22,.8)] hover:bg-[#3D2F20]"
              >
                Lihat semua produk <ArrowRight size={16} />
              </a>
              <AskButton message="Berapa lama pengiriman ke Jakarta?" variant="ghost" className="px-6 py-3.5 text-[14px]">
                Tanya soal pengiriman
              </AskButton>
            </div>
            <div className="mt-9 flex flex-wrap gap-x-8 gap-y-3 text-[13px] font-semibold text-[#6B5B47]">
              <span className="flex items-center gap-2"><Truck size={15} /> Gratis ongkir &gt; Rp250.000</span>
              <span className="flex items-center gap-2"><ShieldCheck size={15} /> Garansi rasa 7 hari</span>
              <span className="flex items-center gap-2"><Star size={15} /> 4,9/5 dari 2.318 ulasan</span>
            </div>
          </div>

          <div className="relative">
            <div className="rounded-[32px] border border-[#EFE5D6] bg-white p-7 shadow-[0_34px_80px_-38px_rgba(59,38,20,.55)]">
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-[#F3EBDD] px-3 py-1 text-[11.5px] font-bold uppercase tracking-wide text-[#7A5A2E]">
                  Best seller
                </span>
                <span className="flex items-center gap-1 text-[12.5px] font-semibold text-[#6B5B47]">
                  <Star size={13} className="fill-[#E0A93B] text-[#E0A93B]" /> 4,9
                </span>
              </div>
              <div className="mt-6 flex items-center justify-center rounded-3xl bg-gradient-to-br from-[#F6EFE3] to-[#EBDFCB] py-14 text-[76px]">
                ☕
              </div>
              <h2 className="mt-6 text-[21px] font-black tracking-tight">Kopi Gayo Wine 200g</h2>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-[#6B5B47]">
                Proses natural anaerobik 72 jam. Catatan rasa: red wine, blackberry, dark chocolate.
              </p>
              <div className="mt-6 flex items-end justify-between gap-3">
                <span className="text-[26px] font-black tracking-tight">Rp95.000</span>
                <AskButton message="Saya mau pesan Kopi Gayo Wine 200g, bagaimana caranya?">
                  Tanya &amp; pesan
                </AskButton>
              </div>
            </div>
            <div className="absolute -bottom-5 -left-5 hidden rounded-2xl border border-[#EFE5D6] bg-white px-4 py-3 shadow-[0_18px_44px_-22px_rgba(59,38,20,.6)] sm:block">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#E7F3EC] text-[#1F7A45]">
                  <Truck size={16} />
                </span>
                <div className="text-[12.5px] leading-tight">
                  <b>Dikirim hari ini</b>
                  <div className="text-[#6B5B47]">order sebelum 15.00 WIB</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* produk ---------------------------------------------------------- */}
      <section id="produk" className="mx-auto max-w-6xl px-6 py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-[30px] font-black tracking-tight">Paling banyak dipesan</h2>
            <p className="mt-2 max-w-[62ch] text-[14.5px] text-[#6B5B47]">
              Bingung memilih? Tanya asisten kami di pojok kanan bawah — dia hafal seluruh katalog,
              ongkir, sampai kebijakan retur.
            </p>
          </div>
          <AskButton message="Apa saja metode pembayaran yang tersedia?" variant="ghost">
            Tanya metode pembayaran
          </AskButton>
        </div>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PRODUCTS.map((p) => (
            <div
              key={p.name}
              className="rounded-[26px] border border-[#EFE5D6] bg-white p-5 transition hover:-translate-y-1 hover:border-[#DCC9AC] hover:shadow-[0_26px_60px_-30px_rgba(59,38,20,.6)]"
            >
              <div className="flex items-center justify-center rounded-2xl bg-[#F8F2E8] py-10 text-[46px]">
                {p.emoji}
              </div>
              <span className="mt-4 inline-block rounded-full bg-[#F3EBDD] px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wide text-[#7A5A2E]">
                {p.tag}
              </span>
              <h3 className="mt-2.5 text-[15.5px] font-bold leading-snug">{p.name}</h3>
              <p className="mt-1 text-[12.5px] leading-relaxed text-[#7A6A56]">{p.note}</p>
              <div className="mt-4 flex items-center justify-between border-t border-[#F1E8DA] pt-4">
                <span className="text-[17px] font-black">{p.price}</span>
                <AskButton message={`Saya tertarik dengan ${p.name}. Bisa jelaskan detailnya?`} variant="soft">
                  Tanya
                </AskButton>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* kenapa ---------------------------------------------------------- */}
      <section id="kenapa" className="border-y border-[#EFE5D6] bg-[#F6EFE4]">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="text-[30px] font-black tracking-tight">Kenapa 12.000+ pelanggan tetap?</h2>
          <div className="mt-9 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-[24px] border border-[#EADFCF] bg-white p-6">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F3EBDD] text-[#7A5A2E]">
                  <f.icon size={19} />
                </span>
                <h3 className="mt-4 text-[15.5px] font-bold">{f.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-[#6B5B47]">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ulasan ---------------------------------------------------------- */}
      <section id="ulasan" className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-[30px] font-black tracking-tight">Kata mereka</h2>
        <div className="mt-9 grid gap-5 md:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <figure key={t.name} className="rounded-[26px] border border-[#EFE5D6] bg-white p-6">
              <div className="flex gap-0.5 text-[#E0A93B]">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} size={14} className="fill-[#E0A93B]" />
                ))}
              </div>
              <blockquote className="mt-4 text-[14px] leading-relaxed text-[#3D3122]">“{t.text}”</blockquote>
              <figcaption className="mt-5 border-t border-[#F1E8DA] pt-4">
                <div className="text-[13.5px] font-bold">{t.name}</div>
                <div className="text-[12px] text-[#7A6A56]">{t.role}</div>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* faq ------------------------------------------------------------- */}
      <section id="faq" className="mx-auto max-w-3xl px-6 pb-20">
        <h2 className="text-[30px] font-black tracking-tight">Pertanyaan yang sering masuk</h2>
        <p className="mt-2 text-[14.5px] text-[#6B5B47]">
          Tidak ketemu jawabannya? Asisten kami online 24 jam di pojok kanan bawah.
        </p>
        <div className="mt-8 space-y-3">
          {FAQ.map((item, i) => (
            <details
              key={item.q}
              open={i === 0}
              className="group rounded-[20px] border border-[#EFE5D6] bg-white px-5"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-[14.5px] font-bold [&::-webkit-details-marker]:hidden">
                {item.q}
                <ArrowRight
                  size={16}
                  className="shrink-0 text-[#9A8B77] transition group-open:rotate-90"
                />
              </summary>
              <div className="border-t border-[#F4ECE0] py-4">
                <p className="text-[13.5px] leading-relaxed text-[#5D4E3C]">{item.a}</p>
                <AskButton message={item.q} variant="link" className="mt-3">
                  Tanyakan langsung ke asisten
                </AskButton>
              </div>
            </details>
          ))}
        </div>
      </section>

      {/* cta ------------------------------------------------------------- */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="relative overflow-hidden rounded-[32px] bg-[#2A2016] px-8 py-14 text-center">
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: "radial-gradient(34rem 20rem at 50% -20%, rgba(214,178,124,.35), transparent 65%)" }}
          />
          <div className="relative">
            <h2 className="text-[30px] font-black tracking-tight text-white sm:text-[36px]">
              Siap menyeduh yang lebih baik?
            </h2>
            <p className="mx-auto mt-3 max-w-[54ch] text-[14.5px] leading-relaxed text-[#D8C9B4]">
              Pesan sebelum 15.00 WIB dan paket Anda dijemput kurir hari ini. Voucher{" "}
              <b className="text-white">AKUSENYANG</b> memberi diskon 10% untuk pesanan pertama.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <a
                href="#produk"
                className="rounded-full bg-white px-6 py-3.5 text-[14px] font-bold text-[#2A2016] hover:bg-[#F3EBDD]"
              >
                Mulai belanja
              </a>
              <AskButton message="Ada diskon apa bulan ini?" variant="ghost" className="border-[#5A4A36] bg-transparent px-6 py-3.5 text-[14px] text-white hover:bg-[#3A2E21]">
                Cek promo lewat chat
              </AskButton>
            </div>
          </div>
        </div>
      </section>

      {/* footer ---------------------------------------------------------- */}
      <footer className="border-t border-[#EFE5D6] bg-[#F6EFE4]">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 py-12 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <span className="flex items-center gap-2 text-[15px] font-black tracking-tight">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#2A2016] text-white">
                <Coffee size={14} />
              </span>
              ACME STORE
            </span>
            <p className="mt-3 text-[12.5px] leading-relaxed text-[#6B5B47]">
              Jl. Braga No. 12, Bandung 40111
              <br />(022) 555-0142 · halo@acmestore.id
            </p>
          </div>
          <div>
            <div className="text-[12px] font-bold uppercase tracking-wider text-[#8A7A64]">Jam layanan</div>
            <p className="mt-3 text-[12.5px] leading-relaxed text-[#6B5B47]">
              Senin-Sabtu 09.00-18.00 WIB
              <br />Chat AI aktif 24 jam
            </p>
          </div>
          <div>
            <div className="text-[12px] font-bold uppercase tracking-wider text-[#8A7A64]">Bantuan</div>
            <ul className="mt-3 space-y-2">
              <li><AskButton message="Bagaimana cara pengembalian barang?" variant="link" icon={false} className="text-[12.5px] font-semibold text-[#6B5B47] hover:text-[#2A2016] hover:no-underline">Retur &amp; refund</AskButton></li>
              <li><AskButton message="Bagaimana cara melacak paket saya?" variant="link" icon={false} className="text-[12.5px] font-semibold text-[#6B5B47] hover:text-[#2A2016] hover:no-underline">Lacak pesanan</AskButton></li>
              <li><AskButton message="Berapa ongkos kirim ke luar Jawa?" variant="link" icon={false} className="text-[12.5px] font-semibold text-[#6B5B47] hover:text-[#2A2016] hover:no-underline">Ongkos kirim</AskButton></li>
            </ul>
          </div>
          <div>
            <div className="text-[12px] font-bold uppercase tracking-wider text-[#8A7A64]">Ditenagai oleh</div>
            <p className="mt-3 text-[12.5px] leading-relaxed text-[#6B5B47]">
              Chatbot halaman ini dipasang dengan satu baris script <b className="text-[#2A2016]">Sapa AI</b>.
            </p>
          </div>
        </div>
        <div className="border-t border-[#EADFCF] px-6 py-5 text-center text-[11.5px] text-[#8A7A64]">
          Contoh landing page untuk demo integrasi widget Sapa AI.
        </div>
      </footer>
    </div>
  );
}
