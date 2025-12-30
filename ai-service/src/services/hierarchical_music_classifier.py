"""
Hierarchical Music Classification Service

Integrates the world-class CNN hierarchical classification system with the Muzo AI service.
Provides both genre and subgenre classification with 82.38% genre accuracy.

Architecture:
- Step 1: Genre Classifier (7 genres) - 82.38% accuracy
- Step 2: Subgenre Specialists (per-genre models) - 70-85% accuracy per specialist
- Step 3: Combined hierarchical result with confidence scores

This service is production-ready and optimized for real-time music classification.
"""

import asyncio
import gc
import logging
import os
import sys
import threading
import time
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np
import soundfile as sf
import torch

# Add the poc/src directory to path for imports
poc_src_path = Path(__file__).parent.parent.parent.parent / "model-trainer" / "src"
sys.path.insert(0, str(poc_src_path))

try:
    from cnn_model_training_subgenre import HierarchicalModelMatrix

    CNN_AVAILABLE = True
except ImportError as e:
    CNN_AVAILABLE = False
    import_error = str(e)

# Configure logging
logger = logging.getLogger(__name__)

from src.services.simple_audio_loader import SimpleAudioLoader

from .huggingface_model_manager import HuggingFaceModelManager
from .third_parties.discogs import DiscogsConnector
from .third_parties.musicbrainz import MusicIdentificationService


