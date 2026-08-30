"""
Simple filename parsing service for extracting metadata from filenames.

This service provides filename parsing functionality using a hybrid parser
that combines regex patterns with machine learning models.
"""

import os
import re
from pathlib import Path
from typing import Dict

from loguru import logger

from src.utils.performance_optimizer import monitor_performance

try:
    from trainers.filename_parser.hybrid_parser import HybridFilenameParser
except ImportError:
    # trainers/ isn't shipped in the deployed ai-service image (training-time
    # code only); fall back to the parser's own regex-only mode via a
    # minimal stand-in with the same interface.
    HybridFilenameParser = None


class SimpleFilenameParser:
    """
    Simple filename parsing service that extracts metadata from filenames
    using hybrid parsing (regex + ML).
    """

    def __init__(self):
        """Initialize the filename parser service."""
        logger.debug("SimpleFilenameParser initialized")

        if HybridFilenameParser is None:
            # trainers/ not available in this environment (e.g. deployed
            # ai-service image); parse_filename_for_metadata falls back to
            # its own minimal filename-based extraction.
            self.filename_parser = None
            logger.debug("Hybrid filename parser unavailable, using minimal fallback")
            return

        # Initialize the hybrid filename parser
        # Try to load the manually fixed trained model, fallback to regex-only if not available
        try:
            # Resolve relative to the repo root, not the process CWD (gunicorn
            # workers may chdir): src/services/simple_filename_parser.py -> repo/
            model_dir = str(Path(__file__).resolve().parents[2] / "filename_models")
            if os.path.exists(model_dir):
                self.filename_parser = HybridFilenameParser(model_dir)
                logger.debug(
                    "Hybrid filename parser initialized with manually fixed ML model"
                )
            else:
                self.filename_parser = HybridFilenameParser()
                logger.debug("Hybrid filename parser initialized (regex-only mode)")
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
            logger.debug(f"Parsing filename for metadata: {filename}")

            # trainers/ (the ML hybrid parser) isn't in the deployed image --
            # use the regex fallback below instead of NPE-ing on None.parse().
            if self.filename_parser is None:
                return self._parse_minimal(filename)

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

            logger.debug(
                f"Filename parsed: Artist='{parsed_result['artist']}', Title='{parsed_result['title']}', Year='{parsed_result['year']}', Label='{parsed_result['label']}'"
            )
            return parsed_result

        except Exception as e:
            logger.error(f"Failed to parse filename: {e}")
            return self._parse_minimal(filename)

    # Separators seen in real filenames, in order of preference. A plain ASCII
    # " - " is by far the most common "Artist - Title" delimiter.
    _SEPARATORS = (" - ", " – ", " — ", " ~ ", " | ", " _ ")

    def _parse_minimal(self, filename: str) -> Dict[str, str]:
        """Regex-only "Artist - Title (year)" extraction, used when the ML
        hybrid parser isn't available (deployed image) or raises."""
        base = os.path.splitext(filename or "")[0].strip()

        # Drop common non-metadata suffixes first ("-enhanced" etc; "(Original
        # Mix)" is kept -- it's part of the title).
        base = re.sub(
            r"[-_ ]+(enhanced|remaster(?:ed)?|hd|hq|hi-?res)\s*$", "", base, flags=re.I
        ).strip()
        # A trailing (YYYY) or [YYYY] -> year, stripped from the title.
        year = ""
        m = re.search(r"[\(\[](\d{4})[\)\]]\s*$", base)
        if m:
            year = m.group(1)
            base = base[: m.start()].strip()

        artist, title = "", base
        for sep in self._SEPARATORS:
            if sep in base:
                left, _, right = base.partition(sep)
                if left.strip() and right.strip():
                    artist, title = left.strip(), right.strip()
                    break

        # Trailing catalog tag like "[FLING007]" / "(CAT123)" -- not part of the
        # title. Keep parenthetical mix/version info ("(Original Mix)").
        title = re.sub(
            r"\s*[\[\(][A-Z]{2,}[\s-]?\d{2,}[\]\)]\s*$", "", title
        ).strip()

        return {
            "artist": artist.lower(),
            "title": title.lower(),
            "year": year,
            "label": "",
            "subtitle": "",
        }
