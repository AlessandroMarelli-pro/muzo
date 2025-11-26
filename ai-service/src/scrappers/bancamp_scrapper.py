import os
import urllib.parse
from urllib.request import urlopen, urlretrieve

from bs4 import BeautifulSoup
from image_optimizer import optimize_image_in_place
from logging_config import get_logger

# Configure logger
logger = get_logger(__name__)


def get_album_art(artist_title: str) -> dict:
    """
    Scrape Bandcamp for album art image.

    Args:
        artist_title: Artist and title to search for (e.g., "datadata phone xone")

    Returns:
        Dict with 'imagePath' and 'imageUrl' keys, or empty dict if not found
    """
    logger.info(f"Starting Bandcamp search for: {artist_title}")

    # Encode the search query
    encoded_query = urllib.parse.quote(artist_title)
    search_url = f"https://bandcamp.com/search?q={encoded_query}"
    logger.debug(f"Search URL: {search_url}")

    try:
        # Fetch search results page
        logger.debug("Fetching search results page")
        page = urlopen(search_url)
        html = page.read().decode("utf-8")
        soup = BeautifulSoup(html, "html.parser")

        # Find the first itemurl link
        itemurl_div = soup.find("div", class_="itemurl")
        if not itemurl_div:
            logger.warning("No itemurl div found in search results")
            return {}

        album_link = itemurl_div.find("a")
        if not album_link:
            logger.warning("No album link found in itemurl div")
            return {}

        album_url = album_link.get("href")
        if not album_url:
            logger.warning("No href found in album link")
            return {}

        logger.info(f"Found album URL: {album_url}")

        # Fetch the album page
        logger.debug("Fetching album page")
        album_page = urlopen(album_url)
        album_html = album_page.read().decode("utf-8")
        album_soup = BeautifulSoup(album_html, "html.parser")

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

        logger.info(f"Found image URL: {image_url}")

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
        logger.error(f"Error scraping Bandcamp: {e}")
        return {}


if __name__ == "__main__":
    # Test with the provided value
    result = get_album_art("datadata phone xone")
    print(f"Result: {result}")
