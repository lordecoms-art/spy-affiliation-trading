import asyncio
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.channel import Channel
from app.models.message import Message
from app.models.stats import ChannelStats
from app.models.analysis import MessageAnalysis
from app.services.telegram_client import telegram_scraper

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/stats", tags=["stats"])


# ---- Pydantic Schemas ----


class OverviewResponse(BaseModel):
    total_channels: int
    approved_channels: int
    pending_channels: int
    total_messages: int
    analyzed_messages: int
    total_stats_snapshots: int
    messages_with_cta: int


class ChannelStatsResponse(BaseModel):
    id: int
    channel_id: int
    subscribers_count: int
    photos_count: int
    videos_count: int
    files_count: int
    links_count: int
    recorded_at: Optional[datetime]

    class Config:
        from_attributes = True


class TopChannelResponse(BaseModel):
    channel_id: int
    title: str
    username: Optional[str]
    status: str
    total_messages: int
    total_views: int
    total_forwards: int
    total_reactions: int
    latest_subscribers: int
    avg_engagement: float


class SnapshotResultResponse(BaseModel):
    channel_id: int
    channel_title: str
    subscribers_count: int
    snapshot_recorded: bool


# ---- Endpoints ----


@router.get("/overview", response_model=OverviewResponse)
def get_overview(
    db: Session = Depends(get_db),
) -> dict:
    """Get global statistics overview."""
    total_channels = db.query(func.count(Channel.id)).scalar() or 0
    approved_channels = (
        db.query(func.count(Channel.id))
        .filter(Channel.status == "approved")
        .scalar()
        or 0
    )
    pending_channels = (
        db.query(func.count(Channel.id))
        .filter(Channel.status == "pending")
        .scalar()
        or 0
    )
    total_messages = db.query(func.count(Message.id)).scalar() or 0
    analyzed_messages = db.query(func.count(MessageAnalysis.id)).scalar() or 0
    total_stats_snapshots = db.query(func.count(ChannelStats.id)).scalar() or 0
    messages_with_cta = (
        db.query(func.count(MessageAnalysis.id))
        .filter(
            MessageAnalysis.cta_type.isnot(None),
            MessageAnalysis.cta_type != "none",
            MessageAnalysis.cta_type != "",
        )
        .scalar()
        or 0
    )

    return {
        "total_channels": total_channels,
        "approved_channels": approved_channels,
        "pending_channels": pending_channels,
        "total_messages": total_messages,
        "analyzed_messages": analyzed_messages,
        "total_stats_snapshots": total_stats_snapshots,
        "messages_with_cta": messages_with_cta,
    }


@router.get("/channel/{channel_id}", response_model=List[ChannelStatsResponse])
def get_channel_stats(
    channel_id: int,
    limit: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
) -> List[ChannelStats]:
    """Get stats history for a specific channel."""
    channel = db.query(Channel).filter(Channel.id == channel_id).first()
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    stats = (
        db.query(ChannelStats)
        .filter(ChannelStats.channel_id == channel_id)
        .order_by(ChannelStats.recorded_at.desc())
        .limit(limit)
        .all()
    )
    return stats


