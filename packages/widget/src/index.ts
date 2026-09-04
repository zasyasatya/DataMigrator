/**
 * Sapa AI — embeddable popup chat widget.
 *
 * Integration (one line, before </body>):
 *   <script src="https://your-api/embed/widget.js" data-sapa-key="pk_..." defer></script>
 */
import { WIDGET_CSS } from "./styles";

interface WidgetConfig {
  agent_id: string;
  name: string;
  role_title: string;
  emoji: string;
  greeting: string;
  starter_prompts: string[];
  language: string;
  theme: Record<string, any>;
  handoff_enabled: boolean;
  powered_by: string;
}

interface Msg {
  id?: string;
  role: "user" | "assistant";
  content: string;
  sources?: { title: string; score: number }[];
  latency_ms?: number;
  ts?: number;
}

const SPARK =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z"/></svg>';
const SEND =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/></svg>';
const CLOSE =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>';
const UP =
  '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>';
const DOWN =
  '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3z"/><path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg>';

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as any)[c]
  );
}

function fmt(text: string): string {
  let out = escapeHtml(text);
  out = out.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
  out = out.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
  );
  return out;
}

class SapaWidget {
  private base: string;
  private key: string;
  private cfg!: WidgetConfig;
  private host!: HTMLElement;
  private root!: HTMLElement;
  private messagesEl!: HTMLElement;
  private chipsEl!: HTMLElement;
  private inputEl!: HTMLTextAreaElement;
  private sendEl!: HTMLButtonElement;
  private badgeEl!: HTMLElement;
  private errorEl!: HTMLElement;
  private open = false;
  private unread = 0;
  private cid: string | null = null;
  private visitor: { id: string; name?: string; email?: string } = { id: "" };
  private busy = false;
  private listeners: Record<string, ((p?: any) => void)[]> = {};

  constructor(base: string, key: string) {
    this.base = base.replace(/\/$/, "");
    this.key = key;
    this.visitor.id = this.ls("vid") || this.setLs("vid", Math.random().toString(36).slice(2, 12));
    this.cid = this.ls("cid");
  }

  // ------------------------------------------------------------- storage
  private ls(k: string): string | null {
    try {
      return localStorage.getItem(`sapa:${this.key}:${k}`);
    } catch {
      return null;
    }
  }
  private setLs(k: string, v: string): string {
    try {
      localStorage.setItem(`sapa:${this.key}:${k}`, v);
    } catch {
      /* private mode */
    }
    return v;
  }
  private cache(msgs: Msg[]) {
    this.setLs("msgs", JSON.stringify(msgs.slice(-40)));
  }
  private cached(): Msg[] {
    try {
      return JSON.parse(this.ls("msgs") || "[]");
    } catch {
      return [];
    }
  }

