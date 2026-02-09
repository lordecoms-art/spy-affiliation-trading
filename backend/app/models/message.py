from datetime import datetime

from sqlalchemy import (
    Column,
    Integer,
    BigInteger,
    String,
    Text,
    Boolean,
    DateTime,
    ForeignKey,
    UniqueConstraint,
)

from app.database import Base


class Message(Base):
    __tablename__ = "messages"

    __table_args__ = (
        UniqueConstraint(
            "channel_id",
            "telegram_message_id",
            name="uq_channel_telegram_message",
        ),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    channel_id = Column(
        Integer,
        ForeignKey("channels.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    telegram_message_id = Column(BigInteger, nullable=False)
    content_type = Column(String(50), nullable=True)
    text_content = Column(Text, nullable=True)
    media_url = Column(Text, nullable=True)
    voice_duration = Column(Integer, nullable=True)
    voice_transcription = Column(Text, nullable=True)
    views_count = Column(Integer, default=0, nullable=False)
    forwards_count = Column(Integer, default=0, nullable=False)
    replies_count = Column(Integer, default=0, nullable=False)
    reactions_count = Column(Integer, default=0, nullable=False)
    reactions_json = Column(Text, nullable=True)
    is_pinned = Column(Boolean, default=False, nullable=False)
    forward_from = Column(String(500), nullable=True)
    external_links = Column(Text, nullable=True)
    has_cta = Column(Boolean, default=False, nullable=False)
    cta_text = Column(Text, nullable=True)
    cta_link = Column(Text, nullable=True)
    posted_at = Column(DateTime, nullable=True)
    scraped_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    def __repr__(self) -> str:
        return (
            f"<Message(id={self.id}, channel_id={self.channel_id}, "
            f"type='{self.content_type}')>"
        )
