"""
Simple filename parsing service for extracting metadata from filenames.

This service provides filename parsing functionality using a hybrid parser
that combines regex patterns with machine learning models.
"""

import os
from typing import Dict

from loguru import logger
from trainers.filename_parser.hybrid_parser import HybridFilenameParser

from src.utils.performance_optimizer import monitor_performance


class SimpleFilenameParser:
    """
    Simple filename parsing service that extracts metadata from filenames
    using hybrid parsing (regex + ML).
    """

    def __init__(self):
        """Initialize the filename parser service."""
        logger.info("SimpleFilenameParser initialized")

        # Initialize the hybrid filename parser
        # Try to load the manually fixed trained model, fallback to regex-only if not available
        try:
            model_dir = "filename_models"
            if os.path.exists(model_dir):
                self.filename_parser = HybridFilenameParser(model_dir)
                logger.info(
                    "Hybrid filename parser initialized with manually fixed ML model"
                )
            else:
                self.filename_parser = HybridFilenameParser()
                logger.info("Hybrid filename parser initialized (regex-only mode)")
        except Exception as e:
            logger.warning(f"Failed to initialize hybrid parser: {e}, using regex-only")
            self.filename_parser = HybridFilenameParser()

    @monitor_performance("filename_parsing")
    def parse_filename_for_metadata(self, filename: str) -> Dict[str, str]:
        """
        Parse filename to extract artist, title, year, and label information using hybrid parser.

        Args:
            filename: Audio filename (with or without extension)

        Returns:
            Dictionary with extracted metadata
        """
        try:
            logger.info(f"Parsing filename for metadata: {filename}")

            # Use the hybrid parser to extract metadata
            result = self.filename_parser.parse(filename, use_ml=True)
            # Ensure all fields are present and lowercase
            parsed_result = {
                "artist": result.get("artist", "").lower().strip(),
                "title": result.get("title", "").lower().strip(),
                "year": result.get("year", "").strip(),
                "label": result.get("label", "").lower().strip(),
                "subtitle": result.get("subtitle", "").lower().strip(),
            }

            logger.info(
                f"Filename parsed: Artist='{parsed_result['artist']}', Title='{parsed_result['title']}', Year='{parsed_result['year']}', Label='{parsed_result['label']}'"
            )
            return parsed_result

        except Exception as e:
            logger.error(f"Failed to parse filename: {e}")
            return {
                "artist": "",
                "title": os.path.splitext(filename)[0].lower() if filename else "",
                "year": "",
                "label": "",
                "subtitle": "",
            }