class HierarchicalMusicClassificationService:
    """
    Production-ready hierarchical music classification service.

    Features:
    - 82.38% genre accuracy (proven performance)
    - Per-genre subgenre specialists
    - Real-time classification (2-3 seconds)
    - Thread-safe operations
    - Graceful error handling
    - Performance monitoring
    """

    audio_loader = None

    def __init__(
        self,
        genre_model_path: str = None,
        specialists_dir: str = "models/subgenre_specialists",
        preload_all_specialists: bool = True,
        max_concurrent_predictions: int = 4,
        use_huggingface: bool = True,
        hf_repo_id_genre: str = "CosmicSurfer/muzo-genre-classifier",
        hf_repo_id_specialists: str = "CosmicSurfer/muzo-subgenre-specialists",
        enable_musicbrainz_integration: bool = True,
        acoustid_api_key: str = None,
        use_discogs_integration: bool = True,
    ):
        """
        Initialize the hierarchical classification service.

        Args:
            genre_model_path: Path to the trained genre classifier (required if use_huggingface=False)
            specialists_dir: Directory containing subgenre specialists (used if use_huggingface=False)
            preload_all_specialists: Whether to load all specialists at startup
            max_concurrent_predictions: Maximum concurrent predictions
            use_huggingface: Whether to download models from HuggingFace Hub
            hf_repo_id_genre: HuggingFace repository ID for genre classifier
            hf_repo_id_specialists: HuggingFace repository ID for subgenre specialists
            enable_musicbrainz_integration: Whether to use MusicBrainz for genre validation
            acoustid_api_key: Acoustid API key (optional, will use ACOUSTID_API_KEY env var if not provided)
            use_discogs_integration: Whether to use Discogs for genre validation
        """
        self.use_huggingface = use_huggingface
        self.preload_all_specialists = preload_all_specialists
        self.max_concurrent_predictions = max_concurrent_predictions
        self.enable_musicbrainz_integration = enable_musicbrainz_integration
        self.audio_loader = SimpleAudioLoader()

        # Memory management: refresh thread pool every N predictions to prevent accumulation
        self.thread_pool_refresh_interval = 25  # Refresh every 50 predictions
        # Initialize MusicBrainz integration if enabled
        if self.enable_musicbrainz_integration:
            # Use provided API key or fall back to environment variable
            api_key = acoustid_api_key or os.getenv("ACOUSTID_API_KEY")
            self.musicbrainz_service = MusicIdentificationService(api_key)
            logger.info("🎵 MusicBrainz integration enabled")
        else:
            self.musicbrainz_service = None
            logger.info("🎵 MusicBrainz integration disabled")

        # Initialize Discogs integration if enabled
        if use_discogs_integration:
            self.discogs_connector = DiscogsConnector()
            logger.info("🎵 Discogs integration enabled")
        else:
            self.discogs_connector = None
            logger.info("🎵 Discogs integration disabled")

        if use_huggingface:
            self.hf_manager = HuggingFaceModelManager()
            self.hf_repo_id_genre = hf_repo_id_genre
            self.hf_repo_id_specialists = hf_repo_id_specialists
            self.genre_model_path = None  # Will be downloaded
            self.specialists_dir = None  # Will be downloaded
        else:
            if genre_model_path is None:
                raise ValueError(
                    "genre_model_path is required when use_huggingface=False"
                )
            self.genre_model_path = genre_model_path
            self.specialists_dir = specialists_dir

        # System state
        self.is_initialized = False
        self.system = None
        self.system_info = None

        # Performance tracking
        self.prediction_count = 0
        self.total_prediction_time = 0.0
        self.last_prediction_time = 0.0

        # Thread safety
        self._lock = threading.Lock()
        self._executor = ThreadPoolExecutor(max_workers=max_concurrent_predictions)

        logger.info("🎵 Initializing Hierarchical Music Classification Service")
        if use_huggingface:
            logger.info(f"🎯 Using HuggingFace models: {hf_repo_id_genre}")
            logger.info(f"🎶 Specialists from: {hf_repo_id_specialists}")
        else:
            logger.info(f"🎯 Genre model: {self.genre_model_path}")
            logger.info(f"🎶 Specialists dir: {self.specialists_dir}")

        # Check availability
        if not CNN_AVAILABLE:
            raise ImportError(f"CNN modules not available: {import_error}")

        # Initialize MusicBrainz genre mapping
        self._init_musicbrainz_genre_mapping()

    def _init_musicbrainz_genre_mapping(self):
        """Initialize mapping between MusicBrainz genres and our classification system."""
        # Map MusicBrainz genres to our 7 main genres
        self.musicbrainz_to_main_genres = {
            # Alternative Rock
            "alternative rock": "Alternative",
            "indie rock": "Alternative",
            "grunge": "Alternative",
            "post-rock": "Alternative",
            "shoegaze": "Alternative",
            "emo": "Alternative",
            "punk rock": "Alternative",
            "hardcore punk": "Alternative",
            "post-punk": "Alternative",
            "new wave": "Alternative",
            # Dance/EDM
            "electronic dance music": "Dance_EDM",
            "house": "Dance_EDM",
            "techno": "Dance_EDM",
            "trance": "Dance_EDM",
            "drum and bass": "Dance_EDM",
            "dubstep": "Dance_EDM",
            "ambient": "Dance_EDM",
            "breakbeat": "Dance_EDM",
            "garage": "Dance_EDM",
            "jungle": "Dance_EDM",
            "hardcore": "Dance_EDM",
            "electro": "Dance_EDM",
            "progressive house": "Dance_EDM",
            "deep house": "Dance_EDM",
            "future bass": "Dance_EDM",
            # Electronic
            "electronic": "Electronic",
            "synth-pop": "Electronic",
            "new age": "Electronic",
            "experimental": "Electronic",
            "industrial": "Electronic",
            "idm": "Electronic",
            "drone": "Electronic",
            "glitch": "Electronic",
            "chiptune": "Electronic",
            # Hip-Hop/Rap
            "hip hop": "Hip-Hop_Rap",
            "rap": "Hip-Hop_Rap",
            "trap": "Hip-Hop_Rap",
            "drill": "Hip-Hop_Rap",
            "conscious hip hop": "Hip-Hop_Rap",
            "gangsta rap": "Hip-Hop_Rap",
            "alternative hip hop": "Hip-Hop_Rap",
            "boom bap": "Hip-Hop_Rap",
            "cloud rap": "Hip-Hop_Rap",
            "lo-fi hip hop": "Hip-Hop_Rap",
            # Jazz
            "jazz": "Jazz",
            "bebop": "Jazz",
            "swing": "Jazz",
            "bossa nova": "Jazz",
            "fusion": "Jazz",
            "smooth jazz": "Jazz",
            "acid jazz": "Jazz",
            "nu jazz": "Jazz",
            "jazz fusion": "Jazz",
            "cool jazz": "Jazz",
            "hard bop": "Jazz",
            "free jazz": "Jazz",
            # R&B/Soul
            "r&b": "R&B_Soul",
            "soul": "R&B_Soul",
            "funk": "R&B_Soul",
            "neo-soul": "R&B_Soul",
            "contemporary r&b": "R&B_Soul",
            "alternative r&b": "R&B_Soul",
            "quiet storm": "R&B_Soul",
            "new jack swing": "R&B_Soul",
            # Reggae
            "reggae": "Reggae",
            "dancehall": "Reggae",
            "ska": "Reggae",
            "rocksteady": "Reggae",
            "dub": "Reggae",
            "roots reggae": "Reggae",
            "lovers rock": "Reggae",
        }

        # Map our main genres to MusicBrainz subgenres for validation
        self.main_genres_to_musicbrainz = {
            "Alternative": [
                "alternative rock",
                "indie rock",
                "grunge",
                "post-rock",
                "shoegaze",
                "emo",
                "punk rock",
                "hardcore punk",
                "post-punk",
                "new wave",
            ],
            "Dance_EDM": [
                "electronic dance music",
                "house",
                "techno",
                "trance",
                "drum and bass",
                "dubstep",
                "ambient",
                "breakbeat",
                "garage",
                "jungle",
                "hardcore",
                "electro",
                "progressive house",
                "deep house",
                "future bass",
            ],
            "Electronic": [
                "electronic",
                "synth-pop",
                "new age",
                "experimental",
                "industrial",
                "idm",
                "ambient",
                "drone",
                "glitch",
                "chiptune",
            ],
            "Hip-Hop_Rap": [
                "hip hop",
                "rap",
                "trap",
                "drill",
                "conscious hip hop",
                "gangsta rap",
                "alternative hip hop",
                "boom bap",
                "cloud rap",
                "lo-fi hip hop",
            ],
            "Jazz": [
                "jazz",
                "bebop",
                "swing",
                "bossa nova",
                "fusion",
                "smooth jazz",
                "acid jazz",
                "nu jazz",
                "jazz fusion",
                "cool jazz",
                "hard bop",
                "free jazz",
            ],
            "R&B_Soul": [
                "r&b",
                "soul",
                "funk",
                "neo-soul",
                "contemporary r&b",
                "alternative r&b",
                "quiet storm",
                "new jack swing",
            ],
            "Reggae": [
                "reggae",
                "dancehall",
                "ska",
                "rocksteady",
                "dub",
                "roots reggae",
                "lovers rock",
            ],
        }

        logger.info("🎵 MusicBrainz genre mapping initialized")

    async def _get_musicbrainz_genres(
        self, audio_file_path: str
    ) -> Optional[List[str]]:
        """
        Get MusicBrainz genres for an audio file.

        Args:
            audio_file_path: Path to audio file

        Returns:
            List of MusicBrainz genres or None if identification failed
        """
        if not self.enable_musicbrainz_integration or not self.musicbrainz_service:
            return None

        try:
            logger.debug(f"🎵 Getting MusicBrainz genres for: {audio_file_path}")
            result = self.musicbrainz_service.identify_music(audio_file_path)
            if result.status.value == "success" and result.genres:
                logger.debug(f"🎵 Found MusicBrainz genres: {result.genres}")
                return result.genres
            else:
                logger.debug(f"🎵 No MusicBrainz genres found: {result.error_message}")
                return None

        except Exception as e:
            logger.warning(f"🎵 MusicBrainz identification failed: {e}")
            return None

    async def _get_discogs_genres(
        self, audio_file_path: str
    ) -> Optional[Dict[str, List[str]]]:
        """
        Get Discogs genres for an audio file with fallback to artist search.

        Args:
            audio_file_path: Path to audio file

        Returns:
            Dictionary with 'genres' and 'subgenres' lists or None if failed
        """
        if not self.discogs_connector:
            return None

        try:
            logger.debug(f"🎵 Getting Discogs genres for: {audio_file_path}")

            # First try to get genres from specific file path
            result = self.discogs_connector.get_genre_from_filepath(audio_file_path)

            # If no genres found, try artist fallback
            if not result.get("genres") and not result.get("subgenres"):
                logger.debug(
                    "🎵 No Discogs genres found for specific track, trying artist fallback"
                )

                # Extract artist from filename for fallback search
                filename = os.path.basename(audio_file_path)
                metadata = (
                    self.discogs_connector.filename_parser.parse_filename_for_metadata(
                        filename
                    )
                )
                artist = metadata.get("artist", "").strip()

                if artist:
                    logger.debug(f"🎵 Searching Discogs for artist: {artist}")
                    result = self.discogs_connector.search_artist_genres(artist)
                else:
                    logger.debug("🎵 No artist found in filename for Discogs fallback")
                    return None

            if result.get("genres") or result.get("subgenres"):
                logger.debug(f"🎵 Found Discogs genres: {result}")
                return result
            else:
                logger.debug("🎵 No Discogs genres found")
                return None

        except Exception as e:
            logger.warning(f"🎵 Discogs identification failed: {e}")
            return None

    def _calculate_genre_boost(
        self, predicted_genre: str, musicbrainz_genres: List[str]
    ) -> float:
        """
        Calculate confidence boost based on MusicBrainz genre validation.

        Args:
            predicted_genre: Genre predicted by our model
            musicbrainz_genres: Genres from MusicBrainz

        Returns:
            Confidence boost factor (1.0 = no boost, >1.0 = boost)
        """
        if not musicbrainz_genres:
            return 1.0

        # Check if any MusicBrainz genre maps to our predicted genre
        for mb_genre in musicbrainz_genres:
            mb_genre_lower = mb_genre.lower()
            if mb_genre_lower in self.musicbrainz_to_main_genres:
                mapped_genre = self.musicbrainz_to_main_genres[mb_genre_lower]
                if mapped_genre == predicted_genre:
                    logger.debug(
                        f"🎵 Genre validation match: {predicted_genre} ↔ {mb_genre}"
                    )
                    return 1.2  # 20% confidence boost for exact match

        # Check for partial matches (substring matching)
        predicted_lower = predicted_genre.lower()
        for mb_genre in musicbrainz_genres:
            mb_genre_lower = mb_genre.lower()
            if predicted_lower in mb_genre_lower or mb_genre_lower in predicted_lower:
                logger.debug(f"🎵 Genre partial match: {predicted_genre} ≈ {mb_genre}")
                return 1.1  # 10% confidence boost for partial match

        logger.debug(
            f"🎵 No genre validation match: {predicted_genre} vs {musicbrainz_genres}"
        )
        return 1.0

    def _apply_musicbrainz_validation(
        self, classification_result: Dict[str, Any], musicbrainz_genres: List[str]
    ) -> Dict[str, Any]:
        """
        Apply MusicBrainz genre validation to classification results.

        Args:
            classification_result: Original classification result
            musicbrainz_genres: Genres from MusicBrainz

        Returns:
            Enhanced classification result with MusicBrainz validation
        """
        if not musicbrainz_genres or not classification_result.get("success", False):
            return classification_result

        classification = classification_result["classification"]
        predicted_genre = classification["genre"]
        predicted_subgenre = classification["subgenre"]

        # Calculate genre boost
        genre_boost = self._calculate_genre_boost(predicted_genre, musicbrainz_genres)

        # Apply boost to confidence scores
        original_genre_conf = classification["confidence"]["genre"]
        original_subgenre_conf = classification["confidence"]["subgenre"]
        original_combined_conf = classification["confidence"]["combined"]

        boosted_genre_conf = min(1.0, original_genre_conf * genre_boost)
        boosted_subgenre_conf = min(1.0, original_subgenre_conf * genre_boost)
        boosted_combined_conf = min(1.0, original_combined_conf * genre_boost)

        # Update classification result
        enhanced_result = classification_result.copy()
        enhanced_result["classification"]["confidence"] = {
            "genre": round(boosted_genre_conf, 4),
            "subgenre": round(boosted_subgenre_conf, 4),
            "combined": round(boosted_combined_conf, 4),
            "original_genre": round(original_genre_conf, 4),
            "original_subgenre": round(original_subgenre_conf, 4),
            "original_combined": round(original_combined_conf, 4),
            "musicbrainz_boost": round(genre_boost, 2),
        }

        # Add MusicBrainz validation info
        enhanced_result["musicbrainz_validation"] = {
            "enabled": True,
            "used": True,
            "genres_found": musicbrainz_genres,
            "genre_match": genre_boost > 1.0,
            "boost_factor": round(genre_boost, 2),
            "confidence_improvement": {
                "genre": round(boosted_genre_conf - original_genre_conf, 4),
                "subgenre": round(boosted_subgenre_conf - original_subgenre_conf, 4),
                "combined": round(boosted_combined_conf - original_combined_conf, 4),
            },
        }

        logger.info(
            f"🎵 MusicBrainz validation applied: {predicted_genre} → {predicted_subgenre} (boost: {genre_boost:.2f}x)"
        )

        return enhanced_result

    def _calculate_discogs_genre_boost(
        self,
        predicted_genre: str,
        predicted_subgenre: str,
        discogs_data: Dict[str, List[str]],
    ) -> float:
        """
        Calculate confidence boost based on Discogs genre validation.

        Args:
            predicted_genre: Genre predicted by our model
            predicted_subgenre: Subgenre predicted by our model
            discogs_data: Dictionary with 'genres' and 'subgenres' from Discogs

        Returns:
            Confidence boost factor (1.0 = no boost, >1.0 = boost)
        """
        if not discogs_data:
            return 1.0

        discogs_genres = discogs_data.get("genres", [])
        discogs_subgenres = discogs_data.get("subgenres", [])

        if not discogs_genres and not discogs_subgenres:
            return 1.0

        # Check genre match
        genre_match = False
        if discogs_genres:
            predicted_genre_lower = predicted_genre.lower()
            for discogs_genre in discogs_genres:
                if (
                    predicted_genre_lower in discogs_genre.lower()
                    or discogs_genre.lower() in predicted_genre_lower
                ):
                    genre_match = True
                    break

        # Check subgenre match
        subgenre_match = False
        if discogs_subgenres and predicted_subgenre:
            predicted_subgenre_lower = predicted_subgenre.lower()
            for discogs_subgenre in discogs_subgenres:
                if (
                    predicted_subgenre_lower in discogs_subgenre.lower()
                    or discogs_subgenre.lower() in predicted_subgenre_lower
                ):
                    subgenre_match = True
                    break

        # Calculate boost based on matches
        if genre_match and subgenre_match:
            return 1.3  # Strong boost for both matches
        elif genre_match:
            return 1.2  # Moderate boost for genre match
        elif subgenre_match:
            return 1.1  # Small boost for subgenre match
        else:
            return 1.0  # No boost

    def _apply_discogs_validation(
        self, classification_result: Dict[str, Any], discogs_data: Dict[str, List[str]]
    ) -> Dict[str, Any]:
        """
        Apply Discogs genre validation to classification results.

        Args:
            classification_result: Original classification result
            discogs_data: Dictionary with 'genres' and 'subgenres' from Discogs

        Returns:
            Enhanced classification result with Discogs validation
        """
        if not discogs_data or not classification_result.get("success", False):
            return classification_result

        classification = classification_result["classification"]
        predicted_genre = classification["genre"]
        predicted_subgenre = classification["subgenre"]

        # Calculate genre boost
        genre_boost = self._calculate_discogs_genre_boost(
            predicted_genre, predicted_subgenre, discogs_data
        )

        # Apply boost to confidence scores
        original_genre_conf = classification["confidence"]["genre"] or 0.0
        original_subgenre_conf = classification["confidence"]["subgenre"] or 0.0
        original_combined_conf = classification["confidence"]["combined"] or 0.0

        boosted_genre_conf = min(1.0, original_genre_conf * genre_boost)
        boosted_subgenre_conf = min(1.0, original_subgenre_conf * genre_boost)
        boosted_combined_conf = min(1.0, original_combined_conf * genre_boost)

        # Update classification result
        enhanced_result = classification_result.copy()
        enhanced_result["classification"]["confidence"] = {
            "genre": round(boosted_genre_conf, 4),
            "subgenre": round(boosted_subgenre_conf, 4),
            "combined": round(boosted_combined_conf, 4),
            "original_genre": round(original_genre_conf, 4),
            "original_subgenre": round(original_subgenre_conf, 4),
            "original_combined": round(original_combined_conf, 4),
            "discogs_boost": round(genre_boost, 2),
        }

        # Add Discogs validation info
        enhanced_result["discogs_validation"] = {
            "enabled": True,
            "used": True,
            "genres_found": discogs_data.get("genres", []),
            "subgenres_found": discogs_data.get("subgenres", []),
            "genre_match": genre_boost > 1.0,
            "boost_factor": round(genre_boost, 2),
            "confidence_improvement": {
                "genre": round(boosted_genre_conf - original_genre_conf, 4),
                "subgenre": round(boosted_subgenre_conf - original_subgenre_conf, 4),
                "combined": round(boosted_combined_conf - original_combined_conf, 4),
            },
        }

        logger.info(
            f"🎵 Discogs validation applied: {predicted_genre} → {predicted_subgenre} (boost: {genre_boost:.2f}x)"
        )

        return enhanced_result

    async def initialize(self) -> Dict[str, Any]:
        """
        Initialize the hierarchical classification system.

        Returns:
            Dictionary with initialization results
        """
        logger.info("🚀 Initializing hierarchical classification system...")

        start_time = time.time()

        try:
            # Download models from HuggingFace if needed
            if self.use_huggingface:
                logger.info("🌐 Downloading models from Hugging Face...")

                try:
                    # Download genre classifier
                    self.genre_model_path = self.hf_manager.download_genre_classifier(
                        self.hf_repo_id_genre
                    )
                    logger.info(
                        f"✅ Genre classifier downloaded: {self.genre_model_path}"
                    )

                    # Download specialists (you can specify which ones to download)
                    available_genres = [
                        "Alternative",
                        "Dance_EDM",
                        "Electronic",
                        "Hip-Hop_Rap",
                        "Jazz",
                        "R&B_Soul",
                        "Reggae",
                    ]
                    downloaded_specialists = self.hf_manager.download_all_specialists(
                        available_genres, self.hf_repo_id_specialists
                    )

                    # Create a temporary specialists directory structure
                    temp_specialists_dir = Path("models/temp_specialists")
                    temp_specialists_dir.mkdir(parents=True, exist_ok=True)

                    successful_downloads = 0
                    for genre, model_path in downloaded_specialists.items():
                        if model_path:
                            try:
                                # Create genre directory and copy model
                                genre_dir = temp_specialists_dir / genre
                                genre_dir.mkdir(exist_ok=True)

                                # Copy model to expected location
                                import shutil

                                target_path = (
                                    genre_dir
                                    / f"subgenre-specialist-{genre.lower()}-v1.0.pth"
                                )
                                shutil.copy2(model_path, target_path)
                                successful_downloads += 1
                                logger.info(
                                    f"✅ {genre} specialist downloaded and configured"
                                )
                            except Exception as e:
                                logger.warning(
                                    f"⚠️ Failed to configure {genre} specialist: {e}"
                                )
                        else:
                            logger.warning(f"⚠️ {genre} specialist download failed")

                    self.specialists_dir = str(temp_specialists_dir)
                    logger.info(
                        f"✅ HuggingFace models configured: {successful_downloads}/{len(available_genres)} specialists"
                    )

                except Exception as e:
                    logger.error(f"❌ Failed to download models from HuggingFace: {e}")
                    raise RuntimeError(f"HuggingFace model download failed: {e}")

            # Initialize the hierarchical system
            self.system = HierarchicalModelMatrix(
                genre_model_path=self.genre_model_path,
                specialists_dir=self.specialists_dir,
            )

            # Load the complete system
            await asyncio.get_event_loop().run_in_executor(
                self._executor, self.system.load_complete_system
            )

            # Get system information
            self.system_info = self.system.get_system_info()

            initialization_time = time.time() - start_time

            self.is_initialized = True

            result = {
                "success": True,
                "initialization_time": initialization_time,
                "system_info": {
                    "genre_classifier_loaded": self.system_info["genre_classifier"][
                        "loaded"
                    ],
                    "available_genres": len(
                        self.system_info["genre_classifier"]["genres"]
                    ),
                    "loaded_specialists": self.system_info["coverage"][
                        "specialists_available"
                    ],
                    "coverage_percentage": self.system_info["coverage"][
                        "coverage_percentage"
                    ],
                },
                "performance": {
                    "expected_genre_accuracy": "82.38%",
                    "expected_processing_time": "2-3 seconds",
                    "concurrent_predictions": self.max_concurrent_predictions,
                },
            }

            logger.info("✅ Hierarchical system initialized successfully!")
            logger.info(f"⏱️ Initialization time: {initialization_time:.2f}s")
            logger.info(
                f"🎯 Genre classifier: {result['system_info']['available_genres']} genres"
            )
            logger.info(
                f"🎶 Subgenre specialists: {result['system_info']['loaded_specialists']} loaded"
            )
            logger.info(
                f"📊 Coverage: {result['system_info']['coverage_percentage']:.1f}%"
            )

            return result

        except Exception as e:
            logger.error(f"❌ Failed to initialize hierarchical system: {e}")
            raise

    def _split_audio_into_segments(
        self,
        audio_file_path: str,
        segment_duration: float = 90.0,
        overlap: float = 0.0,
        force_segmentation: bool = True,
        skip_intro_outro: bool = False,
    ) -> List[str]:
        """
        Split audio file into segments of specified duration.

        Args:
            audio_file_path: Path to the audio file
            segment_duration: Duration of each segment in seconds (default: 90s)
            overlap: Overlap between segments in seconds (default: 0s)
            force_segmentation: Force segmentation even for short files (default: False)
            skip_intro_outro: Skip first and last segments to avoid intro/outro (default: False)

        Returns:
            List of temporary segment file paths
        """
        logger.info(f"🎵 Splitting audio into {segment_duration}s segments...")

        try:
            # Load audio file once into memory (now optimized with y[:, 0] instead of np.mean)
            y, sr = self.audio_loader.load_audio_sample(audio_file_path)
            total_duration = len(y) / sr

            logger.info(f"📏 Audio file duration: {total_duration:.1f}s")
            logger.info(f"🎯 Target segment duration: {segment_duration}s")

            if total_duration <= segment_duration and not force_segmentation:
                logger.info(
                    f"📏 Audio duration ({total_duration:.1f}s) <= segment duration ({segment_duration}s), using full file"
                )
                logger.info(
                    "💡 To force segmentation, use a smaller segment_duration parameter or set force_segmentation=True"
                )
                return [audio_file_path], []

            if total_duration <= segment_duration and force_segmentation:
                logger.info(
                    f"📏 Audio duration ({total_duration:.1f}s) <= segment duration ({segment_duration}s), but force_segmentation=True"
                )
                logger.info("🔄 Creating single segment from full file")
                # Create a single segment from the full file
                segments = []
                temp_dir = Path("temp_segments")
                temp_dir.mkdir(exist_ok=True)

                base_name = Path(audio_file_path).stem
                segment_path = temp_dir / f"{base_name}_segment_000.wav"
                sf.write(str(segment_path), y, sr)
                segments.append(str(segment_path))

                logger.info("✅ Created 1 segment from full file")
                return segments, []

            # Calculate segment parameters
            segment_samples = int(segment_duration * sr)
            overlap_samples = int(overlap * sr)
            step_samples = segment_samples - overlap_samples

            logger.info(f"🔢 Audio samples: {len(y)}")
            logger.info(f"🔢 Segment samples: {segment_samples}")
            logger.info(f"🔢 Step samples: {step_samples}")
            logger.info(f"🔢 Overlap samples: {overlap_samples}")

            segments = []
            temp_dir = Path("temp_segments")
            temp_dir.mkdir(exist_ok=True)

            base_name = Path(audio_file_path).stem

            # Calculate the range for segmentation
            range_start = 0
            range_end = len(y) - segment_samples + 1
            range_step = step_samples

            logger.info(f"🔢 Range: {range_start} to {range_end} step {range_step}")

            segment_count = 0
            for i, start_sample in enumerate(range(range_start, range_end, range_step)):
                end_sample = start_sample + segment_samples
                # Fast in-memory slicing (no disk I/O)
                segment_audio = y[start_sample:end_sample]

                # Save segment to temporary file
                segment_path = temp_dir / f"{base_name}_segment_{i:03d}.wav"
                sf.write(str(segment_path), segment_audio, sr)
                segments.append(str(segment_path))
                segment_count += 1

                logger.info(
                    f"📄 Created segment {i + 1}: {start_sample / sr:.1f}s - {end_sample / sr:.1f}s"
                )

            # Check if there's remaining audio after the last complete segment
            last_complete_end = range_start + (segment_count * range_step)

            if last_complete_end < len(y):
                # Create a final segment with remaining audio
                remaining_audio = y[last_complete_end:]
                remaining_duration = len(remaining_audio) / sr
                is_zero = np.all(remaining_audio == 0)
                if (
                    remaining_duration >= 1.0 and not is_zero
                ):  # Only include if at least 1 second
                    segment_path = (
                        temp_dir / f"{base_name}_segment_{segment_count:03d}.wav"
                    )
                    sf.write(str(segment_path), remaining_audio, sr)
                    segments.append(str(segment_path))
                    segment_count += 1

                    logger.info(
                        f"📄 Created final segment {segment_count}: {last_complete_end / sr:.1f}s - {len(y) / sr:.1f}s (duration: {remaining_duration:.1f}s)"
                    )
                else:
                    logger.info(
                        f"📄 Skipping final segment (too short: {remaining_duration:.1f}s)"
                    )

            logger.info(f"✅ Split audio into {len(segments)} segments")

            # Skip intro and outro segments if requested
            intro_outro_segments = []
            if skip_intro_outro and len(segments) > 2:
                original_count = len(segments)
                # Remove first and last segments
                intro_outro_segments = [segments[0]]
                segments = segments[1:]

                # segments = segments[1:-1]
                logger.info(
                    f"🎯 Skipped intro/outro: {original_count} → {len(segments)} segments"
                )
                logger.info(
                    f"📄 Using segments 2-{original_count - 1} (skipping first and last)"
                )
            elif skip_intro_outro and len(segments) <= 2:
                logger.info(
                    f"⚠️ Cannot skip intro/outro: only {len(segments)} segments available"
                )

            # Explicitly release large audio array from memory
            del y
            if "segment_audio" in locals():
                del segment_audio
            if "remaining_audio" in locals():
                del remaining_audio
            gc.collect()

            return segments, intro_outro_segments

        except Exception as e:
            logger.error(f"❌ Failed to split audio: {e}")

            gc.collect()
            return [audio_file_path]  # Fallback to original file

    def _cleanup_segments(self, segment_paths: List[str]):
        """Clean up temporary segment files."""
        for segment_path in segment_paths:
            try:
                if os.path.exists(segment_path) and "temp_segments" in segment_path:
                    logger.info(f"🗑️ Removing segment: {segment_path}")
                    os.remove(segment_path)
            except Exception as e:
                logger.warning(f"⚠️ Failed to cleanup segment {segment_path}: {e}")

    def _aggregate_segment_results(
        self,
        segment_results: List[Dict[str, Any]],
        method: str = "majority_vote",
        external_validation: Dict[str, Any] = None,
    ) -> Dict[str, Any]:
        """
        Aggregate results from multiple segments.

        Args:
            segment_results: List of classification results from segments
            method: Aggregation method ('majority_vote', 'confidence_weighted', 'best_confidence')
            external_validation: External validation data for tie-breaking

        Returns:
            Aggregated classification result
        """
        if not segment_results:
            return {"error": "No segment results to aggregate"}

        successful_results = [r for r in segment_results if r.get("success", False)]
        if not successful_results:
            return {"error": "No successful segment classifications"}

        logger.info(
            f"🔄 Aggregating {len(successful_results)} segment results using {method}"
        )

        if method == "majority_vote":
            return self._majority_vote_aggregation(
                successful_results, external_validation
            )
        elif method == "confidence_weighted":
            return self._confidence_weighted_aggregation(successful_results)
        elif method == "best_confidence":
            return self._best_confidence_aggregation(successful_results)
        else:
            logger.warning(
                f"⚠️ Unknown aggregation method '{method}', using majority vote"
            )
            return self._majority_vote_aggregation(
                successful_results, external_validation
            )

    def _majority_vote_aggregation(
        self, results: List[Dict[str, Any]], external_validation: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """Aggregate results using majority voting with hierarchical consistency and external validation tie-breaking."""
        # Count complete genre-subgenre combinations
        combination_votes = Counter()
        combination_confidences = {}

        # Also track individual votes for fallback
        genre_votes = Counter()
        subgenre_votes = Counter()
        genre_confidences = {}
        subgenre_confidences = {}

        for result in results:
            classification = result.get("classification", {})
            genre = classification.get("genre")
            subgenre = classification.get("subgenre")
            genre_conf = classification.get("confidence", {}).get("genre", 0)
            subgenre_conf = classification.get("confidence", {}).get("subgenre", 0)
            combined_conf = classification.get("confidence", {}).get("combined", 0)

            if genre and subgenre:
                # Count complete combinations
                combination = f"{genre} → {subgenre}"
                combination_votes[combination] += 1
                if combination not in combination_confidences:
                    combination_confidences[combination] = []
                combination_confidences[combination].append(combined_conf)

            # Track individual votes for fallback
            if genre:
                genre_votes[genre] += 1
                if genre not in genre_confidences:
                    genre_confidences[genre] = []
                genre_confidences[genre].append(genre_conf)

            if subgenre:
                subgenre_votes[subgenre] += 1
                if subgenre not in subgenre_confidences:
                    subgenre_confidences[subgenre] = []
                subgenre_confidences[subgenre].append(subgenre_conf)

        # Try to get the most common complete combination first
        if combination_votes:
            # Get all combinations with their vote counts
            combination_counts = combination_votes.most_common()
            max_votes = combination_counts[0][1]

            # Find all combinations with the maximum vote count
            top_combinations = [
                combo for combo, votes in combination_counts if votes == max_votes
            ]

            if len(top_combinations) == 1:
                # Clear winner
                most_common_combination = top_combinations[0]
                logger.info(
                    f"🎯 Majority vote: {most_common_combination} ({max_votes} votes)"
                )
            else:
                # Tie - use external validation as tie-breaker
                logger.info(
                    f"🎯 Tie detected: {top_combinations} (all have {max_votes} votes)"
                )

                if external_validation:
                    most_common_combination = (
                        self._resolve_tie_with_external_validation(
                            top_combinations, external_validation
                        )
                    )
                    logger.info(
                        f"🎯 Tie resolved with external validation: {most_common_combination}"
                    )
                else:
                    # No external validation, pick the first one (alphabetically)
                    most_common_combination = sorted(top_combinations)[0]
                    logger.info(
                        f"🎯 Tie resolved alphabetically: {most_common_combination}"
                    )

            predicted_genre, predicted_subgenre = most_common_combination.split(" → ")

            # Calculate average confidence for the winning combination
            combination_confidence = np.mean(
                combination_confidences.get(most_common_combination, [0])
            )
            genre_confidence = np.mean(genre_confidences.get(predicted_genre, [0]))
            subgenre_confidence = np.mean(
                subgenre_confidences.get(predicted_subgenre, [0])
            )
        else:
            # Fallback to individual voting (should not happen with proper results)
            logger.warning(
                "⚠️ No complete combinations found, falling back to individual voting"
            )
            predicted_genre = (
                genre_votes.most_common(1)[0][0] if genre_votes else "Unknown"
            )
            predicted_subgenre = (
                subgenre_votes.most_common(1)[0][0] if subgenre_votes else "Unknown"
            )

            genre_confidence = np.mean(genre_confidences.get(predicted_genre, [0]))
            subgenre_confidence = np.mean(
                subgenre_confidences.get(predicted_subgenre, [0])
            )
            combination_confidence = (genre_confidence + subgenre_confidence) / 2

        # Calculate combined confidence (average of genre and subgenre)
        combined_confidence = combination_confidence

        return {
            "success": True,
            "classification": {
                "genre": predicted_genre,
                "subgenre": predicted_subgenre,
                "confidence": {
                    "genre": round(genre_confidence, 4),
                    "subgenre": round(subgenre_confidence, 4),
                    "combined": round(combined_confidence, 4),
                },
            },
            "aggregation_method": "majority_vote",
            "segment_count": len(results),
            "combination_votes": dict(combination_votes),
            "genre_votes": dict(genre_votes),
            "subgenre_votes": dict(subgenre_votes),
            "processing_time": sum(
                r.get("processing_time", 0) for r in results if r is not None
            ),
            "timestamp": time.time(),
            "model_name": "Hierarchical Music Classification (Segmented)",
        }

    def _resolve_tie_with_external_validation(
        self, tied_combinations: List[str], external_validation: Dict[str, Any]
    ) -> str:
        """
        Resolve ties using external validation data (MusicBrainz + Discogs).

        Args:
            tied_combinations: List of tied combinations like ["Electronic → Downtempo", "Hip-Hop_Rap → Gangsta Rap"]
            external_validation: Dictionary containing MusicBrainz and Discogs validation data

        Returns:
            The best combination based on external validation
        """
        logger.info(f"🔍 Resolving tie with external validation: {tied_combinations}")

        # Extract external validation data
        if external_validation is None:
            logger.warning("⚠️ External validation is None, using alphabetical order")
            return sorted(tied_combinations)[0]

        musicbrainz_genres = external_validation.get("musicbrainz_genres", [])
        discogs_data = external_validation.get("discogs_data", {})

        # Handle case where discogs_data might be None
        if discogs_data is None:
            discogs_genres = []
            discogs_subgenres = []
            logger.info("⚠️ Discogs data is None, skipping Discogs validation")
        else:
            discogs_genres = discogs_data.get("genres", [])
            discogs_subgenres = discogs_data.get("subgenres", [])

        # Score each combination based on external validation
        combination_scores = {}

        for combination in tied_combinations:
            genre, subgenre = combination.split(" → ")
            score = 0

            # MusicBrainz validation scoring
            if musicbrainz_genres:
                for mb_genre in musicbrainz_genres:
                    mb_genre_lower = mb_genre.lower()
                    if mb_genre_lower in self.musicbrainz_to_main_genres:
                        mapped_genre = self.musicbrainz_to_main_genres[mb_genre_lower]
                        if mapped_genre == genre:
                            score += 2  # Strong match
                            logger.debug(
                                f"🎵 MusicBrainz genre match: {genre} ↔ {mb_genre}"
                            )
                        elif (
                            genre.lower() in mb_genre_lower
                            or mb_genre_lower in genre.lower()
                        ):
                            score += 1  # Partial match
                            logger.debug(
                                f"🎵 MusicBrainz partial match: {genre} ≈ {mb_genre}"
                            )

            # Discogs validation scoring
            if discogs_genres:
                for discogs_genre in discogs_genres:
                    if (
                        genre.lower() in discogs_genre.lower()
                        or discogs_genre.lower() in genre.lower()
                    ):
                        score += 2  # Strong genre match
                        logger.debug(
                            f"🎵 Discogs genre match: {genre} ↔ {discogs_genre}"
                        )

            if discogs_subgenres:
                for discogs_subgenre in discogs_subgenres:
                    if (
                        subgenre.lower() in discogs_subgenre.lower()
                        or discogs_subgenre.lower() in subgenre.lower()
                    ):
                        score += 2  # Strong subgenre match
                        logger.debug(
                            f"🎵 Discogs subgenre match: {subgenre} ↔ {discogs_subgenre}"
                        )

            combination_scores[combination] = score
            logger.debug(f"🎯 {combination}: score = {score}")

        # Find the combination with the highest score
        best_combination = max(combination_scores.items(), key=lambda x: x[1])[0]
        best_score = combination_scores[best_combination]

        logger.info(
            f"🎯 External validation resolved tie: {best_combination} (score: {best_score})"
        )

        # If there's still a tie (same score), pick the first one alphabetically
        if (
            best_score == 0
            or len([s for s in combination_scores.values() if s == best_score]) > 1
        ):
            logger.info("🎯 No external validation advantage, using alphabetical order")
            best_combination = sorted(tied_combinations)[0]

        return best_combination

    def _confidence_weighted_aggregation(
        self, results: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Aggregate results using confidence-weighted voting with hierarchical consistency."""
        # Weight complete genre-subgenre combinations
        combination_weights = {}
        combination_confidences = {}

        # Also track individual weights for fallback
        genre_weights = {}
        subgenre_weights = {}

        for result in results:
            classification = result.get("classification", {})
            genre = classification.get("genre")
            subgenre = classification.get("subgenre")
            genre_conf = classification.get("confidence", {}).get("genre", 0)
            subgenre_conf = classification.get("confidence", {}).get("subgenre", 0)
            combined_conf = classification.get("confidence", {}).get("combined", 0)

            if genre and subgenre:
                # Weight complete combinations
                combination = f"{genre} → {subgenre}"
                if combination not in combination_weights:
                    combination_weights[combination] = 0
                combination_weights[combination] += combined_conf

                if combination not in combination_confidences:
                    combination_confidences[combination] = []
                combination_confidences[combination].append(combined_conf)

            # Track individual weights for fallback
            if genre:
                if genre not in genre_weights:
                    genre_weights[genre] = 0
                genre_weights[genre] += genre_conf

            if subgenre:
                if subgenre not in subgenre_weights:
                    subgenre_weights[subgenre] = 0
                subgenre_weights[subgenre] += subgenre_conf

        # Try to get the highest weighted complete combination first
        if combination_weights:
            best_combination = max(combination_weights.items(), key=lambda x: x[1])[0]
            predicted_genre, predicted_subgenre = best_combination.split(" → ")

            # Calculate confidence for the winning combination
            combination_confidence = np.mean(
                combination_confidences.get(best_combination, [0])
            )
            genre_confidence = (
                genre_weights.get(predicted_genre, 0) / sum(genre_weights.values())
                if sum(genre_weights.values()) > 0
                else 0
            )
            subgenre_confidence = (
                subgenre_weights.get(predicted_subgenre, 0)
                / sum(subgenre_weights.values())
                if sum(subgenre_weights.values()) > 0
                else 0
            )

            logger.info(
                f"🎯 Confidence-weighted: {best_combination} (weight: {combination_weights[best_combination]:.3f})"
            )
        else:
            # Fallback to individual weighting (should not happen with proper results)
            logger.warning(
                "⚠️ No complete combinations found, falling back to individual weighting"
            )
            predicted_genre = (
                max(genre_weights.items(), key=lambda x: x[1])[0]
                if genre_weights
                else "Unknown"
            )
            predicted_subgenre = (
                max(subgenre_weights.items(), key=lambda x: x[1])[0]
                if subgenre_weights
                else "Unknown"
            )

            # Normalize weights to get confidence scores
            total_genre_weight = sum(genre_weights.values())
            total_subgenre_weight = sum(subgenre_weights.values())

            genre_confidence = (
                genre_weights.get(predicted_genre, 0) / total_genre_weight
                if total_genre_weight > 0
                else 0
            )
            subgenre_confidence = (
                subgenre_weights.get(predicted_subgenre, 0) / total_subgenre_weight
                if total_subgenre_weight > 0
                else 0
            )
            combination_confidence = (genre_confidence + subgenre_confidence) / 2

        combined_confidence = combination_confidence

        return {
            "success": True,
            "classification": {
                "genre": predicted_genre,
                "subgenre": predicted_subgenre,
                "confidence": {
                    "genre": round(genre_confidence, 4),
                    "subgenre": round(subgenre_confidence, 4),
                    "combined": round(combined_confidence, 4),
                },
            },
            "aggregation_method": "confidence_weighted",
            "segment_count": len(results),
            "combination_weights": {
                k: round(v, 4) for k, v in combination_weights.items()
            },
            "genre_weights": {k: round(v, 4) for k, v in genre_weights.items()},
            "subgenre_weights": {k: round(v, 4) for k, v in subgenre_weights.items()},
            "processing_time": sum(
                r.get("processing_time", 0) for r in results if r is not None
            ),
            "timestamp": time.time(),
            "model_name": "Hierarchical Music Classification (Segmented)",
        }

    def _best_confidence_aggregation(
        self, results: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Aggregate results by selecting the result with highest combined confidence."""
        best_result = max(
            results,
            key=lambda r: r.get("classification", {})
            .get("confidence", {})
            .get("combined", 0),
        )

        return {
            **best_result,
            "aggregation_method": "best_confidence",
            "segment_count": len(results),
            "model_name": "Hierarchical Music Classification (Segmented)",
        }

    async def classify_audio(
        self,
        audio_file_path: str,
        include_details: bool = False,
        use_segments: bool = True,
        segment_duration: float = 90.0,
        aggregation_method: str = "majority_vote",
        force_segmentation: bool = True,
        skip_intro_outro: bool = False,
        use_musicbrainz_validation: bool = True,
    ) -> Dict[str, Any]:
        """
        Classify audio file using hierarchical classification with optional segmentation.

        Args:
            audio_file_path: Path to the audio file
            include_details: Whether to include detailed prediction information
            use_segments: Whether to split long audio into segments for better accuracy
            segment_duration: Duration of each segment in seconds (default: 90s)
            aggregation_method: Method to aggregate segment results ('majority_vote', 'confidence_weighted', 'best_confidence')
            force_segmentation: Force segmentation even for short files (default: False)
            skip_intro_outro: Skip first and last segments to avoid intro/outro (default: False)
            use_musicbrainz_validation: Whether to use MusicBrainz for genre validation (default: True)
            use_discogs_validation: Whether to use Discogs for genre validation (default: True)
        Returns:
            Dictionary with classification results
        """
        if not self.is_initialized:
            raise RuntimeError("Service not initialized. Call initialize() first.")

        if not os.path.exists(audio_file_path):
            raise FileNotFoundError(f"Audio file not found: {audio_file_path}")

        logger.info(f"🎵 Classifying: {Path(audio_file_path).name}")

        start_time = time.time()

        try:
            # Get MusicBrainz genres if validation is enabled
            musicbrainz_genres = None
            if use_musicbrainz_validation and self.enable_musicbrainz_integration:
                musicbrainz_genres = await self._get_musicbrainz_genres(audio_file_path)
                if musicbrainz_genres:
                    logger.info(f"🎵 MusicBrainz genres found: {musicbrainz_genres}")
                else:
                    logger.info(
                        "🎵 No MusicBrainz genres found, proceeding with standard classification"
                    )

            # Get Discogs genres (always enabled)

            discogs_data = await self._get_discogs_genres(audio_file_path)
            if discogs_data:
                logger.info(f"🎵 Discogs genres found: {discogs_data}")

                # Check if Discogs has a single, confident result
                discogs_genres = discogs_data.get("genres", [])
                discogs_subgenres = discogs_data.get("subgenres", [])

                if len(discogs_genres) == 1 and len(discogs_subgenres) == 1:
                    logger.info(
                        "🎯 Discogs has single genre and subgenre - using as final classification"
                    )

                    # Map Discogs genre to our main genre if needed
                    discogs_genre = discogs_genres[0]
                    discogs_subgenre = discogs_subgenres[0]

                    # Check if the Discogs genre maps to one of our main genres
                    mapped_genre = None
                    for mb_genre, main_genre in self.musicbrainz_to_main_genres.items():
                        if (
                            discogs_genre.lower() in mb_genre
                            or mb_genre in discogs_genre.lower()
                            or discogs_genre.lower() == main_genre.lower()
                        ):
                            mapped_genre = main_genre
                            break

                    if mapped_genre:
                        logger.info(
                            f"🎯 Using Discogs classification: {mapped_genre} → {discogs_subgenre}"
                        )

                        # Return Discogs result directly
                        response = {
                            "success": True,
                            "file_path": audio_file_path,
                            "classification": {
                                "genre": mapped_genre,
                                "subgenre": discogs_subgenre,
                                "confidence": {
                                    "genre": 0.95,  # High confidence for single Discogs result
                                    "subgenre": 0.95,
                                    "combined": 0.95,
                                },
                            },
                            "processing_time": round(time.time() - start_time, 2),
                            "timestamp": time.time(),
                            "model_name": "Discogs Direct Classification",
                            "segmentation": {
                                "used": False,
                                "segment_count": 1,
                                "segment_duration": segment_duration,
                            },
                            "discogs_direct_classification": {
                                "enabled": True,
                                "used": True,
                                "original_genre": discogs_genre,
                                "original_subgenre": discogs_subgenre,
                                "mapped_genre": mapped_genre,
                                "confidence": "high",
                                "reason": "Single genre and subgenre from Discogs",
                            },
                        }

                        # Add MusicBrainz validation info
                        if musicbrainz_genres:
                            response["musicbrainz_validation"] = {
                                "enabled": True,
                                "used": True,
                                "genres_found": musicbrainz_genres,
                                "genre_match": mapped_genre.lower()
                                in [g.lower() for g in musicbrainz_genres],
                                "boost_factor": 1.0,
                                "confidence_improvement": {
                                    "genre": 0.0,
                                    "subgenre": 0.0,
                                    "combined": 0.0,
                                },
                                "message": "Discogs direct classification used",
                            }
                        else:
                            response["musicbrainz_validation"] = {
                                "enabled": use_musicbrainz_validation,
                                "used": False,
                                "genres_found": [],
                                "genre_match": False,
                                "boost_factor": 1.0,
                                "confidence_improvement": {
                                    "genre": 0.0,
                                    "subgenre": 0.0,
                                    "combined": 0.0,
                                },
                                "message": "Discogs direct classification used, MusicBrainz not available",
                            }

                        logger.info(
                            f"✅ Discogs direct classification complete: {mapped_genre} → {discogs_subgenre}"
                        )
                        return response
                    else:
                        logger.info(
                            f"🎵 Discogs genre '{discogs_genre}' doesn't map to our main genres, proceeding with standard classification"
                        )
                else:
                    logger.info(
                        f"🎵 Discogs has multiple genres/subgenres ({len(discogs_genres)}/{len(discogs_subgenres)}), proceeding with standard classification"
                    )
            else:
                logger.info(
                    "🎵 No Discogs genres found, proceeding with standard classification"
                )

            # Check if we should use segmentation
            if use_segments:
                # Split audio into segments
                segment_paths, intro_outro_segments = self._split_audio_into_segments(
                    audio_file_path,
                    segment_duration,
                    force_segmentation=force_segmentation,
                    skip_intro_outro=skip_intro_outro,
                )

                if len(segment_paths) == 1:
                    # Single segment (short audio), use regular classification
                    logger.info("📏 Using single segment classification")
                    result = await asyncio.get_event_loop().run_in_executor(
                        self._executor,
                        self.system.predict_hierarchical,
                        segment_paths[0],
                    )
                    hierarchical = result["hierarchical_prediction"]

                    response = {
                        "success": True,
                        "file_path": audio_file_path,
                        "classification": {
                            "genre": hierarchical["genre"],
                            "subgenre": hierarchical["subgenre"],
                            "confidence": {
                                "genre": round(hierarchical["genre_confidence"], 4),
                                "subgenre": round(
                                    hierarchical["subgenre_confidence"], 4
                                ),
                                "combined": round(
                                    hierarchical["combined_confidence"], 4
                                ),
                            },
                        },
                        "processing_time": round(time.time() - start_time, 2),
                        "timestamp": time.time(),
                        "model_name": "Hierarchical Music Classification",
                        "segmentation": {
                            "used": False,
                            "segment_count": 1,
                            "segment_duration": segment_duration,
                        },
                    }
                else:
                    # Multiple segments, classify each and aggregate
                    logger.info(f"🎵 Classifying {len(segment_paths)} segments...")

                    # Classify all segments in parallel
                    segment_tasks = [
                        asyncio.get_event_loop().run_in_executor(
                            self._executor,
                            self.system.predict_hierarchical,
                            segment_path,
                        )
                        for segment_path in segment_paths
                    ]

                    segment_results_raw = await asyncio.gather(
                        *segment_tasks, return_exceptions=True
                    )

                    # Process segment results
                    segment_results = []
                    for i, result in enumerate(segment_results_raw):
                        if isinstance(result, Exception):
                            logger.warning(
                                f"⚠️ Segment {i + 1} classification failed: {result}"
                            )
                            continue

                        if result is None:
                            logger.warning(f"⚠️ Segment {i + 1} returned None result")
                            continue

                        hierarchical = result["hierarchical_prediction"]
                        segment_result = {
                            "success": True,
                            "segment_index": i,
                            "classification": {
                                "genre": hierarchical["genre"],
                                "subgenre": hierarchical["subgenre"],
                                "confidence": {
                                    "genre": round(hierarchical["genre_confidence"], 4),
                                    "subgenre": round(
                                        hierarchical["subgenre_confidence"], 4
                                    ),
                                    "combined": round(
                                        hierarchical["combined_confidence"], 4
                                    ),
                                },
                            },
                            "processing_time": 0,  # Individual segment time not tracked
                        }
                        segment_results.append(segment_result)

                    # Prepare external validation data for tie-breaking
                    external_validation = {
                        "musicbrainz_genres": musicbrainz_genres,
                        "discogs_data": discogs_data,
                    }

                    # Aggregate segment results
                    response = self._aggregate_segment_results(
                        segment_results, aggregation_method, external_validation
                    )
                    response["file_path"] = audio_file_path
                    response["segmentation"] = {
                        "used": True,
                        "segment_count": len(segment_paths),
                        "segment_duration": segment_duration,
                        "aggregation_method": aggregation_method,
                    }

                    # Clean up temporary segment files
                    self._cleanup_segments(segment_paths + intro_outro_segments)

                    logger.info(
                        f"✅ Segmented classification complete: {response['classification']['genre']} → {response['classification']['subgenre']} ({response['classification']['confidence']['combined']:.2%})"
                    )
            else:
                # Use original single-file classification
                logger.info("📏 Using single-file classification")
                result = await asyncio.get_event_loop().run_in_executor(
                    self._executor, self.system.predict_hierarchical, audio_file_path
                )
                hierarchical = result["hierarchical_prediction"]

                response = {
                    "success": True,
                    "file_path": audio_file_path,
                    "classification": {
                        "genre": hierarchical["genre"],
                        "subgenre": hierarchical["subgenre"],
                        "confidence": {
                            "genre": round(hierarchical["genre_confidence"], 4),
                            "subgenre": round(hierarchical["subgenre_confidence"], 4),
                            "combined": round(hierarchical["combined_confidence"], 4),
                        },
                    },
                    "processing_time": round(time.time() - start_time, 2),
                    "timestamp": time.time(),
                    "model_name": "Hierarchical Music Classification",
                    "segmentation": {
                        "used": False,
                        "segment_count": 1,
                        "segment_duration": segment_duration,
                    },
                }

            # Add detailed information if requested
            if include_details and not response.get("segmentation", {}).get(
                "used", False
            ):
                # Only add details for single-file classification
                response["details"] = {
                    "genre_details": result["genre_details"],
                    "subgenre_details": result["subgenre_details"]
                    if result["subgenre_details"]
                    else None,
                    "specialist_used": hierarchical["genre"],
                    "processing_steps": [
                        f"1. Genre classification: {hierarchical['genre']} ({hierarchical['genre_confidence']:.2%})",
                        f"2. Subgenre classification: {hierarchical['subgenre']} ({hierarchical['subgenre_confidence']:.2%})",
                        f"3. Combined result: {hierarchical['combined_confidence']:.2%} confidence",
                    ],
                }

            # Apply MusicBrainz validation if enabled
            if use_musicbrainz_validation:
                if musicbrainz_genres:
                    response = self._apply_musicbrainz_validation(
                        response, musicbrainz_genres
                    )
                else:
                    # Add MusicBrainz info even when no genres found
                    response["musicbrainz_validation"] = {
                        "enabled": True,
                        "used": False,
                        "genres_found": [],
                        "genre_match": False,
                        "boost_factor": 1.0,
                        "confidence_improvement": {
                            "genre": 0.0,
                            "subgenre": 0.0,
                            "combined": 0.0,
                        },
                        "message": "MusicBrainz identification attempted but no genres found",
                    }
            else:
                # Add MusicBrainz info when disabled
                response["musicbrainz_validation"] = {
                    "enabled": False,
                    "used": False,
                    "genres_found": [],
                    "genre_match": False,
                    "boost_factor": 1.0,
                    "confidence_improvement": {
                        "genre": 0.0,
                        "subgenre": 0.0,
                        "combined": 0.0,
                    },
                    "message": "MusicBrainz validation disabled",
                }

            # Apply Discogs validation (always enabled)
            if discogs_data:
                response = self._apply_discogs_validation(response, discogs_data)
            else:
                message = (
                    "Discogs identification attempted but no genres found"
                    if self.discogs_connector
                    else "Discogs validation disabled"
                )

                # Add Discogs info even when no genres found
                response["discogs_validation"] = {
                    "enabled": True if self.discogs_connector else False,
                    "used": True if self.discogs_connector else False,
                    "genres_found": [],
                    "subgenres_found": [],
                    "genre_match": False,
                    "boost_factor": 1.0,
                    "confidence_improvement": {
                        "genre": 0.0,
                        "subgenre": 0.0,
                        "combined": 0.0,
                    },
                    "message": message,
                }

            # Update performance tracking
            with self._lock:
                self.prediction_count += 1
                self.total_prediction_time += response["processing_time"]
                self.last_prediction_time = response["processing_time"]

                # Auto-refresh thread pool periodically to prevent memory accumulation
                if self.prediction_count % self.thread_pool_refresh_interval == 0:
                    logger.info(
                        f"🔄 Auto-refreshing thread pool after {self.prediction_count} predictions"
                    )

            # Refresh thread pool if needed (check outside lock to avoid deadlock)
            if self.prediction_count % self.thread_pool_refresh_interval == 0:
                self.refresh_thread_pool()

            logger.info(
                f"✅ Classification complete: {response['classification']['genre']} → {response['classification']['subgenre']} ({response['classification']['confidence']['combined']:.2%}) in {response['processing_time']:.2f}s"
            )

            # Clear PyTorch caches and force garbage collection
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
            gc.collect()

            return response

        except Exception as e:
            logger.error(f"❌ Classification failed for {audio_file_path}: {e}")

            # Clean up on error
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
            gc.collect()

            return {
                "success": False,
                "file_path": audio_file_path,
                "error": str(e),
                "processing_time": time.time() - start_time,
                "timestamp": time.time(),
            }

    async def classify_batch(
        self,
        audio_file_paths: List[str],
        include_details: bool = False,
        use_musicbrainz_validation: bool = True,
    ) -> Dict[str, Any]:
        """
        Classify multiple audio files in parallel.

        Args:
            audio_file_paths: List of audio file paths
            include_details: Whether to include detailed prediction information
            use_musicbrainz_validation: Whether to use MusicBrainz for genre validation

        Returns:
            Dictionary with batch classification results
        """
        logger.info(f"🎵 Batch classification: {len(audio_file_paths)} files")

        start_time = time.time()

        # Create tasks for parallel processing
        tasks = [
            self.classify_audio(
                audio_path,
                include_details=include_details,
                use_musicbrainz_validation=use_musicbrainz_validation,
            )
            for audio_path in audio_file_paths
        ]

        # Execute all tasks concurrently
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Process results
        successful_results = []
        failed_results = []

        for i, result in enumerate(results):
            if isinstance(result, Exception):
                failed_results.append(
                    {"file_path": audio_file_paths[i], "error": str(result)}
                )
            elif result.get("success", False):
                successful_results.append(result)
            else:
                failed_results.append(result)

        total_time = time.time() - start_time

        batch_result = {
            "success": len(failed_results) == 0,
            "total_files": len(audio_file_paths),
            "successful_classifications": len(successful_results),
            "failed_classifications": len(failed_results),
            "results": successful_results,
            "errors": failed_results,
            "batch_processing_time": round(total_time, 2),
            "average_time_per_file": round(total_time / len(audio_file_paths), 2)
            if audio_file_paths
            else 0,
            "timestamp": time.time(),
        }

        logger.info(
            f"✅ Batch classification complete: {len(successful_results)}/{len(audio_file_paths)} successful in {total_time:.2f}s"
        )

        return batch_result

    def refresh_thread_pool(self):
        """
        Refresh the thread pool executor to release memory from worker threads.
        Call this periodically (e.g., every 50-100 predictions) to prevent memory accumulation.
        """
        logger.info("🔄 Refreshing thread pool executor to release memory...")
        with self._lock:
            # Shutdown existing executor
            if self._executor:
                self._executor.shutdown(wait=True)

            # Create new executor
            self._executor = ThreadPoolExecutor(
                max_workers=self.max_concurrent_predictions
            )

            # Force garbage collection
            gc.collect()
            if torch.cuda.is_available():
                torch.cuda.empty_cache()

        logger.info("✅ Thread pool refreshed")

    def get_performance_stats(self) -> Dict[str, Any]:
        """Get performance statistics for the service."""
        with self._lock:
            avg_prediction_time = (
                self.total_prediction_time / self.prediction_count
                if self.prediction_count > 0
                else 0
            )

            return {
                "total_predictions": self.prediction_count,
                "average_prediction_time": round(avg_prediction_time, 2),
                "last_prediction_time": round(self.last_prediction_time, 2),
                "total_processing_time": round(self.total_prediction_time, 2),
                "system_initialized": self.is_initialized,
                "concurrent_capacity": self.max_concurrent_predictions,
            }

    def get_system_status(self) -> Dict[str, Any]:
        """Get detailed system status information."""
        if not self.is_initialized:
            return {"initialized": False, "error": "System not initialized"}

        performance = self.get_performance_stats()

        return {
            "initialized": True,
            "system_info": self.system_info,
            "performance": performance,
            "configuration": {
                "genre_model_path": self.genre_model_path,
                "specialists_directory": self.specialists_dir,
                "preload_all_specialists": self.preload_all_specialists,
                "max_concurrent_predictions": self.max_concurrent_predictions,
            },
        }

    def get_available_genres_and_subgenres(self) -> Dict[str, List[str]]:
        """Get mapping of available genres to their subgenres."""
        if not self.is_initialized:
            return {}

        genre_subgenre_mapping = {}

        # Get available genres
        available_genres = self.system_info["genre_classifier"]["genres"]

        # For each genre, get available subgenres from specialists
        for genre in available_genres:
            if genre in self.system_info["subgenre_specialists"]:
                subgenres = self.system_info["subgenre_specialists"][genre]["subgenres"]
                genre_subgenre_mapping[genre] = subgenres
            else:
                genre_subgenre_mapping[genre] = []  # No specialist available

        return genre_subgenre_mapping

    async def health_check(self) -> Dict[str, Any]:
        """Perform a health check of the classification system."""
        logger.info("🏥 Performing health check...")

        health_status = {"healthy": True, "checks": {}, "timestamp": time.time()}

        # Check 1: System initialization
        health_status["checks"]["system_initialized"] = {
            "status": "pass" if self.is_initialized else "fail",
            "message": "System is initialized"
            if self.is_initialized
            else "System not initialized",
        }

        # Check 2: Model files exist
        genre_model_exists = os.path.exists(self.genre_model_path)
        health_status["checks"]["genre_model_file"] = {
            "status": "pass" if genre_model_exists else "fail",
            "message": f"Genre model file {'exists' if genre_model_exists else 'missing'}: {self.genre_model_path}",
        }

        # Check 3: Specialists directory exists
        specialists_dir_exists = os.path.exists(self.specialists_dir)
        health_status["checks"]["specialists_directory"] = {
            "status": "pass" if specialists_dir_exists else "fail",
            "message": f"Specialists directory {'exists' if specialists_dir_exists else 'missing'}: {self.specialists_dir}",
        }

        # Check 4: System coverage
        if self.is_initialized:
            coverage = self.system_info["coverage"]["coverage_percentage"]
            coverage_ok = coverage >= 50  # At least 50% coverage
            health_status["checks"]["system_coverage"] = {
                "status": "pass" if coverage_ok else "warn",
                "message": f"System coverage: {coverage:.1f}%",
            }

        # Determine overall health
        failed_checks = [
            check
            for check in health_status["checks"].values()
            if check["status"] == "fail"
        ]
        health_status["healthy"] = len(failed_checks) == 0

        if not health_status["healthy"]:
            logger.warning(
                f"❌ Health check failed: {len(failed_checks)} failed checks"
            )
        else:
            logger.info("✅ Health check passed")

        return health_status

    async def shutdown(self):
        """Gracefully shutdown the service."""
        logger.info("🔄 Shutting down hierarchical classification service...")

        # Shutdown thread pool
        self._executor.shutdown(wait=True)

        # Clear system references
        self.system = None
        self.system_info = None
        self.is_initialized = False

        logger.info("✅ Service shutdown complete")


# Global service instance (singleton pattern)
_service_instance: Optional[HierarchicalMusicClassificationService] = None


async def get_hierarchical_classification_service(
    genre_model_path: str = None,
    specialists_dir: str = "models/subgenre_specialists",
    use_huggingface: bool = True,
    enable_musicbrainz_integration: bool = True,
    acoustid_api_key: str = None,
    **kwargs,
) -> HierarchicalMusicClassificationService:
    """
    Get or create the global hierarchical classification service instance.

    Args:
        genre_model_path: Path to genre classifier (required if use_huggingface=False)
        specialists_dir: Directory with specialists (used if use_huggingface=False)
        use_huggingface: Whether to download models from HuggingFace Hub
        enable_musicbrainz_integration: Whether to use MusicBrainz for genre validation
        acoustid_api_key: Acoustid API key (optional, will use ACOUSTID_API_KEY env var if not provided)
        **kwargs: Additional service configuration

    Returns:
        HierarchicalMusicClassificationService instance
    """
    global _service_instance

    if _service_instance is None:
        if not use_huggingface and genre_model_path is None:
            raise ValueError("genre_model_path is required when use_huggingface=False")

        _service_instance = HierarchicalMusicClassificationService(
            genre_model_path=genre_model_path,
            specialists_dir=specialists_dir,
            use_huggingface=use_huggingface,
            enable_musicbrainz_integration=enable_musicbrainz_integration,
            acoustid_api_key=acoustid_api_key,
            **kwargs,
        )

        # Initialize the service
        await _service_instance.initialize()

    return _service_instance


# Convenience functions for easy integration
async def classify_music_hierarchical(
    audio_file_path: str,
    include_details: bool = False,
    use_musicbrainz_validation: bool = True,
) -> Dict[str, Any]:
    """
    Convenience function for hierarchical music classification.

    Args:
        audio_file_path: Path to audio file
        include_details: Whether to include detailed information
        use_musicbrainz_validation: Whether to use MusicBrainz for genre validation

    Returns:
        Classification result dictionary
    """
    service = await get_hierarchical_classification_service()
    return await service.classify_audio(
        audio_file_path,
        include_details=include_details,
        use_musicbrainz_validation=use_musicbrainz_validation,
    )


async def classify_music_batch_hierarchical(
    audio_file_paths: List[str],
    include_details: bool = False,
    use_musicbrainz_validation: bool = True,
) -> Dict[str, Any]:
    """
    Convenience function for batch hierarchical music classification.

    Args:
        audio_file_paths: List of audio file paths
        include_details: Whether to include detailed information
        use_musicbrainz_validation: Whether to use MusicBrainz for genre validation

    Returns:
        Batch classification result dictionary
    """
    service = await get_hierarchical_classification_service()
    return await service.classify_batch(
        audio_file_paths,
        include_details=include_details,
        use_musicbrainz_validation=use_musicbrainz_validation,
    )
