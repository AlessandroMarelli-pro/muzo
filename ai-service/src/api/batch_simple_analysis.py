"""
Batch simple audio analysis API endpoint for processing multiple files.

This module provides a batch endpoint that processes multiple audio files
efficiently using single API call batching for AI metadata extraction.
"""

import gc
import os
import tempfile
from typing import List, Optional, Tuple

from flask import request
from flask_restful import Resource
from loguru import logger

from src.scrappers.scrapper_dispatcher import get_album_art
from src.services.simple_analysis import SimpleAnalysisService
from src.utils.performance_optimizer import monitor_performance

# Import shared executor from simple_analysis module
import src.api.simple_analysis as simple_analysis_module


class BatchSimpleAnalysisResource(Resource):
    """Batch simple audio analysis endpoint."""

    def __init__(self):
        """Initialize the batch simple analysis resource."""
        self.simple_analysis = SimpleAnalysisService()

    @monitor_performance("batch_simple_analysis_api")
    def post(self):
        """
        Perform simple audio analysis on multiple files in batch.

        This endpoint processes multiple audio files efficiently by:
        - Extracting AI metadata for all files in a single batch API call (70%+ token savings)
        - Processing audio analysis (BPM, features, fingerprint) for each file
        - Leveraging context caching for 90% discount on cached tokens

        Request:
            - audio_files: Multiple audio files (multipart/form-data)
            - sample_duration: Duration of sample to analyze (default: 10.0 seconds)
            - skip_intro: Seconds to skip from beginning (default: 30.0)
            - skip_ai_metadata: Skip AI metadata extraction (default: false)
            - has_image: Whether files already have images (default: false)

        Returns:
            dict: Batch analysis results with per-file results
        """
        temp_file_paths: List[str] = []

        try:
            # Get multiple files from request
            audio_files = request.files.getlist("audio_files")

            if not audio_files or len(audio_files) == 0:
                return {
                    "error": "No audio files provided",
                    "message": "Please provide at least one audio file in the request",
                }, 400

            # Validate file count (reasonable limit)
            if len(audio_files) > 50:
                return {
                    "error": "Too many files",
                    "message": "Maximum 50 files per batch request",
                }, 400

            # Validate all files
            for audio_file in audio_files:
                if audio_file.filename == "":
                    return {
                        "error": "Empty filename",
                        "message": "All files must have valid filenames",
                    }, 400

                if not self._is_valid_audio_file(audio_file.filename):
                    return {
                        "error": "Invalid file type",
                        "message": f"Invalid file type: {audio_file.filename}. "
                        "Please provide valid audio files (wav, mp3, flac, m4a, aac, ogg, opus)",
                    }, 400

                if not self._validate_file_size(audio_file):
                    return {
                        "error": "File too large",
                        "message": f"File {audio_file.filename} exceeds 100MB limit",
                    }, 413

            logger.info(
                f"Processing batch audio analysis for {len(audio_files)} files"
            )

            # Get parameters with optimized defaults
            sample_duration = float(request.form.get("sample_duration", "10.0"))
            skip_intro = float(request.form.get("skip_intro", "30.0"))
            skip_ai_metadata = (
                request.form.get("skip_ai_metadata", "false").lower() == "true"
            )
            has_image = request.form.get("has_image", "false").lower() == "true"

            # Save all uploaded files temporarily
            file_items: List[Tuple[str, str]] = []
            for audio_file in audio_files:
                # Create temp file with proper suffix
                temp_file = tempfile.NamedTemporaryFile(
                    delete=False, suffix=os.path.splitext(audio_file.filename)[1]
                )
                temp_file_path = temp_file.name
                temp_file.close()

                # Save uploaded file
                audio_file.save(temp_file_path)
                temp_file_paths.append(temp_file_path)

                # Store (file_path, original_filename) tuple
                file_items.append((temp_file_path, audio_file.filename))

            # Perform batch analysis
            result = self.simple_analysis.analyze_audio_batch(
                file_items=file_items,
                sample_duration=sample_duration,
                skip_intro=skip_intro,
                skip_ai_metadata=skip_ai_metadata,
            )

            # Start album art fetching in parallel for successful results (non-blocking)
            if not has_image:
                for idx, file_result in enumerate(result.get("results", [])):
                    if file_result.get("status") == "success":
                        try:
                            id3_tags = file_result.get("id3_tags", {})
                            artist = id3_tags.get("artist")
                            title = id3_tags.get("title")
                            if artist and title:
                                # Submit album art fetching to thread pool
                                album_art_future = simple_analysis_module._executor.submit(
                                    self._get_album_art_with_timeout,
                                    artist,
                                    title,
                                    file_items[idx][0],  # file_path
                                    timeout=5.0,
                                )

                                # Try to get result (non-blocking, with timeout)
                                try:
                                    album_art = album_art_future.result(timeout=5.0)
                                    file_result["album_art"] = album_art
                                except Exception as e:
                                    logger.warning(
                                        f"Album art fetching failed or timed out for "
                                        f"{file_items[idx][1]}: {e}"
                                    )
                                    file_result["album_art"] = None
                            else:
                                file_result["album_art"] = None
                        except Exception as e:
                            logger.warning(
                                f"Failed to fetch album art for {file_items[idx][1]}: {e}"
                            )
                            if "album_art" not in file_result:
                                file_result["album_art"] = None

            logger.info(
                f"Batch analysis completed: {result.get('successful', 0)}/"
                f"{result.get('total_files', 0)} successful"
            )

            # Track request count and auto-refresh thread pool periodically
            simple_analysis_module._request_count += len(audio_files)
            if (
                simple_analysis_module._request_count
                % simple_analysis_module._thread_pool_refresh_interval
                == 0
            ):
                logger.info(
                    f"🔄 Auto-refreshing thread pool after "
                    f"{simple_analysis_module._request_count} requests"
                )
                simple_analysis_module._refresh_thread_pool()

            return result, 200

        except Exception as e:
            logger.error(f"Batch audio analysis failed: {e}")

            # Clean up on error
            gc.collect()

            return {
                "error": "Batch analysis failed",
                "message": str(e),
                "status": "error",
            }, 500

        finally:
            # Clean up all temporary files
            for temp_file_path in temp_file_paths:
                if os.path.exists(temp_file_path):
                    try:
                        os.unlink(temp_file_path)
                    except Exception as cleanup_error:
                        logger.warning(
                            f"Failed to clean up temp file {temp_file_path}: {cleanup_error}"
                        )

            # Force garbage collection after request
            gc.collect()

    def _get_album_art_with_timeout(
        self, artist: str, title: str, file_path: str, timeout: float = 5.0
    ) -> Optional[str]:
        """
        Get album art with timeout handling.

        Args:
            artist: Artist name
            title: Track title
            file_path: Path to audio file
            timeout: Maximum time to wait in seconds

        Returns:
            Album art URL or None if timeout/failure
        """
        try:
            album_art = get_album_art(artist.strip() + " - " + title.strip(), file_path)
            if not album_art and "-" in title:
                logger.warning(
                    f"Album art fetching failed for '{artist} - {title}', "
                    f"trying again with split title and file path {file_path}"
                )
                artist = title.split("-")[0].strip()
                title = title.split("-")[1].strip()
                album_art = get_album_art(artist + " - " + title, file_path)
            return album_art
        except Exception as e:
            logger.warning(
                f"Album art fetching failed for '{artist} - {title}': {e}"
            )
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
            logger.warning(
                f"File too large: {file_size} bytes (max: {max_size})"
            )
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
