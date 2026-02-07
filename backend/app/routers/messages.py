import asyncio
import json
import logging
import shutil
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import exists
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db, SessionLocal
from app.models.channel import Channel
from app.models.message import Message
from app.models.analysis import MessageAnalysis
from app.services.telegram_client import TelegramScraper, telegram_scraper
from app.services.analyzer import message_analyzer

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/messages", tags=["messages"])

# ---- In-memory scrape progress tracking ----

_scrape_progress: Dict[str, Any] = {
    "status": "idle",  # idle | in_progress | done | error
    "started_at": None,
    "finished_at": None,
    "since_date": None,
    "channels_total": 0,
    "channels_done": 0,
    "current_channel": None,
    "channels": {},  # channel_id -> {title, status, messages_scraped, new, updated}
    "total_new": 0,
    "total_updated": 0,
    "total_scraped": 0,
    "error": None,
    "auto_analysis": {
        "status": "idle",
        "analyzed": 0,
        "errors": 0,
        "total_queued": 0,
    },
}


# ---- Pydantic Schemas ----


class MessageResponse(BaseModel):
    id: int
    channel_id: int
    telegram_message_id: int
    content_type: Optional[str]
    text_content: Optional[str]
    media_url: Optional[str]
    voice_duration: Optional[int]
    voice_transcription: Optional[str]
    views_count: int
    forwards_count: int
    replies_count: int
    reactions_count: int
    external_links: Optional[str]
    has_cta: bool
    cta_text: Optional[str]
    cta_link: Optional[str]
    posted_at: Optional[datetime]
    scraped_at: Optional[datetime]

    class Config:
        from_attributes = True


class ScrapeResultResponse(BaseModel):
    channel_id: int
    channel_title: str
    messages_scraped: int
    new_messages: int
    updated_messages: int


class ScrapeAllResponse(BaseModel):
    status: str
    channels_queued: int
    since_date: str


# ---- Endpoints ----


