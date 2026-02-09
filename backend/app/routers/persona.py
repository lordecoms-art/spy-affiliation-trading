import json
import logging
import re
from collections import Counter
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, extract
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.channel import Channel
from app.models.message import Message
from app.models.analysis import MessageAnalysis
from app.services.analyzer import message_analyzer

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/persona", tags=["persona"])

# French + English stop words
STOP_WORDS = {
    "le", "la", "les", "de", "du", "des", "un", "une", "et", "en",
    "au", "aux", "ce", "ces", "est", "sont", "ont", "pas", "ne",
    "que", "qui", "se", "sa", "son", "ses", "sur", "par", "pour", "avec",
    "dans", "plus", "mais", "ou", "si", "il", "elle", "ils",
    "elles", "nous", "vous", "je", "tu", "on", "mon", "ma", "mes",
    "ton", "ta", "tes", "notre", "votre", "leur", "leurs", "tout",
    "tous", "toute", "toutes", "aussi", "comme", "fait", "cette",
    "the", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would",
    "shall", "should", "may", "might", "can", "could", "must",
    "an", "and", "but", "or", "for", "nor", "not",
    "so", "yet", "at", "by", "in", "of", "on", "to", "up",
    "it", "its", "me", "my", "we", "our", "you", "your",
    "he", "him", "his", "she", "her", "they", "them", "their",
    "this", "that", "these", "those", "what", "which", "who",
    "https", "http", "www", "com", "pas", "c'est", "j'ai",
    "très", "bien", "même", "dit", "peut", "faut", "vas",
    "ça", "donc", "alors", "car", "quand", "dont", "suis",
}

EMOJI_PATTERN = re.compile(
    "["
    "\U0001F600-\U0001F64F"
    "\U0001F300-\U0001F5FF"
    "\U0001F680-\U0001F6FF"
    "\U0001F1E0-\U0001F1FF"
    "\U00002702-\U000027B0"
    "\U0001F900-\U0001F9FF"
    "\U0001FA00-\U0001FA6F"
    "\U0001FA70-\U0001FAFF"
    "\U00002600-\U000026FF"
    "]+",
    flags=re.UNICODE,
)


def _compute_publication_rhythm(db: Session, channel_id: int) -> dict:
    """Compute publication rhythm stats from messages."""
    rows = (
        db.query(Message.posted_at, Message.content_type)
        .filter(
            Message.channel_id == channel_id,
            Message.posted_at.isnot(None),
        )
        .all()
    )

    if not rows:
        return {
            "total_messages": 0,
            "avg_posts_per_day": 0,
            "min_posts_per_day": 0,
            "max_posts_per_day": 0,
            "posting_hours": [],
            "active_days": [],
            "content_types": [],
        }

    day_counts: Counter = Counter()
    hour_counts: Counter = Counter()
    weekday_counts: Counter = Counter()
    type_counts: Counter = Counter()
    weekday_names = {
        0: "Monday", 1: "Tuesday", 2: "Wednesday",
        3: "Thursday", 4: "Friday", 5: "Saturday", 6: "Sunday",
    }

    for posted_at, content_type in rows:
        if posted_at:
            day_counts[posted_at.date()] += 1
            hour_counts[posted_at.hour] += 1
            weekday_counts[weekday_names[posted_at.weekday()]] += 1
        type_counts[content_type or "text"] += 1

    daily_values = list(day_counts.values()) if day_counts else [0]
    total = len(rows)

    return {
        "total_messages": total,
        "avg_posts_per_day": round(sum(daily_values) / len(daily_values), 1),
        "min_posts_per_day": min(daily_values),
        "max_posts_per_day": max(daily_values),
        "posting_hours": [
            {"hour": h, "count": c, "pct": round(c / total * 100, 1)}
            for h, c in sorted(hour_counts.items())
        ],
        "active_days": [
            {"day": d, "count": c, "pct": round(c / total * 100, 1)}
            for d, c in weekday_counts.most_common()
        ],
        "content_types": [
            {"type": t, "count": c, "pct": round(c / total * 100, 1)}
            for t, c in type_counts.most_common()
        ],
    }


