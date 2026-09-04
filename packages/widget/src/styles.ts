/** Widget styles — injected into the Shadow DOM, fully isolated from host CSS. */
export const WIDGET_CSS = `
:host{
  --primary:#7C5CF6; --primary-600:#6A4BE0; --ink:#191430; --ink-2:#5F5B74; --ink-3:#918DA3;
  --surface:#ffffff; --line:#ECE7F7; --radius:20px;
  all:initial;
}
.sapa-root{
  position:fixed; bottom:20px; z-index:2147483000;
  font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
  color:var(--ink); line-height:1.45; font-size:14px;
}
.sapa-root[data-pos="right"]{ right:20px; }
.sapa-root[data-pos="left"]{ left:20px; }
.sapa-root *{ box-sizing:border-box; margin:0; padding:0; }
.sapa-root button{ font:inherit; border:0; background:none; cursor:pointer; color:inherit; }

/* launcher ------------------------------------------------------------ */
.sapa-launcher{
  display:flex; align-items:center; gap:8px;
  background:#171226; color:#fff; border-radius:999px;
  padding:13px 18px; font-weight:600; font-size:14px;
  box-shadow:0 12px 32px -8px rgba(23,18,38,.45), 0 0 0 1px rgba(255,255,255,.06) inset;
  transition:transform .18s ease, box-shadow .18s ease;
}
.sapa-launcher:hover{ transform:translateY(-2px); box-shadow:0 16px 40px -8px rgba(23,18,38,.55); }
.sapa-launcher svg{ width:18px; height:18px; }
.sapa-badge{
  position:absolute; top:-4px; right:-4px; min-width:20px; height:20px; padding:0 5px;
  background:#F04438; color:#fff; border-radius:999px; font-size:11px; font-weight:700;
  display:flex; align-items:center; justify-content:center; border:2px solid #fff;
}
.sapa-launcher-wrap{ position:relative; display:inline-block; }

/* panel --------------------------------------------------------------- */
.sapa-panel{
  position:absolute; bottom:72px; width:384px; max-width:calc(100vw - 32px);
  height:min(640px, calc(100vh - 110px));
  background:var(--surface); border:1px solid var(--line); border-radius:var(--radius);
  box-shadow:0 24px 64px -16px rgba(23,15,60,.28), 0 2px 8px rgba(23,15,60,.06);
  display:flex; flex-direction:column; overflow:hidden;
  opacity:0; transform:translateY(12px) scale(.98); pointer-events:none;
  transition:opacity .2s ease, transform .2s ease;
}
.sapa-root[data-pos="right"] .sapa-panel{ right:0; }
.sapa-root[data-pos="left"] .sapa-panel{ left:0; }
.sapa-root.open .sapa-panel{ opacity:1; transform:none; pointer-events:auto; }

.sapa-header{
  background:linear-gradient(120deg,#241448 0%, #3B1E6E 55%, color-mix(in srgb, var(--primary) 70%, #2A1656) 100%);
  color:#fff; padding:16px 18px; display:flex; align-items:center; gap:12px;
}
.sapa-avatar{
  width:42px; height:42px; border-radius:14px; flex:none;
  background:radial-gradient(circle at 30% 25%, color-mix(in srgb, var(--primary) 85%, #fff) 0%, var(--primary) 60%);
  display:flex; align-items:center; justify-content:center; font-size:20px;
  box-shadow:0 0 0 4px rgba(255,255,255,.10), 0 6px 18px -4px rgba(0,0,0,.5);
}
.sapa-header-meta{ flex:1; min-width:0; }
.sapa-header-name{ font-weight:700; font-size:15px; letter-spacing:-.01em; }
.sapa-header-status{ font-size:12px; color:rgba(255,255,255,.72); display:flex; align-items:center; gap:6px; }
.sapa-dot{ width:7px; height:7px; border-radius:50%; background:#34D399; box-shadow:0 0 8px #34D399; }
.sapa-close{ color:rgba(255,255,255,.8); padding:6px; border-radius:10px; }
.sapa-close:hover{ background:rgba(255,255,255,.12); color:#fff; }

.sapa-messages{
  flex:1; overflow-y:auto; padding:18px 16px; display:flex; flex-direction:column; gap:12px;
  background:linear-gradient(180deg,#FAF8FF 0%, #FDFCFF 40%);
}
.sapa-msg{ max-width:82%; padding:10px 14px; font-size:13.5px; white-space:pre-wrap; word-break:break-word; }
.sapa-msg.bot{
  align-self:flex-start; background:#fff; border:1px solid var(--line); color:var(--ink);
  border-radius:16px 16px 16px 6px; box-shadow:0 1px 2px rgba(23,15,60,.05);
}
.sapa-msg.user{
  align-self:flex-end; background:var(--primary); color:#fff; border-radius:16px 16px 6px 16px;
  box-shadow:0 6px 16px -6px color-mix(in srgb, var(--primary) 60%, transparent);
}
.sapa-msg a{ color:inherit; font-weight:600; }
.sapa-meta{ font-size:10.5px; color:var(--ink-3); margin-top:6px; display:flex; gap:8px; align-items:center; }
.sapa-src{ color:var(--primary-600); font-weight:600; }
.sapa-fb{ display:inline-flex; gap:4px; margin-left:auto; }
.sapa-fb button{ padding:2px 4px; border-radius:6px; color:var(--ink-3); }
.sapa-fb button:hover{ background:#F1EDFC; color:var(--primary-600); }
.sapa-fb button.on{ color:var(--primary-600); }

.sapa-typing{ display:inline-flex; gap:4px; padding:4px 2px; }
.sapa-typing i{ width:6px; height:6px; border-radius:50%; background:var(--ink-3); animation:sapa-blink 1.2s infinite; }
.sapa-typing i:nth-child(2){ animation-delay:.2s; } .sapa-typing i:nth-child(3){ animation-delay:.4s; }
@keyframes sapa-blink{ 0%,80%,100%{opacity:.25} 40%{opacity:1} }

.sapa-chips{ display:flex; gap:8px; padding:0 16px 10px; flex-wrap:wrap; background:transparent; }
.sapa-chip{
  border:1px solid var(--line); background:#fff; color:var(--primary-600);
  border-radius:999px; padding:7px 12px; font-size:12px; font-weight:600;
}
.sapa-chip:hover{ border-color:var(--primary); background:#F6F3FF; }

.sapa-composer{ border-top:1px solid var(--line); padding:12px; background:#fff; }
.sapa-input-row{
  display:flex; align-items:flex-end; gap:8px; border:1px solid var(--line);
  border-radius:16px; padding:8px 8px 8px 14px; background:#FBFAFF;
  transition:border-color .15s ease, box-shadow .15s ease;
}
.sapa-input-row:focus-within{ border-color:var(--primary); box-shadow:0 0 0 3px color-mix(in srgb, var(--primary) 18%, transparent); }
.sapa-input{
  flex:1; border:0; outline:0; background:transparent; resize:none; font:inherit; font-size:13.5px;
  color:var(--ink); max-height:110px; min-height:22px; line-height:1.4;
}
.sapa-send{
  width:34px; height:34px; border-radius:12px; background:var(--primary); color:#fff; flex:none;
  display:flex; align-items:center; justify-content:center;
  transition:background .15s ease, transform .1s ease;
}
.sapa-send:hover{ background:var(--primary-600); }
.sapa-send:disabled{ opacity:.45; cursor:not-allowed; }
.sapa-footer{
  text-align:center; font-size:10.5px; color:var(--ink-3); padding:6px 0 2px;
}
.sapa-footer b{ color:var(--primary-600); font-weight:700; }
.sapa-error{
  margin:0 16px 10px; padding:8px 12px; border-radius:12px; background:#FEECEB; color:#B42318; font-size:12px;
  display:flex; gap:8px; align-items:center; justify-content:space-between;
}
.sapa-error button{ color:#B42318; font-weight:700; text-decoration:underline; }

@media (max-width: 480px){
  .sapa-root{ bottom:0; right:0 !important; left:0 !important; }
  .sapa-panel{ width:100vw; height:100dvh; max-width:none; border-radius:0; bottom:0; }
  .sapa-root.open .sapa-launcher-wrap{ display:none; }
  .sapa-panel{ transform:translateY(100%); }
  .sapa-root.open .sapa-panel{ transform:none; }
}
`;
