from datetime import datetime

from sqlalchemy import (
    Column,
    Integer,
    BigInteger,
    Float,
    DateTime,
    ForeignKey,
)

from app.database import Base


class ChannelStats(Base):
    __tablename__ = "channel_stats"

    id = Column(Integer, primary_key=True, autoincrement=True)
    channel_id = Column(
        Integer,
        ForeignKey("channels.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    subscribers_count = Column(BigInteger, default=0, nullable=False)
    posts_count = Column(Integer, default=0, nullable=False)
    avg_views = Column(Float, default=0, nullable=False)
    photos_count = Column(Integer, default=0, nullable=False)
    videos_count = Column(Integer, default=0, nullable=False)
    files_count = Column(Integer, default=0, nullable=False)
    links_count = Column(Integer, default=0, nullable=False)
    recorded_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    def __repr__(self) -> str:
        return (
            f"<ChannelStats(id={self.id}, channel_id={self.channel_id}, "
            f"subscribers={self.subscribers_count})>"
        )
