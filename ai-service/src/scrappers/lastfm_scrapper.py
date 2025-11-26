import os
from urllib.request import urlretrieve

import pylast
from image_optimizer import optimize_image_in_place
from logging_config import get_logger

# Configure logger
logger = get_logger(__name__)


def get_album_art(artist_title: str) -> dict:
    """
    Scrape Last.fm for album art image.

    Args:
        artist_title: Artist and title to search for (e.g., "foo fighters - everlong")

    Returns:
        Dict with 'imagePath' and 'imageUrl' keys, or empty dict if not found
    """
    logger.info(f"Starting Last.fm search for: {artist_title}")

    # Parse artist and title
    if " - " in artist_title:
        artist, title = artist_title.split(" - ", 1)
    else:
        # Try to split by first space as artist/title if no dash
        parts = artist_title.split(" ", 1)
        if len(parts) < 2:
            logger.warning("Could not parse artist and title from input")
            return {}
        artist, title = parts[0], parts[1]

    logger.debug(f"Parsed artist: '{artist}', title: '{title}'")

    # Initialize Last.fm network (using sample API key)
    API_KEY = os.environ.get("LAST_FM_API_KEY")
    API_SECRET = os.environ.get("LAST_FM_SECRET_KEY")

    network = pylast.LastFMNetwork(api_key=API_KEY, api_secret=API_SECRET)
    logger.debug("Initialized Last.fm network")

    try:
        # Get track and album
        logger.debug(f"Searching for track: {artist} - {title}")
        track = network.get_track(artist, title)
        album = track.get_album()

        if not album:
            logger.warning("No album found for track")
            return {}

        logger.info(f"Found album: {album.get_name()}")

        # Get cover image URL (pylast provides get_cover_image method)
        logger.debug("Getting cover image URL")
        image_url = album.get_cover_image(size=pylast.SIZE_EXTRA_LARGE)

        if not image_url:
            # Try other sizes
            logger.debug("Trying large size")
            image_url = album.get_cover_image(size=pylast.SIZE_LARGE)

        if not image_url:
            logger.debug("Trying default size")
            image_url = album.get_cover_image()

        if not image_url:
            logger.warning("No cover image found for album")
            return {}

        logger.info(f"Found image URL: {image_url}")

        # Create images directory
        project_root = os.path.dirname(
            os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
        )
        images_dir = os.path.join(project_root, "muzo", "images")
        os.makedirs(images_dir, exist_ok=True)
        logger.debug(f"Images directory: {images_dir}")

        # Generate filename
        safe_artist = "".join(
            c for c in artist if c.isalnum() or c in (" ", "-", "_")
        ).strip()
        safe_title = "".join(
            c for c in title if c.isalnum() or c in (" ", "-", "_")
        ).strip()
        safe_artist = safe_artist.replace(" ", "_")
        safe_title = safe_title.replace(" ", "_")
        filename = f"{safe_artist}_{safe_title}.jpg"
        image_path = os.path.join(images_dir, filename)
        logger.debug(f"Image path: {image_path}")

        # Download and save image
        logger.info("Downloading and saving image")
        urlretrieve(image_url, image_path)
        logger.info(f"Successfully saved image to: {image_path}")

        # Optimize the image
        logger.info("Optimizing image")
        try:
            optimize_image_in_place(image_path)
            logger.info("Image optimization completed")
        except Exception as e:
            logger.warning(f"Image optimization failed: {e}")

        return {"imagePath": image_path, "imageUrl": image_url}

    except Exception as e:
        logger.error(f"Error scraping Last.fm: {e}")
        return {}


if __name__ == "__main__":
    # Test with the provided values
    result1 = get_album_art("foo fighters - everlong")
    print(f"Foo Fighters result: {result1}")

    result2 = get_album_art("datadata phone xone")
    print(f"Datadata result: {result2}")
