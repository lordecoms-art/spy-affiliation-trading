import asyncio
import base64
import logging
import random
from datetime import datetime
from typing import Any, Dict, List, Optional

from telethon import TelegramClient
from telethon.tl.functions.channels import GetFullChannelRequest
from telethon.tl.functions.messages import GetDialogsRequest
from telethon.tl.types import (
    Channel,
    InputPeerEmpty,
    MessageMediaDocument,
    MessageMediaPhoto,
)

from app.config import settings

logger = logging.getLogger(__name__)


class TelegramScraper:
    """Telethon-based Telegram scraper with rate limiting."""

    def __init__(self) -> None:
        self._client: Optional[TelegramClient] = None
        self._connected: bool = False

    @property
    def client(self) -> TelegramClient:
        if self._client is None:
            self._client = TelegramClient(
                settings.TELEGRAM_SESSION_NAME,
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

            entity = await self.client.get_entity(telegram_id)

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

            entity = await self.rate_limited_request(
                self.client.get_entity(channel_identifier)
            )

            messages = await self.rate_limited_request(
                self.client.get_messages(
                    entity,
                    limit=limit,
                    min_id=min_id,
                )
            )

            for msg in messages:
                if msg is None or msg.id is None:
                    continue

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
                                        voice_duration = getattr(
                                            attr, "duration", None
                                        )
                                    break
                                elif attr_name == "DocumentAttributeSticker":
                                    content_type = "sticker"
                                    break
                            else:
                                content_type = "document"

                # Extract external links from message text
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
                if hasattr(msg, "reactions") and msg.reactions:
                    for result in getattr(msg.reactions, "results", []):
                        reactions_count += getattr(result, "count", 0)

                import json

                messages_data.append(
                    {
                        "telegram_message_id": msg.id,
                        "content_type": content_type,
                        "text_content": msg.text or msg.message or None,
                        "media_url": media_url,
                        "voice_duration": voice_duration,
                        "views_count": views,
                        "forwards_count": forwards,
                        "replies_count": replies_count,
                        "reactions_count": reactions_count,
                        "external_links": json.dumps(external_links)
                        if external_links
                        else None,
                        "has_cta": has_cta,
                        "cta_text": cta_text,
                        "cta_link": cta_link,
                        "posted_at": msg.date.replace(tzinfo=None)
                        if msg.date
                        else None,
                    }
                )

            logger.info(
                f"Fetched {len(messages_data)} messages from {channel_identifier}"
            )
            return messages_data

        except Exception as e:
            logger.error(
                f"Error fetching messages from {channel_identifier}: {e}"
            )
            return messages_data

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
