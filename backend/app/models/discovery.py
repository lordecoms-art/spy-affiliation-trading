from datetime import datetime

from sqlalchemy import (
    Column,
    Integer,
    BigInteger,
    String,
    DateTime,
    ForeignKey,
)

from app.database import Base


class ChannelDiscovery(Base):
    __tablename__ = "channel_discoveries"

    id = Column(Integer, primary_key=True, autoincrement=True)
    telegram_id = Column(BigInteger, unique=True, nullable=False, index=True)
    username = Column(String(255), nullable=True)
    title = Column(String(500), nullable=True)
    discovered_from_channel_id = Column(
        Integer,
        ForeignKey("channels.id", ondelete="SET NULL"),
        nullable=True,
    )
    discovered_via = Column(String(100), nullable=True)
    status = Column(String(50), default="pending", nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    def __repr__(self) -> str:
        return (
            f"<ChannelDiscovery(id={self.id}, telegram_id={self.telegram_id}, "
            f"status='{self.status}')>"
        )
