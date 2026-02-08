import asyncio
import logging
import shutil
from datetime import datetime

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import func

from app.config import settings
from app.database import SessionLocal
from app.models.channel import Channel
from app.models.message import Message
from app.models.stats import ChannelStats

logger = logging.getLogger(__name__)

scheduler = BackgroundScheduler()


def scrape_approved_channels() -> None:
    """Scrape messages from all approved channels."""
    logger.info(
        f"[Scheduler] Starting scrape of approved channels at {datetime.utcnow()}"
    )

    db = SessionLocal()
    try:
        approved_channels = (
            db.query(Channel)
            .filter(Channel.status == "approved")
            .all()
        )

        if not approved_channels:
            logger.info("[Scheduler] No approved channels to scrape.")
            return

        logger.info(
            f"[Scheduler] Found {len(approved_channels)} approved channels."
        )

        channel_ids = [ch.id for ch in approved_channels]

    except Exception as e:
        logger.error(f"[Scheduler] Error in scrape_approved_channels: {e}")
        return
    finally:
        db.close()

    # Run async scraping in a fresh event loop
    from app.services.telegram_client import TelegramScraper

    src_session = f"{settings.TELEGRAM_SESSION_NAME}.session"
    bg_name = f"{settings.TELEGRAM_SESSION_NAME}_sched"
    bg_session = f"{bg_name}.session"
    try:
        shutil.copy2(src_session, bg_session)
    except Exception as e:
        logger.error(f"[Scheduler] Failed to copy session file: {e}")
        return

    scraper = TelegramScraper(session_name=bg_name)
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(
            _scrape_channels_scheduled(scraper, channel_ids)
        )
    except Exception as e:
        logger.error(f"[Scheduler] Scrape failed: {e}")
    finally:
        loop.run_until_complete(scraper.disconnect())
        loop.close()

    logger.info("[Scheduler] Scrape cycle completed.")


async def _scrape_channels_scheduled(scraper, channel_ids: list) -> None:
    """Async scraping for scheduler."""
    connected = await scraper.connect()
    if not connected:
        logger.error("[Scheduler] Cannot connect to Telegram.")
        return

    try:
        await scraper.client.get_dialogs(limit=200)
    except Exception:
        pass

    db = SessionLocal()
    total_new = 0
    try:
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
                    limit=settings.MAX_MESSAGES_PER_SCRAPE,
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
                logger.info(
                    f"[Scheduler] Scraped {channel.title}: "
                    f"{new_count} new / {len(raw)} total"
                )
            except Exception as e:
                logger.error(f"[Scheduler] Error scraping {channel.title}: {e}")

            await asyncio.sleep(2)
    finally:
        db.close()

    logger.info(f"[Scheduler] Total new messages: {total_new}")


def record_channel_stats() -> None:
    """Record daily stats snapshot for all approved channels.

    Fetches LIVE subscriber counts from Telegram via GetFullChannelRequest
    before recording, so we get actual daily evolution data.
    """
    logger.info(
        f"[Scheduler] Recording channel stats at {datetime.utcnow()}"
    )

    db = SessionLocal()
    try:
        approved_channels = (
            db.query(Channel)
            .filter(Channel.status == "approved")
            .all()
        )

        if not approved_channels:
            logger.info("[Scheduler] No approved channels for stats recording.")
            return

        logger.info(
            f"[Scheduler] Recording stats for {len(approved_channels)} channels."
        )

        channel_data = [
            (ch.id, ch.title, ch.username, ch.telegram_id)
            for ch in approved_channels
        ]

    except Exception as e:
        logger.error(f"[Scheduler] Error in record_channel_stats: {e}")
        return
    finally:
        db.close()

    # Use a separate Telegram client to fetch live subscriber counts
    from app.services.telegram_client import TelegramScraper

    src_session = f"{settings.TELEGRAM_SESSION_NAME}.session"
    bg_name = f"{settings.TELEGRAM_SESSION_NAME}_stats"
    bg_session = f"{bg_name}.session"
    try:
        shutil.copy2(src_session, bg_session)
    except Exception as e:
        logger.error(f"[Scheduler] Failed to copy session for stats: {e}")
        return

    scraper = TelegramScraper(session_name=bg_name)
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(
            _record_stats_with_telegram(scraper, channel_data)
        )
    except Exception as e:
        logger.error(f"[Scheduler] Stats recording failed: {e}")
    finally:
        try:
            loop.run_until_complete(scraper.disconnect())
        except Exception:
            pass
        loop.close()

    logger.info("[Scheduler] Stats recording completed.")


