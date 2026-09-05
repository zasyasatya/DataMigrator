#!/usr/bin/env node
/**
 * verify-deploy — smoke test end-to-end untuk deployment Sapa AI.
 *
 * Menjalankan alur chatbot PERSIS seperti widget.js di landing page, terhadap
 * URL yang sudah live: login admin -> ambil widget key -> load bundle ->
 * config -> chat SSE -> history -> feedback -> cek muncul di dashboard.
 *
 * Pakai:
 *   node scripts/verify-deploy.mjs                          # lokal (http://127.0.0.1:3000)
 *   BASE=https://sapa.zasya.id node scripts/verify-deploy.mjs   # production
 *   BASE=... ADMIN_EMAIL=... ADMIN_PW=... node scripts/verify-deploy.mjs
 *
 * Exit code 0 = semua lulus, 1 = ada yang gagal. Berguna untuk memastikan
 * "sudah deploy tapi tidak bisa login" tidak terulang: bila login gagal, output
 * akan menunjukkan apakah itu masalah proxy (502), kredensial (401), atau boot.
 */
const BASE = (process.env.BASE || "http://127.0.0.1:3000").replace(/\/+$/, "");
const ORIGIN = process.env.ORIGIN || BASE;

const log = (...a) => console.log(...a);
let failures = 0;
const check = (name, ok, extra = "") => {
  log(`${ok ? "  [OK]  " : "  [FAIL]"} ${name}${extra ? " — " + extra : ""}`);
  if (!ok) failures++;
};

// --- 0. ambil public key agent lewat API admin (login) -----------------------
log("\n== 0. Login admin & ambil widget key ==");
const login = await fetch(`${BASE}/api/v1/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-Forwarded-Proto": "https" },
  body: JSON.stringify({
    email: process.env.ADMIN_EMAIL || "admin@sapa.ai",
    password: process.env.ADMIN_PW || "admin123",
  }),
});
check("POST /api/v1/auth/login", login.status === 200, `HTTP ${login.status}`);
if (login.status !== 200) { log(await login.text()); process.exit(1); }
const { token } = await login.json();
const cookie = (login.headers.getSetCookie?.() || []).find((c) => c.startsWith("sapa_session"));
check("cookie sesi terkirim", !!cookie, cookie ? cookie.slice(0, 42) + "…" : "");
check("cookie punya flag Secure (karena X-Forwarded-Proto: https)", /;\s*Secure/i.test(cookie || ""));
check("token tidak mengandung padding '=' (hindari cookie ter-quote)", !token.includes("="));

const agents = await (await fetch(`${BASE}/api/v1/agents`, { headers: { Authorization: `Bearer ${token}` } })).json();
check("GET /api/v1/agents", Array.isArray(agents) && agents.length > 0, `${agents.length} agent`);
const agentId = agents[0].id;

const keys = await (await fetch(`${BASE}/api/v1/keys?agent_id=${agentId}`, { headers: { Authorization: `Bearer ${token}` } })).json();
const pk = keys.find((k) => k.kind === "public")?.public_key;
check("public key widget tersedia", !!pk, pk);
if (!pk) process.exit(1);

// --- 1. widget dimuat dari landing page --------------------------------------
log("\n== 1. Bundle widget (yang di-load landing page) ==");
const bundle = await fetch(`${BASE}/embed/widget.js`, { headers: { Origin: ORIGIN } });
const js = await bundle.text();
check("GET /embed/widget.js", bundle.status === 200 && bundle.headers.get("content-type")?.includes("javascript"), `${js.length} bytes`);
check("bundle berisi bootstrap SapaChat", js.includes("SapaChat") && js.includes("data-sapa-key"));

// --- 2. config (dipanggil widget saat mount) ---------------------------------
log("\n== 2. Widget mount: config ==");
const cfgRes = await fetch(`${BASE}/w/${pk}/config`, { headers: { Origin: ORIGIN } });
const cfg = await cfgRes.json();
check("GET /w/{pk}/config", cfgRes.status === 200, `HTTP ${cfgRes.status}`);
check("agent name & greeting terbaca", !!cfg.name && !!cfg.greeting, `${cfg.name}: ${String(cfg.greeting).slice(0, 40)}…`);
check("starter prompts ada", Array.isArray(cfg.starter_prompts) && cfg.starter_prompts.length > 0, `${cfg.starter_prompts?.length} prompt`);

// --- 3. chat SSE (persis widget.send) ----------------------------------------
log("\n== 3. Chat streaming (SSE) dari landing page ==");
const visitorId = "visitor-" + Math.random().toString(36).slice(2, 10);
const questions = [
  "Berapa lama pengiriman ke Jakarta?",
  "Bagaimana cara pengembalian barang?",
  "Apa saja metode pembayaran?",
  "Ada diskon apa bulan ini?",
];

let conversationId = null;
let lastMessageId = null;

for (const q of questions) {
  const res = await fetch(`${BASE}/w/${pk}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGIN },
    body: JSON.stringify({ message: q, conversation_id: conversationId, visitor_id: visitorId }),
  });
  if (res.status !== 200) { check(`chat "${q}"`, false, `HTTP ${res.status}`); continue; }

  const ctype = res.headers.get("content-type") || "";
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "", event = "message", answer = "", meta = null, done = null, sources = [];
  const handle = (chunk) => {
    event = "message";
    for (const line of chunk.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) {
        let d; try { d = JSON.parse(line.slice(5)); } catch { continue; }
        if (event === "meta") { meta = d; sources = d.sources || []; }
        else if (event === "delta") answer += d.t ?? "";
        else if (event === "done") done = d;
      }
    }
  };
  for (;;) {
    const { done: rd, value } = await reader.read();
    if (rd) break;
    buf += dec.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf("\n\n")) >= 0) { handle(buf.slice(0, idx)); buf = buf.slice(idx + 2); }
  }
  if (buf.trim()) handle(buf);

  conversationId = meta?.conversation_id || conversationId;
  lastMessageId = meta?.message_id || done?.message_id || lastMessageId;

  check(`SSE content-type "${q.slice(0, 28)}…"`, ctype.includes("text/event-stream"), ctype);
  check(`   meta + delta + done lengkap`, !!meta && answer.length > 0 && !!done, `${answer.length} char, engine=${meta?.engine}`);
  check(`   jawaban relevan (ada knowledge source / rule)`, sources.length > 0 || /voucher|diskon/i.test(answer), sources.map((s) => s.title).join(", ") || "rule-match");
  log(`   ↳ jawaban: ${answer.slice(0, 108).replace(/\n/g, " ")}…`);
}

