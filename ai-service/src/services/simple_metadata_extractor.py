"""
Simple metadata extraction service for file and ID3 tag extraction.

This service provides metadata extraction functionality for both file system
metadata and audio file ID3 tags with filename parsing fallback.
"""

import os
import time
from typing import Any, Dict

from loguru import logger
from mutagen import File

from src.utils.performance_optimizer import monitor_performance


class SimpleMetadataExtractor:
    default_id3_tags = {
        "title": "",
        "artist": "",
        "album": "",
        "albumartist": "",
        "date": "",
        "year": "",
        "genre": "",
        "bpm": "",
        "track_number": "",
        "disc_number": "",
        "comment": "",
        "composer": "",
        "copyright": "",
        "bitrate": "",
    }

    """
    Simple metadata extraction service that provides file metadata
    and ID3 tag extraction capabilities.
    """

    def __init__(self, filename_parser=None):
        """
        Initialize the metadata extractor service.

        Args:
            filename_parser: Optional filename parser instance for fallback parsing
        """
        logger.info("SimpleMetadataExtractor initialized")
        self.filename_parser = filename_parser

    @monitor_performance("simple_file_metadata")
    def extract_file_metadata(self, file_path: str) -> Dict[str, Any]:
        """
        Extract basic file metadata without audio processing.

        Args:
            file_path: Path to audio file

        Returns:
            Dictionary containing file metadata
        """
        try:
            logger.info(f"Extracting file metadata: {file_path}")

            # Get file stats
            stat = os.stat(file_path)
            file_size_bytes = stat.st_size
            file_size_mb = file_size_bytes / (1024 * 1024)

            # Get file extension and name
            filename = os.path.basename(file_path)
            file_extension = os.path.splitext(filename)[1].lower()

            # Basic MIME type mapping
            mime_types = {
                ".flac": "audio/flac",
                ".mp3": "audio/mpeg",
                ".wav": "audio/wav",
                ".m4a": "audio/mp4",
                ".aac": "audio/aac",
                ".ogg": "audio/ogg",
            }

            metadata = {
                "file_info": {
                    "filename": filename,
                    "filepath": file_path,
                    "file_extension": file_extension,
                    "mime_type": mime_types.get(file_extension, "audio/unknown"),
                    "file_size_bytes": file_size_bytes,
                    "file_size_mb": round(file_size_mb, 2),
                    "created_at": time.strftime(
                        "%Y-%m-%dT%H:%M:%SZ", time.gmtime(stat.st_ctime)
                    ),
                    "modified_at": time.strftime(
                        "%Y-%m-%dT%H:%M:%SZ", time.gmtime(stat.st_mtime)
                    ),
                    "accessed_at": time.strftime(
                        "%Y-%m-%dT%H:%M:%SZ", time.gmtime(stat.st_atime)
                    ),
                }
            }

            logger.info(f"File metadata extracted: {file_size_mb:.2f} MB")
            return metadata

        except Exception as e:
            logger.error(f"Failed to extract file metadata: {e}")
            raise

    def is_binary_data(self, value):
        """Check if a value contains binary data that shouldn't be displayed as text."""
        if isinstance(value, bytes):
            return True

        if isinstance(value, str):
            # Check for null bytes or excessive non-printable characters
            if "\x00" in value:
                return True
            # Count non-printable characters (excluding common whitespace)
            non_printable = sum(1 for c in value if ord(c) < 32 and c not in "\t\n\r")
            return non_printable > len(value) * 0.1  # More than 10% non-printable

        return False

    def safe_string_conversion(self, value):
        """Safely convert a value to string, handling binary data and encoding issues."""
        try:
            if value is None:
                return "None"

            # Handle lists
            if isinstance(value, list):
                if not value:
                    return "[Empty list]"
                # Process each item in the list
                safe_items = []
                for item in value:
                    safe_item = self.safe_string_conversion(item)
                    if safe_item != "[Binary data]":
                        safe_items.append(safe_item)
                return ", ".join(safe_items) if safe_items else "[Binary data only]"

            # Check for binary data first
            if self.is_binary_data(value):
                return "[Binary data]"

            # Handle bytes with encoding
            if isinstance(value, bytes):
                try:
                    return value.decode("utf-8", errors="replace")
                except Exception:
                    return "[Binary data]"

            return str(value)

        except Exception:
            return "[Conversion error]"

    def safe_get_tag_value(self, audio_file, key):
        """Safely get a tag value from audio file, handling ValueError exceptions."""
        try:
            if key in audio_file:
                return audio_file[key]
        except ValueError:
            # Some keys may exist but raise ValueError when accessed
            # This is common with certain audio formats
            pass
        except Exception:
            # Handle any other exceptions
            pass
        return None

    @monitor_performance("simple_id3_tags")
    def extract_id3_tags(
        self, file_path: str, original_filename: str = ""
    ) -> Dict[str, Any]:
        """
        Extract ID3 tags from audio file with filename fallback.

        Args:
            file_path: Path to audio file
            original_filename: Original filename for fallback parsing

        Returns:
            Dictionary containing ID3 tag information
        """
        try:
            logger.info(f"Extracting ID3 tags: {file_path}")

            # Try to extract ID3 tags using mutagen
            try:
                audio_file = File(file_path)
                # Common tag mappings for different formats
                tag_mappings = {
                    "title": ["TIT2", "TITLE", "\xa9nam", "title"],
                    "artist": ["TPE1", "ARTIST", "\xa9ART", "artist"],
                    "album": ["TALB", "ALBUM", "\xa9alb", "album"],
                    "albumartist": ["TPE2", "ALBUMARTIST", "aART", "albumartist"],
                    "date": ["TDRC", "DATE", "\xa9day", "date"],
                    "year": ["TDRC", "TYER", "YEAR", "year", "DATE"],
                    "genre": ["TCON", "GENRE", "\xa9gen", "genre", "style", "category"],
                    "bpm": ["TBPM", "BPM", "bpm"],
                    "track_number": [
                        "TRCK",
                        "TRACKNUMBER",
                        "trkn",
                        "track",
                        "tracknumber",
                    ],
                    "disc_number": ["TPOS", "DISCNUMBER", "disk", "disc", "discnumber"],
                    "comment": ["COMM", "COMMENT", "\xa9cmt", "comment"],
                    "composer": ["TCOM", "COMPOSER", "\xa9wrt", "composer"],
                    "copyright": ["TCOP", "COPYRIGHT", "copyright"],
                }
                id3_tags = {}
                if audio_file is not None:
                    for common_name, possible_keys in tag_mappings.items():
                        for key in possible_keys:
                            value = self.safe_get_tag_value(audio_file, key)
                            if value is not None:
                                safe_value = self.safe_string_conversion(value)
                                if safe_value and safe_value != "[Binary data]":
                                    id3_tags[common_name] = safe_value
                                    break  # Found a valid value for this common_name

                    # Extract bitrate from audio file info
                    if hasattr(audio_file, "info"):
                        info = audio_file.info
                        bitrate = getattr(info, "bitrate", None)
                        if bitrate:
                            try:
                                id3_tags["bitrate"] = int(bitrate)
                            except (ValueError, TypeError):
                                id3_tags["bitrate"] = bitrate
                        else:
                            id3_tags["bitrate"] = ""
                    else:
                        id3_tags["bitrate"] = ""

                else:
                    id3_tags = self.default_id3_tags
            except Exception as e:
                logger.warning(f"Failed to extract ID3 tags: {e}")
                id3_tags = self.default_id3_tags

            # Clean up empty strings
            if id3_tags.get("title") == "":
                id3_tags["title"] = original_filename.lower().strip()

            id3_tags = {k: v if v else "" for k, v in id3_tags.items()}
            # Fallback to filename parsing if ID3 tags are missing
            if id3_tags.get("title") and not id3_tags.get("artist"):
                logger.info("ID3 tags missing, falling back to filename parsing")
                filename = id3_tags.get("title")
                if self.filename_parser:
                    filename_metadata = (
                        self.filename_parser.parse_filename_for_metadata(filename)
                    )
                    # Use filename data to fill missing ID3 fields
                    id3_tags["artist"] = (
                        filename_metadata.get("artist", "").lower().strip()
                    )
                    id3_tags["title"] = (
                        filename_metadata.get("title", "").lower().strip()
                    )
                    if not id3_tags.get("year"):
                        id3_tags["year"] = filename_metadata.get("year", "")

                    # Add filename-derived metadata
                    id3_tags["filename_parsed"] = True
                    id3_tags["label"] = filename_metadata.get("label", "")
                else:
                    id3_tags["filename_parsed"] = False
            else:
                id3_tags["filename_parsed"] = False

            logger.info(
                f"ID3 tags extracted: {id3_tags.get('title', 'Unknown')} - {id3_tags.get('artist', 'Unknown')} (filename_parsed: {id3_tags.get('filename_parsed', False)})"
            )
            return {"id3_tags": id3_tags}

        except Exception as e:
            logger.error(f"Failed to extract ID3 tags: {e}")
            # Even on error, try filename parsing as last resort
            return {"id3_tags": self.default_id3_tags}
