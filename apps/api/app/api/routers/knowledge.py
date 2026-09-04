from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.deps import get_workspace_id
from app.core.ids import new_id
from app.models import Agent, KnowledgeChunk, KnowledgeDocument
from app.schemas import DocumentIn, DocumentOut
from app.services.knowledge import chunk_count, reindex_document

router = APIRouter(prefix="/api/v1/agents/{agent_id}/knowledge", tags=["knowledge"])

_MAX_UPLOAD = 2 * 1024 * 1024


async def _get_owned_agent(db: AsyncSession, agent_id: str, workspace_id: str) -> Agent:
    agent = (await db.execute(select(Agent).where(Agent.id == agent_id))).scalar_one_or_none()
    if not agent or agent.workspace_id != workspace_id:
        raise HTTPException(status_code=404, detail="Agent tidak ditemukan")
    return agent


async def _out(db: AsyncSession, doc: KnowledgeDocument) -> DocumentOut:
    out = DocumentOut.model_validate(doc)
    out.chunk_count = await chunk_count(db, doc.id)
    return out


@router.get("", response_model=list[DocumentOut])
async def list_docs(
    agent_id: str,
    workspace_id: str = Depends(get_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    await _get_owned_agent(db, agent_id, workspace_id)
    rows = (
        await db.execute(
            select(KnowledgeDocument)
            .where(KnowledgeDocument.agent_id == agent_id)
            .order_by(KnowledgeDocument.created_at)
        )
    ).scalars().all()
    return [await _out(db, d) for d in rows]


@router.post("", response_model=DocumentOut, status_code=201)
async def create_doc(
    agent_id: str,
    payload: DocumentIn,
    workspace_id: str = Depends(get_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    await _get_owned_agent(db, agent_id, workspace_id)
    doc = KnowledgeDocument(
        id=new_id("document"),
        agent_id=agent_id,
        title=payload.title,
        content=payload.content,
        source=payload.source,
    )
    db.add(doc)
    await db.flush()
    await reindex_document(db, doc)
    await db.commit()
    await db.refresh(doc)
    return await _out(db, doc)


@router.post("/upload", response_model=DocumentOut, status_code=201)
async def upload_doc(
    agent_id: str,
    file: UploadFile,
    workspace_id: str = Depends(get_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    await _get_owned_agent(db, agent_id, workspace_id)
    data = await file.read(_MAX_UPLOAD + 1)
    if len(data) > _MAX_UPLOAD:
        raise HTTPException(status_code=413, detail="File maksimal 2MB")
    try:
        content = data.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(status_code=415, detail="File harus berupa teks (txt/md/csv/html)")
    doc = KnowledgeDocument(
        id=new_id("document"),
        agent_id=agent_id,
        title=file.filename or "Dokumen",
        content=content,
        source="file",
    )
    db.add(doc)
    await db.flush()
    await reindex_document(db, doc)
    await db.commit()
    await db.refresh(doc)
    return await _out(db, doc)


@router.patch("/{doc_id}", response_model=DocumentOut)
async def update_doc(
    agent_id: str,
    doc_id: str,
    payload: DocumentIn,
    workspace_id: str = Depends(get_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    await _get_owned_agent(db, agent_id, workspace_id)
    doc = await _get_doc(db, doc_id, agent_id)
    doc.title = payload.title
    doc.content = payload.content
    await reindex_document(db, doc)
    await db.commit()
    await db.refresh(doc)
    return await _out(db, doc)


@router.delete("/{doc_id}", status_code=204)
async def delete_doc(
    agent_id: str,
    doc_id: str,
    workspace_id: str = Depends(get_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    await _get_owned_agent(db, agent_id, workspace_id)
    doc = await _get_doc(db, doc_id, agent_id)
    chunks = (
        await db.execute(select(KnowledgeChunk).where(KnowledgeChunk.document_id == doc.id))
    ).scalars().all()
    for c in chunks:
        await db.delete(c)
    await db.delete(doc)
    await db.commit()


async def _get_doc(db: AsyncSession, doc_id: str, agent_id: str) -> KnowledgeDocument:
    doc = (
        await db.execute(select(KnowledgeDocument).where(KnowledgeDocument.id == doc_id))
    ).scalar_one_or_none()
    if not doc or doc.agent_id != agent_id:
        raise HTTPException(status_code=404, detail="Dokumen tidak ditemukan")
    return doc
