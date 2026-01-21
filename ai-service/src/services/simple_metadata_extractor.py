"""
Simple metadata extraction service for file and ID3 tag extraction.

This service provides metadata extraction functionality for both file system
metadata and audio file ID3 tags with filename parsing fallback.
"""

import base64
import os
import time
from typing import Any, Dict, Optional

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
        "image": "",
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
                ".opus": "audio/opus",
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

    def _parse_flac_picture_block(self, data: bytes) -> Optional[bytes]:
        """
        Parse FLAC/Vorbis picture block format to extract image data.

        Format: type(4) + mime_len(4) + mime + desc_len(4) + desc +
                width(4) + height(4) + depth(4) + colors(4) + data_len(4) + data

        Args:
            data: Binary picture block data

        Returns:
            Image data bytes or None if parsing fails
        """
        try:
            if len(data) < 32:
                return None

            pos = 0
            # Skip picture type (4 bytes)
            pos += 4

            # Read MIME type length
            if len(data) < pos + 4:
                return None
            mime_len = int.from_bytes(data[pos : pos + 4], "big")
            pos += 4

            # Skip MIME type
            if len(data) < pos + mime_len:
                return None
            pos += mime_len

            # Read description length
            if len(data) < pos + 4:
                return None
            desc_len = int.from_bytes(data[pos : pos + 4], "big")
            pos += 4

            # Skip description
            if len(data) < pos + desc_len:
                return None
            pos += desc_len

            # Skip width, height, depth, colors (16 bytes total)
            pos += 16

            # Read image data length
            if len(data) < pos + 4:
                return None
            data_len = int.from_bytes(data[pos : pos + 4], "big")
            pos += 4

            # Extract image data
            if len(data) < pos + data_len:
                return None
            return data[pos : pos + data_len]

        except Exception as e:
            logger.warning(f"Failed to parse FLAC picture block: {e}")
            return None

    def extract_embedded_image(self, file_path: str) -> Optional[bytes]:
        """
        Extract embedded image/cover art from audio file.

        Args:
            file_path: Path to audio file

        Returns:
            Raw image data as bytes, or None if no image found
        """
        try:
            logger.info(f"Extracting embedded image from: {file_path}")
            audio_file = File(file_path)

            if audio_file is None:
                return None

            image_data = None
            file_extension = os.path.splitext(file_path)[1].lower()
            is_flac = file_extension == ".flac"

            if is_flac:
                # For FLAC files, use the pictures property
                try:
                    if hasattr(audio_file, "pictures") and audio_file.pictures:
                        # Iterate through pictures and find front cover (type == 3)
                        for picture in audio_file.pictures:
                            # Type 3 is Cover (front)
                            if picture.type == 3:
                                if hasattr(picture, "data"):
                                    image_data = picture.data
                                    break
                        # If no front cover found, use first picture
                        if not image_data and len(audio_file.pictures) > 0:
                            first_picture = audio_file.pictures[0]
                            if hasattr(first_picture, "data"):
                                image_data = first_picture.data
                except Exception as e:
                    logger.warning(f"Failed to extract FLAC pictures: {e}")
            else:
                # For non-FLAC files, check binary image fields
                # First, try to find APIC tags (they may have keys like 'APIC:"Album cover"')
                try:
                    if hasattr(audio_file, "keys"):
                        # Search for keys starting with "APIC"
                        for key in audio_file.keys():
                            if key.startswith("APIC"):
                                image_tag = self.safe_get_tag_value(audio_file, key)
                                if image_tag:
                                    try:
                                        # Handle list format
                                        if (
                                            isinstance(image_tag, list)
                                            and len(image_tag) > 0
                                        ):
                                            image_tag = image_tag[0]

                                        # APIC object has a data attribute
                                        if hasattr(image_tag, "data"):
                                            image_data = image_tag.data
                                            break
                                    except Exception as e:
                                        logger.warning(
                                            f"Failed to extract {key} tag: {e}"
                                        )
                                        continue
                except Exception as e:
                    logger.warning(f"Failed to search for APIC tags: {e}")

                # If APIC not found, try other binary image fields
                if not image_data:
                    binary_fields = [
                        "PIC",
                        "covr",
                        "METADATA_BLOCK_PICTURE",
                        "metadata_block_picture",
                        "TRAKTOR4",
                    ]
                    for field in binary_fields:
                        image_tag = self.safe_get_tag_value(audio_file, field)
                        if image_tag:
                            try:
                                # Handle different formats
                                if isinstance(image_tag, list) and len(image_tag) > 0:
                                    image_tag = image_tag[0]

                                # Handle METADATA_BLOCK_PICTURE which is base64-encoded
                                if field in [
                                    "METADATA_BLOCK_PICTURE",
                                    "metadata_block_picture",
                                ]:
                                    if isinstance(image_tag, str):
                                        # Decode base64 string and parse picture block
                                        try:
                                            decoded_data = base64.b64decode(image_tag)
                                            image_data = self._parse_flac_picture_block(
                                                decoded_data
                                            )
                                            if image_data:
                                                break
                                        except Exception as decode_error:
                                            logger.warning(
                                                f"Failed to decode base64 METADATA_BLOCK_PICTURE: {decode_error}"
                                            )
                                            continue
                                    elif isinstance(image_tag, bytes):
                                        # Already decoded, parse as picture block
                                        image_data = self._parse_flac_picture_block(
                                            image_tag
                                        )
                                        if image_data:
                                            break

                                # For MP4/M4A (covr) and other formats, extract from data attribute
                                elif hasattr(image_tag, "data"):
                                    image_data = image_tag.data
                                # Direct bytes
                                elif isinstance(image_tag, bytes):
                                    image_data = image_tag

                                if image_data:
                                    break
                            except Exception as e:
                                logger.warning(f"Failed to extract {field} tag: {e}")
                                continue

            if image_data:
                logger.info("Successfully extracted embedded image from audio file")
                return image_data
            else:
                logger.debug("No embedded image found in audio file")
                return None

        except Exception as e:
            logger.warning(f"Failed to extract embedded image: {e}")
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

            # Initialize audio_file to None in case extraction fails
            audio_file = None

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
                    "description": ["COMM", "DESCRIPTION", "description"],
                    "synopsis": ["COMM", "SYNOPSIS", "synopsis"],
                    "url": ["UFID", "URL", "url"],
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

            # Check if this is a YouTube download and fix artist if needed
            is_youtube_download = False
            if audio_file is not None:
                # Check for YouTube indicators: purl tag or description containing youtube.com
                purl = self.safe_get_tag_value(audio_file, "purl")
                if purl:
                    purl_str = self.safe_string_conversion(purl)
                    if (
                        "youtube.com" in purl_str.lower()
                        or "youtu.be" in purl_str.lower()
                    ):
                        is_youtube_download = True

                # Also check description for YouTube indicators
                if not is_youtube_download:
                    description = self.safe_get_tag_value(audio_file, "description")
                    if description:
                        desc_str = self.safe_string_conversion(description)
                        if (
                            "youtube.com" in desc_str.lower()
                            or "youtu.be" in desc_str.lower()
                        ):
                            is_youtube_download = True

            # Fallback: check file path for YouTube indicators if metadata check didn't find it
            if not is_youtube_download:
                file_path_lower = file_path.lower()
                if "youtube" in file_path_lower:
                    is_youtube_download = True

            # If it's a YouTube download and title contains "Artist - Title" pattern,
            # extract artist from title and use it if it differs from the existing artist
            if is_youtube_download and id3_tags.get("title"):
                title = id3_tags.get("title", "")
                # Try to parse "Artist - Title" pattern from title
                # Common separators: " - ", " – ", " — ", " | "
                separators = [" - ", " – ", " — ", " | ", " ~ ", " : ", " _ ", " . "]
                for sep in separators:
                    if sep in title:
                        parts = title.split(sep, 1)
                        if len(parts) == 2:
                            potential_artist = parts[0].strip()
                            potential_title = parts[1].strip()

                            # Only use this if we have a valid artist and title
                            if potential_artist and potential_title:
                                current_artist = id3_tags.get("artist", "").strip()

                                # If artist from title doesn't match current artist,
                                # prefer the one from title (it's more likely correct)
                                if potential_artist.lower() != current_artist.lower():
                                    logger.info(
                                        f"YouTube download detected: Title contains artist info. "
                                        f"Replacing artist '{current_artist}' with '{potential_artist}' from title"
                                    )
                                    id3_tags["artist"] = (
                                        potential_artist.lower().strip()
                                    )
                                    id3_tags["title"] = potential_title.lower().strip()
                                    id3_tags["youtube_artist_corrected"] = True
                                break

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
