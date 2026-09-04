"""Dashboard analytics aggregation."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Agent, Conversation, Feedback, Message
from app.schemas import ActivityItem, AgentAnalyticsOut, ConversationOut, OverviewOut


def _day_start(offset_days: int = 0) -> datetime:
    now = datetime.now(timezone.utc)
    return (now - timedelta(days=offset_days)).replace(hour=0, minute=0, second=0, microsecond=0)


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


def _ago(dt: datetime) -> str:
    delta = datetime.now(timezone.utc) - _aware(dt)
    if delta.total_seconds() < 0:
        delta = timedelta(0)
    mins = int(delta.total_seconds() // 60)
    if mins < 1:
        return "baru saja"
    if mins < 60:
        return f"{mins} mnt lalu"
    hours = mins // 60
    if hours < 24:
        return f"{hours} jam lalu"
    days = hours // 24
    return f"{days} hari lalu"


async def overview(db: AsyncSession, workspace_id: str, user_name: str) -> OverviewOut:
    agent_ids_q = select(Agent.id).where(Agent.workspace_id == workspace_id)
    agent_rows = (await db.execute(select(Agent).where(Agent.workspace_id == workspace_id))).scalars().all()
    agent_names = {a.id: a.name for a in agent_rows}
    agent_ids = list(agent_names)

    today_start = _day_start(0)
    hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)

    conv_today = (
        await db.execute(
            select(func.count(Conversation.id)).where(
                Conversation.agent_id.in_(agent_ids or ["-"]),
                Conversation.started_at >= today_start,
            )
        )
    ).scalar_one()
    conv_total = (
        await db.execute(
            select(func.count(Conversation.id)).where(
                Conversation.agent_id.in_(agent_ids or ["-"])
            )
        )
    ).scalar_one()
    conv_done = (
        await db.execute(
            select(func.count(Conversation.id)).where(
                Conversation.agent_id.in_(agent_ids or ["-"]),
                Conversation.status == "resolved",
            )
        )
    ).scalar_one()
    msg_today = (
        await db.execute(
            select(func.count(Message.id)).where(
                Message.agent_id.in_(agent_ids or ["-"]),
                Message.created_at >= today_start,
            )
        )
    ).scalar_one()
    lat_rows = (
        await db.execute(
            select(Message.latency_ms).where(
                Message.agent_id.in_(agent_ids or ["-"]),
                Message.role == "assistant",
                Message.latency_ms.is_not(None),
            )
        )
    ).scalars().all()
    avg_ms = sum(lat_rows) / len(lat_rows) if lat_rows else 0.0

    fb_rows = (
        await db.execute(
            select(Feedback.rating).where(Feedback.conversation_id.in_(select(Conversation.id).where(Conversation.agent_id.in_(agent_ids or ["-"]))))
        )
    ).scalars().all()
    up = sum(1 for r in fb_rows if r == "up")
    down = sum(1 for r in fb_rows if r == "down")
    csat = (up / (up + down) * 100) if (up + down) else 0.0

    live_now = (
        await db.execute(
            select(func.count(Conversation.id)).where(
                Conversation.agent_id.in_(agent_ids or ["-"]),
                Conversation.status == "open",
                Conversation.last_message_at >= hour_ago,
            )
        )
    ).scalar_one()

    agents_live = sum(1 for a in agent_rows if a.status == "live")

    # week series (last 7 days conversation counts)
    week: list[int] = []
    for i in range(6, -1, -1):
        start, end = _day_start(i), _day_start(i - 1)
        c = (
            await db.execute(
                select(func.count(Conversation.id)).where(
                    Conversation.agent_id.in_(agent_ids or ["-"]),
                    Conversation.started_at >= start,
                    Conversation.started_at < end,
                )
            )
        ).scalar_one()
        week.append(c)

    # activity feed: recent messages
    recent_msgs = (
        await db.execute(
            select(Message)
            .where(Message.agent_id.in_(agent_ids or ["-"]))
            .order_by(Message.created_at.desc())
            .limit(8)
        )
    ).scalars().all()
    activity: list[ActivityItem] = []
    for m in recent_msgs:
        icon = "user" if m.role == "user" else "spark"
        title = (
            f"Pelanggan bertanya" if m.role == "user" else f"{agent_names.get(m.agent_id, 'Agent')} menjawab"
        )
        activity.append(
            ActivityItem(
                id=m.id,
                kind="message",
                icon=icon,
                title=title,
                detail=m.content[:110],
                agent=agent_names.get(m.agent_id, "-"),
                ago=_ago(m.created_at),
                created_at=m.created_at,
            )
        )

    recent_convs = (
        await db.execute(
            select(Conversation)
            .where(Conversation.agent_id.in_(agent_ids or ["-"]))
            .order_by(Conversation.last_message_at.desc())
            .limit(6)
        )
    ).scalars().all()
    conv_outs: list[ConversationOut] = []
    for c in recent_convs:
        msgs = (
            await db.execute(
                select(Message)
                .where(Message.conversation_id == c.id)
                .order_by(Message.created_at.desc())
                .limit(1)
            )
        ).scalars().all()
        count = (
            await db.execute(
                select(func.count(Message.id)).where(Message.conversation_id == c.id)
            )
        ).scalar_one()
        conv_outs.append(
            ConversationOut(
                id=c.id,
                channel=c.channel,
                visitor_name=c.visitor_name,
                visitor_email=c.visitor_email,
                origin=c.origin,
                status=c.status,
                started_at=c.started_at,
                last_message_at=c.last_message_at,
                message_count=count,
                last_message=msgs[0].content[:90] if msgs else "",
            )
        )

    hour = datetime.now(timezone.utc).hour
    greeting = "Selamat pagi" if hour < 11 else "Selamat siang" if hour < 15 else "Selamat sore" if hour < 19 else "Selamat malam"

    return OverviewOut(
        greeting=f"{greeting}, {user_name.split()[0] if user_name else 'Admin'}",
        agents_live=agents_live,
        agents_total=len(agent_rows),
        tasks_now=live_now,
        conversations_today=conv_today,
        conversations_done=conv_done,
        conversations_todo=max(conv_today - conv_done, 0),
        messages_today=msg_today,
        resolution_rate=(conv_done / conv_today * 100) if conv_today else 0.0,
        avg_response_s=round(avg_ms / 1000, 1),
        csat=round(csat, 1),
        time_saved_h=round(msg_today * 0.07, 1),
        activity=activity,
        recent_conversations=conv_outs,
        week_series=week,
    )


async def agent_analytics(db: AsyncSession, agent_id: str) -> AgentAnalyticsOut:
    convs = (
        await db.execute(select(Conversation).where(Conversation.agent_id == agent_id))
    ).scalars().all()
    conv_ids = [c.id for c in convs]
    msgs: list[Message] = []
    if conv_ids:
        msgs = (
            await db.execute(
                select(Message).where(Message.conversation_id.in_(conv_ids)).order_by(Message.created_at)
            )
        ).scalars().all()

    resolved = sum(1 for c in convs if c.status == "resolved")
    resolution = (resolved / len(convs) * 100) if convs else 0.0

    fb = (
        await db.execute(
            select(Feedback.rating).where(Feedback.conversation_id.in_(conv_ids or ["-"]))
        )
    ).scalars().all()
    up = sum(1 for r in fb if r == "up")
    down = sum(1 for r in fb if r == "down")
    csat = (up / (up + down) * 100) if (up + down) else 0.0

    lat = [m.latency_ms for m in msgs if m.role == "assistant" and m.latency_ms]
    avg_latency = (sum(lat) / len(lat) / 1000) if lat else 0.0

    # series 14 hari
    series = []
    for i in range(13, -1, -1):
        start, end = _day_start(i), _day_start(i - 1)
        c = sum(1 for c_ in convs if start <= _aware(c_.started_at) < end)
        m = sum(1 for m_ in msgs if start <= _aware(m_.created_at) < end)
        series.append({"date": start.strftime("%Y-%m-%d"), "conversations": c, "messages": m})

    by_channel: dict[str, int] = {}
    for c in convs:
        by_channel[c.channel] = by_channel.get(c.channel, 0) + 1

    hours = [0] * 24
    for m in msgs:
        hours[_aware(m.created_at).hour] += 1
    busiest = max(range(24), key=lambda h: hours[h]) if any(hours) else 0

    src_hits: dict[str, int] = {}
    engine_split: dict[str, int] = {}
    for m in msgs:
        if m.role != "assistant":
            continue
        engine_split[m.engine] = engine_split.get(m.engine, 0) + 1
        for s in m.sources or []:
            title = s.get("title", "Dokumen")
            src_hits[title] = src_hits.get(title, 0) + 1
    top_sources = sorted(
        ({"title": t, "hits": h} for t, h in src_hits.items()), key=lambda x: -x["hits"]
    )[:5]

    return AgentAnalyticsOut(
        conversations_total=len(convs),
        messages_total=len(msgs),
        resolution_rate=round(resolution, 1),
        csat=round(csat, 1),
        avg_latency_s=round(avg_latency, 1),
        busiest_hour=busiest,
        series=series,
        by_channel=by_channel,
        hour_histogram=hours,
        top_sources=top_sources,
        feedback={"up": up, "down": down},
        engine_split=engine_split,
    )
