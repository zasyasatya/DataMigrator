"""BM25 retrieval over knowledge chunks (no external deps, deterministic)."""

from __future__ import annotations

import math
from dataclasses import dataclass

from app.services.text import tokenize


@dataclass
class Hit:
    chunk_id: str
    document_id: str
    document_title: str
    content: str
    score: float


class BM25:
    def __init__(self, docs: list[tuple[str, str]], k1: float = 1.5, b: float = 0.75):
        self.k1 = k1
        self.b = b
        self.doc_tokens = [tokenize(t) for t, _ in docs]
        self.ids = [i for i, _ in docs]
        self.n = len(self.doc_tokens)
        self.avgdl = (sum(len(d) for d in self.doc_tokens) / self.n) if self.n else 0.0
        self.df: dict[str, int] = {}
        for toks in self.doc_tokens:
            for t in set(toks):
                self.df[t] = self.df.get(t, 0) + 1

    def score(self, query: str) -> list[float]:
        q = tokenize(query)
        scores = [0.0] * self.n
        if not self.n or not q:
            return scores
        for idx, toks in enumerate(self.doc_tokens):
            if not toks:
                continue
            tf: dict[str, int] = {}
            for t in toks:
                tf[t] = tf.get(t, 0) + 1
            dl = len(toks)
            for term in q:
                df = self.df.get(term, 0)
                if not df:
                    continue
                idf = math.log(1 + (self.n - df + 0.5) / (df + 0.5))
                f = tf.get(term, 0)
                if not f:
                    continue
                denom = f + self.k1 * (1 - self.b + self.b * dl / (self.avgdl or 1))
                scores[idx] += idf * (f * (self.k1 + 1)) / denom
        return scores


def retrieve(
    chunks: list[tuple[str, str, str, str]],  # (chunk_id, document_id, doc_title, content)
    query: str,
    top_k: int = 3,
    min_score: float = 0.35,
) -> list[Hit]:
    if not chunks:
        return []
    index = BM25([(c[3], c[0]) for c in chunks])
    scores = index.score(query)
    ranked = sorted(
        (
            (score, i)
            for i, score in enumerate(scores)
            if score >= min_score
        ),
        reverse=True,
    )[:top_k]
    return [
        Hit(
            chunk_id=chunks[i][0],
            document_id=chunks[i][1],
            document_title=chunks[i][2],
            content=chunks[i][3],
            score=score,
        )
        for score, i in ranked
    ]
