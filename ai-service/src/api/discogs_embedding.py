"""
Discogs-effnet embedding API endpoint.

Lightweight endpoint that extracts the discogs-effnet audio embedding and its
classifier heads (danceability, mood, genre_discogs400), skipping the full
analysis pipeline (BPM/key/spectral features/AI metadata). Intended for
backfilling embeddings/classifiers on tracks that were analyzed before these
features existed.

Runs on the FULL track, not a trimmed excerpt -- TensorflowPredictEffnetDiscogs
internally windows the input into ~1s patches and mean-pools them, and
Essentia's own docs recommend `MonoLoader >> TensorflowPredictEffnetDiscogs` on
the whole file rather than a short sample.
"""

import os
import tempfile

from flask import request
from flask_restful import Resource
from loguru import logger

from src.services.features.discogs_classifiers_extractor import DiscogsClassifiersExtractor
from src.services.features.discogs_embedding_extractor import DiscogsEmbeddingExtractor
from src.services.features.tempo_cnn_extractor import TempoCnnExtractor
from src.services.simple_audio_loader import SimpleAudioLoader
from src.utils.performance_optimizer import monitor_performance

# Same gate as SimpleAnalysisService.DISCOGS_CLASSIFIERS_ENABLED, read independently
# here since this resource deliberately doesn't import SimpleAnalysisService.
DISCOGS_CLASSIFIERS_ENABLED = os.getenv("DISCOGS_CLASSIFIERS_ENABLED", "true").lower() != "false"


