import asyncio
import logging
import shutil
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, extract
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db, SessionLocal
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


@router.get("/heatmap")
def get_posting_heatmap(
    db: Session = Depends(get_db),
) -> dict:
    """Get posting time heatmap data: day of week x hour.

    Returns engagement averages for all tracked channels.
    """
    rows = (
        db.query(
            extract("dow", Message.posted_at).label("dow"),
            extract("hour", Message.posted_at).label("hour"),
            func.avg(Message.views_count).label("avg_views"),
            func.count(Message.id).label("count"),
        )
        .filter(Message.posted_at.isnot(None))
        .group_by(
            extract("dow", Message.posted_at),
            extract("hour", Message.posted_at),
        )
        .all()
    )

    heatmap = []
    for r in rows:
        heatmap.append({
            "day": int(r.dow) if r.dow is not None else 0,
            "hour": int(r.hour) if r.hour is not None else 0,
            "avg_views": round(float(r.avg_views), 0) if r.avg_views else 0,
            "count": r.count,
        })

    # Find best time
    best = max(heatmap, key=lambda x: x["avg_views"]) if heatmap else None
    day_names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

    return {
        "heatmap": heatmap,
        "best_time": {
            "day": day_names[best["day"]] if best else "N/A",
            "hour": best["hour"] if best else 0,
            "avg_views": best["avg_views"] if best else 0,
        } if best else None,
    }


@router.get("/trends")
def get_trends(
    db: Session = Depends(get_db),
) -> dict:
    """Get trending data: top hooks, posting patterns, alerts."""
    from collections import Counter

    # Top hooks across all channels
    all_analyses = (
        db.query(
            MessageAnalysis.hook_type,
            MessageAnalysis.engagement_score,
            Message.channel_id,
            Message.posted_at,
            Message.views_count,
        )
        .join(Message, Message.id == MessageAnalysis.message_id)
        .filter(MessageAnalysis.hook_type.isnot(None))
        .all()
    )

    hook_counter = Counter()
    hook_scores = {}
    for hook, score, ch_id, posted_at, views in all_analyses:
        if hook and hook != "none":
            hook_counter[hook] += 1
            if hook not in hook_scores:
                hook_scores[hook] = []
            if score is not None:
                hook_scores[hook].append(score)

    top_hooks = [
        {
            "type": h,
            "count": c,
            "avg_engagement": round(
                sum(hook_scores.get(h, [0])) / max(len(hook_scores.get(h, [1])), 1), 2
            ),
        }
        for h, c in hook_counter.most_common(10)
    ]

    # Best posting hours globally
    hour_data = (
        db.query(
            extract("hour", Message.posted_at).label("hour"),
            func.avg(Message.views_count).label("avg_views"),
            func.count(Message.id).label("count"),
        )
        .filter(Message.posted_at.isnot(None))
        .group_by(extract("hour", Message.posted_at))
        .order_by(func.avg(Message.views_count).desc())
        .limit(5)
        .all()
    )

    best_hours = [
        {
            "hour": int(h.hour) if h.hour is not None else 0,
            "avg_views": round(float(h.avg_views), 0) if h.avg_views else 0,
            "count": h.count,
        }
        for h in hour_data
    ]

    # Per-channel message count for alerts
    channel_activity = (
        db.query(
            Channel.id,
            Channel.title,
            func.count(Message.id).label("msg_count"),
            func.avg(Message.views_count).label("avg_views"),
        )
        .join(Message, Message.channel_id == Channel.id)
        .filter(Channel.status == "approved")
        .group_by(Channel.id, Channel.title)
        .order_by(func.count(Message.id).desc())
        .all()
    )

    channel_summaries = [
        {
            "channel_id": ca.id,
            "title": ca.title,
            "total_messages": ca.msg_count,
            "avg_views": round(float(ca.avg_views), 0) if ca.avg_views else 0,
        }
        for ca in channel_activity
    ]

    return {
        "top_hooks": top_hooks,
        "best_hours": best_hours,
        "channel_summaries": channel_summaries,
    }


