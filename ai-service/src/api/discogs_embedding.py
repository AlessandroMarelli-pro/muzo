"""
Discogs-effnet embedding API endpoint.

Lightweight endpoint that extracts only the discogs-effnet audio embedding,
skipping the full analysis pipeline (BPM/key/spectral features/AI metadata).
Intended for backfilling embeddings on tracks that were analyzed before this
feature existed.
"""

import os
import tempfile

from flask import request
from flask_restful import Resource
from loguru import logger

from src.services.simple_analysis import SimpleAnalysisService
from src.utils.performance_optimizer import monitor_performance


class DiscogsEmbeddingResource(Resource):
    """Discogs-effnet embedding extraction endpoint."""

    def __init__(self):
        self.simple_analysis = SimpleAnalysisService()

    @monitor_performance("discogs_embedding_api")
    def post(self):
        """
        Extract the discogs-effnet embedding for an audio file.

        Request:
            - audio_file: Audio file (wav, mp3, flac, m4a, aac, ogg, opus)
            - sample_duration: Duration of sample to analyze (default: 10.0 seconds)
            - skip_intro: Seconds to skip from beginning (default: 15.0)

        Returns:
            dict: { "status": "success", "embedding": list[float] (len 1280) }
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

            try:
                logger.info(f"Extracting discogs embedding for: {audio_file.filename}")

                sample_duration = float(request.form.get("sample_duration", 10.0))
                skip_intro = float(request.form.get("skip_intro", 15.0))

                y_harmonic, _, _, sr, *_ = self.simple_analysis.smart_audio_sample_loading(
                    temp_file_path, sample_duration, skip_intro
                )
                embedding = self.simple_analysis.generate_discogs_embedding(y_harmonic, sr)

                logger.info(
                    f"Discogs embedding extraction completed for: {audio_file.filename} "
                    f"(len={len(embedding)})"
                )
                return {"status": "success", "embedding": embedding}, 200

            finally:
                if os.path.exists(temp_file_path):
                    os.unlink(temp_file_path)

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