def _compute_writing_style(db: Session, channel_id: int) -> dict:
    """Compute writing style stats from message texts."""
    texts = (
        db.query(Message.text_content)
        .filter(
            Message.channel_id == channel_id,
            Message.text_content.isnot(None),
            Message.text_content != "",
        )
        .all()
    )

    if not texts:
        return {
            "total_with_text": 0,
            "avg_message_length": 0,
            "median_message_length": 0,
            "emoji_per_message": 0,
            "messages_with_emojis_pct": 0,
            "recurring_words": [],
        }

    lengths = []
    word_counter: Counter = Counter()
    emoji_count = 0
    msgs_with_emoji = 0

    for (text,) in texts:
        if not text:
            continue
        lengths.append(len(text))

        emojis = EMOJI_PATTERN.findall(text)
        if emojis:
            emoji_count += sum(len(e) for e in emojis)
            msgs_with_emoji += 1

        words = re.findall(r"\b[a-zA-Zàâäéèêëïîôùûüçœæ]{3,}\b", text.lower())
        for word in words:
            if word not in STOP_WORDS:
                word_counter[word] += 1

    total = len(texts)
    lengths_sorted = sorted(lengths)
    median = lengths_sorted[len(lengths_sorted) // 2] if lengths_sorted else 0

    return {
        "total_with_text": total,
        "avg_message_length": round(sum(lengths) / len(lengths)) if lengths else 0,
        "median_message_length": median,
        "emoji_per_message": round(emoji_count / total, 1) if total else 0,
        "messages_with_emojis_pct": round(msgs_with_emoji / total * 100, 1) if total else 0,
        "recurring_words": [
            {"word": w, "count": c}
            for w, c in word_counter.most_common(30)
        ],
    }


def _compute_message_structure(db: Session, channel_id: int) -> dict:
    """Compute message structure from analyses."""
    analyses = (
        db.query(
            MessageAnalysis.hook_type,
            MessageAnalysis.cta_type,
            MessageAnalysis.tone,
            MessageAnalysis.engagement_score,
            MessageAnalysis.virality_potential,
        )
        .join(Message, Message.id == MessageAnalysis.message_id)
        .filter(Message.channel_id == channel_id)
        .all()
    )

    if not analyses:
        return {
            "total_analyzed": 0,
            "hook_types": [],
            "cta_types": [],
            "tones": [],
            "avg_engagement": 0,
            "avg_virality": 0,
        }

    total = len(analyses)
    hook_counter: Counter = Counter()
    cta_counter: Counter = Counter()
    tone_counter: Counter = Counter()
    engagement_scores = []
    virality_scores = []

    for hook, cta, tone, engagement, virality in analyses:
        if hook and hook != "none":
            hook_counter[hook] += 1
        if cta and cta != "none":
            cta_counter[cta] += 1
        if tone:
            tone_counter[tone] += 1
        if engagement is not None:
            engagement_scores.append(engagement)
        if virality is not None:
            virality_scores.append(virality)

    return {
        "total_analyzed": total,
        "hook_types": [
            {"type": h, "count": c, "pct": round(c / total * 100, 1)}
            for h, c in hook_counter.most_common()
        ],
        "cta_types": [
            {"type": ct, "count": c, "pct": round(c / total * 100, 1)}
            for ct, c in cta_counter.most_common()
        ],
        "tones": [
            {"type": t, "count": c, "pct": round(c / total * 100, 1)}
            for t, c in tone_counter.most_common()
        ],
        "avg_engagement": round(
            sum(engagement_scores) / len(engagement_scores), 2
        ) if engagement_scores else 0,
        "avg_virality": round(
            sum(virality_scores) / len(virality_scores), 2
        ) if virality_scores else 0,
    }


def _compute_engagement(db: Session, channel_id: int) -> dict:
    """Compute engagement stats."""
    top_by_views = (
        db.query(
            Message.text_content,
            Message.views_count,
            Message.forwards_count,
            Message.posted_at,
            Message.content_type,
            MessageAnalysis.engagement_score,
            MessageAnalysis.hook_type,
        )
        .outerjoin(MessageAnalysis, MessageAnalysis.message_id == Message.id)
        .filter(Message.channel_id == channel_id)
        .order_by(Message.views_count.desc())
        .limit(10)
        .all()
    )

    hour_views = (
        db.query(
            extract("hour", Message.posted_at).label("hour"),
            func.avg(Message.views_count).label("avg_views"),
            func.count(Message.id).label("count"),
        )
        .filter(
            Message.channel_id == channel_id,
            Message.posted_at.isnot(None),
        )
        .group_by(extract("hour", Message.posted_at))
        .order_by(extract("hour", Message.posted_at))
        .all()
    )

    type_engagement = (
        db.query(
            Message.content_type,
            func.avg(Message.views_count).label("avg_views"),
            func.avg(MessageAnalysis.engagement_score).label("avg_engagement"),
            func.count(Message.id).label("count"),
        )
        .outerjoin(MessageAnalysis, MessageAnalysis.message_id == Message.id)
        .filter(Message.channel_id == channel_id)
        .group_by(Message.content_type)
        .all()
    )

    return {
        "top_messages": [
            {
                "text_preview": (
                    (m.text_content[:200] + "...")
                    if m.text_content and len(m.text_content) > 200
                    else m.text_content
                ),
                "views": m.views_count or 0,
                "forwards": m.forwards_count or 0,
                "posted_at": m.posted_at.isoformat() if m.posted_at else None,
                "content_type": m.content_type,
                "engagement_score": (
                    round(float(m.engagement_score), 2)
                    if m.engagement_score else None
                ),
                "hook_type": m.hook_type,
            }
            for m in top_by_views
        ],
        "hour_views_correlation": [
            {
                "hour": int(h.hour) if h.hour is not None else 0,
                "avg_views": round(float(h.avg_views), 0) if h.avg_views else 0,
                "count": h.count,
            }
            for h in hour_views
        ],
        "best_performing_types": [
            {
                "type": t.content_type or "text",
                "avg_views": round(float(t.avg_views), 0) if t.avg_views else 0,
                "avg_engagement": (
                    round(float(t.avg_engagement), 2)
                    if t.avg_engagement else None
                ),
                "count": t.count,
            }
            for t in type_engagement
        ],
    }


def _build_ai_context(
    channel: Channel,
    rhythm: dict,
    style: dict,
    structure: dict,
    engagement: dict,
    sample_messages: list,
) -> str:
    """Build a text context for Claude from computed data."""
    parts = []

    parts.append("CHANNEL: {}".format(channel.title))
    if channel.description:
        parts.append("DESCRIPTION: {}".format(channel.description))
    parts.append("SUBSCRIBERS: {}".format(channel.subscribers_count))

    parts.append("\nPUBLICATION RHYTHM:")
    parts.append(
        "- Average {avg} posts/day (min {mn}, max {mx})".format(
            avg=rhythm["avg_posts_per_day"],
            mn=rhythm["min_posts_per_day"],
            mx=rhythm["max_posts_per_day"],
        )
    )
    if rhythm["posting_hours"]:
        top_hours = sorted(
            rhythm["posting_hours"], key=lambda x: x["count"], reverse=True
        )[:5]
        hours_str = ", ".join(
            "{}h ({}%)".format(h["hour"], h["pct"]) for h in top_hours
        )
        parts.append("- Top posting hours: {}".format(hours_str))
    if rhythm["active_days"]:
        days_str = ", ".join(
            "{} ({}%)".format(d["day"], d["pct"])
            for d in rhythm["active_days"][:3]
        )
        parts.append("- Most active days: {}".format(days_str))
    if rhythm["content_types"]:
        types_str = ", ".join(
            "{} ({}%)".format(t["type"], t["pct"])
            for t in rhythm["content_types"]
        )
        parts.append("- Content types: {}".format(types_str))

    parts.append("\nWRITING STYLE METRICS:")
    parts.append(
        "- Avg message length: {} chars".format(style["avg_message_length"])
    )
    parts.append(
        "- Emoji per message: {}".format(style["emoji_per_message"])
    )
    parts.append(
        "- Messages with emojis: {}%".format(style["messages_with_emojis_pct"])
    )
    if style["recurring_words"]:
        words_str = ", ".join(
            "{}({})".format(w["word"], w["count"])
            for w in style["recurring_words"][:20]
        )
        parts.append("- Top 20 recurring words: {}".format(words_str))

    parts.append("\nMESSAGE STRUCTURE:")
    parts.append("- Total analyzed: {}".format(structure["total_analyzed"]))
    parts.append(
        "- Avg engagement score: {}/10".format(structure["avg_engagement"])
    )
    parts.append(
        "- Avg virality potential: {}/10".format(structure["avg_virality"])
    )
    if structure["hook_types"]:
        hooks_str = ", ".join(
            "{} ({}%)".format(h["type"], h["pct"])
            for h in structure["hook_types"]
        )
        parts.append("- Hook types: {}".format(hooks_str))
    if structure["cta_types"]:
        cta_str = ", ".join(
            "{} ({}%)".format(c["type"], c["pct"])
            for c in structure["cta_types"]
        )
        parts.append("- CTA types: {}".format(cta_str))
    if structure["tones"]:
        tones_str = ", ".join(
            "{} ({}%)".format(t["type"], t["pct"])
            for t in structure["tones"]
        )
        parts.append("- Tones: {}".format(tones_str))

    parts.append("\nENGAGEMENT:")
    if engagement["top_messages"]:
        parts.append(
            "- Top message views: {}".format(
                engagement["top_messages"][0]["views"]
            )
        )
    if engagement["best_performing_types"]:
        bpt = ", ".join(
            "{} ({} views avg)".format(t["type"], int(t["avg_views"]))
            for t in engagement["best_performing_types"]
        )
        parts.append("- Best performing types: {}".format(bpt))

    parts.append(
        "\n\nSAMPLE MESSAGES ({} messages):".format(len(sample_messages))
    )
    for i, msg in enumerate(sample_messages[:50], 1):
        text = msg.text_content
        if text and len(text) > 300:
            text = text[:300] + "..."
        if text:
            parts.append("\n--- Message {} ---".format(i))
            parts.append(text)

    return "\n".join(parts)


# ---- Endpoints ----


@router.get("/{channel_id}")
def get_persona(
    channel_id: int,
    db: Session = Depends(get_db),
) -> dict:
    """Get computed persona stats for a channel.

    Returns publication rhythm, writing style, message structure,
    and engagement stats all computed from DB data.
    """
    channel = db.query(Channel).filter(Channel.id == channel_id).first()
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    # Count total and analyzed messages
    total_messages = (
        db.query(func.count(Message.id))
        .filter(Message.channel_id == channel_id)
        .scalar() or 0
    )
    analyzed_messages = (
        db.query(func.count(MessageAnalysis.id))
        .join(Message, Message.id == MessageAnalysis.message_id)
        .filter(Message.channel_id == channel_id)
        .scalar() or 0
    )

    rhythm = _compute_publication_rhythm(db, channel_id)
    style = _compute_writing_style(db, channel_id)
    structure = _compute_message_structure(db, channel_id)
    engagement = _compute_engagement(db, channel_id)

    return {
        "channel": {
            "id": channel.id,
            "title": channel.title,
            "username": channel.username,
            "description": channel.description,
            "subscribers_count": channel.subscribers_count,
            "photo_url": channel.photo_url,
        },
        "coverage": {
            "total_messages": total_messages,
            "analyzed_messages": analyzed_messages,
            "analysis_pct": (
                round(analyzed_messages / total_messages * 100, 1)
                if total_messages else 0
            ),
        },
        "publication_rhythm": rhythm,
        "writing_style": style,
        "message_structure": structure,
        "engagement": engagement,
    }


@router.post("/{channel_id}/generate")
def generate_ai_persona(
    channel_id: int,
    db: Session = Depends(get_db),
) -> dict:
    """Generate AI persona synthesis using Claude.

    Sends channel stats and sample messages to Claude to produce
    a qualitative persona analysis.
    """
    channel = db.query(Channel).filter(Channel.id == channel_id).first()
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    rhythm = _compute_publication_rhythm(db, channel_id)
    style = _compute_writing_style(db, channel_id)
    structure = _compute_message_structure(db, channel_id)
    engagement = _compute_engagement(db, channel_id)

    # Get sample messages (diverse: top engagement + recent)
    sample_messages = (
        db.query(Message)
        .filter(
            Message.channel_id == channel_id,
            Message.text_content.isnot(None),
            Message.text_content != "",
        )
        .order_by(Message.views_count.desc())
        .limit(30)
        .all()
    )
    recent = (
        db.query(Message)
        .filter(
            Message.channel_id == channel_id,
            Message.text_content.isnot(None),
            Message.text_content != "",
        )
        .order_by(Message.posted_at.desc())
        .limit(20)
        .all()
    )
    seen_ids = {m.id for m in sample_messages}
    for m in recent:
        if m.id not in seen_ids:
            sample_messages.append(m)
            seen_ids.add(m.id)

    context = _build_ai_context(
        channel, rhythm, style, structure, engagement, sample_messages
    )

    prompt = (
        "You are an expert marketing analyst. Based on the following data "
        "about a Telegram channel, generate a comprehensive PERSONA analysis "
        "in JSON format.\n\n"
        "{context}\n\n"
        "Generate a JSON with these sections:\n"
        '{{\n'
        '  "persona_summary": "2-3 paragraph summary of who this channel is, '
        'their personality, and their strategy",\n'
        '  "writing_style": {{\n'
        '    "tone_description": "detailed description of the writing tone",\n'
        '    "formatting_habits": "how they format messages (line breaks, caps, emojis)",\n'
        '    "language": "primary language and multilingual patterns",\n'
        '    "signature_phrases": ["list of 5-10 signature phrases"],\n'
        '    "emoji_style": "description of emoji usage patterns"\n'
        '  }},\n'
        '  "content_templates": [\n'
        '    {{\n'
        '      "name": "template name",\n'
        '      "description": "when this template is used",\n'
        '      "structure": "the message structure pattern",\n'
        '      "example_summary": "brief example"\n'
        '    }}\n'
        '  ],\n'
        '  "content_strategy": {{\n'
        '    "main_topics": ["list of main content topics"],\n'
        '    "posting_sequences": ["identified sequences like tease->result->CTA"],\n'
        '    "weekly_pattern_analysis": "description of weekly content rhythm",\n'
        '    "promotional_vs_value_ratio": "estimated ratio"\n'
        '  }},\n'
        '  "strengths": ["list of 3-5 content/marketing strengths"],\n'
        '  "weaknesses": ["list of 3-5 content/marketing weaknesses"],\n'
        '  "recommendations": ["5 actionable recommendations for improvement"]\n'
        '}}\n\n'
        "Return ONLY the JSON object, no other text. "
        "Write the analysis in the same language as the channel content."
    ).format(context=context)

    try:
        response = message_analyzer.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            messages=[{"role": "user", "content": prompt}],
        )
        raw_text = response.content[0].text.strip()

        # Clean markdown code block if present
        if raw_text.startswith("```"):
            lines = raw_text.split("\n")
            lines = [l for l in lines if not l.strip().startswith("```")]
            raw_text = "\n".join(lines)

        ai_persona = json.loads(raw_text)
        return {"status": "success", "ai_persona": ai_persona}

    except json.JSONDecodeError as e:
        logger.error("Failed to parse AI persona JSON: {}".format(e))
        # Return raw text if JSON parsing fails
        return {"status": "partial", "raw_text": raw_text, "error": str(e)}
    except Exception as e:
        logger.error("Failed to generate AI persona: {}".format(e))
        raise HTTPException(
            status_code=500,
            detail="AI persona generation failed: {}".format(str(e)),
        )


