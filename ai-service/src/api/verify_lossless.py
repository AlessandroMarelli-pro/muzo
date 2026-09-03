"""
Fake-lossless verification API endpoint.

POST /api/v1/audio/verify-lossless - spectral check that a lossless-container
file was not transcoded from a lossy source.
"""

import os
import tempfile

from flask import request
from flask_restful import Resource
from loguru import logger

from src.services.features.lossless_verifier import LosslessVerifier
from src.services.simple_audio_loader import SimpleAudioLoader
from src.utils.trace import track_context, trace_start

_TRACE_FILE = "verify_lossless"

VALID_EXTENSIONS = {".wav", ".flac", ".m4a", ".aiff", ".aif"}


class VerifyLosslessResource(Resource):
    def __init__(self):
        self.audio_loader = SimpleAudioLoader()
        self.verifier = LosslessVerifier(self.audio_loader)

    def post(self):
        """
        Request:
            - audio_file: a lossless-container audio file (wav, flac, m4a, aiff)

        Returns:
            dict: { "status": "success", "verified": bool, "cutoff_hz": float,
                    "sample_rate": int, "reason": str }
        """
        h = None
        _ctx = None
        temp_file_path = None
        converted_wav_path = None
        try:
            if "audio_file" not in request.files:
                return {"error": "No audio file provided"}, 400

            audio_file = request.files["audio_file"]
            if audio_file.filename == "":
                return {"error": "No file selected"}, 400
            if not self._is_valid_audio_file(audio_file.filename):
                return {
                    "error": "Invalid file type",
                    "message": "Provide a lossless-container file (wav, flac, m4a, aiff)",
                }, 400
            if not self._validate_file_size(audio_file):
                return {"error": "File too large", "message": "100MB limit"}, 413

            temp_file = tempfile.NamedTemporaryFile(
                delete=False, suffix=os.path.splitext(audio_file.filename)[1]
            )
            temp_file_path = temp_file.name
            temp_file.close()
            audio_file.save(temp_file_path)

            analysis_path = temp_file_path
            if temp_file_path.endswith(".m4a"):
                converted_wav_path = self.audio_loader.convert_m4a_to_wav(temp_file_path)
                analysis_path = converted_wav_path

            _ctx = track_context(audio_file.filename)
            _ctx.__enter__()
            h = trace_start(
                "verify_lossless", file=_TRACE_FILE, track=audio_file.filename
            )
            with h.step("spectral analysis"):
                verdict = self.verifier.verify_file(analysis_path)

            logger.debug(
                f"verify-lossless {audio_file.filename}: "
                f"verified={verdict.verified} cutoff={verdict.cutoff_hz:.0f}Hz "
                f"({verdict.reason})"
            )
            h.done(verified=verdict.verified, cutoff_hz=verdict.cutoff_hz)
            return {"status": "success", **verdict.to_dict()}, 200

        except Exception as e:
            logger.error(f"verify-lossless failed: {e}")
            if h:
                h.done(error=str(e))
            return {"error": "Verification failed", "message": str(e), "status": "error"}, 500

        finally:
            if _ctx is not None:
                _ctx.__exit__(None, None, None)
            if temp_file_path and os.path.exists(temp_file_path):
                os.unlink(temp_file_path)
            if converted_wav_path and os.path.exists(converted_wav_path):
                os.unlink(converted_wav_path)

    def _is_valid_audio_file(self, filename: str) -> bool:
        _, ext = os.path.splitext(filename.lower())
        return ext in VALID_EXTENSIONS

    def _validate_file_size(self, audio_file) -> bool:
        max_size = 100 * 1024 * 1024
        audio_file.seek(0, 2)
        file_size = audio_file.tell()
        audio_file.seek(0)
        return file_size <= max_size
