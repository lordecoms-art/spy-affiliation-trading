import json
import logging
from datetime import datetime
from typing import Any, Dict, Optional

from anthropic import Anthropic

from app.config import settings

logger = logging.getLogger(__name__)

ANALYSIS_PROMPT = """You are an expert marketing analyst specializing in Telegram affiliate marketing and trading channels. Analyze the following message and provide a structured analysis.

MESSAGE TEXT:
---
{message_text}
---

ADDITIONAL CONTEXT:
- Content type: {content_type}
- Views: {views_count}
- Forwards: {forwards_count}
- Reactions: {reactions_count}
- Has CTA button: {has_cta}
- CTA text: {cta_text}
- External links: {external_links}

Provide your analysis as a valid JSON object with exactly these fields:

{{
    "hook_type": "one of: question, bold_claim, statistic, story, urgency, fear, curiosity, social_proof, authority, pain_point, none",
    "cta_type": "one of: link_click, join_channel, buy_product, sign_up, contact_dm, forward_message, none",
    "tone": "one of: urgent, professional, casual, aggressive, educational, inspirational, fear_based, friendly",
    "promises": ["list of specific promises or claims made in the message"],
    "social_proof_elements": ["list of social proof elements used, e.g., testimonials, numbers, screenshots, results"],
    "engagement_score": 0.0 to 10.0,
    "virality_potential": 0.0 to 10.0
}}

IMPORTANT:
- engagement_score: Rate 0-10 based on how engaging the message is (hook strength, emotional triggers, clarity).
- virality_potential: Rate 0-10 based on likelihood of being forwarded/shared (novelty, emotion, usefulness).
- Be precise and factual. Only list promises/social_proof that are actually present.
- Return ONLY the JSON object, no other text.
"""

VOICE_ANALYSIS_PROMPT = """You are an expert marketing analyst. Analyze the following voice message transcript from a Telegram affiliate/trading channel.

TRANSCRIPT:
---
{transcript}
---

DURATION: {duration} seconds

Provide your analysis as a valid JSON object with exactly these fields:

{{
    "hook_type": "one of: question, bold_claim, statistic, story, urgency, fear, curiosity, social_proof, authority, pain_point, none",
    "cta_type": "one of: link_click, join_channel, buy_product, sign_up, contact_dm, forward_message, none",
    "tone": "one of: urgent, professional, casual, aggressive, educational, inspirational, fear_based, friendly",
    "promises": ["list of specific promises or claims made"],
    "social_proof_elements": ["list of social proof elements used"],
    "engagement_score": 0.0 to 10.0,
    "virality_potential": 0.0 to 10.0
}}

Return ONLY the JSON object, no other text.
"""


class MessageAnalyzer:
    """Service for analyzing messages using Claude/Anthropic API."""

    def __init__(self) -> None:
        self._client: Optional[Anthropic] = None

    @property
    def client(self) -> Anthropic:
        if self._client is None:
            if not settings.ANTHROPIC_API_KEY:
                raise ValueError(
                    "ANTHROPIC_API_KEY is not configured. "
                    "Set it in .env or environment variables."
                )
            self._client = Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        return self._client

    def analyze_message(
        self,
        text_content: str,
        content_type: str = "text",
        views_count: int = 0,
        forwards_count: int = 0,
        reactions_count: int = 0,
        has_cta: bool = False,
        cta_text: Optional[str] = None,
        external_links: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Analyze a message using Claude API.

        Args:
            text_content: The message text to analyze.
            content_type: Type of the message content.
            views_count: Number of views.
            forwards_count: Number of forwards.
            reactions_count: Number of reactions.
            has_cta: Whether the message has a CTA button.
            cta_text: CTA button text if present.
            external_links: JSON string of external links.

        Returns:
            Dictionary with analysis results or None on failure.
        """
        if not text_content or not text_content.strip():
            logger.warning("Empty text content, skipping analysis.")
            return None

        try:
            prompt = ANALYSIS_PROMPT.format(
                message_text=text_content,
                content_type=content_type,
                views_count=views_count,
                forwards_count=forwards_count,
                reactions_count=reactions_count,
                has_cta=has_cta,
                cta_text=cta_text or "N/A",
                external_links=external_links or "None",
            )

            response = self.client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=1024,
                messages=[
                    {"role": "user", "content": prompt},
                ],
            )

            response_text = response.content[0].text.strip()

            # Clean potential markdown code block wrapper
            if response_text.startswith("```"):
                lines = response_text.split("\n")
                # Remove first line (```json or ```) and last line (```)
                lines = [
                    line
                    for line in lines
                    if not line.strip().startswith("```")
                ]
                response_text = "\n".join(lines)

            analysis = json.loads(response_text)

            # Validate and sanitize
            result: Dict[str, Any] = {
                "hook_type": str(analysis.get("hook_type", "none")),
                "cta_type": str(analysis.get("cta_type", "none")),
                "tone": str(analysis.get("tone", "casual")),
                "promises": json.dumps(analysis.get("promises", [])),
                "social_proof_elements": json.dumps(
                    analysis.get("social_proof_elements", [])
                ),
                "engagement_score": float(
                    analysis.get("engagement_score", 0.0)
                ),
                "virality_potential": float(
                    analysis.get("virality_potential", 0.0)
                ),
                "raw_analysis": json.dumps(analysis),
                "analyzed_at": datetime.utcnow(),
            }

            logger.info("Message analyzed successfully.")
            return result

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse analysis response as JSON: {e}")
            return None
        except Exception as e:
            logger.error(f"Error analyzing message: {e}")
            return None

    def analyze_voice_transcript(
        self,
        transcript: str,
        duration: int = 0,
    ) -> Optional[Dict[str, Any]]:
        """
        Analyze a voice message transcript using Claude API.

        Args:
            transcript: The voice message transcript.
            duration: Duration of the voice message in seconds.

        Returns:
            Dictionary with analysis results or None on failure.
        """
        if not transcript or not transcript.strip():
            logger.warning("Empty transcript, skipping analysis.")
            return None

        try:
            prompt = VOICE_ANALYSIS_PROMPT.format(
                transcript=transcript,
                duration=duration,
            )

            response = self.client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=1024,
                messages=[
                    {"role": "user", "content": prompt},
                ],
            )

            response_text = response.content[0].text.strip()

            if response_text.startswith("```"):
                lines = response_text.split("\n")
                lines = [
                    line
                    for line in lines
                    if not line.strip().startswith("```")
                ]
                response_text = "\n".join(lines)

            analysis = json.loads(response_text)

            result: Dict[str, Any] = {
                "hook_type": str(analysis.get("hook_type", "none")),
                "cta_type": str(analysis.get("cta_type", "none")),
                "tone": str(analysis.get("tone", "casual")),
                "promises": json.dumps(analysis.get("promises", [])),
                "social_proof_elements": json.dumps(
                    analysis.get("social_proof_elements", [])
                ),
                "engagement_score": float(
                    analysis.get("engagement_score", 0.0)
                ),
                "virality_potential": float(
                    analysis.get("virality_potential", 0.0)
                ),
                "raw_analysis": json.dumps(analysis),
                "analyzed_at": datetime.utcnow(),
            }

            logger.info("Voice transcript analyzed successfully.")
            return result

        except json.JSONDecodeError as e:
            logger.error(
                f"Failed to parse voice analysis response as JSON: {e}"
            )
            return None
        except Exception as e:
            logger.error(f"Error analyzing voice transcript: {e}")
            return None


# Singleton instance
message_analyzer = MessageAnalyzer()
