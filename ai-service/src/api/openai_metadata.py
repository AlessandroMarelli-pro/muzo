"""
OpenAI metadata extraction API endpoint.

This module provides an endpoint for extracting music metadata from filenames
using OpenAI, without requiring full audio file processing.
"""

from flask import request
from flask_restful import Resource
from loguru import logger

from src.services.openai_metadata_extractor import OpenAIMetadataExtractor
from src.utils.performance_optimizer import monitor_performance

# Shared extractor instance across all requests
_shared_extractor = None


def get_shared_extractor():
    """Get or create shared OpenAI metadata extractor instance."""
    global _shared_extractor

    if _shared_extractor is None:
        try:
            _shared_extractor = OpenAIMetadataExtractor()
            logger.info("Shared OpenAI metadata extractor initialized")
        except Exception as e:
            logger.error(f"Failed to initialize shared OpenAI metadata extractor: {e}")
            _shared_extractor = None

    return _shared_extractor


class OpenAIMetadataResource(Resource):
    """OpenAI metadata extraction endpoint."""

    def __init__(self):
        """Initialize the OpenAI metadata resource."""
        # Use shared extractor instance
        self.openai_extractor = get_shared_extractor()

    @monitor_performance("openai_metadata_api")
    def post(self):
        """
        Extract metadata from a filename using OpenAI.
        If file_path is provided, ID3 tags will be extracted and used for more accurate results.

        Request body (JSON):
            {
                "filename": "Artist - Title (Mix) [Year].mp3",
                "file_path": "/path/to/audio/file.mp3"  # Optional
            }

        Or form data:
            - filename: Audio filename
            - file_path: Optional path to audio file

        Returns:
            dict: Extracted metadata from OpenAI
        """
        try:
            # Check if OpenAI service is available
            if not self.openai_extractor or not self.openai_extractor._is_available():
                return {
                    "error": "OpenAI service not available",
                    "message": "OpenAI API key not configured. Set OPENAI_API_KEY environment variable.",
                    "status": "error",
                }, 503

            # Get filename and file_path from request
            filename = None
            file_path = None

            # Try to get from JSON body first
            if request.is_json:
                data = request.get_json()
                if data:
                    filename = data.get("filename")
                    file_path = data.get("file_path")

            # Fall back to form data
            if not filename:
                filename = request.form.get("filename")
            if not file_path:
                file_path = request.form.get("file_path")

            # Validate filename
            if not filename:
                return {
                    "error": "No filename provided",
                    "message": "Please provide a filename in the request body (JSON) or form data",
                }, 400

            if filename.strip() == "":
                return {
                    "error": "Empty filename",
                    "message": "Please provide a valid filename",
                }, 400

            logger.info(f"Extracting metadata from filename: {filename}")
            if file_path:
                logger.info(f"Using file path for ID3 tag extraction: {file_path}")

            # Extract metadata using OpenAI
            metadata = self.openai_extractor.extract_metadata_from_filename(
                filename, file_path
            )

            # Check if extraction was successful (has at least artist or title)
            if not metadata or (
                not metadata.get("artist") and not metadata.get("title")
            ):
                return {
                    "status": "partial",
                    "message": "Metadata extraction completed but returned minimal data",
                    "filename": filename,
                    "metadata": metadata,
                }, 200

            # Return successful result
            result = {
                "status": "success",
                "message": "Metadata extracted successfully",
                "filename": filename,
                "metadata": metadata,
            }

            logger.info(
                f"Metadata extraction completed: {metadata.get('artist', 'Unknown')} - {metadata.get('title', 'Unknown')}"
            )
            return result, 200

        except Exception as e:
            logger.error(f"OpenAI metadata extraction failed: {e}")
            return {
                "error": "Metadata extraction failed",
                "message": str(e),
                "status": "error",
            }, 500

    @monitor_performance("openai_metadata_api")
    def get(self):
        """
        Health check for OpenAI metadata extraction service.

        Returns:
            dict: Service availability status
        """
        try:
            is_available = (
                self.openai_extractor is not None
                and self.openai_extractor._is_available()
            )

            return {
                "status": "available" if is_available else "unavailable",
                "message": "OpenAI metadata extraction service is available"
                if is_available
                else "OpenAI API key not configured",
                "service": "openai_metadata_extraction",
            }, 200 if is_available else 503

        except Exception as e:
            logger.error(f"OpenAI metadata health check failed: {e}")
            return {
                "status": "error",
                "message": str(e),
                "service": "openai_metadata_extraction",
            }, 500
