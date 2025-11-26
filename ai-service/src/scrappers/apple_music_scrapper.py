import os
import re
import urllib.parse
from urllib.request import urlopen, urlretrieve

from bs4 import BeautifulSoup
from image_optimizer import optimize_image_in_place
from logging_config import get_logger

# Configure logger
logger = get_logger(__name__)


def get_album_art(artist_title: str) -> dict:
    """
    Scrape Apple Music for album art image.

    Args:
        artist_title: Artist and title to search for (e.g., "scatter counting satellites")

    Returns:
        Dict with 'imagePath' and 'imageUrl' keys, or empty dict if not found
    """
    logger.info(f"Starting Apple Music search for: {artist_title}")

    # Encode the search query
    encoded_query = urllib.parse.quote(artist_title)
    search_url = f"https://music.apple.com/us/search?term={encoded_query}"
    logger.debug(f"Search URL: {search_url}")

    try:
        # Fetch search results page
        logger.debug("Fetching search results page")
        page = urlopen(search_url)
        html = page.read().decode("utf-8")
        soup = BeautifulSoup(html, "html.parser")

        # Find the first artwork component
        artwork_div = soup.find("div", {"data-testid": "artwork-component"})
        if not artwork_div:
            logger.warning("No artwork component found in search results")
            return {}

        # Find the source tag within the artwork component
        source = artwork_div.find("source")
        if not source:
            logger.warning("No source found in artwork component")
            return {}

        # Get the srcset attribute which contains multiple image sizes
        srcset = source.get("srcset", "")
        if not srcset:
            logger.warning("No srcset found in source tag")
            return {}

        # Parse srcset to find the widest image
        # Format: "url1 size1, url2 size2, ..."
        image_sizes = []
        for item in srcset.split(","):
            item = item.strip()
            if " " in item:
                url, size = item.rsplit(" ", 1)
                # Extract numeric size (e.g., "632w" -> 632)
                size_match = re.search(r"(\d+)w", size)
                if size_match:
                    image_sizes.append((int(size_match.group(1)), url.strip()))

        if not image_sizes:
            logger.warning("No valid image sizes found in srcset")
            return {}

        # Get the image with the widest size
        image_sizes.sort(key=lambda x: x[0], reverse=True)
        widest_size, image_url = image_sizes[0]
        logger.info(f"Found image URL (size {widest_size}w): {image_url}")

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
        filename = f"{safe_title}_apple_music.jpg"
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
        logger.error(f"Error scraping Apple Music: {e}")
        return {}


if __name__ == "__main__":
    # Test with the provided value
    result = get_album_art("scatter counting satellites")
    print(f"Result: {result}")
