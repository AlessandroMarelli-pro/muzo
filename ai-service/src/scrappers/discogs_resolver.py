"""
Discogs release URL resolution.

Unlike Bandcamp, Discogs has a real, official REST API (60 req/min
authenticated, simple user-token auth, no bot-blocking) -- no scraping, no
LLM fallback needed.
"""

import os

import discogs_client

from src.scrappers.logging_config import get_logger

logger = get_logger(__name__)

DISCOGS_BASE_URL = "https://www.discogs.com"


def resolve_url(artist_title: str) -> str | None:
    """
    Search Discogs and return the URL of the first matching release.

    Args:
        artist_title: Artist and title to search for (e.g., "Sade Smooth Operator")

    Returns:
        The matched Discogs release URL, or None if not found.
    """
    logger.debug(f"Starting Discogs search for: {artist_title}")

    user_token = os.getenv("DISCOGS_USER_TOKEN")
    if not user_token:
        logger.warning("DISCOGS_USER_TOKEN not set; skipping Discogs lookup")
        return None

    try:
        logger.debug("Querying Discogs release search API")
        client = discogs_client.Client("Muzo/1.0", user_token=user_token)
        results = client.search(artist_title, type="release")
        logger.debug(f"Discogs search returned {len(results)} result(s)")

        release = results[0] if results else None
        if not release or not release.url:
            logger.warning(f"No Discogs match found for: {artist_title!r}")
            return None

        release_url = f"{DISCOGS_BASE_URL}{release.url}"
        logger.debug(f"Found Discogs release URL: {release_url}")
        return release_url

    except Exception as e:
        logger.error(f"Error searching Discogs: {e}")
        return None


if __name__ == "__main__":
    result = resolve_url("Sade Smooth Operator")
    print(f"Result: {result}")
