"""
Gemini-with-search fallback for Bandcamp URL resolution.

bandcamp.com/search is behind a Private Access Token bot-check that no HTTP
client or headless browser can pass (verified: curl_cffi w/ Chrome TLS
impersonation and Playwright w/ stealth patches both still get served the
challenge page). This asks Gemini, with Google Search grounding, to find the
URL instead -- it does the searching, we just need the URL back. Direct
Bandcamp pages (not /search) load fine, so this only replaces the search step.
"""

import os

from src.scrappers.logging_config import get_logger

logger = get_logger(__name__)

try:
    from google import genai
    from google.genai import types

    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False


def resolve_url_via_gemini(artist_title: str) -> str | None:
    """
    Ask Gemini (with Google Search grounding) for the Bandcamp URL matching
    the given artist/title.

    Returns:
        The matched Bandcamp URL, or None if unavailable/not found.
    """
    if not GEMINI_AVAILABLE:
        logger.warning("google-genai SDK not installed; skipping Gemini fallback")
        return None

    api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
    if not api_key:
        logger.warning("No GOOGLE_API_KEY/GEMINI_API_KEY set; skipping Gemini fallback")
        return None

    model = os.getenv("GEMINI_BANDCAMP_MODEL", "gemini-flash-lite-latest")

    try:
        client = genai.Client(api_key=api_key)
        config = types.GenerateContentConfig(
            temperature=0.0,
            tools=[types.Tool(google_search=types.GoogleSearch())],
        )
        prompt = (
            f'Find the official Bandcamp URL (bandcamp.com) for the track or '
            f'album by artist "{artist_title}". Return ONLY the URL, nothing '
            f"else -- no explanation, no markdown. If you cannot find a "
            f'confident exact match, return exactly: NONE'
        )
        response = client.models.generate_content(
            model=model, contents=prompt, config=config
        )
        raw_text = (response.text or "").strip() if hasattr(response, "text") else ""
        logger.debug(f"Gemini Bandcamp lookup: {artist_title!r} -> {raw_text!r}")

        if not raw_text or raw_text.upper() == "NONE":
            return None
        if "bandcamp.com" not in raw_text:
            logger.warning(f"Gemini returned a non-Bandcamp URL, discarding: {raw_text!r}")
            return None
        return raw_text

    except Exception as e:
        logger.warning(f"Gemini Bandcamp fallback failed: {e}")
        return None
