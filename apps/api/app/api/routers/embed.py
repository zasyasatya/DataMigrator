"""Serves the embeddable widget bundle (single <script> tag integration)."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, HTMLResponse

from app.core.config import settings

router = APIRouter(tags=["embed"])


@router.get("/embed/widget.js", include_in_schema=False)
async def widget_js():
    path = settings.widget_bundle
    if not path.exists():
        raise HTTPException(
            status_code=404,
            detail="Widget bundle belum di-build. Jalankan: npm run build:widget",
        )
    return FileResponse(
        path,
        media_type="application/javascript",
        headers={"Cache-Control": "public, max-age=300", "Access-Control-Allow-Origin": "*"},
    )


_INTEGRATION_DOC = """<!doctype html>
<html lang="id"><head><meta charset="utf-8"><title>Sapa AI — Integrasi</title></head>
<body style="font-family:system-ui;padding:48px;max-width:760px;margin:auto">
<h1>Integrasi 1 baris</h1>
<p>Tempel snippet berikut sebelum <code>&lt;/body&gt;</code> di website Anda:</p>
<pre style="background:#171226;color:#EDE9FE;padding:16px;border-radius:12px;overflow:auto">&lt;script src="{base}/embed/widget.js" data-sapa-key="PK_ANDA" defer&gt;&lt;/script&gt;</pre>
<p>Ganti <code>PK_ANDA</code> dengan public key agent (lihat dashboard → tab Integrasi).</p>
</body></html>"""


@router.get("/embed", response_class=HTMLResponse, include_in_schema=False)
async def embed_doc():
    return _INTEGRATION_DOC.replace("{base}", settings.app_url)
