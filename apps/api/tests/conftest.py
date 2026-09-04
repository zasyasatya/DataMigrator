from __future__ import annotations

import os
import tempfile

_TMP = tempfile.mkdtemp(prefix="sapa-test-")
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{_TMP}/test.db"
os.environ["SECRET_KEY"] = "test-secret-key"
os.environ["SEED_DEMO"] = "0"
os.environ["ENVIRONMENT"] = "test"

import httpx  # noqa: E402
import pytest  # noqa: E402
import pytest_asyncio  # noqa: E402


@pytest_asyncio.fixture(scope="session")
def anyio_backend():
    return "asyncio"


@pytest_asyncio.fixture
async def client():
    from app.core.db import SessionLocal, engine, init_db
    from app.main import app
    from app.seed import seed

    await init_db()
    async with SessionLocal() as db:
        await seed(db)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as c:
        yield c
    await engine.dispose()


@pytest_asyncio.fixture
async def auth(client: httpx.AsyncClient) -> dict:
    resp = await client.post(
        "/api/v1/auth/login", json={"email": "admin@sapa.ai", "password": "admin123"}
    )
    assert resp.status_code == 200, resp.text
    token = resp.json()["token"]
    return {"Authorization": f"Bearer {token}"}


async def sse_events(client: httpx.AsyncClient, method: str, url: str, **kwargs) -> list[tuple[str, dict]]:
    import json

    events: list[tuple[str, dict]] = []
    async with client.stream(method, url, **kwargs) as resp:
        assert resp.status_code == 200, await resp.aread()
        event_name = "message"
        async for line in resp.aiter_lines():
            if line.startswith("event:"):
                event_name = line[6:].strip()
            elif line.startswith("data:"):
                events.append((event_name, json.loads(line[5:])))
                event_name = "message"
    return events


def sse_text(events: list[tuple[str, dict]]) -> str:
    return "".join(d.get("t", "") for name, d in events if name == "delta")