@router.get("/top-channels", response_model=List[TopChannelResponse])
def get_top_channels(
    sort_by: str = Query(
        "total_views",
        description="Sort by: total_views, total_forwards, total_reactions, total_messages",
    ),
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
) -> List[dict]:
    """Get top channels ranked by engagement metrics."""
    # Query channels with aggregated message stats
    results = (
        db.query(
            Channel.id.label("channel_id"),
            Channel.title,
            Channel.username,
            Channel.status,
            func.count(Message.id).label("total_messages"),
            func.coalesce(func.sum(Message.views_count), 0).label("total_views"),
            func.coalesce(func.sum(Message.forwards_count), 0).label(
                "total_forwards"
            ),
            func.coalesce(func.sum(Message.reactions_count), 0).label(
                "total_reactions"
            ),
        )
        .outerjoin(Message, Message.channel_id == Channel.id)
        .filter(Channel.status == "approved")
        .group_by(Channel.id, Channel.title, Channel.username, Channel.status)
    )

    # Apply sorting
    sort_column_map = {
        "total_views": "total_views",
        "total_forwards": "total_forwards",
        "total_reactions": "total_reactions",
        "total_messages": "total_messages",
    }

    if sort_by not in sort_column_map:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid sort_by. Must be one of: {', '.join(sort_column_map.keys())}",
        )

    results = results.order_by(func.coalesce(func.sum(
        getattr(Message, sort_by.replace("total_", "") + "_count")
        if sort_by != "total_messages"
        else Message.id
    ), 0).desc())

    rows = results.limit(limit).all()

    top_channels: List[dict] = []
    for row in rows:
        # Get latest subscriber count from stats
        latest_stats = (
            db.query(ChannelStats)
            .filter(ChannelStats.channel_id == row.channel_id)
            .order_by(ChannelStats.recorded_at.desc())
            .first()
        )
        subscribers = latest_stats.subscribers_count if latest_stats else 0

        total_msgs = row.total_messages or 0
        total_views = row.total_views or 0
        avg_engagement = (
            round(total_views / total_msgs, 2) if total_msgs > 0 else 0.0
        )

        top_channels.append(
            {
                "channel_id": row.channel_id,
                "title": row.title,
                "username": row.username,
                "status": row.status,
                "total_messages": total_msgs,
                "total_views": total_views,
                "total_forwards": row.total_forwards or 0,
                "total_reactions": row.total_reactions or 0,
                "latest_subscribers": subscribers,
                "avg_engagement": avg_engagement,
            }
        )

    return top_channels


@router.post("/snapshot/{channel_id}", response_model=SnapshotResultResponse)
def trigger_stats_snapshot(
    channel_id: int,
    db: Session = Depends(get_db),
) -> dict:
    """Trigger a manual stats snapshot for a channel."""
    channel = db.query(Channel).filter(Channel.id == channel_id).first()
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    channel_identifier = channel.username or str(channel.telegram_id)

    # Try to fetch live stats from Telegram
    subscribers_count = 0
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            info = loop.run_until_complete(
                telegram_scraper.get_channel_info(channel_identifier)
            )
        finally:
            loop.close()

        if info:
            subscribers_count = info.get("subscribers_count", 0)
    except Exception as e:
        logger.warning(
            f"Could not fetch live stats for channel {channel_id}: {e}"
        )

    # Count media types from messages
    photos_count = (
        db.query(func.count(Message.id))
        .filter(
            Message.channel_id == channel_id,
            Message.content_type == "photo",
        )
        .scalar()
        or 0
    )
    videos_count = (
        db.query(func.count(Message.id))
        .filter(
            Message.channel_id == channel_id,
            Message.content_type == "video",
        )
        .scalar()
        or 0
    )
    files_count = (
        db.query(func.count(Message.id))
        .filter(
            Message.channel_id == channel_id,
            Message.content_type == "document",
        )
        .scalar()
        or 0
    )

    # Count messages with external links
    from sqlalchemy import and_

    links_count = (
        db.query(func.count(Message.id))
        .filter(
            Message.channel_id == channel_id,
            Message.external_links.isnot(None),
            Message.external_links != "",
        )
        .scalar()
        or 0
    )

    stats = ChannelStats(
        channel_id=channel_id,
        subscribers_count=subscribers_count,
        photos_count=photos_count,
        videos_count=videos_count,
        files_count=files_count,
        links_count=links_count,
        recorded_at=datetime.utcnow(),
    )
    db.add(stats)
    db.commit()

    logger.info(
        f"Stats snapshot recorded for channel {channel.title} "
        f"(subscribers: {subscribers_count})"
    )

    return {
        "channel_id": channel_id,
        "channel_title": channel.title,
        "subscribers_count": subscribers_count,
        "snapshot_recorded": True,
    }
