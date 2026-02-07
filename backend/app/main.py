import base64
import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import engine, Base
from app.routers import channels, messages, stats, analysis
from app.services.scheduler import start_scheduler, stop_scheduler

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup and shutdown events."""
    # Startup
    logger.info("Starting Spy Affiliation Trading backend v1.1...")

    # Restore Telegram session file from env var if available
    session_data = os.environ.get("TELEGRAM_SESSION_DATA")
    if session_data:
        import gzip
        session_path = f"{settings.TELEGRAM_SESSION_NAME}.session"
        try:
            raw = base64.b64decode(session_data)
            decompressed = gzip.decompress(raw)
            with open(session_path, "wb") as f:
                f.write(decompressed)
            logger.info(f"Telegram session file restored ({len(decompressed)} bytes) to {session_path}")
        except Exception as e:
            logger.error(f"Failed to restore Telegram session: {e}")
    else:
        logger.info("No TELEGRAM_SESSION_DATA env var found, using local session file if available.")

    # Create database tables
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables created/verified.")
    except Exception as e:
        logger.error(f"Failed to create database tables: {e}")

    # Start the scheduler
    try:
        start_scheduler()
        logger.info("Scheduler started.")
    except Exception as e:
        logger.error(f"Failed to start scheduler: {e}")

    yield

    # Shutdown
    logger.info("Shutting down Spy Affiliation Trading backend...")
    stop_scheduler()
    logger.info("Application shutdown complete.")


app = FastAPI(
    title="Spy Affiliation Trading API",
    description=(
        "API for monitoring and analyzing Telegram affiliate marketing "
        "and trading channels. Scrape messages, analyze content with AI, "
        "and track engagement metrics."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(channels.router)
app.include_router(messages.router)
app.include_router(stats.router)
app.include_router(analysis.router)


@app.get("/", tags=["root"])
def root() -> dict:
    """Root endpoint with API information."""
    return {
        "name": "Spy Affiliation Trading API",
        "version": "1.0.0",
        "description": "Telegram affiliate channel monitoring and analysis",
        "docs_url": "/docs",
        "redoc_url": "/redoc",
    }


@app.get("/health", tags=["health"])
def health_check() -> dict:
    """Health check endpoint."""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "database_url_configured": bool(settings.DATABASE_URL),
        "telegram_configured": bool(
            settings.TELEGRAM_API_ID and settings.TELEGRAM_API_HASH
        ),
        "anthropic_configured": bool(settings.ANTHROPIC_API_KEY),
    }
