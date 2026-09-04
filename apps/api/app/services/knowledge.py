"""Knowledge document indexing (chunk + tokenize)."""

from __future__ import annotations

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.ids import new_id
from app.models import KnowledgeChunk, KnowledgeDocument
from app.services.text import chunk_text, tokenize


async def reindex_document(db: AsyncSession, doc: KnowledgeDocument) -> int:
    await db.execute(delete(KnowledgeChunk).where(KnowledgeChunk.document_id == doc.id))
    chunks = chunk_text(doc.content) if doc.content.strip() else []
    for i, text in enumerate(chunks):
        db.add(
            KnowledgeChunk(
                id=new_id("chunk"),
                agent_id=doc.agent_id,
                document_id=doc.id,
                position=i,
                content=text,
                tokens=" ".join(tokenize(text)),
            )
        )
    await db.flush()
    return len(chunks)


async def chunk_count(db: AsyncSession, doc_id: str) -> int:
    return (
        await db.execute(select(KnowledgeChunk.id).where(KnowledgeChunk.document_id == doc_id))
    ).scalars().all().__len__()
