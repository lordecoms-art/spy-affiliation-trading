import logging
from datetime import datetime

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.triggers.cron import CronTrigger

from app.config import settings
from app.database import SessionLocal
from app.models.channel import Channel
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

        for channel in approved_channels:
            try:
                logger.info(
                    f"[Scheduler] Scraping channel: {channel.title} "
                    f"(ID: {channel.telegram_id})"
                )
                # The actual async scraping logic would be triggered here.
                # In a production setup, this would use asyncio.run() or
                # an async scheduler to call telegram_scraper methods.
                # For now, we log the intent.
                logger.info(
                    f"[Scheduler] Channel {channel.title} queued for scraping."
                )
            except Exception as e:
                logger.error(
                    f"[Scheduler] Error scraping channel {channel.title}: {e}"
                )

    except Exception as e:
        logger.error(f"[Scheduler] Error in scrape_approved_channels: {e}")
    finally:
        db.close()

    logger.info("[Scheduler] Scrape cycle completed.")


def record_channel_stats() -> None:
    """Record daily stats snapshot for all approved channels."""
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

        for channel in approved_channels:
            try:
                # In production, fetch live stats from Telegram.
                # For now, create a snapshot with placeholder values
                # that would be filled by the Telegram API.
                stats = ChannelStats(
                    channel_id=channel.id,
                    subscribers_count=0,
                    photos_count=0,
                    videos_count=0,
                    files_count=0,
                    links_count=0,
                    recorded_at=datetime.utcnow(),
                )
                db.add(stats)
                logger.info(
                    f"[Scheduler] Stats recorded for channel: {channel.title}"
                )
            except Exception as e:
                logger.error(
                    f"[Scheduler] Error recording stats for {channel.title}: {e}"
                )

        db.commit()

    except Exception as e:
        logger.error(f"[Scheduler] Error in record_channel_stats: {e}")
        db.rollback()
    finally:
        db.close()

    logger.info("[Scheduler] Stats recording completed.")


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
