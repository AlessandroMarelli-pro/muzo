import logging
import os
from pathlib import Path

from huggingface_hub import HfApi, hf_hub_download

logger = logging.getLogger(__name__)


class HuggingFaceModelManager:
    """Manages downloading and caching models from Hugging Face Hub."""

    def __init__(self, cache_dir: str = "models/huggingface_cache"):
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.api = HfApi(token=os.getenv("HF_TOKEN"))

    def download_genre_classifier(
        self, repo_id: str = "CosmicSurfer/muzo-genre-classifier"
    ) -> str:
        """Download the main genre classifier model."""
        logger.info(f"📥 Downloading genre classifier from {repo_id}")

        try:
            model_path = self.api.hf_hub_download(
                repo_id=repo_id,
                filename="genre_classifier.pth",
                cache_dir=str(self.cache_dir),
                local_files_only=False,
            )

            logger.info(f"✅ Genre classifier downloaded: {model_path}")
            return model_path

        except Exception as e:
            logger.error(f"❌ Failed to download genre classifier: {e}")
            raise

    def download_subgenre_specialist(
        self, genre: str, repo_id: str = "CosmicSurfer/muzo-subgenre-specialists"
    ) -> str:
        """Download a specific subgenre specialist model."""
        logger.info(f"📥 Downloading {genre} specialist from {repo_id}")

        try:
            model_path = self.api.hf_hub_download(
                repo_id=repo_id,
                filename=f"{genre.lower()}_specialist.pth",
                cache_dir=str(self.cache_dir),
                local_files_only=False,
            )

            logger.info(f"✅ {genre} specialist downloaded: {model_path}")
            return model_path

        except Exception as e:
            logger.error(f"❌ Failed to download {genre} specialist: {e}")
            raise

    def download_all_specialists(
        self, genres: list, repo_id: str = "CosmicSurfer/muzo-subgenre-specialists"
    ) -> dict:
        """Download all subgenre specialists."""
        logger.info(f"📥 Downloading {len(genres)} specialists from {repo_id}")

        downloaded_models = {}

        for genre in genres:
            try:
                model_path = self.download_subgenre_specialist(genre, repo_id)
                downloaded_models[genre] = model_path
            except Exception as e:
                logger.warning(f"⚠️ Failed to download {genre} specialist: {e}")
                downloaded_models[genre] = None

        successful = sum(1 for path in downloaded_models.values() if path is not None)
        logger.info(f"✅ Downloaded {successful}/{len(genres)} specialists")

        return downloaded_models

    def get_cached_model_path(self, repo_id: str, filename: str) -> str:
        """Get the local path of a cached model."""
        return self.api.hf_hub_download(
            repo_id=repo_id,
            filename=filename,
            cache_dir=str(self.cache_dir),
            local_files_only=True,
        )

    def is_model_cached(self, repo_id: str, filename: str) -> bool:
        """Check if a model is already cached locally."""
        try:
            self.get_cached_model_path(repo_id, filename)
            return True
        except Exception:
            return False
