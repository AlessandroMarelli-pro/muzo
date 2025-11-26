import importlib.util
import logging
import os
import sys

# Add current directory to path
sys.path.append(os.path.dirname(__file__))

from apple_music_scrapper import get_album_art as get_apple_music_art
from bancamp_scrapper import get_album_art as get_bandcamp_art
from lastfm_scrapper import get_album_art as get_lastfm_art
from logging_config import get_logger
from musicbrainz_scrapper import get_album_art as get_musicbrainz_art

# Configure logger
logger = get_logger(__name__)


def get_album_art(artist_title: str) -> dict:
    """
    Dispatcher to search for album art across multiple sources.

    Tries sources in order: Bandcamp -> Last.fm -> MusicBrainz

    Args:
        artist_title: Artist and title to search for

    Returns:
        Dict with 'source', 'imagePath' and 'imageUrl' keys, or empty dict if not found
    """
    logger.info(f"Starting album art search for: {artist_title}")

    # Try Apple Music first
    logger.debug("Trying Apple Music scraper")
    result = get_apple_music_art(artist_title)
    if result:
        result["source"] = "apple_music"
        logger.info(f"Found album art on Apple Music: {result['imageUrl']}")
        return result
    logger.debug("Apple Music scraper returned no results")

    # Try Bandcamp second
    logger.debug("Trying Bandcamp scraper")
    result = get_bandcamp_art(artist_title)
    if result:
        result["source"] = "bandcamp"
        logger.info(f"Found album art on Bandcamp: {result['imageUrl']}")
        return result
    logger.debug("Bandcamp scraper returned no results")

    # Try Last.fm second
    logger.debug("Trying Last.fm scraper")
    result = get_lastfm_art(artist_title)
    if result:
        result["source"] = "lastfm"
        logger.info(f"Found album art on Last.fm: {result['imageUrl']}")
        return result
    logger.debug("Last.fm scraper returned no results")

    # Try MusicBrainz last
    logger.debug("Trying MusicBrainz scraper")
    result = get_musicbrainz_art(artist_title)
    if result:
        result["source"] = "musicbrainz"
        logger.info(f"Found album art on MusicBrainz: {result['imageUrl']}")
        return result
    logger.debug("MusicBrainz scraper returned no results")

    # No results found
    logger.warning(f"No album art found for: {artist_title}")
    return {}


if __name__ == "__main__":
    # Configure logging for testing
    from logging_config import setup_logging

    setup_logging(level=logging.INFO)

    # Test with the provided value
    result = get_album_art("datadata phone xone")
    print(f"Dispatcher result: {result}")

    # Test with another value
    result2 = get_album_art("foo fighters - everlong")
    print(f"Foo Fighters result: {result2}")

    # Test with a value that should fall back to Last.fm
    result3 = get_album_art("nonexistent artist - nonexistent song")
    print(f"Nonexistent result: {result3}")