@router.get("/", response_model=List[MessageResponse])
def list_messages(
    channel_id: Optional[int] = Query(None, description="Filter by channel ID"),
    content_type: Optional[str] = Query(None, description="Filter by content type"),
    has_cta: Optional[bool] = Query(None, description="Filter by CTA presence"),
    date_from: Optional[datetime] = Query(None, description="Start date filter"),
    date_to: Optional[datetime] = Query(None, description="End date filter"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
) -> List[Message]:
    """List messages with optional filters."""
    query = db.query(Message)

    if channel_id is not None:
        query = query.filter(Message.channel_id == channel_id)

    if content_type is not None:
        valid_types = ("text", "photo", "video", "voice", "document", "sticker")
        if content_type not in valid_types:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid content_type. Must be one of: {', '.join(valid_types)}",
            )
        query = query.filter(Message.content_type == content_type)

    if has_cta is not None:
        query = query.filter(Message.has_cta == has_cta)

    if date_from is not None:
        query = query.filter(Message.posted_at >= date_from)

    if date_to is not None:
        query = query.filter(Message.posted_at <= date_to)

    messages = (
        query.order_by(Message.posted_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return messages


@router.get("/scrape-status")
def get_scrape_status() -> dict:
    """Get real-time scraping progress."""
    return _scrape_progress


@router.get("/{message_id}", response_model=MessageResponse)
def get_message(
    message_id: int,
    db: Session = Depends(get_db),
) -> Message:
    """Get a single message by ID."""
    message = db.query(Message).filter(Message.id == message_id).first()
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    return message


@router.post("/scrape/{channel_id}", response_model=ScrapeResultResponse)
def scrape_channel_messages(
    channel_id: int,
    db: Session = Depends(get_db),
) -> dict:
    """Trigger message scraping for a specific channel."""
    channel = db.query(Channel).filter(Channel.id == channel_id).first()
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    if channel.status != "approved":
        raise HTTPException(
            status_code=400,
            detail=f"Channel must be approved before scraping. Current status: {channel.status}",
        )

    channel_identifier = channel.username or str(channel.telegram_id)

    last_message = (
        db.query(Message)
        .filter(Message.channel_id == channel_id)
        .order_by(Message.telegram_message_id.desc())
        .first()
    )
    min_id = last_message.telegram_message_id if last_message else 0

    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            raw_messages = loop.run_until_complete(
                telegram_scraper.get_channel_messages(
                    channel_identifier=channel_identifier,
                    limit=settings.MAX_MESSAGES_PER_SCRAPE,
                    min_id=min_id,
                )
            )
        finally:
            loop.close()
    except Exception as e:
        logger.error(f"Telegram scrape failed for channel {channel_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to scrape messages from Telegram: {str(e)}",
        )

    new_count = 0
    updated_count = 0

    for msg_data in raw_messages:
        existing = (
            db.query(Message)
            .filter(
                Message.channel_id == channel_id,
                Message.telegram_message_id == msg_data["telegram_message_id"],
            )
            .first()
        )

        if existing:
            existing.views_count = msg_data.get("views_count", existing.views_count)
            existing.forwards_count = msg_data.get("forwards_count", existing.forwards_count)
            existing.replies_count = msg_data.get("replies_count", existing.replies_count)
            existing.reactions_count = msg_data.get("reactions_count", existing.reactions_count)
            updated_count += 1
        else:
            message = Message(
                channel_id=channel_id,
                telegram_message_id=msg_data["telegram_message_id"],
                content_type=msg_data.get("content_type", "text"),
                text_content=msg_data.get("text_content"),
                media_url=msg_data.get("media_url"),
                voice_duration=msg_data.get("voice_duration"),
                views_count=msg_data.get("views_count", 0),
                forwards_count=msg_data.get("forwards_count", 0),
                replies_count=msg_data.get("replies_count", 0),
                reactions_count=msg_data.get("reactions_count", 0),
                external_links=msg_data.get("external_links"),
                has_cta=msg_data.get("has_cta", False),
                cta_text=msg_data.get("cta_text"),
                cta_link=msg_data.get("cta_link"),
                posted_at=msg_data.get("posted_at"),
                scraped_at=datetime.utcnow(),
            )
            db.add(message)
            new_count += 1

    db.commit()

    logger.info(
        f"Scrape complete for channel {channel.title}: "
        f"{new_count} new, {updated_count} updated messages."
    )

    return {
        "channel_id": channel_id,
        "channel_title": channel.title,
        "messages_scraped": len(raw_messages),
        "new_messages": new_count,
        "updated_messages": updated_count,
    }


@router.post("/scrape-all", response_model=ScrapeAllResponse)
def scrape_all_channels(
    background_tasks: BackgroundTasks,
    since_date: str = Query("2026-01-01", description="Scrape messages since this date (YYYY-MM-DD)"),
    auto_analyze: bool = Query(True, description="Auto-run AI analysis on new messages after scraping"),
    db: Session = Depends(get_db),
) -> dict:
    """Scrape ALL messages from all approved channels since a given date.

    Uses iter_messages for unlimited pagination with batch processing.
    Progress is tracked in real-time via GET /api/messages/scrape-status.
    """
    global _scrape_progress

    if _scrape_progress["status"] == "in_progress":
        return {
            "status": "already_running",
            "channels_queued": _scrape_progress["channels_total"],
            "since_date": _scrape_progress["since_date"],
        }

    approved = (
        db.query(Channel)
        .filter(Channel.status == "approved")
        .all()
    )
    if not approved:
        return {"status": "no_channels", "channels_queued": 0, "since_date": since_date}

    # Parse since_date
    try:
        since_dt = datetime.strptime(since_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid since_date format. Use YYYY-MM-DD.")

    # Reset progress
    _scrape_progress = {
        "status": "in_progress",
        "started_at": datetime.utcnow().isoformat(),
        "finished_at": None,
        "since_date": since_date,
        "channels_total": len(approved),
        "channels_done": 0,
        "current_channel": None,
        "channels": {
            str(ch.id): {
                "title": ch.title,
                "status": "pending",
                "messages_scraped": 0,
                "new": 0,
                "updated": 0,
            }
            for ch in approved
        },
        "total_new": 0,
        "total_updated": 0,
        "total_scraped": 0,
        "error": None,
        "auto_analysis": {
            "status": "pending" if auto_analyze else "disabled",
            "analyzed": 0,
            "errors": 0,
            "total_queued": 0,
        },
    }

    channel_data = [(ch.id, ch.title, ch.username, ch.telegram_id) for ch in approved]
    background_tasks.add_task(_scrape_all_bg, channel_data, since_dt, auto_analyze)

    return {
        "status": "started",
        "channels_queued": len(approved),
        "since_date": since_date,
    }


def _scrape_all_bg(
    channel_data: List[tuple],
    since_date: datetime,
    auto_analyze: bool,
) -> None:
    """Background task: scrape ALL messages since since_date from all channels."""
    global _scrape_progress

    # Copy session file for background use
    src_session = f"{settings.TELEGRAM_SESSION_NAME}.session"
    bg_name = f"{settings.TELEGRAM_SESSION_NAME}_scrape"
    bg_session = f"{bg_name}.session"
    try:
        shutil.copy2(src_session, bg_session)
    except Exception as e:
        logger.error(f"Failed to copy session for background scrape: {e}")
        _scrape_progress["status"] = "error"
        _scrape_progress["error"] = f"Session copy failed: {e}"
        return

    scraper = TelegramScraper(session_name=bg_name)

    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(
            _scrape_channels_async(scraper, channel_data, since_date)
        )
    except Exception as e:
        logger.error(f"Background scrape failed: {e}")
        _scrape_progress["status"] = "error"
        _scrape_progress["error"] = str(e)
    finally:
        try:
            loop.run_until_complete(scraper.disconnect())
        except Exception:
            pass
        loop.close()

    # Mark scraping as done
    if _scrape_progress["status"] != "error":
        _scrape_progress["status"] = "done"
    _scrape_progress["finished_at"] = datetime.utcnow().isoformat()

    total = _scrape_progress["total_new"]
    updated = _scrape_progress["total_updated"]
    scraped = _scrape_progress["total_scraped"]
    logger.info(
        f"=== SCRAPE COMPLETE === "
        f"Total: {scraped} scraped, {total} new, {updated} updated "
        f"across {len(channel_data)} channels since {since_date.date()}"
    )

    # Auto-trigger AI analysis on new unanalyzed messages
    if auto_analyze and total > 0:
        _run_auto_analysis()


async def _scrape_channels_async(
    scraper: TelegramScraper,
    channel_data: List[tuple],
    since_date: datetime,
) -> None:
    """Async: iterate all channels, scrape ALL messages since since_date."""
    global _scrape_progress

    connected = await scraper.connect()
    if not connected:
        logger.error("Cannot scrape: Telegram not connected.")
        _scrape_progress["status"] = "error"
        _scrape_progress["error"] = "Telegram not connected"
        return

    # Populate entity cache
    try:
        await scraper.client.get_dialogs(limit=200)
    except Exception as e:
        logger.warning(f"Failed to pre-load dialogs: {e}")

    for ch_id, ch_title, ch_username, ch_telegram_id in channel_data:
        ch_key = str(ch_id)
        _scrape_progress["current_channel"] = ch_title
        _scrape_progress["channels"][ch_key]["status"] = "in_progress"

        identifier = ch_username or str(ch_telegram_id)

        ch_new = 0
        ch_updated = 0
        ch_scraped = 0
        batch_num = 0

        try:
            # No min_id: scrape ALL messages since since_date.
            # Deduplication is handled at DB insert time.
            async for batch in scraper.iter_channel_messages_since(
                channel_identifier=identifier,
                since_date=since_date,
                batch_size=50,
            ):
                batch_num += 1
                db = SessionLocal()
                try:
                    for msg_data in batch:
                        existing = (
                            db.query(Message)
                            .filter(
                                Message.channel_id == ch_id,
                                Message.telegram_message_id == msg_data["telegram_message_id"],
                            )
                            .first()
                        )

                        if existing:
                            existing.views_count = msg_data.get("views_count", existing.views_count)
                            existing.forwards_count = msg_data.get("forwards_count", existing.forwards_count)
                            existing.replies_count = msg_data.get("replies_count", existing.replies_count)
                            existing.reactions_count = msg_data.get("reactions_count", existing.reactions_count)
                            ch_updated += 1
                        else:
                            message = Message(
                                channel_id=ch_id,
                                telegram_message_id=msg_data["telegram_message_id"],
                                content_type=msg_data.get("content_type", "text"),
                                text_content=msg_data.get("text_content"),
                                media_url=msg_data.get("media_url"),
                                voice_duration=msg_data.get("voice_duration"),
                                views_count=msg_data.get("views_count", 0),
                                forwards_count=msg_data.get("forwards_count", 0),
                                replies_count=msg_data.get("replies_count", 0),
                                reactions_count=msg_data.get("reactions_count", 0),
                                external_links=msg_data.get("external_links"),
                                has_cta=msg_data.get("has_cta", False),
                                cta_text=msg_data.get("cta_text"),
                                cta_link=msg_data.get("cta_link"),
                                posted_at=msg_data.get("posted_at"),
                                scraped_at=datetime.utcnow(),
                            )
                            db.add(message)
                            ch_new += 1

                        ch_scraped += 1

                    # Commit after each batch of 50
                    db.commit()
                except Exception as e:
                    db.rollback()
                    logger.error(f"DB error for {ch_title} batch {batch_num}: {e}")
                finally:
                    db.close()

                # Update progress
                _scrape_progress["channels"][ch_key]["messages_scraped"] = ch_scraped
                _scrape_progress["channels"][ch_key]["new"] = ch_new
                _scrape_progress["channels"][ch_key]["updated"] = ch_updated

                logger.info(
                    f"Scraped {ch_scraped} messages from {ch_title} (batch {batch_num})"
                )

        except Exception as e:
            logger.error(f"Failed to scrape {ch_title}: {e}")
            _scrape_progress["channels"][ch_key]["status"] = "error"
            continue

        # Channel done
        _scrape_progress["channels"][ch_key]["status"] = "done"
        _scrape_progress["channels_done"] += 1
        _scrape_progress["total_new"] += ch_new
        _scrape_progress["total_updated"] += ch_updated
        _scrape_progress["total_scraped"] += ch_scraped

        logger.info(
            f"Channel {ch_title}: {ch_scraped} messages scraped since {since_date.date()} "
            f"({ch_new} new, {ch_updated} updated)"
        )

        # Small pause between channels
        await asyncio.sleep(2)


def _run_auto_analysis() -> None:
    """Run AI analysis on all unanalyzed messages after scraping."""
    global _scrape_progress
    _scrape_progress["auto_analysis"]["status"] = "in_progress"

    db = SessionLocal()
    try:
        # Find all unanalyzed messages with text content
        unanalyzed = (
            db.query(Message.id)
            .filter(
                Message.text_content.isnot(None),
                Message.text_content != "",
                ~exists().where(MessageAnalysis.message_id == Message.id),
            )
            .order_by(Message.posted_at.desc())
            .all()
        )

        message_ids = [row.id for row in unanalyzed]
        _scrape_progress["auto_analysis"]["total_queued"] = len(message_ids)

        if not message_ids:
            _scrape_progress["auto_analysis"]["status"] = "done"
            logger.info("Auto-analysis: no unanalyzed messages found.")
            return

        logger.info(f"Auto-analysis: {len(message_ids)} messages to analyze")

        analyzed = 0
        errors = 0

        for msg_id in message_ids:
            message = db.query(Message).filter(Message.id == msg_id).first()
            if not message:
                continue

            # Skip if already analyzed (race condition guard)
            existing = (
                db.query(MessageAnalysis)
                .filter(MessageAnalysis.message_id == msg_id)
                .first()
            )
            if existing:
                continue

            text = message.text_content
            if message.content_type == "voice" and message.voice_transcription:
                text = message.voice_transcription

            if not text or not text.strip():
                continue

            try:
                if message.content_type == "voice" and message.voice_transcription:
                    result = message_analyzer.analyze_voice_transcript(
                        transcript=text,
                        duration=message.voice_duration or 0,
                    )
                else:
                    result = message_analyzer.analyze_message(
                        text_content=text,
                        content_type=message.content_type or "text",
                        views_count=message.views_count,
                        forwards_count=message.forwards_count,
                        reactions_count=message.reactions_count,
                        has_cta=message.has_cta,
                        cta_text=message.cta_text,
                        external_links=message.external_links,
                    )

                if result:
                    analysis = MessageAnalysis(
                        message_id=msg_id,
                        hook_type=result.get("hook_type"),
                        cta_type=result.get("cta_type"),
                        tone=result.get("tone"),
                        promises=result.get("promises"),
                        social_proof_elements=result.get("social_proof_elements"),
                        engagement_score=result.get("engagement_score"),
                        virality_potential=result.get("virality_potential"),
                        raw_analysis=result.get("raw_analysis"),
                        analyzed_at=result.get("analyzed_at", datetime.utcnow()),
                    )
                    db.add(analysis)
                    db.commit()
                    analyzed += 1
                    _scrape_progress["auto_analysis"]["analyzed"] = analyzed
                    logger.info(
                        f"Auto-analyzed message {msg_id} ({analyzed}/{len(message_ids)})"
                    )
                else:
                    errors += 1
                    _scrape_progress["auto_analysis"]["errors"] = errors

            except Exception as e:
                logger.error(f"Auto-analysis error for message {msg_id}: {e}")
                errors += 1
                _scrape_progress["auto_analysis"]["errors"] = errors

            # Rate limit between API calls
            time.sleep(1)

    except Exception as e:
        logger.error(f"Auto-analysis failed: {e}")
        _scrape_progress["auto_analysis"]["status"] = "error"
    finally:
        db.close()

    _scrape_progress["auto_analysis"]["status"] = "done"
    logger.info(
        f"=== AUTO-ANALYSIS COMPLETE === "
        f"{analyzed} analyzed, {errors} errors out of {len(message_ids)} queued"
    )
