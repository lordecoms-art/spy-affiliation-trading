import json
import logging
from collections import Counter
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.message import Message
from app.models.analysis import MessageAnalysis
from app.services.analyzer import message_analyzer

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/analysis", tags=["analysis"])


# ---- Pydantic Schemas ----


class AnalysisResponse(BaseModel):
    id: int
    message_id: int
    hook_type: Optional[str]
    cta_type: Optional[str]
    tone: Optional[str]
    promises: Optional[str]
    social_proof_elements: Optional[str]
    engagement_score: Optional[float]
    virality_potential: Optional[float]
    raw_analysis: Optional[str]
    analyzed_at: Optional[datetime]

    class Config:
        from_attributes = True


class AnalysisWithMessageResponse(BaseModel):
    id: int
    message_id: int
    hook_type: Optional[str]
    cta_type: Optional[str]
    tone: Optional[str]
    promises: Optional[str]
    social_proof_elements: Optional[str]
    engagement_score: Optional[float]
    virality_potential: Optional[float]
    analyzed_at: Optional[datetime]
    message_text: Optional[str]
    message_content_type: Optional[str]
    channel_id: Optional[int]

    class Config:
        from_attributes = True


class AnalyzeResultResponse(BaseModel):
    message_id: int
    success: bool
    analysis: Optional[AnalysisResponse]
    error: Optional[str]


class InsightsResponse(BaseModel):
    total_analyzed: int
    avg_engagement_score: float
    avg_virality_potential: float
    top_hook_types: List[Dict[str, Any]]
    top_cta_types: List[Dict[str, Any]]
    top_tones: List[Dict[str, Any]]
    best_posting_hours: List[Dict[str, Any]]
    highest_engagement_messages: List[Dict[str, Any]]


# ---- Endpoints ----


