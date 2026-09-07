"""
Simple audio loading service for efficient audio file handling.

This service provides audio loading functionality with support for various formats
and efficient sample loading for analysis.
"""

import gc
from typing import Tuple

import numpy as np
import soundfile as sf
from loguru import logger
from pydub import AudioSegment

from src.utils.performance_optimizer import monitor_performance


class SimpleAudioLoader:
    """
    Simple audio loading service that provides efficient audio file loading
    and format conversion capabilities.
    """

    def __init__(self):
        """Initialize the audio loader service."""
        logger.debug("SimpleAudioLoader initialized")

    def convert_m4a_to_wav(self, file_path: str) -> str:
        """
        Convert an M4A file to a WAV file.

        Args:
            file_path: Path to M4A file

        Returns:
            Path to converted WAV file
        """
        try:
            logger.debug(f"Converting M4A to WAV: {file_path}")

            m4a_file = file_path  # I have downloaded sample audio from this link https://getsamplefiles.com/sample-audio-files/m4a
            wav_filename = file_path.replace(".m4a", ".wav")

            sound = AudioSegment.from_file(m4a_file, format="m4a")
            sound.export(wav_filename, format="wav")
            logger.debug(f"Converted M4A to WAV: {wav_filename}")

            return wav_filename
        except Exception as e:
            logger.error(f"Failed to convert M4A to WAV: {e}")
            raise

    @monitor_performance("simple_audio_sample_loading")
    def load_audio_sample(
        self,
        file_path: str,
        sample_duration: float = None,
        skip_intro: float = 0.0,
    ) -> Tuple[np.ndarray, int]:
        """
        Load only a sample of the audio file for efficient analysis.

        Args:
            file_path: Path to audio file
            sample_duration: Duration of sample to load in seconds (default: 60s)

        Returns:
            Tuple of (audio_data, sample_rate)
        """
        try:
            logger.debug(
                f"Loading audio sample ({sample_duration}s from {skip_intro}s): {file_path}"
            )

            # Get file info first to determine total duration
            info = sf.info(file_path)
            total_duration = info.duration
            sr = info.samplerate
            # Calculate skip samples
            skip_intro_samples = int(skip_intro * sr)

            # Apply intro/outro skipping
            start_sample = skip_intro_samples
            # Calculate sample length if sample_duration is provided
            if sample_duration:
                sample_samples = int(sample_duration * sr)
            else:
                sample_samples = int(total_duration * sr)

            # Load sample from the beginning
            y, sr = sf.read(
                file_path, start=start_sample, stop=start_sample + sample_samples
            )  # Convert to mono if stereo

            if y.ndim > 1:
                y = np.mean(y, axis=1)
            # Normalize peak loudness of the extracted sample for fair comparisons
            max_val = np.abs(y).max()
            if max_val > 0:
                y = y / max_val  # Peak normalize to [-1, 1]
            del max_val  # Explicitly release
            actual_duration = len(y) / sr

            logger.debug(
                f"Audio sample processed: {len(y)} samples, {sr} Hz, {actual_duration:.2f}s"
            )

            return y, sr
        except Exception as e:
            logger.error(f"Failed to load audio sample: {e}")
            # Clean up on error
            if "y" in locals():
                del y
            gc.collect()
            raise