@router.get("/growth")
def get_channels_growth(
    db: Session = Depends(get_db),
) -> List[dict]:
    """Get subscriber growth data for all approved channels.

    Returns 24h, 7d, 30d growth (absolute + percentage) and sparkline data.
    """
    channels = (
        db.query(Channel)
        .filter(Channel.status == "approved")
        .all()
    )

    now = datetime.utcnow()
    results = []

    for channel in channels:
        # Get last 30 daily snapshots
        snapshots = (
            db.query(ChannelStats)
            .filter(ChannelStats.channel_id == channel.id)
            .order_by(ChannelStats.recorded_at.desc())
            .limit(30)
            .all()
        )

        current_subs = channel.subscribers_count or 0
        sparkline = []
        growth_24h = 0
        growth_24h_pct = 0.0
        growth_7d = 0
        growth_7d_pct = 0.0
        growth_30d = 0
        growth_30d_pct = 0.0

        if snapshots:
            # Latest snapshot is the most recent
            current_subs = snapshots[0].subscribers_count or current_subs

            # Build sparkline (oldest to newest)
            sparkline = [s.subscribers_count for s in reversed(snapshots)]

            # Helper: compute growth vs a reference snapshot
            def _growth_vs(ref_snap):
                ref_subs = ref_snap.subscribers_count or 0
                diff = current_subs - ref_subs
                pct = round(diff / ref_subs * 100, 2) if ref_subs > 0 else 0.0
                return diff, pct

            # Find snapshots closest to 1 day, 7 days, 30 days ago
            for s in snapshots[1:]:  # skip the latest (index 0)
                age = (now - s.recorded_at).total_seconds() / 86400  # days

                if age >= 0.8 and growth_24h == 0:
                    growth_24h, growth_24h_pct = _growth_vs(s)

                if age >= 6.5 and growth_7d == 0:
                    growth_7d, growth_7d_pct = _growth_vs(s)

                if age >= 29 and growth_30d == 0:
                    growth_30d, growth_30d_pct = _growth_vs(s)

            # If we have >=2 snapshots but no time-based match yet,
            # use oldest available as reference for all missing periods
            if len(snapshots) >= 2:
                oldest = snapshots[-1]
                if growth_24h == 0 and growth_24h_pct == 0.0:
                    growth_24h, growth_24h_pct = _growth_vs(oldest)
                if growth_7d == 0 and growth_7d_pct == 0.0:
                    growth_7d, growth_7d_pct = _growth_vs(oldest)
                if growth_30d == 0 and growth_30d_pct == 0.0:
                    growth_30d, growth_30d_pct = _growth_vs(oldest)

        # Average daily gain/loss over 30 days
        avg_daily_30d = round(growth_30d / 30) if growth_30d != 0 else 0

        # Date of first snapshot for this channel
        first_snapshot_date = None
        if snapshots:
            first_snapshot_date = snapshots[-1].recorded_at.strftime("%Y-%m-%d")

        results.append({
            "channel_id": channel.id,
            "title": channel.title,
            "username": channel.username,
            "photo_url": channel.photo_url,
            "subscribers_count": current_subs,
            "growth_24h": growth_24h,
            "growth_24h_pct": growth_24h_pct,
            "growth_7d": growth_7d,
            "growth_7d_pct": growth_7d_pct,
            "growth_30d": growth_30d,
            "growth_30d_pct": growth_30d_pct,
            "avg_daily_30d": avg_daily_30d,
            "sparkline": sparkline,
            "snapshots_count": len(snapshots),
            "first_snapshot": first_snapshot_date,
        })

    return results


@router.post("/snapshot-all")
def trigger_snapshot_all(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> dict:
    """Trigger immediate stats snapshot for ALL approved channels.

    Fetches live subscriber counts from Telegram for each channel.
    Runs in background to avoid timeout.
    """
    approved = (
        db.query(Channel)
        .filter(Channel.status == "approved")
        .all()
    )

    if not approved:
        return {"status": "no_channels", "channels_queued": 0}

    channel_data = [
        (ch.id, ch.title, ch.username, ch.telegram_id)
        for ch in approved
    ]

    background_tasks.add_task(_snapshot_all_bg, channel_data)

    return {
        "status": "started",
        "channels_queued": len(channel_data),
    }


def _snapshot_all_bg(channel_data: list) -> None:
    """Background task: snapshot all channels with live Telegram data."""
    from app.services.telegram_client import TelegramScraper

    src_session = f"{settings.TELEGRAM_SESSION_NAME}.session"
    bg_name = f"{settings.TELEGRAM_SESSION_NAME}_snap"
    bg_session = f"{bg_name}.session"
    try:
        shutil.copy2(src_session, bg_session)
    except Exception as e:
        logger.error(f"Failed to copy session for snapshot: {e}")
        return

    scraper = TelegramScraper(session_name=bg_name)
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(
            _snapshot_channels_async(scraper, channel_data)
        )
    except Exception as e:
        logger.error(f"Snapshot-all failed: {e}")
    finally:
        try:
            loop.run_until_complete(scraper.disconnect())
        except Exception:
            pass
        loop.close()

    logger.info("Snapshot-all completed.")


async def _snapshot_channels_async(scraper, channel_data: list) -> None:
    """Async: fetch live stats and record snapshot for each channel."""
    connected = await scraper.connect()
    if not connected:
        logger.error("Cannot connect to Telegram for snapshot.")
        return

    try:
        await scraper.client.get_dialogs(limit=200)
    except Exception:
        pass

    db = SessionLocal()
    try:
        for ch_id, ch_title, ch_username, ch_telegram_id in channel_data:
            try:
                live_subscribers = 0
                try:
                    data = await scraper.enrich_channel(ch_telegram_id)
                    if data:
                        live_subscribers = data.get("subscribers_count", 0)
                        channel = db.query(Channel).filter(Channel.id == ch_id).first()
                        if channel and live_subscribers > 0:
                            channel.subscribers_count = live_subscribers
                except Exception as e:
                    logger.warning(f"Could not fetch live stats for {ch_title}: {e}")
                    channel = db.query(Channel).filter(Channel.id == ch_id).first()
                    live_subscribers = channel.subscribers_count if channel else 0

                # Posts in last 24h
                yesterday = datetime.utcnow() - timedelta(days=1)
                posts_24h = (
                    db.query(func.count(Message.id))
                    .filter(Message.channel_id == ch_id, Message.posted_at >= yesterday)
                    .scalar() or 0
                )
                avg_views_24h = (
                    db.query(func.avg(Message.views_count))
                    .filter(Message.channel_id == ch_id, Message.posted_at >= yesterday)
                    .scalar()
                )
                avg_views_24h = round(float(avg_views_24h), 2) if avg_views_24h else 0.0

                stats = ChannelStats(
                    channel_id=ch_id,
                    subscribers_count=live_subscribers,
                    posts_count=posts_24h,
                    avg_views=avg_views_24h,
                    recorded_at=datetime.utcnow(),
                )
                db.add(stats)
                logger.info(
                    f"Snapshot: {ch_title} = {live_subscribers} subscribers"
                )
            except Exception as e:
                logger.error(f"Snapshot error for {ch_title}: {e}")

            await asyncio.sleep(2)

        db.commit()
    except Exception as e:
        logger.error(f"Snapshot-all DB error: {e}")
        db.rollback()
    finally:
        db.close()
