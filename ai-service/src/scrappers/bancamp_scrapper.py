import os
import urllib.parse
from urllib.request import urlretrieve

from bs4 import BeautifulSoup
from curl_cffi import requests as curl_requests

from src.scrappers.gemini_bandcamp_resolver import resolve_url_via_gemini
from src.scrappers.image_optimizer import optimize_image_in_place
from src.scrappers.logging_config import get_logger

# Configure logger
logger = get_logger(__name__)


def resolve_url(artist_title: str) -> str | None:
    """
    Search Bandcamp and return the URL of the first matching album/track.

    Args:
        artist_title: Artist and title to search for (e.g., "datadata phone xone")

    Returns:
        The matched Bandcamp URL, or None if not found.
    """
    logger.debug(f"Starting Bandcamp search for: {artist_title}")

    encoded_query = urllib.parse.quote(artist_title)
    search_url = f"https://bandcamp.com/search?q={encoded_query}"
    logger.debug(f"Search URL: {search_url}")

    try:
        # Bandcamp's search page serves a JS bot-check to generic HTTP clients;
        # impersonating Chrome's TLS/HTTP2 fingerprint is what clears it.
        response = curl_requests.get(search_url, impersonate="chrome")
        soup = BeautifulSoup(response.text, "html.parser")

        itemurl_div = soup.find("div", class_="itemurl")
        album_link = itemurl_div.find("a") if itemurl_div else None
        album_url = album_link.get("href") if album_link else None

        if album_url:
            logger.debug(f"Found album URL: {album_url}")
            return album_url

        logger.warning("Search scrape found no match, falling back to Gemini")

    except Exception as e:
        logger.error(f"Error searching Bandcamp: {e}")

    # Fallback: bandcamp.com/search is behind a Private Access Token bot-check
    # (see gemini_bandcamp_resolver docstring) -- ask Gemini with Google Search
    # grounding to find the URL instead.
    return resolve_url_via_gemini(artist_title)


def get_album_art(artist_title: str) -> dict:
    """
    Scrape Bandcamp for album art image.

    Args:
        artist_title: Artist and title to search for (e.g., "datadata phone xone")

    Returns:
        Dict with 'imagePath' and 'imageUrl' keys, or empty dict if not found
    """
    album_url = resolve_url(artist_title)
    if not album_url:
        return {}

    try:
        # Fetch the album page
        logger.debug("Fetching album page")
        album_response = curl_requests.get(album_url, impersonate="chrome")
        album_soup = BeautifulSoup(album_response.text, "html.parser")

        # Find the album art
        album_art_div = album_soup.find("div", id="tralbumArt")
        if not album_art_div:
            logger.warning("No tralbumArt div found on album page")
            return {}

        img = album_art_div.find("img")
        if not img:
            logger.warning("No img found in tralbumArt div")
            return {}

        image_url = img.get("src", "")
        if not image_url:
            logger.warning("No src found in img tag")
            return {}

        logger.debug(f"Found image URL: {image_url}")

        # Create images directory
        project_root = os.path.dirname(
            os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
        )
        images_dir = os.path.join(project_root, "muzo", "images")
        os.makedirs(images_dir, exist_ok=True)
        logger.debug(f"Images directory: {images_dir}")

        # Generate filename
        safe_title = "".join(
            c for c in artist_title if c.isalnum() or c in (" ", "-", "_")
        ).strip()
        safe_title = safe_title.replace(" ", "_")
        filename = f"{safe_title}_bandcamp.jpg"
        image_path = os.path.join(images_dir, filename)
        logger.debug(f"Image path: {image_path}")

        # Download and save image
        logger.debug("Downloading and saving image")
        urlretrieve(image_url, image_path)
        logger.debug(f"Successfully saved image to: {image_path}")

        # Optimize the image
        logger.debug("Optimizing image")
        try:
            optimize_image_in_place(image_path)
            logger.debug("Image optimization completed")
        except Exception as e:
            logger.warning(f"Image optimization failed: {e}")

        return {"imagePath": image_path, "imageUrl": image_url}

    except Exception as e:
        logger.error(f"Error scraping Bandcamp: {e}")
        return {}


if __name__ == "__main__":
    # Test with the provided value
    result = get_album_art("datadata phone xone")
    print(f"Result: {result}")
