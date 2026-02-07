import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

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

    def analyze_messages_batch(
        self, messages: List[Dict[str, Any]]
    ) -> Optional[List[Dict[str, Any]]]:
        """
        Analyze a batch of messages (up to 10) in a single Claude API call.

        Args:
            messages: List of dicts, each with keys: text_content, content_type,
                      views_count, forwards_count, reactions_count, has_cta,
                      cta_text, external_links.

        Returns:
            List of result dicts (one per message) or None on failure.
            Each result dict has: hook_type, cta_type, tone, promises,
            social_proof_elements, engagement_score, virality_potential,
            raw_analysis, analyzed_at.
        """
        if not messages:
            logger.warning("Empty messages list, skipping batch analysis.")
            return None

        # Build numbered message blocks
        message_blocks = []
        for i, msg in enumerate(messages):
            text = msg.get("text_content", "")
            if not text or not text.strip():
                text = "(empty)"
            block = (
                f"=== MESSAGE {i + 1} ===\n"
                f"TEXT:\n{text}\n"
                f"Content type: {msg.get('content_type', 'text')}\n"
                f"Views: {msg.get('views_count', 0)}\n"
                f"Forwards: {msg.get('forwards_count', 0)}\n"
                f"Reactions: {msg.get('reactions_count', 0)}\n"
                f"Has CTA button: {msg.get('has_cta', False)}\n"
                f"CTA text: {msg.get('cta_text') or 'N/A'}\n"
                f"External links: {msg.get('external_links') or 'None'}\n"
            )
            message_blocks.append(block)

        all_messages_text = "\n".join(message_blocks)

        prompt = (
            "You are an expert marketing analyst specializing in Telegram affiliate "
            "marketing and trading channels. Analyze each of the following messages "
            "and provide a structured analysis for EACH one.\n\n"
            f"{all_messages_text}\n\n"
            f"Return a JSON array with exactly {len(messages)} objects (one per message, "
            "in the same order). Each object must have exactly these fields:\n\n"
            "{\n"
            '    "hook_type": "one of: question, bold_claim, statistic, story, urgency, '
            'fear, curiosity, social_proof, authority, pain_point, none",\n'
            '    "cta_type": "one of: link_click, join_channel, buy_product, sign_up, '
            'contact_dm, forward_message, none",\n'
            '    "tone": "one of: urgent, professional, casual, aggressive, educational, '
            'inspirational, fear_based, friendly",\n'
            '    "promises": ["list of specific promises or claims made in the message"],\n'
            '    "social_proof_elements": ["list of social proof elements used"],\n'
            '    "engagement_score": 0.0 to 10.0,\n'
            '    "virality_potential": 0.0 to 10.0\n'
            "}\n\n"
            "IMPORTANT:\n"
            "- engagement_score: Rate 0-10 based on how engaging the message is.\n"
            "- virality_potential: Rate 0-10 based on likelihood of being forwarded/shared.\n"
            "- Be precise and factual. Only list promises/social_proof that are actually present.\n"
            "- Return ONLY the JSON array, no other text.\n"
        )

        try:
            response = self.client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=4096,
                messages=[
                    {"role": "user", "content": prompt},
                ],
            )

            response_text = response.content[0].text.strip()

            # Clean potential markdown code block wrapper
            if response_text.startswith("```"):
                lines = response_text.split("\n")
                lines = [
                    line
                    for line in lines
                    if not line.strip().startswith("```")
                ]
                response_text = "\n".join(lines)

            analyses = json.loads(response_text)

            if not isinstance(analyses, list):
                logger.error("Batch analysis response is not a JSON array.")
                return None

            # Pad or truncate to match input length
            now = datetime.utcnow()
            results: List[Dict[str, Any]] = []

            for i in range(len(messages)):
                if i < len(analyses):
                    a = analyses[i]
                else:
                    # If Claude returned fewer results, use defaults
                    a = {}

                result: Dict[str, Any] = {
                    "hook_type": str(a.get("hook_type", "none")),
                    "cta_type": str(a.get("cta_type", "none")),
                    "tone": str(a.get("tone", "casual")),
                    "promises": json.dumps(a.get("promises", [])),
                    "social_proof_elements": json.dumps(
                        a.get("social_proof_elements", [])
                    ),
                    "engagement_score": float(
                        a.get("engagement_score", 0.0)
                    ),
                    "virality_potential": float(
                        a.get("virality_potential", 0.0)
                    ),
                    "raw_analysis": json.dumps(a),
                    "analyzed_at": now,
                }
                results.append(result)

            logger.info(
                f"Batch analysis complete: {len(results)} messages analyzed."
            )
            return results

        except json.JSONDecodeError as e:
            logger.error(
                f"Failed to parse batch analysis response as JSON: {e}"
            )
            return None
        except Exception as e:
            logger.error(f"Error in batch analysis: {e}")
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