def _repair_truncated_json(text: str) -> str:
    """Attempt to repair truncated JSON by closing open brackets/braces."""
    # Strip trailing incomplete values (partial strings, etc.)
    # Find the last complete structure element
    stack = []
    in_string = False
    escape_next = False
    last_valid = 0

    for i, ch in enumerate(text):
        if escape_next:
            escape_next = False
            continue
        if ch == '\\' and in_string:
            escape_next = True
            continue
        if ch == '"' and not escape_next:
            in_string = not in_string
            continue
        if in_string:
            continue
        if ch in '{[':
            stack.append(ch)
        elif ch == '}' and stack and stack[-1] == '{':
            stack.pop()
            last_valid = i + 1
        elif ch == ']' and stack and stack[-1] == '[':
            stack.pop()
            last_valid = i + 1
        elif ch in ',: \n\r\t':
            continue

    if not stack:
        return text  # Already valid

    # Truncate to last valid position, then close remaining brackets
    repaired = text[:last_valid] if last_valid > 0 else text.rstrip()

    # Remove trailing commas
    repaired = repaired.rstrip().rstrip(',')

    # Close remaining open brackets/braces in reverse order
    for bracket in reversed(stack):
        if bracket == '{':
            repaired += '}'
        elif bracket == '[':
            repaired += ']'

    return repaired