async def _record_stats_with_telegram(scraper, channel_data: list) -> None:
    """Fetch live subscriber counts from Telegram and record daily snapshots."""
    from datetime import timedelta
    from sqlalchemy import func

    connected = await scraper.connect()
    if not connected:
        logger.error("[Scheduler] Cannot connect to Telegram for stats.")
        return

    try:
        await scraper.client.get_dialogs(limit=200)
    except Exception:
        pass

    db = SessionLocal()
    try:
        for ch_id, ch_title, ch_username, ch_telegram_id in channel_data:
            try:
                # Fetch LIVE subscriber count from Telegram
                live_subscribers = 0
                try:
                    data = await scraper.enrich_channel(ch_telegram_id)
                    if data:
                        live_subscribers = data.get("subscribers_count", 0)
                        # Update the channel record with fresh count
                        channel = db.query(Channel).filter(Channel.id == ch_id).first()
                        if channel and live_subscribers > 0:
                            channel.subscribers_count = live_subscribers
                except Exception as e:
                    logger.warning(
                        f"[Scheduler] Could not fetch live stats for {ch_title}: {e}"
                    )
                    channel = db.query(Channel).filter(Channel.id == ch_id).first()
                    live_subscribers = channel.subscribers_count if channel else 0

                # Count messages posted in last 24h
                yesterday = datetime.utcnow() - timedelta(days=1)
                posts_24h = (
                    db.query(func.count(Message.id))
                    .filter(
                        Message.channel_id == ch_id,
                        Message.posted_at >= yesterday,
                    )
                    .scalar()
                    or 0
                )

                # Average views for messages in last 24h
                avg_views_24h = (
                    db.query(func.avg(Message.views_count))
                    .filter(
                        Message.channel_id == ch_id,
                        Message.posted_at >= yesterday,
                    )
                    .scalar()
                )
                avg_views_24h = round(float(avg_views_24h), 2) if avg_views_24h else 0.0

                # Media counts
                photos_count = (
                    db.query(func.count(Message.id))
                    .filter(Message.channel_id == ch_id, Message.content_type == "photo")
                    .scalar() or 0
                )
                videos_count = (
                    db.query(func.count(Message.id))
                    .filter(Message.channel_id == ch_id, Message.content_type == "video")
                    .scalar() or 0
                )
                files_count = (
                    db.query(func.count(Message.id))
                    .filter(Message.channel_id == ch_id, Message.content_type == "document")
                    .scalar() or 0
                )
                links_count = (
                    db.query(func.count(Message.id))
                    .filter(
                        Message.channel_id == ch_id,
                        Message.external_links.isnot(None),
                        Message.external_links != "",
                    )
                    .scalar() or 0
                )

                stats = ChannelStats(
                    channel_id=ch_id,
                    subscribers_count=live_subscribers,
                    posts_count=posts_24h,
                    avg_views=avg_views_24h,
                    photos_count=photos_count,
                    videos_count=videos_count,
                    files_count=files_count,
                    links_count=links_count,
                    recorded_at=datetime.utcnow(),
                )
                db.add(stats)
                logger.info(
                    f"[Scheduler] Stats recorded for {ch_title}: "
                    f"{live_subscribers} subscribers, {posts_24h} posts/24h"
                )
            except Exception as e:
                logger.error(
                    f"[Scheduler] Error recording stats for {ch_title}: {e}"
                )

            await asyncio.sleep(2)

        db.commit()

    except Exception as e:
        logger.error(f"[Scheduler] Stats recording error: {e}")
        db.rollback()
    finally:
        db.close()


def start_scheduler() -> None:
    """Initialize and start the APScheduler with configured jobs."""
    if scheduler.running:
        logger.warning("[Scheduler] Scheduler is already running.")
        return

    # Scrape approved channels at configured interval
    scheduler.add_job(
        scrape_approved_channels,
        trigger=IntervalTrigger(minutes=settings.SCRAPE_INTERVAL_MINUTES),
        id="scrape_approved_channels",
        name="Scrape approved Telegram channels",
        replace_existing=True,
    )

    # Record channel stats daily at configured hour
    scheduler.add_job(
        record_channel_stats,
        trigger=CronTrigger(hour=settings.STATS_SNAPSHOT_HOUR),
        id="record_channel_stats",
        name="Record daily channel statistics",
        replace_existing=True,
    )

    scheduler.start()
    logger.info(
        f"[Scheduler] Started with scrape interval "
        f"{settings.SCRAPE_INTERVAL_MINUTES}min, "
        f"stats snapshot at {settings.STATS_SNAPSHOT_HOUR}:00 UTC."
    )


def stop_scheduler() -> None:
    """Gracefully shut down the scheduler."""
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("[Scheduler] Scheduler stopped.")
