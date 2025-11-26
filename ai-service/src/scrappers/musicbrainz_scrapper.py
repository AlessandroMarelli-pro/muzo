import os

import musicbrainzngs
from image_optimizer import optimize_image_in_place
from logging_config import get_logger
from musicbrainzngs import WebServiceError

# Configure logger
logger = get_logger(__name__)


def get_album_art(artist_title: str) -> dict:
    """
    Scrape MusicBrainz for album art image.

    Args:
        artist_title: Artist and title to search for (e.g., "datadata phone xone")

    Returns:
        Dict with 'imagePath' and 'imageUrl' keys, or empty dict if not found
    """
    logger.info(f"Starting MusicBrainz search for: {artist_title}")

    # Set user agent (required by MusicBrainz)
    musicbrainzngs.set_useragent("Muzo Album Art Scraper", "1.0", "contact@example.com")
    logger.debug("Set MusicBrainz user agent")

    try:
        # Search for release groups
        logger.debug("Searching for release groups")
        result = musicbrainzngs.search_release_groups(artist_title)

        if (
            not result
            or "release-group-list" not in result
            or not result["release-group-list"]
        ):
            logger.warning("No release groups found")
            return {}

        # Get the first release group
        release_group = result["release-group-list"][0]
        release_group_id = release_group["id"]
        logger.info(
            f"Found release group: {release_group['title']} (ID: {release_group_id})"
        )

        # Get the first release from the release group
        logger.debug("Getting release details")
        release_result = musicbrainzngs.get_release_group_by_id(
            release_group_id, includes=["releases"]
        )

        if not release_result or "release-list" not in release_result["release-group"]:
            logger.warning("No releases found in release group")
            return {}

        release = release_result["release-group"]["release-list"][0]
        release_id = release["id"]
        logger.info(f"Found release: {release['title']} (ID: {release_id})")

        # Get the front cover image
        logger.debug("Getting front cover image")
        image_data = musicbrainzngs.get_image_front(release_id, size=None)

        if not image_data:
            logger.warning("No cover image found for release")
            return {}

        logger.info("Successfully retrieved cover image data")

        # Create images directory if it doesn't exist
        # Navigate from ai-service/src/scrappers/ to project root
        project_root = os.path.dirname(
            os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
        )
        images_dir = os.path.join(project_root, "muzo", "images")
        os.makedirs(images_dir, exist_ok=True)
        logger.debug(f"Images directory: {images_dir}")

        # Generate filename from release group title
        safe_title = "".join(
            c for c in release_group["title"] if c.isalnum() or c in (" ", "-", "_")
        ).rstrip()
        safe_title = safe_title.replace(" ", "_")
        filename = f"{safe_title}_{release_id[:8]}.jpg"
        image_path = os.path.join(images_dir, filename)
        logger.debug(f"Image path: {image_path}")

        # Save image to file
        logger.info("Saving image to file")
        with open(image_path, "wb") as f:
            f.write(image_data)
        logger.info(f"Successfully saved image to: {image_path}")

        # Optimize the image
        logger.info("Optimizing image")
        try:
            optimize_image_in_place(image_path)
            logger.info("Image optimization completed")
        except Exception as e:
            logger.warning(f"Image optimization failed: {e}")

        # Get image URL (construct from release ID)
        image_url = f"https://coverartarchive.org/release/{release_id}/front"
        logger.debug(f"Image URL: {image_url}")

        return {"imagePath": image_path, "imageUrl": image_url}

    except WebServiceError as e:
        logger.error(f"MusicBrainz API error: {e}")
        return {}
    except Exception as e:
        logger.error(f"Error scraping MusicBrainz: {e}")
        return {}


if __name__ == "__main__":
    # Test with the provided value
    result = get_album_art("datadata phone xone")
    print(f"Result: {result}")
