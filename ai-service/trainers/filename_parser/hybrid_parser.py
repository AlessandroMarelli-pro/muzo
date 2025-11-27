#!/usr/bin/env python3
"""
Hybrid Filename Parser

This module combines regex-based parsing with machine learning models
to provide robust filename parsing capabilities.
"""

import json
import logging
import os
from typing import Any, Dict, Optional

from .data_augmentation import ParsedMetadata
from .model_training import FilenameParserModel

logger = logging.getLogger(__name__)


class HybridFilenameParser:
    """Hybrid parser combining regex and ML approaches"""

    def __init__(self, model_dir: Optional[str] = None):
        self.ml_model = None
        self.model_dir = model_dir

        # Load ML model if available
        if model_dir and os.path.exists(model_dir):
            try:
                self.ml_model = FilenameParserModel()
                self.ml_model.load(model_dir)
                logger.info("ML model loaded successfully")
            except Exception as e:
                logger.warning(f"Failed to load ML model: {e}")
                self.ml_model = None

    def remove_extension(self, filename: str) -> str:
        """Remove file extension from filename"""
        if not filename:
            return filename

        # Common audio extensions
        extensions = [
            ".mp3",
            ".wav",
            ".flac",
            ".m4a",
            ".aac",
            ".ogg",
            ".wma",
            ".aiff",
            ".opus",
        ]

        for ext in extensions:
            if filename.lower().endswith(ext):
                return filename[: -len(ext)]

        return filename

    def parse_with_regex(self, filename: str) -> Dict[str, str]:
        """Parse filename using improved regex patterns"""
        import re

        def clean_text(text: str) -> str:
            """Clean text by removing extra whitespace and normalizing characters."""
            if not text:
                return ""
            # Remove extra whitespace
            text = re.sub(r"\s+", " ", text.strip())
            # Remove common unwanted characters at the beginning/end (but preserve parentheses)
            text = re.sub(r"^[^\w\s()]+|[^\w\s()]+$", "", text)
            return text.strip().lower()

        def extract_year_from_text(text: str) -> str:
            """Extract year from text using regex patterns."""
            if not text:
                return ""
            # Look for 4-digit years (1900-2099) in the text
            year_match = re.search(r"\b(19|20)\d{2}\b", text)
            if year_match:
                return year_match.group()
            return ""

        def remove_year_from_text(text: str) -> str:
            """Remove year from text while preserving other content."""
            if not text:
                return text
            # Remove year patterns: "1999", "(1999)", "1999)", "(1999"
            text = re.sub(r"\s*\(?\b(19|20)\d{2}\b\)?\s*", " ", text)
            # Clean up extra spaces
            text = re.sub(r"\s+", " ", text.strip())
            return text

        result = {"artist": "", "title": "", "year": "", "label": "", "subtitle": ""}

        # Remove extension
        base_name = self.remove_extension(filename)

        # Extract title from quotes first (full-width or regular quotes)
        quote_patterns = [
            r'"([^"]+)"',  # Regular double quotes
            r"＂([^＂]+)＂",  # Full-width double quotes
            r'"([^"]+)"',  # Left/right double quotes
            r'"([^"]+)"',  # Alternative left/right quotes
        ]

        for pattern in quote_patterns:
            quote_match = re.search(pattern, base_name)
            if quote_match:
                result["title"] = clean_text(quote_match.group(1))
                # Remove the quoted part and use remaining as artist
                remaining = base_name.replace(quote_match.group(), "").strip()
                # Remove parentheses content (subtitle)
                paren_match = re.search(r"\(([^)]+)\)", remaining)
                if paren_match:
                    result["subtitle"] = clean_text(paren_match.group(1))
                    remaining = remaining.replace(paren_match.group(), "").strip()

                if remaining:
                    result["artist"] = clean_text(remaining)

                return result

        # Updated regex patterns (only match parentheses with years)
        filename_patterns = [
            # Artist - Title [Label] (most common with brackets)
            r"^(.+?)\s*[-–—~:._]\s*(.+?)\s*\[([^\]]+)\]$",
            # Artist - Title (Year) [Label] - only match if parentheses contain a year
            r"^(.+?)\s*[-–—~:._]\s*(.+?)\s*\((19|20)\d{2}\)\s*\[([^\]]+)\]$",
            # Artist - Title (Year) - only match if parentheses contain a year
            r"^(.+?)\s*[-–—~:._]\s*(.+?)\s*\((19|20)\d{2}\)$",
            # Artist - Title
            r"^(.+?)\s*[-–—~:._]\s*(.+?)$",
        ]

        # Special patterns for complex filenames without clear separators
        special_patterns = [
            # Pattern: "artist ( subtitle ) additional_info year"
            # e.g., "joanna law ( love is not enough ) mix d'ambience 1990"
            r"^(.+?)\s*\(([^)]+)\)\s*(.+?)\s*((19|20)\d{2})$",
            # Pattern: "artist ( subtitle ) additional_info"
            r"^(.+?)\s*\(([^)]+)\)\s*(.+?)$",
        ]

        # Try special patterns first (for complex filenames)
        for pattern in special_patterns:
            match = re.match(pattern, base_name, re.IGNORECASE)
            if match:
                groups = match.groups()

                if len(groups) >= 2:
                    result["artist"] = clean_text(groups[0])
                    result["subtitle"] = clean_text(groups[1])

                    # Handle additional groups
                    if len(groups) >= 3:
                        third_group = clean_text(groups[2])

                        # Check if it's a year
                        if re.match(r"^(19|20)\d{2}$", third_group):
                            result["year"] = third_group
                        else:
                            result["title"] = third_group

                    # Handle fourth group (year from nested capture)
                    if len(groups) >= 4 and groups[3]:
                        year_group = groups[3].strip()
                        if re.match(r"^(19|20)\d{2}$", year_group):
                            result["year"] = year_group

                    # If no title was set, use subtitle as title
                    if not result["title"]:
                        result["title"] = result["subtitle"]

                    break

        # Try each standard pattern in order of specificity
        if not result["artist"] or not result["title"]:
            for pattern in filename_patterns:
                match = re.match(pattern, base_name, re.IGNORECASE)
                if match:
                    groups = match.groups()

                    if len(groups) >= 2:
                        result["artist"] = clean_text(groups[0])
                        result["title"] = clean_text(groups[1])

                        # Handle additional groups (year, label)
                        if len(groups) >= 3:
                            third_group = clean_text(groups[2])

                            # Check if it's a year
                            if re.match(r"^(19|20)\d{2}$", third_group):
                                result["year"] = third_group
                            else:
                                result["label"] = third_group

                        # Handle fourth group (usually label)
                        if len(groups) >= 4:
                            fourth_group = clean_text(groups[3])
                            result["label"] = fourth_group

                        break

        # Fallback: try simple separator splitting if no pattern matched
        if not result["artist"] or not result["title"]:
            separators = [
                r"\s*-\s*",  # " - " (most common)
                r"\s*–\s*",  # " – " (en dash)
                r"\s*—\s*",  # " — " (em dash)
                r"\s*~\s*",  # " ~ " (tilde)
                r"\s*:\s*",  # " : " (colon)
                r"\s*\.\s*",  # " . " (dot)
                r"\s*_\s*",  # " _ " (underscore)
                r"\s{2,}",  # Multiple spaces (2 or more)
            ]

            for separator in separators:
                parts = re.split(separator, base_name, maxsplit=1)
                if len(parts) == 2:
                    result["artist"] = clean_text(parts[0])
                    result["title"] = clean_text(parts[1])

                    # Try to extract year from title
                    year = extract_year_from_text(result["title"])
                    if year:
                        result["year"] = year
                        # Remove year from title
                        result["title"] = remove_year_from_text(result["title"])
                        result["title"] = clean_text(result["title"])

                    # Clean up artist name if it has parentheses (like "artist (info)")
                    if "(" in result["artist"] and ")" in result["artist"]:
                        # Keep the main artist name, remove parenthetical info
                        artist_parts = result["artist"].split("(")
                        if len(artist_parts) > 1:
                            result["artist"] = clean_text(artist_parts[0])

                    # Try to extract label from title (brackets)
                    label_match = re.search(r"\[([^\]]+)\]", result["title"])
                    if label_match:
                        result["label"] = clean_text(label_match.group(1))
                        # Remove label from title
                        result["title"] = re.sub(r"\s*\[[^\]]+\]", "", result["title"])
                        result["title"] = clean_text(result["title"])

                    break

        # Final fallback: if no artist found, treat entire filename as title
        if not result["artist"] and not result["title"]:
            result["title"] = clean_text(base_name)
        elif not result["title"]:
            result["title"] = result["artist"]
            result["artist"] = ""

        return result

    def parse_with_ml(self, filename: str) -> Dict[str, str]:
        """Parse filename using machine learning model"""
        if not self.ml_model:
            raise ValueError("ML model not available")

        # Remove extension before ML prediction
        base_name = self.remove_extension(filename)
        print(f"Base name: {base_name}")
        return self.ml_model.predict(base_name)

    def parse(self, filename: str, use_ml: bool = True) -> Dict[str, str]:
        """
        Parse filename using hybrid approach

        Args:
            filename: Audio filename to parse
            use_ml: Whether to use ML model as fallback

        Returns:
            Dictionary with parsed metadata
        """
        logger.info(f"Parsing filename: {filename}")

        # Try regex first (fast)
        regex_result = self.parse_with_regex(filename)
        print(f"Regex result: {regex_result}")
        # Check if regex parsing was successful (has both artist and title)
        if regex_result["artist"] and regex_result["title"]:
            logger.info("Regex parsing successful")
            return regex_result

        # If regex failed and ML is available, try ML
        if use_ml and self.ml_model:
            try:
                ml_result = self.parse_with_ml(filename)
                print(f"ML result: {ml_result}")
                logger.info("ML parsing successful")
                return ml_result
            except Exception as e:
                logger.warning(f"ML parsing failed: {e}")

        # Return regex result (even if incomplete)
        logger.info("Using regex result (incomplete)")
        return regex_result

    def parse_batch(self, filenames: list, use_ml: bool = True) -> list:
        """Parse multiple filenames"""
        results = []

        for filename in filenames:
            try:
                result = self.parse(filename, use_ml)
                results.append(result)
            except Exception as e:
                logger.error(f"Failed to parse {filename}: {e}")
                results.append(
                    {
                        "artist": "",
                        "title": filename,
                        "year": "",
                        "label": "",
                        "subtitle": "",
                    }
                )

        return results

    def evaluate_hybrid_performance(self, test_data: list) -> Dict[str, Any]:
        """Evaluate performance of hybrid parser"""
        results = {
            "regex_success": 0,
            "ml_success": 0,
            "total_samples": len(test_data),
            "accuracy": {},
        }

        for sample in test_data:
            filename = sample["filename"]
            expected = sample

            # Test regex
            regex_result = self.parse_with_regex(filename)
            if regex_result["artist"] and regex_result["title"]:
                results["regex_success"] += 1

            # Test ML if available
            if self.ml_model:
                try:
                    ml_result = self.parse_with_ml(filename)
                    if ml_result["artist"] and ml_result["title"]:
                        results["ml_success"] += 1
                except:
                    pass

        # Calculate success rates
        results["regex_success_rate"] = (
            results["regex_success"] / results["total_samples"]
        )
        if self.ml_model:
            results["ml_success_rate"] = (
                results["ml_success"] / results["total_samples"]
            )

        return results


def main():
    """Main function for testing"""
    parser = HybridFilenameParser()

    # Test filenames
    test_filenames = [
        "Artist - Title.mp3",
        "Band – Song (1999).mp3",
        "Singer ~ Track [Label].mp3",
        "Complex Filename with Spaces.mp3",
    ]

    print("Testing hybrid parser:")
    for filename in test_filenames:
        result = parser.parse(filename)
        print(f"Filename: {filename}")
        print(f"Result: {result}")
        print()


if __name__ == "__main__":
    main()
