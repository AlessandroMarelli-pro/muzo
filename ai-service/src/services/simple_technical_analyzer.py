"""
Simple technical audio analyzer for extracting audio technical information.

This service provides technical audio analysis including sample rate, duration,
bitrate, channels, and format detection.
"""

from typing import Any, Dict

import numpy as np
import soundfile as sf
from loguru import logger

from src.utils.performance_optimizer import monitor_performance


class SimpleTechnicalAnalyzer:
    """
    Simple technical audio analyzer that provides audio technical information
    extraction capabilities.
    """

    def __init__(self):
        """Initialize the technical analyzer service."""
        logger.info("SimpleTechnicalAnalyzer initialized")

    @monitor_performance("simple_audio_technical")
    def extract_audio_technical(self, file_path: str) -> Dict[str, Any]:
        """
        Extract basic technical audio information from full file.

        Args:
            file_path: Path to audio file

        Returns:
            Dictionary containing technical audio information
        """
        try:
            logger.info("Extracting audio technical information")

            # Try to use mutagen for more accurate bitrate extraction
            try:
                from mutagen import File

                audio_file = File(file_path)

                if audio_file is not None and hasattr(audio_file, "info"):
                    info = audio_file.info
                    duration = info.length
                    sr = info.sample_rate
                    channels = info.channels
                    bitrate = getattr(info, "bitrate", None)

                    # Get subtype/format info from soundfile for additional details
                    sf_info = sf.info(file_path)
                    subtype = sf_info.subtype
                    try:
                        bit_depth = int(subtype.split("_")[1])
                    except (IndexError, ValueError):
                        bit_depth = 16  # Default fallback

                    logger.info(f"Using mutagen for technical info extraction")

                else:
                    raise ImportError("Mutagen file info not available")

            except (ImportError, AttributeError, Exception) as e:
                logger.info(f"Mutagen not available or failed, using soundfile: {e}")

                # Fallback to soundfile
                info = sf.info(file_path)
                duration = info.duration
                sr = info.samplerate
                channels = info.channels
                subtype = info.subtype
                try:
                    bit_depth = int(subtype.split("_")[1])
                except (IndexError, ValueError):
                    bit_depth = 16  # Default fallback
                bitrate = None

                logger.info(f"Using soundfile for technical info extraction")

            # Basic format detection from sample rate
            if sr == 44100:
                format_name = "cd quality"
            elif sr == 48000:
                format_name = "professional"
            elif sr >= 96000:
                format_name = "high resolution"
            else:
                format_name = "standard"

            # Use actual bitrate if available, otherwise estimate
            if bitrate:
                final_bitrate = bitrate
            else:
                # Estimate bitrate (rough calculation)
                final_bitrate = int(sr * bit_depth * channels)

            technical_info = {
                "audio_technical": {
                    "sample_rate": sr,
                    "duration_seconds": round(duration, 2),
                    "format": format_name,
                    "bitrate": final_bitrate,
                    "channels": channels,
                    "samples": int(duration * sr),
                    "bit_depth": bit_depth,
                    "subtype": subtype,
                }
            }

            logger.info(
                f"Audio technical info: {duration:.2f}s, {sr} Hz, {channels} channels, {final_bitrate} bps"
            )
            return technical_info

        except Exception as e:
            logger.error(f"Failed to extract audio technical info: {e}")
            raise
