"""OpenAI-compatible streaming provider (OpenAI, Groq, OpenRouter, Ollama, vLLM...)."""

from __future__ import annotations

import json
from collections.abc import AsyncIterator

import httpx

from app.core.config import settings
from app.services.llm import GenParams, LLMProvider, Turn


class OpenAICompatibleProvider(LLMProvider):
    name = "openai"

    def __init__(self, api_key: str | None = None, base_url: str | None = None):
        self.api_key = api_key if api_key is not None else settings.openai_api_key
        self.base_url = (base_url or settings.openai_base_url).rstrip("/")

    @property
    def available(self) -> bool:
        return bool(self.api_key)

    async def stream(self, turns: list[Turn], params: GenParams) -> AsyncIterator[str]:
        payload = {
            "model": params.model or settings.openai_model,
            "messages": [{"role": t.role, "content": t.content} for t in turns],
            "temperature": params.temperature,
            "max_tokens": params.max_tokens,
            "stream": True,
        }
        headers = {"Authorization": f"Bearer {self.api_key}"}
        async with httpx.AsyncClient(timeout=httpx.Timeout(60.0, connect=10.0)) as client:
            async with client.stream(
                "POST", f"{self.base_url}/chat/completions", json=payload, headers=headers
            ) as resp:
                if resp.status_code != 200:
                    body = (await resp.aread()).decode(errors="replace")[:400]
                    raise RuntimeError(f"LLM provider error {resp.status_code}: {body}")
                async for line in resp.aiter_lines():
                    if not line or not line.startswith("data:"):
                        continue
                    data = line[5:].strip()
                    if data == "[DONE]":
                        break
                    try:
                        obj = json.loads(data)
                    except json.JSONDecodeError:
                        continue
                    choices = obj.get("choices") or []
                    if not choices:
                        continue
                    delta = choices[0].get("delta") or {}
                    piece = delta.get("content")
                    if piece:
                        yield piece