check("conversation_id stabil antar giliran", !!conversationId, conversationId);

// --- 4. history + feedback (dipanggil widget) --------------------------------
log("\n== 4. History & feedback ==");
const hist = await fetch(`${BASE}/w/${pk}/history?conversation_id=${conversationId}`, { headers: { Origin: ORIGIN } });
const msgs = await hist.json();
check("GET /w/{pk}/history", hist.status === 200 && msgs.length >= questions.length * 2, `${msgs.length} pesan tersimpan`);

const fb = await fetch(`${BASE}/api/v1/conversations/${conversationId}/feedback`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Origin: ORIGIN },
  body: JSON.stringify({ message_id: lastMessageId, rating: "up" }),
});
check("POST feedback (endpoint publik, tanpa token)", fb.status === 201 || fb.status === 200, `HTTP ${fb.status}`);

// --- 5. percakapan terlihat di dashboard admin -------------------------------
log("\n== 5. Percakapan masuk ke dashboard ==");
const convs = await fetch(`${BASE}/api/v1/agents/${agentId}/conversations`, { headers: { Authorization: `Bearer ${token}` } });
const list = await convs.json();
const items = Array.isArray(list) ? list : list.items || [];
check("GET /api/v1/agents/{id}/conversations", convs.status === 200, `${items.length} percakapan`);
check("   percakapan widget tadi tercatat", items.some((c) => c.id === conversationId));

// --- 6. cookie-only auth (bila browser tidak menyimpan token di localStorage) -
log("\n== 6. Auth lewat cookie saja ==");
const me = await fetch(`${BASE}/api/v1/auth/me`, { headers: { Cookie: (cookie || "").split(";")[0], Origin: ORIGIN } });
check("GET /auth/me dengan cookie", me.status === 200, `HTTP ${me.status}`);

log(`\n${failures === 0 ? "✅ SEMUA CHECK LULUS" : `❌ ${failures} CHECK GAGAL`}`);
process.exit(failures === 0 ? 0 : 1);
