from datetime import datetime

from sqlalchemy import (
    Column,
    Integer,
    Float,
    String,
    Text,
    DateTime,
    ForeignKey,
)

from app.database import Base


class MessageAnalysis(Base):
    __tablename__ = "message_analysis"

    id = Column(Integer, primary_key=True, autoincrement=True)
    message_id = Column(
        Integer,
        ForeignKey("messages.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    hook_type = Column(String(100), nullable=True)
    cta_type = Column(String(100), nullable=True)
    tone = Column(String(100), nullable=True)
    promises = Column(Text, nullable=True)
    social_proof_elements = Column(Text, nullable=True)
    engagement_score = Column(Float, nullable=True)
    virality_potential = Column(Float, nullable=True)
    raw_analysis = Column(Text, nullable=True)
    analyzed_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    def __repr__(self) -> str:
        return (
            f"<MessageAnalysis(id={self.id}, message_id={self.message_id}, "
            f"hook='{self.hook_type}')>"
        )
