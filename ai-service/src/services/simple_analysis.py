"""
Simple audio analysis service for minimal operations.

This service provides basic audio analysis with minimal computational overhead,
using soundfile for fast loading and avoiding redundant operations.
"""

import gc
import os
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import TYPE_CHECKING, Any, Dict, List, Optional, Tuple

from loguru import logger

if TYPE_CHECKING:
    from src.utils.scan_progress_publisher import ScanProgressPublisher

from src.services.base_metadata_extractor import create_metadata_extractor
from src.services.features.deam_extractor import DeamExtractor
from src.services.features.discogs_classifiers_extractor import (
    DiscogsClassifiersExtractor,
)
from src.services.features.discogs_embedding_extractor import DiscogsEmbeddingExtractor
from src.services.features.skey_extractor import SkeyExtractor
from src.services.features.tempo_cnn_extractor import TempoCnnExtractor
from src.services.simple_audio_loader import SimpleAudioLoader
from src.services.simple_feature_extractor import SimpleFeatureExtractor
from src.services.simple_filename_parser import SimpleFilenameParser
from src.services.simple_metadata_extractor import SimpleMetadataExtractor
from src.services.simple_technical_analyzer import SimpleTechnicalAnalyzer
from src.utils.performance_optimizer import monitor_performance

# Gates computation of the discogs-effnet classifier heads (danceability, 5 moods,
# genre_discogs400). Default-on, opt-out -- same idiom as
# ELASTICSEARCH_MFCC_VECTOR_SIMILARITY/ELASTICSEARCH_EMBEDDING_VECTOR_SIMILARITY on the
# backend. Toggle off to compare against the existing hand-computed danceability/mood
# fields without the new discogs_classifiers values overwriting anything.
DISCOGS_CLASSIFIERS_ENABLED = (
    os.getenv("DISCOGS_CLASSIFIERS_ENABLED", "true").lower() != "false"
)


