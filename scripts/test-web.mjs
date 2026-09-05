#!/usr/bin/env node
/**
 * test-web — health check khusus web, jalan tanpa server (aman untuk CI/PR).
 *
 * Akar masalah yang dijaga script ini: email literal utuh di komponen yang
 * di-render server memicu Cloudflare Email Address Obfuscation. Teks email di
 * HTML diganti "[email protected]" + data-cfemail, lalu disusun ulang oleh
 * script email-decode SETELAH hidrasi React dimulai → text mismatch → React
 * error #418 → client components (AskButton, ChatbotEmbed) tidak menempel →
 * tombol-tombol landing page mati.
 *
 * 5 kelompok check:
 *   1. Lint hygiene: tidak boleh ada email literal di server component
 *      (file tanpa "use client") — pakai <SafeEmail/> sebagai gantinya.
 *   2. SafeEmail: komponen ASLI (di-transpile lalu di-render) menghasilkan
 *      markup terpecah tanpa pola email utuh.
 *   3. Landing & login page: semua titik email memakai SafeEmail.
 *   4. Simulasi obfuscator: HTML hasil render tidak bisa ditulis ulang oleh
 *      regex gaya Cloudflare (+ kontrol positif membuktikan detektornya hidup).
 *   5. Typecheck: tsc --noEmit untuk apps/web dan packages/widget.
 *
 * Pakai:  npm run test:web     (butuh `npm install` dulu)
 * Exit 0 = semua lulus. Bukti live di deployment: `npm run verify` bagian 7.
 */
import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const log = (...a) => console.log(...a);
let failures = 0;
const check = (name, ok, extra = "") => {
  log(`${ok ? "  [OK]  " : "  [FAIL]"} ${name}${extra ? " — " + extra : ""}`);
  if (!ok) failures++;
};

/** Pola email sekelas regex obfuscator Cloudflare (di jalankan pada byte HTML). */
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/;

/** Buang komentar block & baris-utama supaya lint menilai kode, bukan dokumen. */
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/** Daftar file .ts/.tsx rekursif (node_modules/.next dikecualikan). */
function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name === ".next" || e.name.startsWith(".")) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

const isServerComponent = (src) => !/^["']use client["']/.test(src.trimStart());

// --- 1. Lint hygiene: email literal dilarang di server component --------------
log("\n== 1. Hygiene: tidak ada email literal di server component ==");
const webDirs = ["app", "components", "lib"].map((d) => join(ROOT, "apps/web", d));
const offenders = [];
for (const file of webDirs.flatMap((d) => walk(d))) {
  const raw = readFileSync(file, "utf8");
  if (!isServerComponent(raw)) continue; // client component: atribut value/placeholder aman dari obfuscator
  const code = stripComments(raw);
  const m = code.match(new RegExp(EMAIL_RE.source, "g"));
  if (m) offenders.push(`${file.replace(ROOT + "/", "")}: ${m.join(", ")}`);
}
check("0 email literal di server component (pakai <SafeEmail/>)", offenders.length === 0, offenders.length ? offenders.join(" | ") : "bersih");

// --- 2. SafeEmail: render komponen asli, markup terpecah ----------------------
log("\n== 2. SafeEmail: markup terpecah, tanpa pola email utuh ==");
const TMP_DIR = join(ROOT, "node_modules", ".cache", "sapa-test-web");
rmSync(TMP_DIR, { recursive: true, force: true });
mkdirSync(TMP_DIR, { recursive: true });
const tmpFile = join(TMP_DIR, "safe-email.mjs");
try {
  const compSrc = readFileSync(join(ROOT, "apps/web/components/SafeEmail.tsx"), "utf8");
  const { outputText } = ts.transpileModule(compSrc, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  });
  writeFileSync(tmpFile, outputText);
  const { default: SafeEmail } = await import(pathToFileURL(tmpFile).href);

  const html = renderToStaticMarkup(
    React.createElement(SafeEmail, { local: "halo", domain: "acmestore.id" })
  );
  check("komponen ter-render tanpa pola email utuh di output", !EMAIL_RE.test(html), html);
  check("markup terpecah: local / @ / domain di elemen terpisah", html.includes(">halo<") && html.includes(">@<") && html.includes(">acmestore.id<"));
  check("penanda data-sapa-email ada (dipakai verify bagian 7)", html.includes("data-sapa-email"));

  // --- 3. Halaman: semua titik email memakai SafeEmail ------------------------
  log("\n== 3. Landing & login page memakai SafeEmail di semua titik email ==");
  const landing = readFileSync(join(ROOT, "apps/web/app/landing/page.tsx"), "utf8");
  const login = readFileSync(join(ROOT, "apps/web/app/login/page.tsx"), "utf8");
  const uses = (landing.match(/<SafeEmail\s/g) || []).length;
  check("landing: tidak ada email literal (di luar komentar)", !EMAIL_RE.test(stripComments(landing)));
  check("landing: FAQ & footer keduanya lewat SafeEmail", uses === 2 && /local="halo"\s+domain="acmestore\.id"/.test(landing), `${uses} pemakaian`);
  check("login: hint kredensial lewat SafeEmail (input value/placeholder aman, bukan text node)", /Default seed: <SafeEmail/.test(login));

  // --- 4. Simulasi obfuscator Cloudflare --------------------------------------
  log("\n== 4. Simulasi obfuscator: tidak ada yang bisa ditulis ulang ==");
  const obfuscate = (h) => h.replace(new RegExp(EMAIL_RE.source, "g"), "[email protected]");
  check("HTML SafeEmail tidak berubah oleh rewrite obfuscator", obfuscate(html) === html);
  const control = renderToStaticMarkup(React.createElement("span", null, "halo@acmestore.id"));
  check("kontrol positif: email literal biasa PASTI ditulis ulang (detektor hidup)", obfuscate(control) !== control && obfuscate(control).includes("[email protected]"));
} finally {
  rmSync(TMP_DIR, { recursive: true, force: true });
}

// --- 5. Typecheck --------------------------------------------------------------
log("\n== 5. Typecheck (tsc --noEmit) ==");
let tscOk = true;
for (const ws of ["apps/web", "packages/widget"]) {
  try {
    execSync("npx tsc --noEmit", { cwd: join(ROOT, ws), stdio: "pipe" });
    check(`tsc ${ws}`, true);
  } catch (e) {
    tscOk = false;
    check(`tsc ${ws}`, false, String(e.stdout || e.stderr || e.message).split("\n").filter(Boolean).slice(-3).join(" | "));
  }
}
if (!tscOk) log("   ↳ jalankan `make typecheck` untuk output lengkap");

log(`\n${failures === 0 ? "✅ SEMUA CHECK LULUS" : `❌ ${failures} CHECK GAGAL`}`);
process.exit(failures === 0 ? 0 : 1);