  // ---------------------------------------------------------------- init
  async mount() {
    const res = await fetch(`${this.base}/w/${this.key}/config`);
    if (!res.ok) throw new Error(`Sapa widget: config ${res.status}`);
    this.cfg = await res.json();

    this.host = document.createElement("div");
    this.host.id = "sapa-chat";
    const shadow = this.host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = WIDGET_CSS;
    shadow.appendChild(style);

    const theme = this.cfg.theme || {};
    this.root = document.createElement("div");
    this.root.className = "sapa-root";
    this.root.dataset.pos = theme.position === "left" ? "left" : "right";
    this.root.style.setProperty("--primary", theme.primary || "#7C5CF6");
    this.root.style.setProperty("--radius", `${theme.radius || 20}px`);
    this.root.innerHTML = `
      <div class="sapa-panel" role="dialog" aria-label="Chat ${escapeHtml(this.cfg.name)}">
        <div class="sapa-header">
          <div class="sapa-avatar">${escapeHtml(this.cfg.emoji || "✨")}</div>
          <div class="sapa-header-meta">
            <div class="sapa-header-name">${escapeHtml(this.cfg.name)}</div>
            <div class="sapa-header-status"><span class="sapa-dot"></span>${escapeHtml(
              this.cfg.role_title || "Online"
            )}</div>
          </div>
          <button class="sapa-close" aria-label="Tutup chat">${CLOSE}</button>
        </div>
        <div class="sapa-messages" aria-live="polite"></div>
        <div class="sapa-error" hidden><span>Koneksi terganggu.</span><button>Coba lagi</button></div>
        <div class="sapa-chips"></div>
        <div class="sapa-composer">
          <div class="sapa-input-row">
            <textarea class="sapa-input" rows="1" placeholder="Tulis pesan…"></textarea>
            <button class="sapa-send" aria-label="Kirim">${SEND}</button>
          </div>
          <div class="sapa-footer">Powered by <b>${escapeHtml(this.cfg.powered_by || "Sapa AI")}</b></div>
        </div>
      </div>
      <div class="sapa-launcher-wrap">
        <button class="sapa-launcher" aria-label="Buka chat">${SPARK}<span>${escapeHtml(
      theme.launcher_label || "Chat"
    )}</span></button>
        <span class="sapa-badge" hidden>0</span>
      </div>`;
    shadow.appendChild(this.root);
    document.body.appendChild(this.host);

    this.messagesEl = this.root.querySelector(".sapa-messages")!;
    this.chipsEl = this.root.querySelector(".sapa-chips")!;
    this.inputEl = this.root.querySelector(".sapa-input")!;
    this.sendEl = this.root.querySelector(".sapa-send")!;
    this.badgeEl = this.root.querySelector(".sapa-badge")!;
    this.errorEl = this.root.querySelector(".sapa-error")!;

    this.root.querySelector(".sapa-launcher")!.addEventListener("click", () => this.toggle());
    this.root.querySelector(".sapa-close")!.addEventListener("click", () => this.toggle(false));
    this.sendEl.addEventListener("click", () => this.sendFromInput());
    this.inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.sendFromInput();
      }
    });
    this.inputEl.addEventListener("input", () => {
      this.inputEl.style.height = "auto";
      this.inputEl.style.height = Math.min(this.inputEl.scrollHeight, 110) + "px";
    });
    this.errorEl.querySelector("button")!.addEventListener("click", () => {
      this.errorEl.hidden = true;
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.open) this.toggle(false);
    });

    await this.restore();
    this.renderChips();
  }

  private async restore() {
    const cachedMsgs = this.cached();
    if (this.cid) {
      try {
        const res = await fetch(`${this.base}/w/${this.key}/history?conversation_id=${this.cid}`);
        if (res.ok) {
          const hist: Msg[] = await res.json();
          if (hist.length) {
            this.pushBot(this.cfg.greeting, { silent: true, cache: false });
            hist.forEach((m) => this.push(m.role, m.content, { silent: true, cache: false, sources: m.sources }));
            this.scroll();
            return;
          }
        }
        this.cid = null;
      } catch {
        /* offline → fall back to cache */
      }
    }
    if (cachedMsgs.length) {
      this.pushBot(this.cfg.greeting, { silent: true, cache: false });
      cachedMsgs.forEach((m) => this.push(m.role, m.content, { silent: true, cache: false }));
      this.scroll();
    } else {
      this.pushBot(this.cfg.greeting, { silent: true, cache: false });
    }
  }

  // ------------------------------------------------------------ rendering
  private renderChips() {
    this.chipsEl.innerHTML = "";
    (this.cfg.starter_prompts || []).slice(0, 3).forEach((p) => {
      const b = document.createElement("button");
      b.className = "sapa-chip";
      b.textContent = p;
      b.addEventListener("click", () => this.send(p));
      this.chipsEl.appendChild(b);
    });
  }

  private push(
    role: "user" | "assistant",
    content: string,
    opts: { silent?: boolean; cache?: boolean; sources?: any[]; latency?: number } = {}
  ): HTMLElement {
    const el = document.createElement("div");
    el.className = `sapa-msg ${role === "user" ? "user" : "bot"}`;
    el.innerHTML = fmt(content);
    if (role === "assistant" && (opts.sources?.length || opts.latency != null)) {
      const meta = document.createElement("div");
      meta.className = "sapa-meta";
      const bits: string[] = [];
      if (opts.sources?.length)
        bits.push(`<span class="sapa-src">📚 ${opts.sources.length} sumber</span>`);
      if (opts.latency != null) bits.push(`${(opts.latency / 1000).toFixed(1)}s`);
      meta.innerHTML = bits.join(" · ");
      const fb = document.createElement("span");
      fb.className = "sapa-fb";
      fb.innerHTML = `<button data-r="up" title="Membantu">${UP}</button><button data-r="down" title="Kurang membantu">${DOWN}</button>`;
      fb.addEventListener("click", (e) => {
        const btn = (e.target as HTMLElement).closest("button") as HTMLButtonElement;
        if (!btn) return;
        this.feedback(el, btn.dataset.r!);
      });
      meta.appendChild(fb);
      el.appendChild(meta);
    }
    this.messagesEl.appendChild(el);
    if (opts.cache !== false) {
      const all = this.cached();
      all.push({ role, content, ts: Date.now() });
      this.cache(all);
    }
    if (!opts.silent && role === "assistant" && !this.open) {
      this.unread += 1;
      this.badgeEl.hidden = false;
      this.badgeEl.textContent = String(this.unread);
    }
    this.scroll();
    return el;
  }

  private pushBot(content: string, opts: any = {}) {
    return this.push("assistant", content, opts);
  }

  private scroll() {
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }

  private typing(): HTMLElement {
    const el = document.createElement("div");
    el.className = "sapa-msg bot";
    el.innerHTML = '<span class="sapa-typing"><i></i><i></i><i></i></span>';
    this.messagesEl.appendChild(el);
    this.scroll();
    return el;
  }

  // -------------------------------------------------------------- actions
  toggle(force?: boolean) {
    this.open = force ?? !this.open;
    this.root.classList.toggle("open", this.open);
    if (this.open) {
      this.unread = 0;
      this.badgeEl.hidden = true;
      setTimeout(() => this.inputEl.focus(), 120);
    }
    this.emit(this.open ? "open" : "close");
  }

  private sendFromInput() {
    const text = this.inputEl.value.trim();
    if (!text || this.busy) return;
    this.inputEl.value = "";
    this.inputEl.style.height = "auto";
    void this.send(text);
  }

  async send(text: string) {
    if (this.busy) return;
    this.busy = true;
    this.sendEl.disabled = true;
    this.chipsEl.innerHTML = "";
    this.errorEl.hidden = true;
    this.push("user", text);
    if (!this.open) this.toggle(true);
    const typingEl = this.typing();

    let bubble: any = null;
    let acc = "";
    let sources: any[] = [];
    let messageId: string | null = null;

    try {
      const res = await fetch(`${this.base}/w/${this.key}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          conversation_id: this.cid,
          visitor_id: this.visitor.id,
          visitor_name: this.visitor.name,
          visitor_email: this.visitor.email,
          origin: location.origin,
        }),
      });
      if (!res.ok || !res.body) throw new Error(`chat ${res.status}`);
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let latency: number | undefined;
      const handle = (chunk: string) => {
        let event = "message";
        for (const line of chunk.split("\n")) {
          if (line.startsWith("event:")) event = line.slice(6).trim();
          else if (line.startsWith("data:")) {
            let data: any = {};
            try {
              data = JSON.parse(line.slice(5));
            } catch {
              continue;
            }
            if (event === "meta") {
              this.cid = String(data.conversation_id);
              this.setLs("cid", this.cid);
              this.lastAssistantId = data.message_id || null;
              sources = data.sources || [];
            } else if (event === "delta") {
              if (!bubble) {
                typingEl.remove();
                bubble = this.pushBot("", { cache: false });
              }
              acc += data.t || "";
              bubble.innerHTML = fmt(acc);
              this.scroll();
            } else if (event === "done") {
              messageId = data.message_id;
              this.lastAssistantId = data.message_id || null;
              latency = data.latency_ms;
              sources = data.sources?.length ? data.sources : sources;
            }
          }
        }
      };
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf("\n\n")) >= 0) {
          handle(buf.slice(0, idx));
          buf = buf.slice(idx + 2);
        }
      }
      if (buf.trim()) handle(buf);
      typingEl.remove();
      if (bubble) {
        bubble.innerHTML = fmt(acc);
        const meta = document.createElement("div");
        meta.className = "sapa-meta";
        const bits: string[] = [];
        if (sources.length) bits.push(`<span class="sapa-src">📚 ${sources.length} sumber</span>`);
        if (latency != null) bits.push(`${(latency / 1000).toFixed(1)}s`);
        meta.innerHTML = bits.join(" · ");
        const fb = document.createElement("span");
        fb.className = "sapa-fb";
        fb.innerHTML = `<button data-r="up" title="Membantu">${UP}</button><button data-r="down" title="Kurang membantu">${DOWN}</button>`;
        fb.addEventListener("click", (e) => {
          const btn = (e.target as HTMLElement).closest("button") as HTMLButtonElement;
          if (!btn || !messageId) return;
          this.feedback(bubble!, btn.dataset.r!);
        });
        meta.appendChild(fb);
        bubble.appendChild(meta);
        const all = this.cached();
        all.push({ role: "assistant", content: acc, ts: Date.now() });
        this.cache(all);
        if (!this.open) {
          this.unread += 1;
          this.badgeEl.hidden = false;
          this.badgeEl.textContent = String(this.unread);
        }
        this.scroll();
      }
      this.emit("message", { role: "assistant", content: acc });
    } catch (err) {
      typingEl.remove();
      this.errorEl.hidden = false;
    } finally {
      this.busy = false;
      this.sendEl.disabled = false;
      this.inputEl.focus();
    }
  }

  private async feedback(el: HTMLElement, rating: string) {
    const meta = el.querySelector(".sapa-meta");
    const msgId = this.lastAssistantId;
    if (!this.cid || !msgId) return;
    try {
      await fetch(`${this.base}/api/v1/conversations/${this.cid}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message_id: msgId, rating }),
      });
      meta?.querySelectorAll(".sapa-fb button").forEach((b) => b.classList.remove("on"));
      meta?.querySelector(`.sapa-fb button[data-r="${rating}"]`)?.classList.add("on");
    } catch {
      /* noop */
    }
  }
  private lastAssistantId: string | null = null;

  identify(name?: string, email?: string) {
    this.visitor.name = name;
    this.visitor.email = email;
  }

  on(evt: "open" | "close" | "message", cb: (p?: any) => void) {
    (this.listeners[evt] ||= []).push(cb);
    return () => {
      this.listeners[evt] = (this.listeners[evt] || []).filter((f) => f !== cb);
    };
  }
  private emit(evt: string, payload?: any) {
    (this.listeners[evt] || []).forEach((cb) => cb(payload));
  }
}

// ------------------------------------------------------------------ boot
(function boot() {
  const script = document.currentScript as HTMLScriptElement | null;
  if (!script) return;
  const url = new URL(script.src);
  const base = url.origin;
  const key =
    script.getAttribute("data-sapa-key") ||
    url.searchParams.get("k") ||
    url.searchParams.get("agent") ||
    "";
  if (!key) {
    console.warn("[Sapa AI] widget dimuat tanpa data-sapa-key.");
    return;
  }
  const start = () => {
    const w = new SapaWidget(base, key);
    w.mount().catch((e) => console.warn("[Sapa AI] widget gagal dimuat:", e));
    (window as any).SapaChat = {
      open: () => w.toggle(true),
      close: () => w.toggle(false),
      toggle: () => w.toggle(),
      send: (t: string) => w.send(t),
      identify: (n?: string, e?: string) => w.identify(n, e),
      on: (evt: any, cb: any) => w.on(evt, cb),
    };
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