@router.post("/{channel_id}/plan")
def generate_content_plan(
    channel_id: int,
    db: Session = Depends(get_db),
) -> dict:
    """Generate a 30-day content plan based on channel persona."""
    channel = db.query(Channel).filter(Channel.id == channel_id).first()
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    rhythm = _compute_publication_rhythm(db, channel_id)
    structure = _compute_message_structure(db, channel_id)

    # Get top performing messages as reference
    top_messages = (
        db.query(Message.text_content, Message.views_count, Message.content_type)
        .filter(
            Message.channel_id == channel_id,
            Message.text_content.isnot(None),
            Message.text_content != "",
        )
        .order_by(Message.views_count.desc())
        .limit(10)
        .all()
    )

    top_msgs_context = "\n".join(
        "- [{}] ({} views): {}".format(
            m.content_type or "text",
            m.views_count or 0,
            (m.text_content[:150] + "...") if len(m.text_content or "") > 150 else m.text_content,
        )
        for m in top_messages
    )

    hooks_str = ", ".join(
        "{} ({}%)".format(h["type"], h["pct"])
        for h in structure.get("hook_types", [])[:5]
    )
    cta_str = ", ".join(
        "{} ({}%)".format(c["type"], c["pct"])
        for c in structure.get("cta_types", [])[:5]
    )

    prompt = (
        "You are an expert Telegram content strategist. "
        "Based on the following channel profile, create a "
        "30-DAY CONTENT PLAN.\n\n"
        "CHANNEL: {title}\n"
        "SUBSCRIBERS: {subs}\n"
        "AVG POSTS/DAY: {avg_posts}\n"
        "TOP HOOKS: {hooks}\n"
        "TOP CTAs: {ctas}\n"
        "AVG ENGAGEMENT: {eng}/10\n\n"
        "TOP PERFORMING MESSAGES:\n{top_msgs}\n\n"
        "Generate a JSON with this EXACT structure:\n"
        '{{\n'
        '  "plan_summary": "2-3 sentence strategy overview",\n'
        '  "weekly_themes": [\n'
        '    {{"week": 1, "theme": "...", "focus": "..."}}\n'
        '  ],\n'
        '  "daily_plan": [\n'
        '    {{"day": 1, "dow": "Mon", "posts": [\n'
        '      {{"time": "10:00", "type": "text", "topic": "short topic", "cta": "short cta or null"}}\n'
        '    ]}}\n'
        '  ],\n'
        '  "kpis": ["kpi1", "kpi2"]\n'
        '}}\n\n'
        "IMPORTANT RULES:\n"
        "- Create ALL 30 days. Match {avg_posts} posts/day avg.\n"
        "- Keep topic to MAX 10 words. Keep cta to MAX 8 words or null.\n"
        "- Use 3-letter day abbreviations (Mon, Tue, Wed, Thu, Fri, Sat, Sun).\n"
        "- Return ONLY valid JSON, no markdown, no backticks.\n"
        "- Write in the same language as the channel content.\n"
        "- Be concise to fit within response limits."
    ).format(
        title=channel.title,
        subs=channel.subscribers_count,
        avg_posts=rhythm["avg_posts_per_day"],
        hooks=hooks_str or "N/A",
        ctas=cta_str or "N/A",
        eng=structure.get("avg_engagement", 0),
        top_msgs=top_msgs_context or "No top messages available",
    )

    try:
        response = message_analyzer.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=16384,
            messages=[{"role": "user", "content": prompt}],
        )
        raw_text = response.content[0].text.strip()
        stop_reason = response.stop_reason

        if raw_text.startswith("```"):
            lines = raw_text.split("\n")
            lines = [l for l in lines if not l.strip().startswith("```")]
            raw_text = "\n".join(lines)

        # If response was truncated (end_turn not reached), try to repair JSON
        if stop_reason != "end_turn":
            logger.warning(
                "Plan generation truncated (stop_reason={}). Attempting JSON repair.".format(stop_reason)
            )
            raw_text = _repair_truncated_json(raw_text)

        plan = json.loads(raw_text)
        return {"status": "success", "plan": plan}

    except json.JSONDecodeError as e:
        logger.error("Failed to parse plan JSON: {}".format(e))
        # Try to repair and return whatever we can
        try:
            repaired = _repair_truncated_json(raw_text)
            plan = json.loads(repaired)
            return {"status": "success", "plan": plan}
        except Exception:
            pass
        return {
            "status": "error",
            "error": "La génération a été tronquée. Réessayez.",
        }
    except Exception as e:
        logger.error("Failed to generate content plan: {}".format(e))
        return {
            "status": "error",
            "error": "Erreur de génération: {}".format(str(e)),
        }