class DiscogsEmbeddingResource(Resource):
    """
    Discogs-effnet embedding + classifier-heads extraction endpoint.

    Deliberately avoids SimpleAnalysisService, which also initializes the
    Gemini filename-cleaning client on construction -- unnecessary cost for an
    embedding-only request. Uses SimpleAudioLoader, DiscogsEmbeddingExtractor,
    and DiscogsClassifiersExtractor directly instead.
    """

    def __init__(self):
        self.audio_loader = SimpleAudioLoader()
        self.embedding_extractor = DiscogsEmbeddingExtractor()
        self.classifiers_extractor = DiscogsClassifiersExtractor()
        self.tempo_cnn_extractor = TempoCnnExtractor()

    @monitor_performance("discogs_embedding_api")
    def post(self):
        """
        Extract the discogs-effnet embedding for an audio file.

        Request:
            - audio_file: Audio file (wav, mp3, flac, m4a, aac, ogg, opus)
              (the full file is analyzed; no sample_duration/skip_intro needed)

        Returns:
            dict: {
                "status": "success",
                "embedding": list[float] (len 1280),
                "discogs_classifiers": {
                    "danceable": float, "mood_aggressive": float, "mood_happy": float,
                    "mood_party": float, "mood_relaxed": float, "mood_sad": float,
                    "voice": float,
                    "genres": [{"genre": str, "style": str, "confidence": float}, ...],
                    "instruments": [{"instrument": str, "confidence": float}, ...],
                    "tags": [{"tag": str, "confidence": float}, ...]
                },
                "discogs_tempo": {"tempo": float, "confidence": float}
            }
        """
        try:
            if "audio_file" not in request.files:
                return {
                    "error": "No audio file provided",
                    "message": "Please provide an audio file in the request",
                }, 400

            audio_file = request.files["audio_file"]

            if audio_file.filename == "":
                return {
                    "error": "No file selected",
                    "message": "Please select a valid audio file",
                }, 400

            if not self._is_valid_audio_file(audio_file.filename):
                return {
                    "error": "Invalid file type",
                    "message": "Please provide a valid audio file (wav, mp3, flac, m4a, aac, ogg, opus)",
                }, 400

            if not self._validate_file_size(audio_file):
                return {
                    "error": "File too large",
                    "message": "File size exceeds 100MB limit for embedding extraction",
                }, 413

            temp_file = tempfile.NamedTemporaryFile(
                delete=False, suffix=os.path.splitext(audio_file.filename)[1]
            )
            temp_file_path = temp_file.name
            temp_file.close()

            audio_file.save(temp_file_path)

            # Essentia's audio reader can't parse M4A/AAC containers directly (same
            # limitation the full analysis pipeline works around in simple_analysis.py).
            converted_wav_path = None
            analysis_path = temp_file_path
            if temp_file_path.endswith(".m4a"):
                converted_wav_path = self.audio_loader.convert_m4a_to_wav(temp_file_path)
                analysis_path = converted_wav_path

            try:
                logger.info(f"Extracting discogs embedding for: {audio_file.filename}")

                y_full, sr = self.audio_loader.load_audio_sample(
                    analysis_path, sample_duration=None
                )
                duration_s = len(y_full) / sr if sr else 0
                embedding = self.embedding_extractor.extract_from_audio(y_full, sr)

                if not embedding:
                    logger.warning(
                        f"Discogs embedding extraction returned empty for: "
                        f"{audio_file.filename} (track duration {duration_s:.1f}s)"
                    )
                    discogs_classifiers = {}
                else:
                    logger.info(
                        f"Discogs embedding: len={len(embedding)}, "
                        f"analyzed {duration_s:.1f}s of full track "
                        f"({audio_file.filename})"
                    )
                    if DISCOGS_CLASSIFIERS_ENABLED:
                        discogs_classifiers = self.classifiers_extractor.predict_all(embedding)
                        if discogs_classifiers:
                            genres = discogs_classifiers.get("genres") or []
                            top_genre = (
                                f"{genres[0]['genre']}/{genres[0]['style']} "
                                f"({genres[0]['confidence']:.0%})"
                                if genres
                                else "none >10%"
                            )
                            logger.info(
                                f"Discogs classifiers: "
                                f"danceable={discogs_classifiers.get('danceable', 0):.2f} "
                                f"aggressive={discogs_classifiers.get('mood_aggressive', 0):.2f} "
                                f"happy={discogs_classifiers.get('mood_happy', 0):.2f} "
                                f"party={discogs_classifiers.get('mood_party', 0):.2f} "
                                f"relaxed={discogs_classifiers.get('mood_relaxed', 0):.2f} "
                                f"sad={discogs_classifiers.get('mood_sad', 0):.2f} "
                                f"top_genre={top_genre} ({len(genres)} genres >10%)"
                            )
                        else:
                            logger.warning("Discogs classifiers returned empty result")
                    else:
                        logger.debug(
                            "Discogs classifiers skipped: DISCOGS_CLASSIFIERS_ENABLED is false"
                        )
                        discogs_classifiers = {}

                if DISCOGS_CLASSIFIERS_ENABLED:
                    discogs_tempo = self.tempo_cnn_extractor.extract_from_audio(y_full, sr)
                    if discogs_tempo:
                        logger.info(
                            f"TempoCNN: tempo={discogs_tempo.get('tempo', 0):.1f} BPM "
                            f"confidence={discogs_tempo.get('confidence', 0):.2f}"
                        )
                    else:
                        logger.warning("TempoCNN returned empty result")
                else:
                    discogs_tempo = {}

                return {
                    "status": "success",
                    "embedding": embedding,
                    "discogs_classifiers": discogs_classifiers,
                    "discogs_tempo": discogs_tempo,
                }, 200

            finally:
                if os.path.exists(temp_file_path):
                    os.unlink(temp_file_path)
                if converted_wav_path and os.path.exists(converted_wav_path):
                    os.unlink(converted_wav_path)

        except Exception as e:
            logger.error(f"Discogs embedding extraction failed: {e}")
            return {
                "error": "Discogs embedding extraction failed",
                "message": str(e),
                "status": "error",
            }, 500

    def _validate_file_size(self, audio_file) -> bool:
        max_size = 100 * 1024 * 1024  # 100MB

        audio_file.seek(0, 2)
        file_size = audio_file.tell()
        audio_file.seek(0)

        if file_size > max_size:
            logger.warning(f"File too large: {file_size} bytes (max: {max_size})")
            return False

        return True

    def _is_valid_audio_file(self, filename: str) -> bool:
        if not filename:
            return False

        file_ext = os.path.splitext(filename)[1].lower().lstrip(".")
        valid_extensions = ["wav", "mp3", "flac", "m4a", "aac", "ogg", "opus"]

        return file_ext in valid_extensions
