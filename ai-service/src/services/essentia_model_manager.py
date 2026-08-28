import json
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

    def download_pb(self, url: str) -> str:
        """Download (or reuse cached) a classifier-head .pb model, return local path."""
        filename = url.rsplit("/", 1)[-1]
        model_path = self.cache_dir / filename

        if model_path.exists():
            logger.info(f"Using cached model: {model_path}")
            return str(model_path)

        logger.info(f"Downloading model from {url}")
        try:
            with requests.get(url, stream=True, timeout=120) as response:
                response.raise_for_status()
                tmp_path = model_path.with_suffix(model_path.suffix + ".tmp")
                with open(tmp_path, "wb") as f:
                    for chunk in response.iter_content(chunk_size=8192):
                        f.write(chunk)
                tmp_path.rename(model_path)
            logger.info(f"Model downloaded: {model_path}")
            return str(model_path)
        except Exception as e:
            logger.error(f"Failed to download model from {url}: {e}")
            raise

    def download_json_metadata(self, url: str) -> dict:
        """Download (or reuse cached) a model's .json metadata sidecar, return parsed dict."""
        filename = url.rsplit("/", 1)[-1]
        json_path = self.cache_dir / filename

        if json_path.exists():
            logger.info(f"Using cached metadata: {json_path}")
            with open(json_path, "r") as f:
                return json.load(f)

        logger.info(f"Downloading metadata from {url}")
        try:
            response = requests.get(url, timeout=30)
            response.raise_for_status()
            data = response.json()
            tmp_path = json_path.with_suffix(json_path.suffix + ".tmp")
            with open(tmp_path, "w") as f:
                json.dump(data, f)
            tmp_path.rename(json_path)
            logger.info(f"Metadata downloaded: {json_path}")
            return data
        except Exception as e:
            logger.error(f"Failed to download metadata from {url}: {e}")
            raise
