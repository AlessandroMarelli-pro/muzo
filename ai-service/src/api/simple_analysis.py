"""
Simple audio analysis API endpoint for minimal operations.
"""

import atexit
import gc
import json
import os
import tempfile
import threading
from concurrent.futures import ThreadPoolExecutor
from typing import Optional

from flask import request
from flask_restful import Resource
from loguru import logger

from src.scrappers.scrapper_dispatcher import get_album_art
from src.services.simple_analysis import SimpleAnalysisService
from src.utils.performance_optimizer import monitor_performance

# Module-level thread pool for parallel operations
# This is shared across all instances and properly cleaned up on exit
_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="album_art_worker")
_executor_lock = threading.Lock()

# Memory management: track requests for periodic thread pool refresh
_request_count = 0
_thread_pool_refresh_interval = 25  # Refresh every 50 requests


def _refresh_thread_pool():
    """
    Refresh the thread pool executor to release memory from worker threads.
    Call this periodically to prevent memory accumulation.
    """
    global _executor
    logger.info("🔄 Refreshing album art thread pool executor...")

    with _executor_lock:
        # Shutdown existing executor
        if _executor:
            _executor.shutdown(wait=True, cancel_futures=True)

        # Create new executor
        _executor = ThreadPoolExecutor(
            max_workers=2, thread_name_prefix="album_art_worker"
        )

        # Force garbage collection
        gc.collect()

    logger.info("✅ Album art thread pool refreshed")


def _cleanup_executor():
    """Clean up thread pool on application exit."""
    logger.info("Shutting down album art executor")
    with _executor_lock:
        _executor.shutdown(wait=True, cancel_futures=True)


# Register cleanup handler
atexit.register(_cleanup_executor)


class SimpleAnalysisResource(Resource):
    """Simple audio analysis endpoint."""

    def __init__(self):
        """Initialize the simple analysis resource."""
        self.simple_analysis = SimpleAnalysisService()

    @monitor_performance("simple_analysis_api")
    def post(self):
        """
        Perform simple audio analysis with minimal operations.

        Returns:
            dict: Simple analysis results
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
                    "message": "File size exceeds 100MB limit for simple analysis",
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
                logger.info(
                    f"Processing audio file with simple analysis: {audio_file.filename}"
                )

                # Get parameters with optimized defaults
                sample_duration = float(
                    request.form.get("sample_duration", "10.0")
                )  # Reduced from 60s
                skip_intro = float(
                    request.form.get("skip_intro", "30.0")
                )  # Reduced from 30s

                has_image = request.form.get("has_image", "false").lower() == "true"
                skip_openai_metadata = (
                    request.form.get("skip_openai_metadata", "false").lower() == "true"
                )
                original_filename = audio_file.filename
                # Perform simple analysis
                result = self.simple_analysis.analyze_audio(
                    temp_file_path,
                    sample_duration=sample_duration,
                    original_filename=original_filename,
                    skip_intro=skip_intro,
                    skip_openai_metadata=skip_openai_metadata,
                )
                # Update filename in result
                if result.get("status") == "success":
                    result["file_info"]["filename"] = original_filename

                # Start album art fetching in parallel (non-blocking)
                album_art_future = None
                if not has_image:
                    try:
                        artist = result["id3_tags"]["artist"]
                        title = result["id3_tags"]["title"]
                        if artist and title:
                            # Submit album art fetching to thread pool with timeout
                            album_art_future = _executor.submit(
                                self._get_album_art_with_timeout,
                                artist,
                                title,
                                temp_file_path,
                                timeout=5.0,  # 5 second timeout for album art
                            )

                    except (KeyError, TypeError) as e:
                        logger.warning(
                            f"Could not extract artist/title for album art: {e}"
                        )

                    # Get album art result if available
                    if album_art_future:
                        try:
                            album_art = album_art_future.result(
                                timeout=5.0
                            )  # Wait max 5 seconds
                            result["album_art"] = album_art
                        except Exception as e:
                            logger.warning(
                                f"Album art fetching failed or timed out: {e}"
                            )
                            result["album_art"] = None
                    else:
                        result["album_art"] = None

                logger.info(f"Simple analysis completed for: {audio_file.filename}")

                # Track request count and auto-refresh thread pool periodically
                global _request_count
                _request_count += 1
                if _request_count % _thread_pool_refresh_interval == 0:
                    logger.info(
                        f"🔄 Auto-refreshing thread pool after {_request_count} requests"
                    )
                    _refresh_thread_pool()

                print(json.dumps(result, indent=4))
                return result, 200

            finally:
                # Clean up temporary file
                if os.path.exists(temp_file_path):
                    os.unlink(temp_file_path)

                # Force garbage collection after request
                gc.collect()

        except Exception as e:
            logger.error(f"Simple audio analysis failed: {e}")

            # Clean up on error
            gc.collect()

            return {
                "error": "Analysis failed",
                "message": str(e),
                "status": "error",
            }, 500

    def _get_album_art_with_timeout(
        self, artist: str, title: str, file_path: str, timeout: float = 5.0
    ) -> Optional[str]:
        """
        Get album art with timeout handling.

        Args:
            query: Search query for album art
            timeout: Maximum time to wait in seconds

        Returns:
            Album art URL or None if timeout/failure
        """
        try:
            album_art = get_album_art(artist.strip() + " - " + title.strip(), file_path)
            if not album_art and "-" in title:
                logger.warning(
                    f"Album art fetching failed for '{artist} - {title}', trying again with split title and file path {file_path}"
                )
                artist = title.split("-")[0].strip()
                title = title.split("-")[1].strip()
                album_art = get_album_art(artist + " - " + title, file_path)
            return album_art
        except Exception as e:
            logger.warning(f"Album art fetching failed for '{artist} - {title}': {e}")
            return None

    def _validate_file_size(self, audio_file) -> bool:
        """
        Validate file size to prevent processing of extremely large files.

        Args:
            audio_file: Flask file object

        Returns:
            bool: True if file size is acceptable
        """
        # Check file size (100MB limit for simple analysis)
        max_size = 100 * 1024 * 1024  # 100MB

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
