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

from src.services.analysis_response import (
    AnalysisResponseBuilder,
    build_classifications,
    feature,
)
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
from src.utils.trace import trace, trace_start, track_context

_TRACE_FILE = "simple_analysis"

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
        logger.debug("SimpleAnalysisService initialized")

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
                logger.debug(
                    "GEMINI filename-cleaning extractor initialized and available"
                )
            else:
                logger.debug(
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
        self,
        file_path: str,
        original_filename: str = "",
        cleaned_filename: str = "",
    ) -> Dict[str, Any]:
        return self.metadata_extractor.extract_id3_tags(
            file_path, original_filename, cleaned_filename
        )

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
    ) -> Dict[str, Any]:
        return self.feature_extractor.extract_basic_features(
            file_path,
            discogs_classifiers,
            discogs_tempo,
            discogs_deam,
            discogs_skey,
        )

    @monitor_performance("discogs_embedding_generation")
    def generate_discogs_embedding_from_file(
        self, y_full, sr: int, audio_16k=None
    ) -> Tuple[list, Optional[dict]]:
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
            audio_16k: Optional -- y_full already resampled to 16 kHz. When the
                caller (see _run_model_pipeline) has done this once to share with
                generate_deam_mood, pass it here to skip a redundant full-track
                librosa.resample.

        Returns:
            (embedding, warning) -- warning is None on success, else
            {"model": "discogs_embedding", "reason": "empty"|"failed", "detail": ...}.
            This model has no ENABLED gate, so "disabled" never occurs here.
        """
        try:
            duration_s = len(y_full) / sr if sr else 0
            if audio_16k is not None:
                embedding = self.embedding_extractor.extract(audio_16k)
            else:
                embedding = self.embedding_extractor.extract_from_audio(y_full, sr)
            if embedding:
                logger.debug(
                    f"Discogs embedding: len={len(embedding)}, "
                    f"analyzed {duration_s:.1f}s of full track"
                )
                return embedding, None
            logger.warning(
                f"Discogs embedding extraction returned empty "
                f"(track duration {duration_s:.1f}s)"
            )
            return [], {"model": "discogs_embedding", "reason": "empty", "detail": None}
        except Exception as e:
            logger.error(f"Failed to extract discogs embedding: {e}")
            return [], {
                "model": "discogs_embedding",
                "reason": "failed",
                "detail": str(e),
            }

    @monitor_performance("discogs_classifiers_generation")
    def generate_discogs_classifiers(
        self, embedding: list
    ) -> Tuple[dict, Optional[dict]]:
        """
        Run the discogs-effnet classifier heads (danceability, 5 moods,
        genre_discogs400) on an already-computed embedding. Gated by
        DISCOGS_CLASSIFIERS_ENABLED.

        Returns:
            (result, warning) -- {} result when disabled, no embedding, or the
            extractor produced nothing; warning names which of those it was.
        """
        if not DISCOGS_CLASSIFIERS_ENABLED:
            logger.debug(
                "Discogs classifiers skipped: DISCOGS_CLASSIFIERS_ENABLED is false"
            )
            return {}, {
                "model": "discogs_classifiers",
                "reason": "disabled",
                "detail": None,
            }
        if not embedding:
            logger.warning("Discogs classifiers skipped: no embedding available")
            return {}, {
                "model": "discogs_classifiers",
                "reason": "empty",
                "detail": "no embedding available",
            }

        try:
            result = self.classifiers_extractor.predict_all(embedding)
        except Exception as e:
            logger.error(f"Discogs classifiers extraction failed: {e}")
            return {}, {
                "model": "discogs_classifiers",
                "reason": "failed",
                "detail": str(e),
            }

        if result:
            genres = result.get("genres") or []
            top_genre = (
                f"{genres[0]['genre']}/{genres[0]['style']} ({genres[0]['confidence']:.0%})"
                if genres
                else "none >10%"
            )
            logger.debug(
                f"Discogs classifiers: danceable={result.get('danceable', 0):.2f} "
                f"aggressive={result.get('mood_aggressive', 0):.2f} "
                f"happy={result.get('mood_happy', 0):.2f} "
                f"party={result.get('mood_party', 0):.2f} "
                f"relaxed={result.get('mood_relaxed', 0):.2f} "
                f"sad={result.get('mood_sad', 0):.2f} "
                f"top_genre={top_genre} ({len(genres)} genres >10%)"
            )
            return result, None

        logger.warning("Discogs classifiers returned empty result")
        return {}, {"model": "discogs_classifiers", "reason": "empty", "detail": None}

    @monitor_performance("tempo_cnn_generation")
    def generate_tempo_cnn(self, y_full, sr: int) -> Tuple[dict, Optional[dict]]:
        """
        Estimate tempo via TempoCNN from the FULL track. TempoCNN needs its own
        11025 Hz rate (vs 16kHz for discogs-effnet/DEAM); TempoCnnExtractor
        resamples internally, so the same natively-loaded y_full/sr the caller
        passes to every generate_*() method works here too. Gated by
        DISCOGS_CLASSIFIERS_ENABLED (same flag as the discogs-effnet classifier
        heads, for one comparison toggle).

        Returns:
            (result, warning) -- {} result when disabled, failed, or empty;
            warning names which.
        """
        if not DISCOGS_CLASSIFIERS_ENABLED:
            logger.debug("TempoCNN skipped: DISCOGS_CLASSIFIERS_ENABLED is false")
            return {}, {"model": "tempo_cnn", "reason": "disabled", "detail": None}
        try:
            result = self.tempo_cnn_extractor.extract_from_audio(y_full, sr)
            if result:
                logger.debug(
                    f"TempoCNN: tempo={result.get('tempo', 0):.1f} BPM "
                    f"confidence={result.get('confidence', 0):.2f}"
                )
                return result, None
            logger.warning("TempoCNN returned empty result")
            return {}, {"model": "tempo_cnn", "reason": "empty", "detail": None}
        except Exception as e:
            logger.error(f"Failed TempoCNN extraction: {e}")
            return {}, {"model": "tempo_cnn", "reason": "failed", "detail": str(e)}

    @monitor_performance("deam_generation")
    def generate_deam_mood(
        self, y_full, sr: int, audio_16k=None
    ) -> Tuple[dict, Optional[dict]]:
        """
        Estimate valence/arousal via the DEAM arousal-valence regression model
        from the FULL track. Unlike the discogs-effnet classifier heads, DEAM
        runs on a separate MSD-MusiCNN embedding (also 16kHz) -- see
        DeamExtractor's docstring for why this model over emoMusic/MuSe. Gated by
        DISCOGS_CLASSIFIERS_ENABLED (same flag as the rest of this pipeline's
        model-driven fields).

        Args:
            audio_16k: Optional -- y_full already resampled to 16 kHz (shared
                with generate_discogs_embedding_from_file by _run_model_pipeline).
                MusiCNN wants 16 kHz too, so passing it skips a redundant
                full-track resample.

        Returns:
            (result, warning) -- {} result when disabled, failed, or empty;
            warning names which.
        """
        if not DISCOGS_CLASSIFIERS_ENABLED:
            logger.debug(
                "DEAM mood extraction skipped: DISCOGS_CLASSIFIERS_ENABLED is false"
            )
            return {}, {"model": "deam", "reason": "disabled", "detail": None}
        try:
            if audio_16k is not None:
                result = self.deam_extractor.extract(audio_16k)
            else:
                result = self.deam_extractor.extract_from_audio(y_full, sr)
            if result:
                logger.debug(
                    f"DEAM mood: valence={result.get('valence', 0):.2f} "
                    f"arousal={result.get('arousal', 0):.2f}"
                )
                return result, None
            logger.warning("DEAM mood extraction returned empty result")
            return {}, {"model": "deam", "reason": "empty", "detail": None}
        except Exception as e:
            logger.error(f"Failed DEAM mood extraction: {e}")
            return {}, {"model": "deam", "reason": "failed", "detail": str(e)}

    def _skey_window(self, y_full, sr: int):
        """Slice y_full to a mid-track window for S-KEY.

        Unlike the discogs-effnet / TempoCNN / MusiCNN models -- which frame the
        input into fixed patches and pool, so full-track input just means "more
        patches" -- S-KEY does ONE VQT + ONE ChromaNet forward pass over the
        whole waveform (time collapsed by a single AdaptiveAvgPool2d at the end).
        Its cost is linear in samples, and it was trained on 15s segments
        (checkpoint["audio"]["dur"] == 15), so a 400-500s track is both slow and
        off-distribution for the pooled chroma. A ~90s window from 30s in matches
        the full-track key on ~3/4 of tracks (measured) while cutting this stage
        3-4x. Tunable: SKEY_WINDOW_S (0 = full track), SKEY_SKIP_INTRO_S.
        """
        if sr is None or not len(y_full):
            return y_full
        try:
            skip_s = float(os.getenv("SKEY_SKIP_INTRO_S", "30"))
            win_s = float(os.getenv("SKEY_WINDOW_S", "90"))
        except ValueError:
            skip_s, win_s = 30.0, 90.0
        if win_s <= 0:
            return y_full
        total_s = len(y_full) / sr
        if total_s <= win_s:
            return y_full
        # Clamp the start so the window still fits within the track.
        start = int(min(skip_s, max(0.0, total_s - win_s)) * sr)
        return y_full[start : start + int(win_s * sr)]

    @monitor_performance("skey_generation")
    def generate_skey(self, y_full, sr: int) -> Tuple[dict, Optional[dict]]:
        """
        Estimate musical key via Deezer's S-KEY model, replacing the retired
        hand-computed KeyFinder/tonnetz-mode heuristic. Runs on a bounded
        mid-track window (see _skey_window) rather than the full track -- S-KEY
        does a single length-linear forward pass and was trained on 15s
        segments, so full-track input is slower with no accuracy upside. Gated
        by DISCOGS_CLASSIFIERS_ENABLED (same flag as the rest of this pipeline's
        model-driven fields, despite S-KEY not actually being part of the
        discogs-effnet family -- one comparison toggle for all model-sourced
        fields).

        Returns:
            (result, warning) -- {} result when disabled, failed, or empty;
            warning names which.
        """
        if not DISCOGS_CLASSIFIERS_ENABLED:
            logger.debug(
                "S-KEY extraction skipped: DISCOGS_CLASSIFIERS_ENABLED is false"
            )
            return {}, {"model": "skey", "reason": "disabled", "detail": None}
        try:
            y_key = self._skey_window(y_full, sr)
            result = self.skey_extractor.extract_from_audio(y_key, sr)
            if result:
                logger.debug(f"S-KEY: key={result.get('key')}")
                return result, None
            logger.warning("S-KEY extraction returned empty result")
            return {}, {"model": "skey", "reason": "empty", "detail": None}
        except Exception as e:
            logger.error(f"Failed S-KEY extraction: {e}")
            return {}, {"model": "skey", "reason": "failed", "detail": str(e)}

    def _run_model_pipeline(
        self, y_full, sr: int, builder: AnalysisResponseBuilder
    ) -> Dict[str, Any]:
        """
        Run every model extractor on one already-decoded full track, recording a
        warning on `builder` for each that produced nothing, and assemble the
        `features`/`labels`/`classifications`/`embedding` sections shared by
        analyze_audio() and _analyze_single_file_in_batch().

        Kept as one shared helper specifically so the two call sites can't drift
        the way the old flat-dict versions did (different message strings, an
        extra top-level "filename" key in the batch path, etc).
        """
        # discogs-effnet and MSD-MusiCNN (DEAM) both want 16 kHz mono. Resample
        # the full track once here and share it, instead of each extractor
        # calling librosa.resample on the whole track independently. TempoCNN
        # (11025 Hz) and S-KEY (its checkpoint's own rate) still resample
        # themselves from y_full.
        audio_16k = None
        if sr is not None and len(y_full):
            try:
                import librosa

                audio_16k = (
                    y_full
                    if sr == 16000
                    else librosa.resample(y_full, orig_sr=sr, target_sr=16000)
                )
            except Exception as e:
                logger.warning(
                    f"Shared 16 kHz resample failed ({e}); extractors will "
                    "resample individually"
                )

        embedding, warn = self.generate_discogs_embedding_from_file(
            y_full, sr, audio_16k=audio_16k
        )
        if warn:
            builder.add_warning(**warn)

        discogs_classifiers, warn = self.generate_discogs_classifiers(embedding)
        if warn:
            builder.add_warning(**warn)

        discogs_tempo, warn = self.generate_tempo_cnn(y_full, sr)
        if warn:
            builder.add_warning(**warn)

        discogs_deam, warn = self.generate_deam_mood(y_full, sr, audio_16k=audio_16k)
        if warn:
            builder.add_warning(**warn)

        discogs_skey, warn = self.generate_skey(y_full, sr)
        if warn:
            builder.add_warning(**warn)

        basic_features = self.extract_basic_features(
            "",
            discogs_classifiers,
            discogs_tempo,
            discogs_deam,
            discogs_skey,
        )
        if basic_features is None:
            # extract_basic_features failed unexpectedly (see its own try/except) --
            # degrade to empty musical features/labels rather than raising, so one
            # derivation failure doesn't collapse the whole request into the error
            # payload (the bug the old `**basic_features` splat had).
            builder.add_warning(
                "musical_features", "failed", "feature derivation raised"
            )
            musical, labels = {}, {}
        else:
            musical, labels = basic_features["musical"], basic_features["labels"]

        features = {
            "tempo": feature(
                musical.get("tempo"), "tempo_cnn", musical.get("tempo_confidence")
            ),
            "key": feature(musical.get("key"), "skey"),
            "camelot_key": feature(musical.get("camelot_key"), "skey"),
            "mode": feature(musical.get("mode"), "skey"),
            "valence": feature(musical.get("valence"), "deam"),
            "arousal": feature(musical.get("arousal"), "deam"),
            "danceability": feature(musical.get("danceability"), "discogs_effnet"),
            "instrumentalness": feature(
                musical.get("instrumentalness"), "discogs_effnet"
            ),
            "mood_happy": feature(
                discogs_classifiers.get("mood_happy"), "discogs_effnet"
            ),
            "mood_sad": feature(discogs_classifiers.get("mood_sad"), "discogs_effnet"),
            "mood_relaxed": feature(
                discogs_classifiers.get("mood_relaxed"), "discogs_effnet"
            ),
            "mood_aggressive": feature(
                discogs_classifiers.get("mood_aggressive"), "discogs_effnet"
            ),
            "mood_party": feature(
                discogs_classifiers.get("mood_party"), "discogs_effnet"
            ),
            "voice": feature(discogs_classifiers.get("voice"), "discogs_effnet"),
        }
        # Drop entries whose source model produced nothing -- `feature()` already
        # returns None for those; strip the None values so `features` only lists
        # what's actually present, consistent with `embedding` below.
        features = {k: v for k, v in features.items() if v is not None}

        response_labels = {
            "valence_mood": labels.get("valence_mood"),
            "arousal_mood": labels.get("arousal_mood"),
            "danceability_feeling": labels.get("danceability_feeling"),
        }
        response_labels = {k: v for k, v in response_labels.items() if v is not None}

        classifications = build_classifications(discogs_classifiers)

        embedding_block = (
            {"vector": embedding, "dim": len(embedding), "source": "discogs_effnet"}
            if embedding
            else None
        )

        return {
            "features": features,
            "labels": response_labels,
            "classifications": classifications,
            "embedding": embedding_block,
        }

    @monitor_performance("simple_analysis_all")
    def analyze_audio(
        self,
        file_path: str,
        sample_duration: float = 10.0,
        original_filename: str = "",
        skip_intro: float = 30.0,
    ) -> Dict[str, Any]:
        # Track if we converted an M4A file so we can clean it up
        converted_wav_path = None

        track_name = original_filename or os.path.basename(file_path)
        ctx = track_context(track_name)
        ctx.__enter__()
        h = trace_start("simple_analysis", file=_TRACE_FILE, track=track_name)
        try:
            logger.debug(f"Starting simple audio analysis: {file_path}")
            start_time = time.time()

            # Preserved through cleaning below so `track.original_filename` in the
            # response always carries the caller's raw upload name -- callers that
            # need to join a batch result back to a source-of-truth record (e.g.
            # a DB row keyed on the file as-uploaded) can't rely on `track.filename`
            # for that once LLM cleaning has rewritten it.
            raw_original_filename = original_filename

            if file_path.endswith(".m4a"):
                converted_wav_path = self.convert_m4a_to_wav(file_path)
                file_path = converted_wav_path

            # Clean the filename via the Gemini filename cleaner (if available).
            # The cleaned "Artist - Title" is passed to extract_id3_tags below,
            # where -- if it parses to a valid artist + title -- it overrides the
            # ID3 title/artist tags outright.
            cleaned_filename = ""
            if (
                original_filename
                and self.ai_extractor
                and self.ai_extractor._is_available()
            ):
                llm_cleaned = self.ai_extractor._clean_filename_with_llm(
                    original_filename
                )
                if llm_cleaned and llm_cleaned != original_filename:
                    logger.debug(
                        f"Filename cleaned: '{original_filename}' -> '{llm_cleaned}'"
                    )
                    cleaned_filename = llm_cleaned
                    original_filename = llm_cleaned

            builder = AnalysisResponseBuilder()

            # Extract all information
            file_metadata = self.extract_file_metadata(file_path)
            track = file_metadata["file_info"]
            track = {
                "filename": track["filename"],
                "original_filename": raw_original_filename or track["filename"],
                "extension": track["file_extension"],
                "mime_type": track["mime_type"],
                "size_bytes": track["file_size_bytes"],
                "size_mb": track["file_size_mb"],
            }

            technical_info = self.extract_audio_technical(
                file_path
            )  # Use full file for duration
            ti = technical_info["audio_technical"]
            audio = {
                "sample_rate": ti["sample_rate"],
                "duration_s": ti["duration_seconds"],
                "format": ti["format"],
                "bitrate": ti["bitrate"],
                "channels": ti["channels"],
                "samples": ti["samples"],
                "bit_depth": ti["bit_depth"],
                "subtype": ti["subtype"],
            }

            # Load the full track once and share it across every generate_*()
            # call below that needs the whole file (embedding, tempo, mood, key)
            # -- each extractor resamples internally to its own target rate, so
            # a single native-rate load is enough; re-decoding the same file
            # from disk 4 times was pure waste.
            with h.step("load full track"):
                y_full, sr = self.audio_loader.load_audio_sample(
                    file_path, sample_duration=None
                )

            with h.step("model pipeline"):
                pipeline = self._run_model_pipeline(y_full, sr, builder)

            id3_tags = self.extract_id3_tags(
                file_path, original_filename, cleaned_filename
            )
            tags = id3_tags["id3_tags"]

            processing_time = round(time.time() - start_time, 3)
            analysis_result = builder.build(
                status="success",
                message="Simple audio analysis completed successfully",
                processing_time=processing_time,
                track=track,
                audio=audio,
                tags=tags,
                features=pipeline["features"],
                labels=pipeline["labels"],
                classifications=pipeline["classifications"],
                embedding=pipeline["embedding"],
            )

            logger.debug(f"Simple audio analysis completed in {processing_time:.3f}s")
            h.done(processing_time=processing_time)

            # Track analysis count and perform periodic garbage collection
            self.analysis_count += 1
            if self.analysis_count % self.gc_interval == 0:
                logger.debug(f"🧹 Performing GC after {self.analysis_count} analyses")
                gc.collect()

            return analysis_result

        except Exception as e:
            logger.error(f"Simple audio analysis failed: {e}")
            h.done(error=str(e))
            gc.collect()

            return AnalysisResponseBuilder().build_error(
                message=f"Analysis failed: {str(e)}",
                processing_time=round(time.time() - start_time, 3),
            )
        finally:
            ctx.__exit__(None, None, None)
            # Clean up converted WAV file if we created one
            if converted_wav_path and os.path.exists(converted_wav_path):
                try:
                    os.unlink(converted_wav_path)
                    logger.debug(f"Cleaned up converted WAV file: {converted_wav_path}")
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
        raw_filename: Optional[str] = None,
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
            raw_filename: The caller's pre-cleaning upload filename, surfaced as
                `track.original_filename` in the response -- callers that join a
                batch result back to a source-of-truth record keyed on the file
                as-uploaded can't rely on `track.filename` for that once LLM
                cleaning has rewritten it (drops track-number prefixes/extensions,
                e.g. "014. Some Track.flac" -> "Some Track"). Falls back to
                `original_filename` when cleaning didn't run.

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

        ctx = track_context(original_filename or os.path.basename(original_filepath))
        ctx.__enter__()
        try:
            logger.debug(f"Processing file {idx + 1}/{total_files}: {original_filename}")

            # Handle M4A conversion if needed
            if file_path.endswith(".m4a"):
                converted_wav_path = self.convert_m4a_to_wav(file_path)
                file_path = converted_wav_path

            builder = AnalysisResponseBuilder()

            # Extract all information
            file_metadata = self.extract_file_metadata(file_path)
            file_metadata["file_info"]["filename"] = original_filename
            fi = file_metadata["file_info"]
            track = {
                "filename": fi["filename"],
                "original_filename": raw_filename or original_filename,
                "extension": fi["file_extension"],
                "mime_type": fi["mime_type"],
                "size_bytes": fi["file_size_bytes"],
                "size_mb": fi["file_size_mb"],
            }

            technical_info = self.extract_audio_technical(file_path)
            ti = technical_info["audio_technical"]
            audio = {
                "sample_rate": ti["sample_rate"],
                "duration_s": ti["duration_seconds"],
                "format": ti["format"],
                "bitrate": ti["bitrate"],
                "channels": ti["channels"],
                "samples": ti["samples"],
                "bit_depth": ti["bit_depth"],
                "subtype": ti["subtype"],
            }

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

            pipeline = self._run_model_pipeline(y_full, sr, builder)

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

            # Extract ID3 tags. When batch cleaning rewrote the filename
            # (raw_filename differs), original_filename is the LLM-cleaned
            # "Artist - Title" -- pass it as cleaned_filename so it overrides
            # the ID3 title/artist tags.
            cleaned_filename = (
                original_filename
                if raw_filename and raw_filename != original_filename
                else ""
            )
            id3_tags = self.extract_id3_tags(
                original_filepath, original_filename, cleaned_filename
            )
            tags = id3_tags["id3_tags"]

            processing_time = round(time.time() - file_start_time, 3)
            file_result = builder.build(
                status="success",
                message="Simple audio analysis completed successfully",
                processing_time=processing_time,
                track=track,
                audio=audio,
                tags=tags,
                features=pipeline["features"],
                labels=pipeline["labels"],
                classifications=pipeline["classifications"],
                embedding=pipeline["embedding"],
            )

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

            logger.debug(
                f"✅ File {idx + 1}/{total_files} completed in {processing_time:.3f}s"
            )
            trace(
                f"file {idx + 1}/{total_files} done in {processing_time:.3f}s",
                file=_TRACE_FILE,
            )

            return file_result, True

        except Exception as e:
            logger.error(
                f"❌ Failed to analyze file {idx + 1}/{total_files} "
                f"({original_filename}): {e}"
            )
            return (
                AnalysisResponseBuilder().build_error(
                    message=f"Analysis failed: {str(e)}",
                    processing_time=round(time.time() - file_start_time, 3),
                    track={
                        "filename": original_filename,
                        "original_filename": raw_filename or original_filename,
                    },
                ),
                False,
            )

        finally:
            ctx.__exit__(None, None, None)
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

        logger.debug(f"Starting batch audio analysis for {total_files} files")
        h = trace_start(
            "simple_analysis_batch", file=_TRACE_FILE, files=total_files
        )

        try:
            h.note("step: batch filename clean")
            # Step 1: Clean all filenames in a single batch call
            cleaned_filenames: List[str] = [
                original_filename for _, original_filename in file_items
            ]
            if self.ai_extractor and self.ai_extractor._is_available():
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

                    logger.debug(
                        f"Cleaning {len(filenames_to_clean)} filenames in batch"
                    )
                    cleaned_result = self.ai_extractor._clean_filenames_batch(
                        filenames_to_clean, file_paths_to_clean
                    )

                    if isinstance(cleaned_result, list) and len(cleaned_result) == len(
                        filenames_to_clean
                    ):
                        cleaned_filenames = cleaned_result
                        logger.debug(
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
            h.note(f"step: analyze files (workers={max_workers})")

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
                        original_filename,  # raw_filename: file_items' own filename,
                        # never overwritten by cleaned_filenames -- see
                        # _analyze_single_file_in_batch's raw_filename docstring.
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
                        file_result = AnalysisResponseBuilder().build_error(
                            message=f"Analysis failed: {str(e)}",
                            processing_time=0.0,
                            track={
                                "filename": file_items[idx][1],
                                "original_filename": file_items[idx][1],
                            },
                        )
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

            logger.debug(
                f"Batch analysis completed: {successful}/{total_files} successful "
                f"in {total_processing_time:.3f}s"
            )
            h.done(files=total_files, ok=successful, failed=failed)

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
            h.done(files=total_files, error=str(e))
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
