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

# Add parent directories to path for imports
sys.path.append(os.path.dirname(os.path.dirname(__file__)))
from image_optimizer import optimize_image_in_place
from src.services.simple_metadata_extractor import SimpleMetadataExtractor

# Configure logger
logger = get_logger(__name__)


def get_album_art(artist_title: str, file_path: str = None) -> dict:
    """
    Dispatcher to search for album art across multiple sources.

    First checks for embedded images in the audio file if file_path is provided.
    If no embedded image is found, tries external sources in order:
    Apple Music -> Bandcamp -> Last.fm -> MusicBrainz

    Args:
        artist_title: Artist and title to search for
        file_path: Optional path to audio file to check for embedded images

    Returns:
        Dict with 'source', 'imagePath' and 'imageUrl' keys, or empty dict if not found
    """
    logger.info(f"Starting album art search for: {artist_title}")

    # First, check for embedded image in file if file_path is provided
    if file_path and os.path.exists(file_path):
        try:
            logger.debug(f"Checking for embedded image in file: {file_path}")
            extractor = SimpleMetadataExtractor()
            image_data = extractor.extract_embedded_image(file_path)

            if image_data:
                logger.info("Found embedded image in audio file")

                # Create images directory
                project_root = os.path.dirname(
                    os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
                )
                images_dir = os.path.join(project_root, "muzo", "images")
                os.makedirs(images_dir, exist_ok=True)
                logger.debug(f"Images directory: {images_dir}")

                # Generate filename from artist_title
                safe_name = "".join(
                    c for c in artist_title if c.isalnum() or c in (" ", "-", "_")
                ).strip()
                safe_name = safe_name.replace(" ", "_")
                # Determine file extension from image data (check magic bytes)
                if image_data.startswith(b"\xff\xd8\xff"):
                    ext = ".jpg"
                elif image_data.startswith(b"\x89PNG\r\n\x1a\n"):
                    ext = ".png"
                else:
                    ext = ".jpg"  # Default to jpg
                filename = f"{safe_name}{ext}"
                image_path = os.path.join(images_dir, filename)
                logger.debug(f"Image path: {image_path}")

                # Save image to file
                logger.info("Saving embedded image to file")
                with open(image_path, "wb") as f:
                    f.write(image_data)
                logger.info(f"Successfully saved embedded image to: {image_path}")

                # Optimize the image
                try:
                    logger.info("Optimizing embedded image")
                    optimize_image_in_place(image_path)
                    logger.info("Image optimization completed")
                except Exception as e:
                    logger.warning(f"Image optimization failed: {e}")

                return {
                    "source": "embedded",
                    "imagePath": image_path,
                    "imageUrl": None,  # Embedded images don't have URLs
                }
            else:
                logger.debug(
                    "No embedded image found in file, proceeding with external sources"
                )
        except Exception as e:
            logger.warning(
                f"Failed to extract embedded image: {e}, proceeding with external sources"
            )

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
