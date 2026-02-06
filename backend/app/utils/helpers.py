import json
import re
from datetime import datetime
from typing import Any, Dict, List, Optional


def safe_json_loads(value: Optional[str], default: Any = None) -> Any:
    """
    Safely parse a JSON string. Returns default if parsing fails.

    Args:
        value: JSON string to parse.
        default: Default value to return on failure.

    Returns:
        Parsed JSON value or default.
    """
    if not value:
        return default
    try:
        return json.loads(value)
    except (json.JSONDecodeError, TypeError):
        return default


def safe_json_dumps(value: Any, default: str = "null") -> str:
    """
    Safely serialize a value to JSON string.

    Args:
        value: Value to serialize.
        default: Default string to return on failure.

    Returns:
        JSON string or default.
    """
    try:
        return json.dumps(value, ensure_ascii=False)
    except (TypeError, ValueError):
        return default


def extract_urls(text: Optional[str]) -> List[str]:
    """
    Extract all URLs from a text string.

    Args:
        text: Input text to search for URLs.

    Returns:
        List of URLs found in the text.
    """
    if not text:
        return []

    url_pattern = re.compile(
        r"https?://(?:[-\w.]|(?:%[\da-fA-F]{2}))+[/\w\-.~:/?#\[\]@!$&'()*+,;=%]*"
    )
    return url_pattern.findall(text)


def truncate_text(text: Optional[str], max_length: int = 200) -> Optional[str]:
    """
    Truncate text to a maximum length with ellipsis.

    Args:
        text: Text to truncate.
        max_length: Maximum length before truncation.

    Returns:
        Truncated text or original if shorter.
    """
    if not text:
        return text
    if len(text) <= max_length:
        return text
    return text[:max_length] + "..."


def format_number(number: int) -> str:
    """
    Format a number for human-readable display.

    Args:
        number: Number to format.

    Returns:
        Formatted string (e.g., '1.2K', '3.5M').
    """
    if number >= 1_000_000:
        return f"{number / 1_000_000:.1f}M"
    elif number >= 1_000:
        return f"{number / 1_000:.1f}K"
    return str(number)


def calculate_engagement_rate(
    views: int,
    forwards: int,
    reactions: int,
    replies: int,
) -> float:
    """
    Calculate a simple engagement rate.

    Args:
        views: Number of views.
        forwards: Number of forwards.
        reactions: Number of reactions.
        replies: Number of replies.

    Returns:
        Engagement rate as a float between 0 and 100.
    """
    if views == 0:
        return 0.0

    interactions = forwards + reactions + replies
    rate = (interactions / views) * 100
    return round(rate, 2)


def normalize_telegram_username(username: str) -> str:
    """
    Normalize a Telegram username by removing @ prefix and trimming whitespace.

    Args:
        username: Raw username string.

    Returns:
        Cleaned username.
    """
    return username.lstrip("@").strip().lower()


def parse_datetime_or_none(value: Any) -> Optional[datetime]:
    """
    Parse a datetime from various formats, returning None on failure.

    Args:
        value: Value to parse (string, datetime, or None).

    Returns:
        Parsed datetime or None.
    """
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        for fmt in (
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%dT%H:%M:%S.%f",
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d",
        ):
            try:
                return datetime.strptime(value, fmt)
            except ValueError:
                continue
    return None


def chunk_list(lst: List[Any], chunk_size: int) -> List[List[Any]]:
    """
    Split a list into chunks of a given size.

    Args:
        lst: List to split.
        chunk_size: Size of each chunk.

    Returns:
        List of list chunks.
    """
    return [lst[i : i + chunk_size] for i in range(0, len(lst), chunk_size)]


def sanitize_text(text: Optional[str]) -> Optional[str]:
    """
    Sanitize text by removing null bytes and excessive whitespace.

    Args:
        text: Text to sanitize.

    Returns:
        Sanitized text.
    """
    if not text:
        return text

    # Remove null bytes
    text = text.replace("\x00", "")

    # Normalize whitespace (collapse multiple spaces/newlines)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r" {2,}", " ", text)

    return text.strip()
