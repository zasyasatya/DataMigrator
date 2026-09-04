"""LLM provider abstraction."""

from __future__ import annotations

from collections.abc import AsyncIterator
from dataclasses import dataclass, field


@dataclass
class Turn:
    role: str  # system | user | assistant
    content: str


@dataclass
class GenParams:
    temperature: float = 0.4
    max_tokens: int = 700
    model: str | None = None
    extra: dict = field(default_factory=dict)


class LLMProvider:
    name = "base"

    async def stream(self, turns: list[Turn], params: GenParams) -> AsyncIterator[str]:
        raise NotImplementedError
        yield  # pragma: no cover
