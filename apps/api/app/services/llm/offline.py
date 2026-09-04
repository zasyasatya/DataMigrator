"""Deterministic offline engine: rules → retrieval-extractive → tone formatting.

Lets the platform run (and be tested) with zero external API keys, while the
provider interface stays identical to the OpenAI-compatible one.
"""

from __future__ import annotations

import asyncio
import re
from collections.abc import AsyncIterator
from dataclasses import dataclass, field

from app.services.llm import GenParams, LLMProvider, Turn
from app.services.retrieval import Hit
from app.services.text import split_sentences, tokenize

_GREET = re.compile(
    r"^(halo|hai|hi|hello|hey|pagi|siang|sore|malam|selamat|assalamualaikum|haloah|yo)\b", re.I
)
_THANKS = re.compile(r"(terima\s?kasih|makasih|thanks|thank\s?you|thx|tq)", re.I)
_BYE = re.compile(r"(dadah|bye|sampai\s?jumpa|selamat\s?tinggal|see\s?you)", re.I)
_HUMAN = re.compile(
    r"(manusia|orang\s+sungguh|cs|customer\s?service|admin|agent\s+manusia|tim\s+kalian|"
    r"bicara\s+dengan|handoff|escalate)",
    re.I,
)

_TONE_OPENERS = {
    "friendly": ["Halo! ", "Baik, ", "Siap! "],
    "formal": ["Baik, ", "Terima kasih atas pertanyaannya. ", ""],
    "casual": ["Oke, ", "Siap, ", "Nih, "],
    "playful": ["Wih, pertanyaan bagus! ", "Siap laksanakan! ", "Okeoke, "],
}
_TONE_LEAD = {
    "friendly": "berdasarkan info yang saya punya, ",
    "formal": "berdasarkan dokumentasi kami, ",
    "casual": "jadi gini, ",
    "playful": "cekidot, ",
}
_TONE_CLOSERS = {
    "friendly": "Ada lagi yang bisa saya bantu? 😊",
    "formal": "Apabila terdapat pertanyaan lain, silakan sampaikan.",
    "casual": "Ada lagi yang mau ditanyain?",
    "playful": "Gimana, sudah jelas kan? Ada lagi? ✨",
}


@dataclass
class AgentBrain:
    """Everything the offline engine needs about an agent."""

    name: str = "Asisten"
    tone: str = "friendly"
    language: str = "id"
    rules: list[dict] = field(default_factory=list)
    greeting: str = "Halo! Ada yang bisa saya bantu?"
    fallback: str = "Maaf, saya belum punya informasi itu."
    handoff_enabled: bool = True
    handoff_message: str = "Baik, saya sambungkan ke tim kami."
    starters: list[str] = field(default_factory=list)


class OfflineProvider(LLMProvider):
    name = "offline"

    def __init__(self, brain: AgentBrain, hits: list[Hit]):
        self.brain = brain
        self.hits = hits

    # ------------------------------------------------------------------ utils
    def _match_rule(self, message: str) -> str | None:
        msg = message.lower()
        msg_tokens = set(tokenize(message))
        for rule in self.brain.rules:
            trigger = (rule.get("trigger") or "").strip()
            response = rule.get("response") or ""
            if not trigger or not response:
                continue
            t = trigger.lower()
            if t in msg:
                return response
            t_tokens = set(tokenize(trigger))
            if t_tokens and t_tokens.issubset(msg_tokens):
                return response
        return None

    def _extract(self, query: str) -> str:
        q = set(tokenize(query))
        picked: list[str] = []
        for hit in self.hits[:2]:
            scored = []
            for sent in split_sentences(hit.content):
                toks = tokenize(sent)
                if not toks:
                    continue
                overlap = len(q & set(toks))
                if overlap:
                    scored.append((overlap / (len(toks) ** 0.5), sent))
            scored.sort(key=lambda x: -x[0])
            for _, sent in scored[:2]:
                if sent not in picked:
                    picked.append(sent)
            if len(picked) >= 3:
                break
        if not picked and self.hits:
            picked = split_sentences(self.hits[0].content)[:2]
        text = " ".join(picked[:3])
        return text[:900]

    def compose(self, message: str) -> tuple[str, str]:
        """Return (reply_text, intent)."""
        brain = self.brain
        rule_hit = self._match_rule(message)
        if rule_hit:
            return rule_hit, "rule"
        if _HUMAN.search(message) and brain.handoff_enabled:
            return brain.handoff_message, "handoff"
        if _GREET.match(message.strip()) and len(message.strip()) < 40:
            extra = ""
            if brain.starters:
                extra = " Coba tanya: " + ", ".join(f'"{s}"' for s in brain.starters[:3]) + "."
            return f"{brain.greeting}{extra}", "greeting"
        if _THANKS.search(message):
            closers = _TONE_CLOSERS.get(brain.tone, _TONE_CLOSERS["friendly"])
            return f"Sama-sama! Senang bisa membantu. {closers}", "thanks"
        if _BYE.search(message):
            return "Sampai jumpa lagi! Semoga harimu menyenangkan. 👋", "bye"

        answer = self._extract(message)
        if not answer:
            return brain.fallback, "fallback"
        openers = _TONE_OPENERS.get(brain.tone, _TONE_OPENERS["friendly"])
        opener = openers[len(message) % len(openers)]
        lead = _TONE_LEAD.get(brain.tone, _TONE_LEAD["friendly"])
        closer = _TONE_CLOSERS.get(brain.tone, _TONE_CLOSERS["friendly"])
        return f"{opener}{lead}{answer} {closer}", "answer"

    # ----------------------------------------------------------------- stream
    async def stream(self, turns: list[Turn], params: GenParams) -> AsyncIterator[str]:
        last_user = next((t.content for t in reversed(turns) if t.role == "user"), "")
        reply, _intent = self.compose(last_user)
        words = reply.split(" ")
        for i, word in enumerate(words):
            yield word if i == 0 else f" {word}"
            await asyncio.sleep(0.014)