@router.get("/", response_model=List[AnalysisWithMessageResponse])
def list_analyses(
    hook_type: Optional[str] = Query(None, description="Filter by hook type"),
    cta_type: Optional[str] = Query(None, description="Filter by CTA type"),
    tone: Optional[str] = Query(None, description="Filter by tone"),
    min_engagement: Optional[float] = Query(None, ge=0, le=10),
    min_virality: Optional[float] = Query(None, ge=0, le=10),
    channel_id: Optional[int] = Query(None, description="Filter by channel"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
) -> List[dict]:
    """List analyzed messages with filters."""
    query = (
        db.query(
            MessageAnalysis.id,
            MessageAnalysis.message_id,
            MessageAnalysis.hook_type,
            MessageAnalysis.cta_type,
            MessageAnalysis.tone,
            MessageAnalysis.promises,
            MessageAnalysis.social_proof_elements,
            MessageAnalysis.engagement_score,
            MessageAnalysis.virality_potential,
            MessageAnalysis.analyzed_at,
            Message.text_content.label("message_text"),
            Message.content_type.label("message_content_type"),
            Message.channel_id.label("channel_id"),
        )
        .join(Message, Message.id == MessageAnalysis.message_id)
    )

    if hook_type is not None:
        query = query.filter(MessageAnalysis.hook_type == hook_type)

    if cta_type is not None:
        query = query.filter(MessageAnalysis.cta_type == cta_type)

    if tone is not None:
        query = query.filter(MessageAnalysis.tone == tone)

    if min_engagement is not None:
        query = query.filter(MessageAnalysis.engagement_score >= min_engagement)

    if min_virality is not None:
        query = query.filter(MessageAnalysis.virality_potential >= min_virality)

    if channel_id is not None:
        query = query.filter(Message.channel_id == channel_id)

    rows = (
        query.order_by(MessageAnalysis.analyzed_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    results = []
    for row in rows:
        results.append(
            {
                "id": row.id,
                "message_id": row.message_id,
                "hook_type": row.hook_type,
                "cta_type": row.cta_type,
                "tone": row.tone,
                "promises": row.promises,
                "social_proof_elements": row.social_proof_elements,
                "engagement_score": row.engagement_score,
                "virality_potential": row.virality_potential,
                "analyzed_at": row.analyzed_at,
                "message_text": row.message_text,
                "message_content_type": row.message_content_type,
                "channel_id": row.channel_id,
            }
        )

    return results


@router.post("/analyze/{message_id}", response_model=AnalyzeResultResponse)
def analyze_message(
    message_id: int,
    db: Session = Depends(get_db),
) -> dict:
    """Trigger Claude analysis for a specific message."""
    message = db.query(Message).filter(Message.id == message_id).first()
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")

    # Check if already analyzed
    existing_analysis = (
        db.query(MessageAnalysis)
        .filter(MessageAnalysis.message_id == message_id)
        .first()
    )
    if existing_analysis:
        return {
            "message_id": message_id,
            "success": True,
            "analysis": existing_analysis,
            "error": None,
        }

    # Determine text to analyze
    text_to_analyze = message.text_content
    is_voice = message.content_type == "voice" and message.voice_transcription

    if is_voice:
        text_to_analyze = message.voice_transcription

    if not text_to_analyze:
        return {
            "message_id": message_id,
            "success": False,
            "analysis": None,
            "error": "No text content available for analysis",
        }

    # Run analysis
    try:
        if is_voice:
            result = message_analyzer.analyze_voice_transcript(
                transcript=text_to_analyze,
                duration=message.voice_duration or 0,
            )
        else:
            result = message_analyzer.analyze_message(
                text_content=text_to_analyze,
                content_type=message.content_type or "text",
                views_count=message.views_count,
                forwards_count=message.forwards_count,
                reactions_count=message.reactions_count,
                has_cta=message.has_cta,
                cta_text=message.cta_text,
                external_links=message.external_links,
            )

        if result is None:
            return {
                "message_id": message_id,
                "success": False,
                "analysis": None,
                "error": "Analysis returned no results. Check API key configuration.",
            }

        analysis = MessageAnalysis(
            message_id=message_id,
            hook_type=result.get("hook_type"),
            cta_type=result.get("cta_type"),
            tone=result.get("tone"),
            promises=result.get("promises"),
            social_proof_elements=result.get("social_proof_elements"),
            engagement_score=result.get("engagement_score"),
            virality_potential=result.get("virality_potential"),
            raw_analysis=result.get("raw_analysis"),
            analyzed_at=result.get("analyzed_at", datetime.utcnow()),
        )

        db.add(analysis)
        db.commit()
        db.refresh(analysis)

        logger.info(f"Message {message_id} analyzed successfully.")

        return {
            "message_id": message_id,
            "success": True,
            "analysis": analysis,
            "error": None,
        }

    except Exception as e:
        logger.error(f"Error analyzing message {message_id}: {e}")
        return {
            "message_id": message_id,
            "success": False,
            "analysis": None,
            "error": str(e),
        }


@router.get("/insights", response_model=InsightsResponse)
def get_insights(
    channel_id: Optional[int] = Query(None, description="Filter by channel"),
    db: Session = Depends(get_db),
) -> dict:
    """Get aggregated insights from all analyses."""
    base_query = db.query(MessageAnalysis).join(
        Message, Message.id == MessageAnalysis.message_id
    )

    if channel_id is not None:
        base_query = base_query.filter(Message.channel_id == channel_id)

    analyses = base_query.all()

    if not analyses:
        return {
            "total_analyzed": 0,
            "avg_engagement_score": 0.0,
            "avg_virality_potential": 0.0,
            "top_hook_types": [],
            "top_cta_types": [],
            "top_tones": [],
            "best_posting_hours": [],
            "highest_engagement_messages": [],
        }

    total = len(analyses)

    # Average scores
    engagement_scores = [
        a.engagement_score for a in analyses if a.engagement_score is not None
    ]
    virality_scores = [
        a.virality_potential for a in analyses if a.virality_potential is not None
    ]

    avg_engagement = (
        round(sum(engagement_scores) / len(engagement_scores), 2)
        if engagement_scores
        else 0.0
    )
    avg_virality = (
        round(sum(virality_scores) / len(virality_scores), 2)
        if virality_scores
        else 0.0
    )

    # Top hook types
    hook_counter = Counter(
        a.hook_type for a in analyses if a.hook_type and a.hook_type != "none"
    )
    top_hooks = [
        {"type": hook, "count": count, "percentage": round(count / total * 100, 1)}
        for hook, count in hook_counter.most_common(10)
    ]

    # Top CTA types
    cta_counter = Counter(
        a.cta_type for a in analyses if a.cta_type and a.cta_type != "none"
    )
    top_ctas = [
        {"type": cta, "count": count, "percentage": round(count / total * 100, 1)}
        for cta, count in cta_counter.most_common(10)
    ]

    # Top tones
    tone_counter = Counter(a.tone for a in analyses if a.tone)
    top_tones = [
        {"type": tone, "count": count, "percentage": round(count / total * 100, 1)}
        for tone, count in tone_counter.most_common(10)
    ]

    # Best posting hours - join with messages to get posted_at
    hour_query = (
        db.query(
            func.extract("hour", Message.posted_at).label("hour"),
            func.avg(MessageAnalysis.engagement_score).label("avg_score"),
            func.count(MessageAnalysis.id).label("count"),
        )
        .join(Message, Message.id == MessageAnalysis.message_id)
        .filter(Message.posted_at.isnot(None))
        .filter(MessageAnalysis.engagement_score.isnot(None))
    )

    if channel_id is not None:
        hour_query = hour_query.filter(Message.channel_id == channel_id)

    hour_results = (
        hour_query.group_by(func.extract("hour", Message.posted_at))
        .order_by(func.avg(MessageAnalysis.engagement_score).desc())
        .limit(10)
        .all()
    )

    best_hours = [
        {
            "hour": int(row.hour) if row.hour is not None else 0,
            "avg_engagement": round(float(row.avg_score), 2),
            "message_count": row.count,
        }
        for row in hour_results
    ]

    # Highest engagement messages
    top_messages_query = (
        db.query(
            MessageAnalysis.message_id,
            MessageAnalysis.engagement_score,
            MessageAnalysis.hook_type,
            MessageAnalysis.cta_type,
            Message.text_content,
            Message.views_count,
        )
        .join(Message, Message.id == MessageAnalysis.message_id)
        .filter(MessageAnalysis.engagement_score.isnot(None))
    )

    if channel_id is not None:
        top_messages_query = top_messages_query.filter(
            Message.channel_id == channel_id
        )

    top_messages = (
        top_messages_query.order_by(MessageAnalysis.engagement_score.desc())
        .limit(10)
        .all()
    )

    highest_engagement = [
        {
            "message_id": row.message_id,
            "engagement_score": round(float(row.engagement_score), 2),
            "hook_type": row.hook_type,
            "cta_type": row.cta_type,
            "text_preview": (row.text_content[:150] + "...")
            if row.text_content and len(row.text_content) > 150
            else row.text_content,
            "views_count": row.views_count,
        }
        for row in top_messages
    ]

    return {
        "total_analyzed": total,
        "avg_engagement_score": avg_engagement,
        "avg_virality_potential": avg_virality,
        "top_hook_types": top_hooks,
        "top_cta_types": top_ctas,
        "top_tones": top_tones,
        "best_posting_hours": best_hours,
        "highest_engagement_messages": highest_engagement,
    }
