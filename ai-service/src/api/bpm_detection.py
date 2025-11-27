"""
BPM Detection API endpoint for audio tempo analysis.

This module provides endpoints for detecting the tempo (BPM) of audio files
using multiple detection strategies.
"""

import os
import tempfile
from typing import Optional

from flask import request
from flask_restful import Resource
from loguru import logger

from src.utils.performance_optimizer import monitor_performance


class BPMDetectionResource(Resource):
    """BPM detection endpoint for audio tempo analysis."""

    @monitor_performance("bpm_detection_api")
    def post(self):
        """
        Detect BPM (tempo) of an audio file.

        Request:
            - audio_file: Audio file (wav, mp3, flac, m4a, aac, ogg, opus)
            - sample_duration: Duration of sample to analyze (default: 10.0 seconds)
            - skip_intro: Seconds to skip from beginning (default: 15.0)
            - skip_outro: Seconds to skip from end (default: 15.0)


        Returns:
            dict: BPM detection results
        """
        try:
            # Check if file is present in request
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

            # Validate file type
            if not self._is_valid_audio_file(audio_file.filename):
                return {
                    "error": "Invalid file type",
                    "message": "Please provide a valid audio file (wav, mp3, flac, m4a, aac, ogg, opus)",
                }, 400

            # Validate file size
            if not self._validate_file_size(audio_file):
                return {
                    "error": "File too large",
                    "message": "File size exceeds 50MB limit for BPM detection",
                }, 413

            # Save uploaded file temporarily
            # Create temp file with proper suffix and ensure it's closed before use
            temp_file = tempfile.NamedTemporaryFile(
                delete=False, suffix=os.path.splitext(audio_file.filename)[1]
            )
            temp_file_path = temp_file.name
            temp_file.close()  # Close the file handle before saving to it

            # Now save the uploaded file to the closed temp file path
            audio_file.save(temp_file_path)

            try:
                logger.info(f"Processing BPM detection for: {audio_file.filename}")

                original_filename = audio_file.filename

                # Detect BPM using selected strategy
                bpm_result = self._detect_bpm(
                    temp_file_path,
                )

                # Prepare response
                result = {
                    "status": "success",
                    "filename": original_filename,
                    "bpm": bpm_result["bpm"],
                    "confidence": bpm_result["confidence"],
                    "processing_time": bpm_result["processing_time"],
                }

                # Add additional details if available
                if "all_results" in bpm_result:
                    result["all_results"] = bpm_result["all_results"]

                logger.info(
                    f"BPM detection completed for: {audio_file.filename} - {bpm_result['bpm']:.1f} BPM"
                )
                return result, 200

            finally:
                # Clean up temporary file
                if os.path.exists(temp_file_path):
                    os.unlink(temp_file_path)

        except Exception as e:
            logger.error(f"BPM detection failed: {e}")
            return {
                "error": "BPM detection failed",
                "message": str(e),
                "status": "error",
            }, 500

    def _detect_bpm(
        self,
        file_path: str,
    ) -> dict:
        """
        Detect BPM using the specified strategy.

        Args:
            file_path: Path to audio file
            sample_duration: Duration of sample to analyze
            skip_intro: Seconds to skip from beginning
            skip_outro: Seconds to skip from end

        Returns:
            dict: BPM detection results
        """
        import time

        start_time = time.time()

        try:
            # Use adaptive detector
            from src.services.enhanced_adaptive_bpm_detector import (
                EnhancedAdaptiveBPMDetector,
            )

            adaptive_detector = EnhancedAdaptiveBPMDetector()

            bpm, confidence = adaptive_detector.detect_bpm_from_file(file_path)

            return {
                "bpm": float(bpm),
                "confidence": float(confidence),
                "processing_time": time.time() - start_time,
            }

        except Exception as e:
            logger.error(f"BPM detection failed: {e}")
            return {
                "bpm": 120.0,
                "confidence": 0.0,
                "error": str(e),
                "processing_time": time.time() - start_time,
            }

    def _calculate_confidence_from_results(self, results: list) -> float:
        """
        Calculate confidence based on consistency of BPM results.

        Args:
            results: List of BPM values from different chunks

        Returns:
            float: Confidence score between 0.0 and 1.0
        """
        if not results or len(results) < 2:
            return 0.5  # Medium confidence for single result

        import numpy as np

        # Calculate standard deviation
        std_dev = np.std(results)
        mean_bpm = np.mean(results)

        # Confidence based on coefficient of variation (lower is better)
        if mean_bpm > 0:
            cv = std_dev / mean_bpm
            confidence = max(0.0, min(1.0, 1.0 - cv))
        else:
            confidence = 0.0

        return float(confidence)

    def _validate_file_size(self, audio_file) -> bool:
        """
        Validate file size to prevent processing of extremely large files.

        Args:
            audio_file: Flask file object

        Returns:
            bool: True if file size is acceptable
        """
        # Check file size (50MB limit for BPM detection)
        max_size = 100 * 1024 * 1024  # 50MB

        # Get file size
        audio_file.seek(0, 2)  # Seek to end
        file_size = audio_file.tell()
        audio_file.seek(0)  # Reset to beginning

        if file_size > max_size:
            logger.warning(f"File too large: {file_size} bytes (max: {max_size})")
            return False

        return True

    def _is_valid_audio_file(self, filename: str) -> bool:
        """
        Check if the uploaded file is a valid audio file.

        Args:
            filename: Name of the uploaded file

        Returns:
            bool: True if valid audio file, False otherwise
        """
        if not filename:
            return False

        # Get file extension
        file_ext = os.path.splitext(filename)[1].lower().lstrip(".")

        # Valid audio extensions
        valid_extensions = ["wav", "mp3", "flac", "m4a", "aac", "ogg", "opus"]

        return file_ext in valid_extensions
