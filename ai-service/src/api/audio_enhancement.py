"""
Audio Enhancement API Endpoint

Flask-RESTful endpoint for AI-based audio super-resolution (UniverSR),
dispatched to a Hugging Face Jobs GPU instance.

Endpoints:
- POST /api/v1/audio/enhance - Enhance a single audio file
"""

import os
import tempfile

from flask import request, send_file
from flask_restful import Resource
from loguru import logger

from ..services.audio_enhancement import get_service_instance, is_service_ready

VALID_EXTENSIONS = {".mp3", ".wav", ".flac", ".m4a", ".aac", ".ogg", ".opus"}


class AudioEnhancementResource(Resource):
    """Audio super-resolution / enhancement endpoint."""

    def post(self):
        """
        Enhance a single audio file via UniverSR audio super-resolution.

        **Parameters:**
        - audio_file: Audio file to enhance

        **Response:** the enhanced audio as a 48kHz WAV file download.
        """
        temp_input_path = None
        temp_output_path = None
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
                    "message": "Please provide a valid audio file (.mp3, .wav, .flac, .m4a, .aac, .ogg, .opus)",
                }, 400

            if not is_service_ready():
                return {
                    "error": "Service not initialized",
                    "message": "Audio enhancement service is not available",
                }, 503

            logger.info(f"🎧 Audio enhancement request: {audio_file.filename}")

            temp_input_path = os.path.join(tempfile.gettempdir(), audio_file.filename)
            audio_file.save(temp_input_path)

            temp_output_path = os.path.join(
                tempfile.gettempdir(), f"enhanced_{audio_file.filename}.wav"
            )

            service = get_service_instance()
            service.enhance(temp_input_path, temp_output_path)

            logger.info(f"✅ Enhancement complete for {audio_file.filename}")

            return send_file(
                temp_output_path,
                mimetype="audio/wav",
                as_attachment=True,
                download_name=f"enhanced_{audio_file.filename}.wav",
            )

        except Exception as e:
            logger.error(f"❌ Enhancement failed: {e}")
            return {
                "error": "Enhancement failed",
                "message": str(e),
                "status": "error",
            }, 500

        finally:
            if temp_input_path and os.path.exists(temp_input_path):
                os.unlink(temp_input_path)
            # temp_output_path is streamed by send_file; Flask's default
            # send_file usage here does not auto-delete it after the response
            # is sent. Cleaning it up immediately would race the response
            # stream, so it is left for the OS temp dir's normal lifecycle.

    def _is_valid_audio_file(self, filename: str) -> bool:
        _, ext = os.path.splitext(filename.lower())
        return ext in VALID_EXTENSIONS
