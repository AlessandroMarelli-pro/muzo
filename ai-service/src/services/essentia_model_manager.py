import logging
from pathlib import Path

import requests

logger = logging.getLogger(__name__)

DISCOGS_EFFNET_URL = (
    "https://essentia.upf.edu/models/feature-extractors/discogs-effnet/"
    "discogs-effnet-bs64-1.pb"
)


class EssentiaModelManager:
    """Downloads and caches Essentia model files from the Essentia model zoo."""

    def __init__(self, cache_dir: str = "models/essentia_cache"):
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    def download_discogs_effnet(self, url: str = DISCOGS_EFFNET_URL) -> str:
        """Download (or reuse cached) discogs-effnet model, return local path."""
        filename = url.rsplit("/", 1)[-1]
        model_path = self.cache_dir / filename

        if model_path.exists():
            logger.info(f"Using cached discogs-effnet model: {model_path}")
            return str(model_path)

        logger.info(f"Downloading discogs-effnet model from {url}")
        try:
            with requests.get(url, stream=True, timeout=120) as response:
                response.raise_for_status()
                tmp_path = model_path.with_suffix(model_path.suffix + ".tmp")
                with open(tmp_path, "wb") as f:
                    for chunk in response.iter_content(chunk_size=8192):
                        f.write(chunk)
                tmp_path.rename(model_path)
            logger.info(f"Discogs-effnet model downloaded: {model_path}")
            return str(model_path)
        except Exception as e:
            logger.error(f"Failed to download discogs-effnet model: {e}")
            raise
