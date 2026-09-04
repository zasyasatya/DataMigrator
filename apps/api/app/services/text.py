"""Text normalization + chunking (pure python, deterministic)."""

from __future__ import annotations

import re

_STOPWORDS = set(
    """
    yang dan di ke dari untuk pada dengan adalah merupakan ini itu saya kami anda kamu dia mereka
    akan sudah telah bisa dapat tidak bukan ya nih sih dong deh kalau jika atau karena sehingga
    bahwa dalam nya para juga lebih sangat ada apa bagaimana kapan dimana siapa mengapa kenapa
    the a an and or but if then else of to in on at by for with about into through during before
    after is are was were be been being i you he she it we they my your his her its our their
    what how when where who why will would can could should may might must this that these those
    """.split()
)

_TOKEN_RE = re.compile(r"[a-z0-9]+")
_SENTENCE_RE = re.compile(r"(?<=[.!?])\s+|\n+")


def normalize(text: str) -> str:
    return text.lower().replace("-", " ").replace("_", " ")


def tokenize(text: str) -> list[str]:
    return [t for t in _TOKEN_RE.findall(normalize(text)) if t not in _STOPWORDS and len(t) > 1]


def chunk_text(content: str, max_chars: int = 700, overlap: int = 80) -> list[str]:
    """Split into paragraph/sentence based chunks of ~max_chars."""
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", content) if p.strip()]
    chunks: list[str] = []
    buf = ""
    for para in paragraphs:
        pieces = [para] if len(para) <= max_chars else _split_sentences(para, max_chars)
        for piece in pieces:
            if buf and len(buf) + len(piece) + 2 > max_chars:
                chunks.append(buf.strip())
                tail = buf[-overlap:] if overlap else ""
                buf = tail + " " + piece
            else:
                buf = f"{buf}\n\n{piece}" if buf else piece
    if buf.strip():
        chunks.append(buf.strip())
    return [c for c in chunks if len(c) >= 20]


def _split_sentences(text: str, max_chars: int) -> list[str]:
    sentences = [s.strip() for s in _SENTENCE_RE.split(text) if s.strip()]
    out: list[str] = []
    cur = ""
    for s in sentences:
        if cur and len(cur) + len(s) + 1 > max_chars:
            out.append(cur.strip())
            cur = s
        else:
            cur = f"{cur} {s}" if cur else s
    if cur.strip():
        out.append(cur.strip())
    return out


def split_sentences(text: str) -> list[str]:
    return [s.strip() for s in _SENTENCE_RE.split(text) if s.strip()]