class GenerateContentRequest(BaseModel):
    channel_ids: List[int]
    message_type: str = "hook"
    subject: str
    remix: bool = False
    num_variants: int = 5


@router.post("/generate-content")
def generate_content(
    req: GenerateContentRequest,
    db: Session = Depends(get_db),
) -> dict:
    """Generate content variants inspired by channel styles."""
    channels_info = []
    sample_texts = []

    for ch_id in req.channel_ids[:3]:
        channel = db.query(Channel).filter(Channel.id == ch_id).first()
        if not channel:
            continue
        channels_info.append(channel.title)

        msgs = (
            db.query(Message.text_content)
            .filter(
                Message.channel_id == ch_id,
                Message.text_content.isnot(None),
                Message.text_content != "",
            )
            .order_by(Message.views_count.desc())
            .limit(15)
            .all()
        )
        for (text,) in msgs:
            if text:
                sample_texts.append(text[:300])

    if not channels_info or not sample_texts:
        raise HTTPException(status_code=404, detail="No channel data found")

    channels_str = " + ".join(channels_info)
    samples_str = "\n---\n".join(sample_texts[:20])

    if req.remix and len(channels_info) > 1:
        style_instruction = (
            "Mix the writing styles of these channels: {}. "
            "Combine elements from each style into a unique voice."
        ).format(channels_str)
    else:
        style_instruction = (
            "Write in the exact same style, tone, and formatting as the "
            "channel '{}'. Mimic their vocabulary, emoji usage, message "
            "structure, and voice perfectly."
        ).format(channels_info[0])

    prompt = (
        "You are a Telegram content creator. {style}\n\n"
        "SAMPLE MESSAGES FROM THE CHANNEL(S):\n{samples}\n\n"
        "TASK: Create {num} message variants for this topic:\n"
        "Subject: {subject}\n"
        "Message type: {msg_type}\n\n"
        "Return a JSON array with {num} variants:\n"
        "[\n"
        '  {{\n'
        '    "text": "the full message text exactly as it would be posted",\n'
        '    "hook_type": "question/bold_claim/statistic/story/urgency/social_proof/etc",\n'
        '    "cta_type": "link_click/join_channel/contact_dm/none/etc",\n'
        '    "style": "description of style used",\n'
        '    "explanation": "why this variant works"\n'
        '  }}\n'
        "]\n\n"
        "IMPORTANT: Write the messages in the SAME LANGUAGE as the sample messages. "
        "Include emojis and formatting exactly like the channel would. "
        "Return ONLY the JSON array, no other text."
    ).format(
        style=style_instruction,
        samples=samples_str,
        num=req.num_variants,
        subject=req.subject,
        msg_type=req.message_type,
    )

    try:
        response = message_analyzer.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            messages=[{"role": "user", "content": prompt}],
        )
        raw_text = response.content[0].text.strip()

        if raw_text.startswith("```"):
            lines = raw_text.split("\n")
            lines = [l for l in lines if not l.strip().startswith("```")]
            raw_text = "\n".join(lines)

        variants = json.loads(raw_text)
        if not isinstance(variants, list):
            variants = [variants]

        return {"status": "success", "variants": variants}

    except json.JSONDecodeError as e:
        logger.error("Failed to parse generated content: {}".format(e))
        return {"status": "partial", "raw_text": raw_text, "error": str(e)}
    except Exception as e:
        logger.error("Content generation failed: {}".format(e))
        raise HTTPException(
            status_code=500,
            detail="Content generation failed: {}".format(str(e)),
        )
