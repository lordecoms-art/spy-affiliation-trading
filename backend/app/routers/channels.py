import asyncio
import logging
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.channel import Channel
from app.models.discovery import ChannelDiscovery
from app.services.telegram_client import telegram_scraper

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/channels", tags=["channels"])


# ---- Pydantic Schemas ----


class ChannelBase(BaseModel):
    username: Optional[str] = None
    title: str
    description: Optional[str] = None
    category: Optional[str] = None
    language: Optional[str] = None
    notes: Optional[str] = None


class ChannelCreate(BaseModel):
    username: str = Field(..., description="Telegram channel username (without @)")


class ChannelUpdate(BaseModel):
    category: Optional[str] = None
    language: Optional[str] = None
    notes: Optional[str] = None


class ChannelResponse(BaseModel):
    id: int
    telegram_id: int
    username: Optional[str]
    title: str
    description: Optional[str]
    photo_url: Optional[str]
    is_verified: bool
    status: str
    discovered_at: Optional[datetime]
    approved_at: Optional[datetime]
    category: Optional[str]
    language: Optional[str]
    notes: Optional[str]
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class DiscoveredChannelResponse(BaseModel):
    id: int
    telegram_id: int
    username: Optional[str]
    title: Optional[str]
    discovered_via: Optional[str]
    status: str
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


class MessageResponse(BaseModel):
    message: str


class SyncResult(BaseModel):
    synced: int
    new_channels: int
    existing_channels: int


# ---- Endpoints ----


@router.get("/discovered", response_model=List[DiscoveredChannelResponse])
def list_discovered_channels(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
) -> List[ChannelDiscovery]:
    """List pending discovered channels."""
    discoveries = (
        db.query(ChannelDiscovery)
        .filter(ChannelDiscovery.status == "pending")
        .order_by(ChannelDiscovery.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return discoveries


@router.get("/approved", response_model=List[ChannelResponse])
def list_approved_channels(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
) -> List[Channel]:
    """List all approved channels."""
    channels = (
        db.query(Channel)
        .filter(Channel.status == "approved")
        .order_by(Channel.approved_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return channels


@router.get("/", response_model=List[ChannelResponse])
def list_channels(
    status: Optional[str] = Query(None, description="Filter by status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
) -> List[Channel]:
    """List all channels with optional status filter."""
    query = db.query(Channel)

    if status:
        if status not in ("pending", "approved", "rejected", "paused"):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid status: {status}. Must be one of: pending, approved, rejected, paused",
            )
        query = query.filter(Channel.status == status)

    channels = (
        query.order_by(Channel.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return channels


@router.get("/{channel_id}", response_model=ChannelResponse)
def get_channel(
    channel_id: int,
    db: Session = Depends(get_db),
) -> Channel:
    """Get a single channel by ID."""
    channel = db.query(Channel).filter(Channel.id == channel_id).first()
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    return channel


@router.post("/", response_model=ChannelResponse, status_code=201)
def add_channel(
    data: ChannelCreate,
    db: Session = Depends(get_db),
) -> Channel:
    """Add a channel manually by username. Fetches info from Telegram."""
    username = data.username.lstrip("@").strip()
    if not username:
        raise HTTPException(status_code=400, detail="Username is required")

    # Check if channel already exists by username
    existing = (
        db.query(Channel).filter(Channel.username == username).first()
    )
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"Channel @{username} already exists with ID {existing.id}",
        )

    # Try to fetch info from Telegram
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            info = loop.run_until_complete(
                telegram_scraper.get_channel_info(username)
            )
        finally:
            loop.close()
    except Exception as e:
        logger.error(f"Failed to fetch Telegram info for @{username}: {e}")
        info = None

    if info:
        # Check by telegram_id too
        existing_by_id = (
            db.query(Channel)
            .filter(Channel.telegram_id == info["telegram_id"])
            .first()
        )
        if existing_by_id:
            raise HTTPException(
                status_code=409,
                detail=f"Channel already exists with telegram_id {info['telegram_id']}",
            )

        channel = Channel(
            telegram_id=info["telegram_id"],
            username=info.get("username", username),
            title=info.get("title", username),
            description=info.get("description"),
            photo_url=info.get("photo_url"),
            is_verified=info.get("is_verified", False),
            status="pending",
            discovered_at=datetime.utcnow(),
        )
    else:
        # Create with minimal info if Telegram fetch fails
        channel = Channel(
            telegram_id=0,
            username=username,
            title=username,
            status="pending",
            discovered_at=datetime.utcnow(),
        )

    db.add(channel)
    db.commit()
    db.refresh(channel)
    logger.info(f"Channel @{username} added with ID {channel.id}")
    return channel


@router.post("/{channel_id}/approve", response_model=ChannelResponse)
def approve_channel(
    channel_id: int,
    db: Session = Depends(get_db),
) -> Channel:
    """Approve a channel for scraping."""
    channel = db.query(Channel).filter(Channel.id == channel_id).first()
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    if channel.status == "approved":
        raise HTTPException(
            status_code=400, detail="Channel is already approved"
        )

    channel.status = "approved"
    channel.approved_at = datetime.utcnow()
    channel.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(channel)
    logger.info(f"Channel {channel.title} (ID: {channel_id}) approved.")
    return channel


@router.post("/{channel_id}/reject", response_model=ChannelResponse)
def reject_channel(
    channel_id: int,
    db: Session = Depends(get_db),
) -> Channel:
    """Reject a channel."""
    channel = db.query(Channel).filter(Channel.id == channel_id).first()
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    if channel.status == "rejected":
        raise HTTPException(
            status_code=400, detail="Channel is already rejected"
        )

    channel.status = "rejected"
    channel.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(channel)
    logger.info(f"Channel {channel.title} (ID: {channel_id}) rejected.")
    return channel


@router.post("/sync-telegram", response_model=SyncResult)
def sync_telegram_channels(
    db: Session = Depends(get_db),
) -> dict:
    """Sync channels from the authenticated Telegram account."""
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            joined_channels = loop.run_until_complete(
                telegram_scraper.get_joined_channels()
            )
        finally:
            loop.close()
    except Exception as e:
        logger.error(f"Failed to sync Telegram channels: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to connect to Telegram: {str(e)}",
        )

    new_count = 0
    existing_count = 0

    for ch in joined_channels:
        existing = (
            db.query(Channel)
            .filter(Channel.telegram_id == ch["telegram_id"])
            .first()
        )

        if existing:
            existing_count += 1
            continue

        channel = Channel(
            telegram_id=ch["telegram_id"],
            username=ch.get("username"),
            title=ch.get("title", "Unknown"),
            is_verified=ch.get("is_verified", False),
            status="pending",
            discovered_at=datetime.utcnow(),
        )
        db.add(channel)
        new_count += 1

    db.commit()
    logger.info(
        f"Telegram sync: {new_count} new, {existing_count} existing "
        f"out of {len(joined_channels)} total."
    )

    return {
        "synced": len(joined_channels),
        "new_channels": new_count,
        "existing_channels": existing_count,
    }


@router.delete("/{channel_id}", response_model=MessageResponse)
def delete_channel(
    channel_id: int,
    db: Session = Depends(get_db),
) -> dict:
    """Delete a channel and all related data."""
    channel = db.query(Channel).filter(Channel.id == channel_id).first()
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    title = channel.title
    db.delete(channel)
    db.commit()
    logger.info(f"Channel {title} (ID: {channel_id}) deleted.")
    return {"message": f"Channel '{title}' deleted successfully"}