class SimpleAnalysisService:
    """
    Simple audio analysis service that provides minimal operations
    for basic audio information extraction.
    """

    def __init__(self):
        """Initialize the simple analysis service."""
        logger.info("SimpleAnalysisService initialized")

        # Initialize all service components
        self.filename_parser = SimpleFilenameParser()
        self.audio_loader = SimpleAudioLoader()
        self.metadata_extractor = SimpleMetadataExtractor(self.filename_parser)
        self.technical_analyzer = SimpleTechnicalAnalyzer()
        self.feature_extractor = SimpleFeatureExtractor()
        self.embedding_extractor = DiscogsEmbeddingExtractor()
        self.classifiers_extractor = DiscogsClassifiersExtractor()
        self.tempo_cnn_extractor = TempoCnnExtractor()
        self.deam_extractor = DeamExtractor()
        self.skey_extractor = SkeyExtractor()

        # Gemini-backed filename cleaner (see GeminiMetadataExtractor's
        # _clean_filename_with_llm/_clean_filenames_batch), used in analyze_audio/
        # analyze_audio_batch to clean original_filename before it feeds ID3 tag
        # parsing. The broader AI "extract and enrich" metadata pipeline
        # (artist/title/genre/style/tags resolution, ai_bpm/ai_key overrides) has
        # been removed -- genre/style/tags now come from the discogs-effnet
        # classifiers, tempo/key from TempoCNN/S-KEY.
        try:
            self.ai_extractor = create_metadata_extractor(provider="GEMINI")
            if self.ai_extractor and self.ai_extractor._is_available():
                logger.info(
                    "GEMINI filename-cleaning extractor initialized and available"
                )
            else:
                logger.info(
                    "GEMINI filename-cleaning extractor initialized but not available "
                    "(no API key)"
                )
        except Exception as e:
            logger.warning(
                "Failed to initialize GEMINI filename-cleaning extractor: %s", e
            )
            self.ai_extractor = None

        # Memory management: track analysis count for periodic cleanup
        self.analysis_count = 0
        self.gc_interval = 10  # Force GC every 10 analyses

        # Parallelism for per-file audio analysis within a batch.
        # Disabled by default (1 = sequential): audioflux's native BFT/Onset/Spectral calls
        # (used in smart_audio_sample_loading, shared_features, key_detector) are not
        # thread-safe -- audioflux bundles its own OpenMP runtime plus Apple's Accelerate
        # framework, and calling into it from
        # multiple Python threads concurrently reproducibly crashes the process with SIGBUS
        # (confirmed: ~40% crash rate across repeated concurrent runs). Since this service is
        # already horizontally scaled across multiple instances, cross-batch throughput comes
        # from running more instances, not from intra-batch threading here. Override via
        # BATCH_AUDIO_WORKERS only if audioflux calls are made thread-safe (e.g. behind a lock).
        try:
            self.batch_audio_workers = max(
                1, int(os.getenv("BATCH_AUDIO_WORKERS", "1"))
            )
        except ValueError:
            logger.warning(
                "Invalid BATCH_AUDIO_WORKERS value, falling back to 1 (sequential)"
            )
            self.batch_audio_workers = 1

    @monitor_performance("filename_parsing")
    def parse_filename_for_metadata(self, filename: str) -> Dict[str, str]:
        return self.filename_parser.parse_filename_for_metadata(filename)

    @monitor_performance("audio_conversion")
    def convert_m4a_to_wav(self, file_path: str) -> str:
        return self.audio_loader.convert_m4a_to_wav(file_path)

    @monitor_performance("metadata_extraction")
    def extract_file_metadata(self, file_path: str) -> Dict[str, Any]:
        return self.metadata_extractor.extract_file_metadata(file_path)

    @monitor_performance("id3_extraction")
    def extract_id3_tags(
        self, file_path: str, original_filename: str = ""
    ) -> Dict[str, Any]:
        return self.metadata_extractor.extract_id3_tags(file_path, original_filename)

    @monitor_performance("technical_analysis")
    def extract_audio_technical(self, file_path: str) -> Dict[str, Any]:
        return self.technical_analyzer.extract_audio_technical(file_path)

    @monitor_performance("feature_extraction")
    def extract_basic_features(
        self,
        file_path: str,
        discogs_classifiers: dict,
        discogs_tempo: dict,
        discogs_deam: dict,
        discogs_skey: dict,
        ai_bpm: float = None,
        ai_key: str = None,
    ) -> Dict[str, Any]:
        return self.feature_extractor.extract_basic_features(
            file_path,
            discogs_classifiers,
            discogs_tempo,
            discogs_deam,
            discogs_skey,
            ai_bpm,
            ai_key,
        )

    @monitor_performance("discogs_embedding_generation")
    def generate_discogs_embedding_from_file(self, y_full, sr: int) -> list:
        """
        Extract the discogs-effnet embedding from the FULL track (not the
        trimmed harmonic/BPM/spectral analysis window). Essentia's own docs
        recommend `MonoLoader >> TensorflowPredictEffnetDiscogs` on the whole
        file -- the model internally windows into ~1s patches and mean-pools
        them, so a short excerpt only samples one part of the song.

        Args:
            y_full: Full-track audio samples at their native sample rate,
                loaded once by the caller and shared across all of the
                generate_*/extract_basic_features calls that each need the
                whole track (embedding, tempo, mood, key) -- avoids re-decoding
                the same file from disk multiple times per analysis.
            sr: Native sample rate of y_full.
        """
        try:
            duration_s = len(y_full) / sr if sr else 0
            embedding = self.embedding_extractor.extract_from_audio(y_full, sr)
            if embedding:
                logger.info(
                    f"Discogs embedding: len={len(embedding)}, "
                    f"analyzed {duration_s:.1f}s of full track"
                )
            else:
                logger.warning(
                    f"Discogs embedding extraction returned empty "
                    f"(track duration {duration_s:.1f}s)"
                )
            return embedding
        except Exception as e:
            logger.error(f"Failed to extract discogs embedding: {e}")
            return []

    @monitor_performance("discogs_classifiers_generation")
    def generate_discogs_classifiers(self, embedding: list) -> dict:
        """
        Run the discogs-effnet classifier heads (danceability, 5 moods,
        genre_discogs400) on an already-computed embedding. Gated by
        DISCOGS_CLASSIFIERS_ENABLED; returns {} when disabled or the embedding is empty.
        """
        if not DISCOGS_CLASSIFIERS_ENABLED:
            logger.debug(
                "Discogs classifiers skipped: DISCOGS_CLASSIFIERS_ENABLED is false"
            )
            return {}
        if not embedding:
            logger.warning("Discogs classifiers skipped: no embedding available")
            return {}

        result = self.classifiers_extractor.predict_all(embedding)
        if result:
            genres = result.get("genres") or []
            top_genre = (
                f"{genres[0]['genre']}/{genres[0]['style']} ({genres[0]['confidence']:.0%})"
                if genres
                else "none >10%"
            )
            logger.info(
                f"Discogs classifiers: danceable={result.get('danceable', 0):.2f} "
                f"aggressive={result.get('mood_aggressive', 0):.2f} "
                f"happy={result.get('mood_happy', 0):.2f} "
                f"party={result.get('mood_party', 0):.2f} "
                f"relaxed={result.get('mood_relaxed', 0):.2f} "
                f"sad={result.get('mood_sad', 0):.2f} "
                f"top_genre={top_genre} ({len(genres)} genres >10%)"
            )
        else:
            logger.warning("Discogs classifiers returned empty result")
        return result

    @monitor_performance("tempo_cnn_generation")
    def generate_tempo_cnn(self, y_full, sr: int) -> dict:
        """
        Estimate tempo via TempoCNN from the FULL track. TempoCNN needs its own
        11025 Hz rate (vs 16kHz for discogs-effnet/DEAM); TempoCnnExtractor
        resamples internally, so the same natively-loaded y_full/sr the caller
        passes to every generate_*() method works here too. Gated by
        DISCOGS_CLASSIFIERS_ENABLED (same flag as the discogs-effnet classifier
        heads, for one comparison toggle). Returns {} when disabled or on any
        failure.
        """
        if not DISCOGS_CLASSIFIERS_ENABLED:
            logger.debug("TempoCNN skipped: DISCOGS_CLASSIFIERS_ENABLED is false")
            return {}
        try:
            result = self.tempo_cnn_extractor.extract_from_audio(y_full, sr)
            if result:
                logger.info(
                    f"TempoCNN: tempo={result.get('tempo', 0):.1f} BPM "
                    f"confidence={result.get('confidence', 0):.2f}"
                )
            else:
                logger.warning("TempoCNN returned empty result")
            return result
        except Exception as e:
            logger.error(f"Failed TempoCNN extraction: {e}")
            return {}

    @monitor_performance("deam_generation")
    def generate_deam_mood(self, y_full, sr: int) -> dict:
        """
        Estimate valence/arousal via the DEAM arousal-valence regression model
        from the FULL track. Unlike the discogs-effnet classifier heads, DEAM
        runs on a separate MSD-MusiCNN embedding (also 16kHz, so no extra
        resample beyond what DeamExtractor already does) -- see DeamExtractor's
        docstring for why this model over emoMusic/MuSe. Gated by
        DISCOGS_CLASSIFIERS_ENABLED (same flag as the rest of this pipeline's
        model-driven fields). Returns {} when disabled or on any failure.
        """
        if not DISCOGS_CLASSIFIERS_ENABLED:
            logger.debug(
                "DEAM mood extraction skipped: DISCOGS_CLASSIFIERS_ENABLED is false"
            )
            return {}
        try:
            result = self.deam_extractor.extract_from_audio(y_full, sr)
            if result:
                logger.info(
                    f"DEAM mood: valence={result.get('valence', 0):.2f} "
                    f"arousal={result.get('arousal', 0):.2f}"
                )
            else:
                logger.warning("DEAM mood extraction returned empty result")
            return result
        except Exception as e:
            logger.error(f"Failed DEAM mood extraction: {e}")
            return {}

    @monitor_performance("skey_generation")
    def generate_skey(self, y_full, sr: int) -> dict:
        """
        Estimate musical key via Deezer's S-KEY model from the FULL track,
        replacing the retired hand-computed KeyFinder/tonnetz-mode heuristic.
        Gated by DISCOGS_CLASSIFIERS_ENABLED (same flag as the rest of this
        pipeline's model-driven fields, despite S-KEY not actually being part of
        the discogs-effnet family -- one comparison toggle for all model-sourced
        fields). Returns {} when disabled or on any failure.
        """
        if not DISCOGS_CLASSIFIERS_ENABLED:
            logger.debug(
                "S-KEY extraction skipped: DISCOGS_CLASSIFIERS_ENABLED is false"
            )
            return {}
        try:
            result = self.skey_extractor.extract_from_audio(y_full, sr)
            if result:
                logger.info(f"S-KEY: key={result.get('key')}")
            else:
                logger.warning("S-KEY extraction returned empty result")
            return result
        except Exception as e:
            logger.error(f"Failed S-KEY extraction: {e}")
            return {}

    @monitor_performance("simple_analysis_all")
    def analyze_audio(
        self,
        file_path: str,
        sample_duration: float = 10.0,
        original_filename: str = "",
        skip_intro: float = 30.0,
        skip_filename_cleaning: bool = False,
    ) -> Dict[str, Any]:
        # Track if we converted an M4A file so we can clean it up
        converted_wav_path = None

        try:
            logger.info(f"Starting simple audio analysis: {file_path}")
            start_time = time.time()

            if file_path.endswith(".m4a"):
                converted_wav_path = self.convert_m4a_to_wav(file_path)
                file_path = converted_wav_path

            # Clean the filename via the Gemini filename cleaner (if available)
            # before it's used as a fallback source for ID3 tag parsing.
            if (
                original_filename
                and not skip_filename_cleaning
                and self.ai_extractor
                and self.ai_extractor._is_available()
            ):
                cleaned_filename = self.ai_extractor._clean_filename_with_llm(
                    original_filename
                )
                if cleaned_filename and cleaned_filename != original_filename:
                    logger.info(
                        f"Filename cleaned: '{original_filename}' -> '{cleaned_filename}'"
                    )
                    original_filename = cleaned_filename
            elif skip_filename_cleaning:
                logger.debug("Skipping filename cleaning (skip_filename_cleaning=True)")

            # Extract all information
            file_metadata = self.extract_file_metadata(file_path)

            technical_info = self.extract_audio_technical(
                file_path
            )  # Use full file for duration

            # Load the full track once and share it across every generate_*()
            # call below that needs the whole file (embedding, tempo, mood, key)
            # -- each extractor resamples internally to its own target rate, so
            # a single native-rate load is enough; re-decoding the same file
            # from disk 4 times was pure waste.
            y_full, sr = self.audio_loader.load_audio_sample(
                file_path, sample_duration=None
            )

            # Computed first: extract_basic_features now sources tempo/danceability/
            # mood/instrumentalness from these instead of the retired hand-computed
            # detectors/formulas.
            embedding = self.generate_discogs_embedding_from_file(y_full, sr)
            discogs_classifiers = self.generate_discogs_classifiers(embedding)
            discogs_tempo = self.generate_tempo_cnn(y_full, sr)
            discogs_deam = self.generate_deam_mood(y_full, sr)
            discogs_skey = self.generate_skey(y_full, sr)
            basic_features = self.extract_basic_features(
                file_path,
                discogs_classifiers,
                discogs_tempo,
                discogs_deam,
                discogs_skey,
            )
            id3_tags = self.extract_id3_tags(file_path, original_filename)

            # Combine all results
            analysis_result = {
                "status": "success",
                "message": "Simple audio analysis completed successfully",
                "processing_time": round(time.time() - start_time, 3),
                "processing_mode": "simple",
                **file_metadata,
                **technical_info,
                **basic_features,
                "embedding": embedding,
                "discogs_classifiers": discogs_classifiers,
                "discogs_tempo": discogs_tempo,
                "discogs_deam": discogs_deam,
                "discogs_skey": discogs_skey,
                **id3_tags,
            }

            logger.info(
                f"Simple audio analysis completed in {analysis_result['processing_time']:.3f}s"
            )

            # Track analysis count and perform periodic garbage collection
            self.analysis_count += 1
            if self.analysis_count % self.gc_interval == 0:
                logger.debug(f"🧹 Performing GC after {self.analysis_count} analyses")
                gc.collect()

            return analysis_result

        except Exception as e:
            logger.error(f"Simple audio analysis failed: {e}")
            gc.collect()

            return {
                "status": "error",
                "message": f"Analysis failed: {str(e)}",
                "processing_mode": "simple",
            }
        finally:
            # Clean up converted WAV file if we created one
            if converted_wav_path and os.path.exists(converted_wav_path):
                try:
                    os.unlink(converted_wav_path)
                    logger.info(f"Cleaned up converted WAV file: {converted_wav_path}")
                except Exception as e:
                    logger.error(
                        f"Failed to clean up converted WAV file {converted_wav_path}: {e}"
                    )

    def _analyze_single_file_in_batch(
        self,
        idx: int,
        file_path: str,
        original_filename: str,
        total_files: int,
        sample_duration: float,
        skip_intro: float,
        session_id: Optional[str],
        batch_index: Optional[int],
        progress_publisher: Optional[Any],
    ) -> Tuple[Dict[str, Any], bool]:
        """
        Run the audio-analysis portion (decode, technical, features, ID3) for a
        single file in a batch. Self-contained so it can run safely on a worker thread:
        it performs its own M4A conversion and cleans up any converted WAV before returning.

        Args:
            idx: Index of this file within the batch (for progress events / ordering)
            file_path: Path to the (temp) audio file
            original_filename: Filename for reporting -- already cleaned by the caller
                (see analyze_audio_batch's batch filename-cleaning step) if cleaning was
                enabled and available.
            total_files: Total files in the batch
            sample_duration: Audio sample duration in seconds
            skip_intro: Seconds to skip from the start
            session_id, batch_index, progress_publisher: Progress reporting context

        Returns:
            Tuple of (file_result dict, success flag)
        """
        file_start_time = time.time()
        converted_wav_path = None
        original_filepath = file_path

        # Publish track.processing event
        if progress_publisher and session_id:
            progress_publisher.publish_event(
                session_id,
                "track.processing",
                {
                    "trackIndex": idx,
                    "totalTracks": total_files,
                    "fileName": original_filename,
                },
                batchIndex=batch_index,
            )

        try:
            logger.info(f"Processing file {idx + 1}/{total_files}: {original_filename}")

            # Handle M4A conversion if needed
            if file_path.endswith(".m4a"):
                converted_wav_path = self.convert_m4a_to_wav(file_path)
                file_path = converted_wav_path

            # Extract all information
            file_metadata = self.extract_file_metadata(file_path)
            file_metadata["file_info"]["filename"] = original_filename

            technical_info = self.extract_audio_technical(file_path)

            # Publish audio.analysis progress (25%)
            if progress_publisher and session_id:
                progress_publisher.publish_track_progress(
                    session_id,
                    batch_index or 0,
                    idx,
                    total_files,
                    original_filename,
                    25,
                )

            # Load the full track once and share it across every generate_*()
            # call below that needs the whole file (embedding, tempo, mood, key)
            # -- each extractor resamples internally to its own target rate, so
            # a single native-rate load is enough; re-decoding the same file
            # from disk 4 times was pure waste.
            y_full, sr = self.audio_loader.load_audio_sample(
                file_path, sample_duration=None
            )

            # Computed first: extract_basic_features now sources tempo/danceability/
            # mood/instrumentalness from these instead of the retired hand-computed
            # detectors/formulas.
            embedding = self.generate_discogs_embedding_from_file(y_full, sr)
            discogs_classifiers = self.generate_discogs_classifiers(embedding)
            discogs_tempo = self.generate_tempo_cnn(y_full, sr)
            discogs_deam = self.generate_deam_mood(y_full, sr)
            discogs_skey = self.generate_skey(y_full, sr)

            # Extract features
            basic_features = self.extract_basic_features(
                file_path,
                discogs_classifiers,
                discogs_tempo,
                discogs_deam,
                discogs_skey,
            )

            # Publish audio.analysis progress (50%)
            if progress_publisher and session_id:
                progress_publisher.publish_track_progress(
                    session_id,
                    batch_index or 0,
                    idx,
                    total_files,
                    original_filename,
                    50,
                )

            # Publish audio.analysis progress (75%)
            if progress_publisher and session_id:
                progress_publisher.publish_track_progress(
                    session_id,
                    batch_index or 0,
                    idx,
                    total_files,
                    original_filename,
                    75,
                )

            # Extract ID3 tags
            id3_tags = self.extract_id3_tags(original_filepath, original_filename)

            # Combine all results
            file_result = {
                "status": "success",
                "message": "Audio analysis completed successfully",
                "processing_time": round(time.time() - file_start_time, 3),
                "processing_mode": "simple",
                "filename": original_filename,
                **file_metadata,
                **technical_info,
                **basic_features,
                "embedding": embedding,
                "discogs_classifiers": discogs_classifiers,
                "discogs_tempo": discogs_tempo,
                "discogs_deam": discogs_deam,
                "discogs_skey": discogs_skey,
                **id3_tags,
            }

            # Publish audio.analysis progress (100% - complete)
            if progress_publisher and session_id:
                progress_publisher.publish_track_progress(
                    session_id,
                    batch_index or 0,
                    idx,
                    total_files,
                    original_filename,
                    100,
                )

            logger.info(
                f"✅ File {idx + 1}/{total_files} completed in "
                f"{file_result['processing_time']:.3f}s"
            )

            return file_result, True

        except Exception as e:
            logger.error(
                f"❌ Failed to analyze file {idx + 1}/{total_files} "
                f"({original_filename}): {e}"
            )
            return (
                {
                    "status": "error",
                    "message": f"Analysis failed: {str(e)}",
                    "processing_mode": "simple",
                    "filename": original_filename,
                    "processing_time": round(time.time() - file_start_time, 3),
                },
                False,
            )

        finally:
            # Clean up converted WAV file if created
            if converted_wav_path and os.path.exists(converted_wav_path):
                try:
                    os.unlink(converted_wav_path)
                except Exception as cleanup_error:
                    logger.warning(
                        f"Failed to clean up converted WAV file "
                        f"{converted_wav_path}: {cleanup_error}"
                    )

    @monitor_performance("simple_analysis_batch")
    def analyze_audio_batch(
        self,
        file_items: List[Tuple[str, str]],
        sample_duration: float = 10.0,
        skip_intro: float = 30.0,
        skip_filename_cleaning: bool = False,
        session_id: Optional[str] = None,
        batch_index: Optional[int] = None,
        progress_publisher: Optional[Any] = None,
    ) -> Dict[str, Any]:
        """
        Analyze multiple audio files in batch with efficient filename cleaning.

        This method processes multiple files efficiently by:
        1. Cleaning all filenames in a single batch API call (70%+ token savings)
        2. Processing audio analysis (BPM, features) for each file individually
        3. Matching cleaned filenames to files by order

        Args:
            file_items: List of tuples (file_path, original_filename) to process
            sample_duration: Duration of audio sample to analyze in seconds (default: 10.0)
            skip_intro: Seconds to skip from beginning (default: 30.0)
            skip_filename_cleaning: Whether to skip filename cleaning (default: False)

        Returns:
            Dictionary containing:
                - status: Overall status ("success" or "partial_success")
                - total_files: Total number of files processed
                - successful: Number of successfully processed files
                - failed: Number of failed files
                - results: List of analysis results (one per file, maintaining input order)
                - processing_time: Total processing time in seconds
        """
        start_time = time.time()
        total_files = len(file_items)
        successful = 0
        failed = 0
        results: List[Dict[str, Any]] = []

        logger.info(f"Starting batch audio analysis for {total_files} files")

        try:
            # Step 1: Clean all filenames in a single batch call
            cleaned_filenames: List[str] = [
                original_filename for _, original_filename in file_items
            ]
            if (
                not skip_filename_cleaning
                and self.ai_extractor
                and self.ai_extractor._is_available()
            ):
                try:
                    # Publish llm.metadata events for all tracks
                    if progress_publisher and session_id:
                        for track_idx, (_, original_filename) in enumerate(file_items):
                            progress_publisher.publish_event(
                                session_id,
                                "llm.metadata",
                                {
                                    "trackIndex": track_idx,
                                    "fileName": original_filename,
                                },
                                batchIndex=batch_index,
                            )

                    filenames_to_clean = [
                        original_filename for _, original_filename in file_items
                    ]
                    file_paths_to_clean = [file_path for file_path, _ in file_items]

                    logger.info(
                        f"Cleaning {len(filenames_to_clean)} filenames in batch"
                    )
                    cleaned_result = self.ai_extractor._clean_filenames_batch(
                        filenames_to_clean, file_paths_to_clean
                    )

                    if isinstance(cleaned_result, list) and len(cleaned_result) == len(
                        filenames_to_clean
                    ):
                        cleaned_filenames = cleaned_result
                        logger.info(
                            f"Successfully cleaned {len(cleaned_filenames)} filenames"
                        )
                    else:
                        logger.warning(
                            f"Batch filename cleaning returned "
                            f"{len(cleaned_result) if isinstance(cleaned_result, list) else 'non-list'} items, "
                            f"expected {len(filenames_to_clean)}. Using original filenames."
                        )
                except Exception as e:
                    logger.warning(
                        f"Batch filename cleaning failed: {e}. "
                        "Continuing with original filenames."
                    )
            else:
                logger.debug("Skipping filename cleaning (disabled or unavailable)")

            # Step 2: Process each file for audio analysis.
            # The CPU-bound audio work (decode, features) for each file is
            # independent now that filenames have been cleaned batch-up-front, so we run
            # files across a small thread pool. librosa/numpy release the GIL during the
            # heavy numeric work, giving real speedup. Results are reassembled in input order.
            # Each worker handles its own M4A conversion + WAV cleanup, so no shared
            # converted-path bookkeeping is needed here.
            results = [None] * total_files
            max_workers = min(self.batch_audio_workers, total_files) or 1

            with ThreadPoolExecutor(
                max_workers=max_workers, thread_name_prefix="batch_audio"
            ) as executor:
                future_to_idx = {
                    executor.submit(
                        self._analyze_single_file_in_batch,
                        idx,
                        file_path,
                        cleaned_filenames[idx]
                        if idx < len(cleaned_filenames)
                        else original_filename,
                        total_files,
                        sample_duration,
                        skip_intro,
                        session_id,
                        batch_index,
                        progress_publisher,
                    ): idx
                    for idx, (file_path, original_filename) in enumerate(file_items)
                }

                for future in as_completed(future_to_idx):
                    idx = future_to_idx[future]
                    try:
                        file_result, ok = future.result()
                    except Exception as e:
                        # Defensive: the worker catches its own errors, but guard anyway
                        # so one bad file never aborts the whole batch.
                        logger.error(
                            f"❌ Unexpected error analyzing file {idx + 1}/{total_files}: {e}"
                        )
                        file_result = {
                            "status": "error",
                            "message": f"Analysis failed: {str(e)}",
                            "processing_mode": "simple",
                            "filename": file_items[idx][1],
                        }
                        ok = False

                    results[idx] = file_result
                    if ok:
                        successful += 1
                    else:
                        failed += 1

            # Track analysis count and perform periodic garbage collection
            self.analysis_count += total_files
            if self.analysis_count % self.gc_interval == 0:
                logger.debug(f"🧹 Performing GC after {self.analysis_count} analyses")
                gc.collect()

            # Determine overall status
            overall_status = (
                "success"
                if failed == 0
                else "partial_success"
                if successful > 0
                else "error"
            )

            total_processing_time = round(time.time() - start_time, 3)

            logger.info(
                f"Batch analysis completed: {successful}/{total_files} successful "
                f"in {total_processing_time:.3f}s"
            )

            return {
                "status": overall_status,
                "total_files": total_files,
                "successful": successful,
                "failed": failed,
                "results": results,
                "processing_time": total_processing_time,
                "processing_mode": "simple_batch",
            }

        except Exception as e:
            logger.error(f"Batch audio analysis failed: {e}")
            gc.collect()

            # results may have been pre-sized with None placeholders if we failed mid-batch;
            # drop any unfilled slots so callers never see None entries.
            partial_results = [r for r in results if r is not None]

            return {
                "status": "error",
                "total_files": total_files,
                "successful": successful,
                "failed": failed,
                "results": partial_results,
                "message": f"Batch analysis failed: {str(e)}",
                "processing_time": round(time.time() - start_time, 3),
                "processing_mode": "simple_batch",
            }
