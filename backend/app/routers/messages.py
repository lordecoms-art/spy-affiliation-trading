import asyncio
import json
import logging
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db, SessionLocal
from app.models.channel import Channel
from app.models.message import Message
from app.services.telegram_client import telegram_scraper

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/messages", tags=["messages"])


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

    # Determine the channel identifier for Telegram
    channel_identifier = channel.username or str(channel.telegram_id)

    # Find the highest telegram_message_id already scraped for this channel
    last_message = (
        db.query(Message)
        .filter(Message.channel_id == channel_id)
        .order_by(Message.telegram_message_id.desc())
        .first()
    )
    min_id = last_message.telegram_message_id if last_message else 0

    # Fetch messages from Telegram
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
        # Check if message already exists
        existing = (
            db.query(Message)
            .filter(
                Message.channel_id == channel_id,
                Message.telegram_message_id == msg_data["telegram_message_id"],
            )
            .first()
        )

        if existing:
            # Update engagement metrics
            existing.views_count = msg_data.get("views_count", existing.views_count)
            existing.forwards_count = msg_data.get(
                "forwards_count", existing.forwards_count
            )
            existing.replies_count = msg_data.get(
                "replies_count", existing.replies_count
            )
            existing.reactions_count = msg_data.get(
                "reactions_count", existing.reactions_count
            )
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
    db: Session = Depends(get_db),
) -> dict:
    """Scrape messages from all approved channels in background."""
    approved = (
        db.query(Channel)
        .filter(Channel.status == "approved")
        .all()
    )
    if not approved:
        return {"status": "no_channels", "channels_queued": 0}

    background_tasks.add_task(_scrape_all_bg, [ch.id for ch in approved])
    return {"status": "started", "channels_queued": len(approved)}


def _scrape_all_bg(channel_ids: list) -> None:
    """Background task: scrape messages from all given channels."""
    import shutil
    from app.services.telegram_client import TelegramScraper

    # Use a separate session file for background scraping
    from app.config import settings as cfg
    src_session = f"{cfg.TELEGRAM_SESSION_NAME}.session"
    bg_name = f"{cfg.TELEGRAM_SESSION_NAME}_scrape"
    bg_session = f"{bg_name}.session"
    try:
        shutil.copy2(src_session, bg_session)
    except Exception as e:
        logger.error(f"Failed to copy session for background scrape: {e}")
        return

    db = SessionLocal()
    scraper = TelegramScraper(session_name=bg_name)

    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(_scrape_channels_async(scraper, channel_ids, db))
    except Exception as e:
        logger.error(f"Background scrape failed: {e}")
    finally:
        loop.run_until_complete(scraper.disconnect())
        loop.close()
        db.close()


async def _scrape_channels_async(scraper, channel_ids: list, db) -> None:
    """Async helper: scrape messages for each channel."""
    connected = await scraper.connect()
    if not connected:
        logger.error("Cannot scrape: Telegram not connected.")
        return

    # Populate entity cache
    try:
        await scraper.client.get_dialogs(limit=200)
    except Exception as e:
        logger.warning(f"Failed to pre-load dialogs: {e}")

    total_new = 0
    for ch_id in channel_ids:
        channel = db.query(Channel).filter(Channel.id == ch_id).first()
        if not channel:
            continue

        identifier = channel.username or str(channel.telegram_id)
        last_msg = (
            db.query(Message)
            .filter(Message.channel_id == ch_id)
            .order_by(Message.telegram_message_id.desc())
            .first()
        )
        min_id = last_msg.telegram_message_id if last_msg else 0

        try:
            raw = await scraper.get_channel_messages(
                channel_identifier=identifier,
                limit=100,
                min_id=min_id,
            )
            new_count = 0
            for msg_data in raw:
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
                    new_count += 1

            db.commit()
            total_new += new_count
            logger.info(f"Scraped {channel.title}: {new_count} new / {len(raw)} total")
        except Exception as e:
            logger.error(f"Failed to scrape {channel.title}: {e}")

        await asyncio.sleep(2)

    logger.info(f"Background scrape complete: {total_new} new messages across {len(channel_ids)} channels.")
