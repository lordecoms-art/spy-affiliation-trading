import asyncio
import base64
import json
import logging
import random
from datetime import datetime, timezone
from typing import Any, AsyncIterator, Dict, List, Optional

from telethon import TelegramClient
from telethon.errors import FloodWaitError
from telethon.tl.functions.channels import GetFullChannelRequest
from telethon.tl.functions.messages import GetDialogsRequest
from telethon.tl.types import (
    Channel,
    InputPeerEmpty,
    MessageMediaDocument,
    MessageMediaPhoto,
    PeerChannel,
)

from app.config import settings

logger = logging.getLogger(__name__)


class TelegramScraper:
    """Telethon-based Telegram scraper with rate limiting."""

    def __init__(self, session_name: Optional[str] = None) -> None:
        self._client: Optional[TelegramClient] = None
        self._connected: bool = False
        self._session_name = session_name or settings.TELEGRAM_SESSION_NAME

    @property
    def client(self) -> TelegramClient:
        if self._client is None:
            self._client = TelegramClient(
                self._session_name,
                settings.TELEGRAM_API_ID,
                settings.TELEGRAM_API_HASH,
            )
        return self._client

    async def connect(self) -> bool:
        """Connect to Telegram. Session file must already exist."""
        try:
            if not self._connected:
                await self.client.connect()
                if not await self.client.is_user_authorized():
                    logger.error(
                        "Telegram session not authorized. "
                        "Run setup_session.py first."
                    )
                    return False
                self._connected = True
                logger.info("Telegram client connected successfully.")
            return True
        except Exception as e:
            logger.error(f"Failed to connect to Telegram: {e}")
            return False

    async def disconnect(self) -> None:
        """Disconnect from Telegram."""
        if self._client is not None and self._connected:
            await self._client.disconnect()
            self._connected = False
            logger.info("Telegram client disconnected.")

    async def rate_limited_request(self, coro: Any) -> Any:
        """Execute a request with random delay for rate limiting."""
        delay = random.uniform(2.0, 5.0)
        await asyncio.sleep(delay)
        return await coro

    async def get_channel_info(self, channel_identifier: str) -> Optional[Dict[str, Any]]:
        """
        Get full info about a channel by username or ID.

        Args:
            channel_identifier: Channel username (without @) or numeric ID.

        Returns:
            Dictionary with channel information or None on failure.
        """
        try:
            if not self._connected:
                await self.connect()

            entity = await self.rate_limited_request(
                self.client.get_entity(channel_identifier)
            )

            if not isinstance(entity, Channel):
                logger.warning(f"{channel_identifier} is not a channel.")
                return None

            full_channel = await self.rate_limited_request(
                self.client(GetFullChannelRequest(entity))
            )

            full_chat = full_channel.full_chat

            photo_url = await self._download_photo_b64(entity)

            return {
                "telegram_id": entity.id,
                "username": entity.username,
                "title": entity.title,
                "description": getattr(full_chat, "about", None),
                "photo_url": photo_url,
                "is_verified": getattr(entity, "verified", False),
                "subscribers_count": getattr(full_chat, "participants_count", 0),
            }

        except Exception as e:
            logger.error(f"Error fetching channel info for {channel_identifier}: {e}")
            return None

    async def _download_photo_b64(self, entity) -> Optional[str]:
        """Download an entity's profile photo and return as base64 data URL."""
        if not entity.photo:
            return None
        try:
            photo_bytes = await self.client.download_profile_photo(entity, file=bytes)
            if photo_bytes:
                photo_b64 = base64.b64encode(photo_bytes).decode()
                return f"data:image/jpeg;base64,{photo_b64}"
        except Exception as e:
            logger.warning(f"Failed to download photo for {getattr(entity, 'title', entity.id)}: {e}")
        return None

    async def enrich_channel(self, telegram_id: int) -> Optional[Dict[str, Any]]:
        """
        Fetch full info (photo, subscribers, description) for a single channel by telegram_id.

        Args:
            telegram_id: The Telegram channel ID.

        Returns:
            Dictionary with enrichment data or None on failure.
        """
        try:
            if not self._connected:
                await self.connect()

            # Use PeerChannel so Telethon resolves as channel, not user
            entity = await self.client.get_entity(PeerChannel(channel_id=telegram_id))

            if not isinstance(entity, Channel):
                return None

            full_channel = await self.client(GetFullChannelRequest(entity))
            full_chat = full_channel.full_chat

            photo_url = await self._download_photo_b64(entity)

            return {
                "telegram_id": entity.id,
                "username": entity.username,
                "title": entity.title,
                "description": getattr(full_chat, "about", None),
                "photo_url": photo_url,
                "is_verified": getattr(entity, "verified", False),
                "subscribers_count": getattr(full_chat, "participants_count", 0),
            }
        except Exception as e:
            logger.error(f"Error enriching channel {telegram_id}: {e}")
            return None

    def _parse_message(self, msg) -> Optional[Dict[str, Any]]:
        """Parse a single Telethon message into a dict."""
        if msg is None or msg.id is None:
            return None

        content_type = "text"
        media_url = None
        voice_duration = None

        if msg.media:
            if isinstance(msg.media, MessageMediaPhoto):
                content_type = "photo"
            elif isinstance(msg.media, MessageMediaDocument):
                doc = msg.media.document
                if doc:
                    for attr in doc.attributes:
                        attr_name = type(attr).__name__
                        if attr_name == "DocumentAttributeVideo":
                            content_type = "video"
                            break
                        elif attr_name == "DocumentAttributeAudio":
                            if getattr(attr, "voice", False):
                                content_type = "voice"
                                voice_duration = getattr(attr, "duration", None)
                            break
                        elif attr_name == "DocumentAttributeSticker":
                            content_type = "sticker"
                            break
                    else:
                        content_type = "document"

        # Extract external links
        external_links: List[str] = []
        if msg.entities:
            for ent in msg.entities:
                ent_type = type(ent).__name__
                if ent_type == "MessageEntityUrl" and msg.text:
                    url = msg.text[ent.offset : ent.offset + ent.length]
                    external_links.append(url)
                elif ent_type == "MessageEntityTextUrl":
                    url = getattr(ent, "url", "")
                    if url:
                        external_links.append(url)

        # Detect CTA
        has_cta = False
        cta_text = None
        cta_link = None
        if msg.reply_markup:
            markup_type = type(msg.reply_markup).__name__
            if markup_type == "ReplyInlineMarkup":
                for row in msg.reply_markup.rows:
                    for button in row.buttons:
                        btn_type = type(button).__name__
                        if btn_type == "KeyboardButtonUrl":
                            has_cta = True
                            cta_text = getattr(button, "text", None)
                            cta_link = getattr(button, "url", None)
                            break
                    if has_cta:
                        break

        views = getattr(msg, "views", 0) or 0
        forwards = getattr(msg, "forwards", 0) or 0
        replies_count = 0
        if msg.replies:
            replies_count = getattr(msg.replies, "replies", 0) or 0

        reactions_count = 0
        reactions_detail = []
        if hasattr(msg, "reactions") and msg.reactions:
            for result in getattr(msg.reactions, "results", []):
                count = getattr(result, "count", 0)
                reactions_count += count
                reaction = getattr(result, "reaction", None)
                if reaction and count > 0:
                    emoticon = getattr(reaction, "emoticon", None)
                    if emoticon:
                        reactions_detail.append({"emoji": emoticon, "count": count})

        # Pinned status
        is_pinned = getattr(msg, "pinned", False)

        # Forward source
        forward_from = None
        if msg.fwd_from:
            fwd = msg.fwd_from
            forward_from = getattr(fwd, "from_name", None)
            if not forward_from:
                forward_from = getattr(fwd, "post_author", None)

        return {
            "telegram_message_id": msg.id,
            "content_type": content_type,
            "text_content": msg.text or msg.message or None,
            "media_url": media_url,
            "voice_duration": voice_duration,
            "views_count": views,
            "forwards_count": forwards,
            "replies_count": replies_count,
            "reactions_count": reactions_count,
            "reactions_json": json.dumps(reactions_detail) if reactions_detail else None,
            "is_pinned": is_pinned,
            "forward_from": forward_from,
            "external_links": json.dumps(external_links) if external_links else None,
            "has_cta": has_cta,
            "cta_text": cta_text,
            "cta_link": cta_link,
            "posted_at": msg.date.replace(tzinfo=None) if msg.date else None,
        }

    async def _parse_message_with_media(self, msg) -> Optional[Dict[str, Any]]:
        """Parse message and download media thumbnail if available."""
        parsed = self._parse_message(msg)
        if not parsed:
            return parsed

        if msg.media and parsed["content_type"] in ("photo", "video"):
            try:
                thumb_bytes = await self.client.download_media(msg, file=bytes, thumb=-1)
                if thumb_bytes and len(thumb_bytes) < 50000:
                    b64 = base64.b64encode(thumb_bytes).decode()
                    parsed["media_url"] = f"data:image/jpeg;base64,{b64}"
            except Exception as e:
                logger.debug(f"Failed to download thumbnail for msg {msg.id}: {e}")

        return parsed

    async def get_channel_messages(
        self,
        channel_identifier: str,
        limit: int = 100,
        min_id: int = 0,
    ) -> List[Dict[str, Any]]:
        """
        Fetch recent messages from a channel.

        Args:
            channel_identifier: Channel username or ID.
            limit: Maximum number of messages to fetch.
            min_id: Only fetch messages with ID greater than this.

        Returns:
            List of message dictionaries.
        """
        messages_data: List[Dict[str, Any]] = []

        try:
            if not self._connected:
                await self.connect()

            entity = await self._resolve_entity(channel_identifier)

            messages = await self.rate_limited_request(
                self.client.get_messages(entity, limit=limit, min_id=min_id)
            )

            for msg in messages:
                parsed = await self._parse_message_with_media(msg)
                if parsed:
                    messages_data.append(parsed)

            logger.info(
                f"Fetched {len(messages_data)} messages from {channel_identifier}"
            )
            return messages_data

        except Exception as e:
            logger.error(
                f"Error fetching messages from {channel_identifier}: {e}"
            )
            return messages_data

    async def _resolve_entity(self, channel_identifier: str):
        """Resolve a channel entity from username or numeric ID string."""
        # If it looks like a numeric ID, use PeerChannel for proper resolution
        try:
            numeric_id = int(channel_identifier)
            return await self.client.get_entity(PeerChannel(channel_id=numeric_id))
        except (ValueError, TypeError):
            pass
        # Otherwise resolve by username
        return await self.rate_limited_request(
            self.client.get_entity(channel_identifier)
        )

    async def iter_channel_messages_since(
        self,
        channel_identifier: str,
        since_date: datetime,
        batch_size: int = 50,
    ) -> AsyncIterator[List[Dict[str, Any]]]:
        """
        Iterate over ALL channel messages since a given date, yielding batches.

        Uses client.iter_messages with offset_date and reverse=True to walk
        forward from since_date. Handles FloodWaitError by sleeping the
        required seconds then resuming. Yields batches of batch_size messages.

        No min_id filtering: the full date range is traversed and
        deduplication is handled by the caller at DB insert time.

        Args:
            channel_identifier: Channel username or numeric ID string.
            since_date: Only fetch messages posted on or after this date.
            batch_size: Number of messages per yielded batch (default 50).

        Yields:
            Lists of message dictionaries (each list up to batch_size items).
        """
        total = 0
        batch: List[Dict[str, Any]] = []

        try:
            if not self._connected:
                await self.connect()

            entity = await self._resolve_entity(channel_identifier)

            # Ensure since_date is timezone-aware for Telethon
            if since_date.tzinfo is None:
                since_date = since_date.replace(tzinfo=timezone.utc)

            async for msg in self.client.iter_messages(
                entity,
                offset_date=since_date,
                reverse=True,
                limit=None,
            ):
                parsed = await self._parse_message_with_media(msg)
                if parsed:
                    batch.append(parsed)
                    total += 1

                if len(batch) >= batch_size:
                    yield batch
                    batch = []
                    # Rate limit: pause between batches
                    await asyncio.sleep(random.uniform(1.0, 2.0))

        except FloodWaitError as e:
            logger.warning(
                f"FloodWaitError for {channel_identifier}: sleeping {e.seconds}s"
            )
            # Yield what we have before sleeping
            if batch:
                yield batch
                batch = []
            await asyncio.sleep(e.seconds + 1)
            logger.info(f"Resumed after FloodWait for {channel_identifier}")

        except Exception as e:
            logger.error(
                f"Error iterating messages from {channel_identifier}: {e}"
            )

        # Yield remaining messages
        if batch:
            yield batch

        logger.info(
            f"Channel {channel_identifier}: {total} messages scraped since {since_date.date()}"
        )

    async def get_joined_channels(self) -> List[Dict[str, Any]]:
        """
        Get all channels the authenticated user has joined.

        Returns:
            List of dictionaries with basic channel info.
        """
        channels_list: List[Dict[str, Any]] = []

        try:
            if not self._connected:
                await self.connect()

            dialogs = await self.rate_limited_request(
                self.client.get_dialogs(limit=200)
            )

            for dialog in dialogs:
                entity = dialog.entity
                if isinstance(entity, Channel) and entity.broadcast:
                    channels_list.append(
                        {
                            "telegram_id": entity.id,
                            "username": entity.username,
                            "title": entity.title,
                            "is_verified": getattr(entity, "verified", False),
                        }
                    )

            logger.info(f"Found {len(channels_list)} joined channels.")
            return channels_list

        except Exception as e:
            logger.error(f"Error fetching joined channels: {e}")
            return channels_list


# Singleton instance
telegram_scraper = TelegramScraper()
