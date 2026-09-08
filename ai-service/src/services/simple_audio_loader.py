"""
Simple audio loading service for efficient audio file handling.

This service provides audio loading functionality with support for various formats
and efficient sample loading for analysis.
"""

import gc
import os
import shutil
import subprocess
from typing import Optional, Tuple

import numpy as np
import soundfile as sf
from loguru import logger
from pydub import AudioSegment

from src.utils.performance_optimizer import monitor_performance

# Decode backend for load_audio_sample().
#   "ffmpeg" (default) -- pipe raw f32le out of the `ffmpeg` binary. ~2-2.3x
#                         faster on the full-track opus/m4a decode the analysis
#                         pipeline does per file (measured: ~3.5-5s -> ~1.5-2s on
#                         400-560s opus tracks; this is the single biggest
#                         per-track stage). ffmpeg's opus decoder rounds ~1e-2
#                         differently from libsndfile's on the raw waveform, but
#                         validated on 10 tracks: zero discrete-label flips
#                         (key/genre/styles/instruments/mood), tempo/valence/
#                         arousal Δ=0, embedding cosine-sim = 1.000000000 -- the
#                         models' patch-pooling absorbs it entirely.
#   "soundfile"        -- libsndfile via the `soundfile` package. The previous
#                         default; escape hatch via AUDIO_DECODER=soundfile.
# Falls back to soundfile automatically if the ffmpeg binary is missing or the
# subprocess fails.
_DECODER = os.getenv("AUDIO_DECODER", "ffmpeg").strip().lower()
_FFMPEG = shutil.which("ffmpeg")


class SimpleAudioLoader:
    """
    Simple audio loading service that provides efficient audio file loading
    and format conversion capabilities.
    """

    def __init__(self):
        """Initialize the audio loader service."""
        logger.debug(f"SimpleAudioLoader initialized (decoder={_DECODER})")

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

    @staticmethod
    def _decode_ffmpeg(
        file_path: str, sr: int, start_sample: int, sample_samples: Optional[int]
    ) -> np.ndarray:
        """
        Decode `file_path` to a float32 mono numpy array at its native `sr` via
        the ffmpeg binary. Returns stereo-then-averaged mono, matching the
        soundfile path's `np.mean(stereo, axis=1)`.

        - For .opus we force `-c:a libopus` (the decoder libsndfile uses too):
          raw waveform then matches soundfile to ~1e-4, vs ~7e-3 from ffmpeg's
          built-in opus decoder. The hint MUST NOT be passed for non-opus inputs
          -- on a WAV it makes ffmpeg emit nothing ("Error parsing Opus packet
          header"). m4a never reaches here (pre-converted to WAV upstream); the
          only inputs are .opus, the post-m4a .wav, and occasionally flac/wav.
        - `-ss` is placed AFTER `-i` so the seek is sample-accurate (decode-then-
          discard). `-ss` before `-i` seeks at the container/page level and lands
          a few ms off (measured Δ~0.3 on the raw window) -- not worth it here,
          the intro skip is only 30s.
        - `-ac 2` + a numpy mean here (not ffmpeg's `-ac 1`) so the downmix is
          bit-identical to the soundfile path rather than ffmpeg's pan-law.
        """
        cmd = [_FFMPEG, "-v", "error", "-nostdin"]
        if file_path.lower().endswith(".opus"):
            cmd += ["-c:a", "libopus"]
        cmd += ["-i", file_path]
        if start_sample > 0:
            cmd += ["-ss", f"{start_sample / sr:.6f}"]
        if sample_samples is not None:
            cmd += ["-t", f"{sample_samples / sr:.6f}"]
        cmd += ["-f", "f32le", "-ac", "2", "-ar", str(sr), "-"]

        proc = subprocess.run(cmd, capture_output=True, check=True)
        raw = np.frombuffer(proc.stdout, dtype=np.float32)
        if raw.size < 2:
            # ffmpeg exited 0 but produced nothing (e.g. a bad -c:a hint) --
            # treat as failure so the caller falls back to soundfile.
            raise RuntimeError("ffmpeg produced no audio")
        # stereo interleaved -> (n, 2); tolerate an odd trailing sample
        if raw.size % 2:
            raw = raw[:-1]
        return raw.reshape(-1, 2).mean(axis=1)

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

            y = None
            if _DECODER == "ffmpeg" and _FFMPEG:
                try:
                    y = self._decode_ffmpeg(
                        file_path,
                        sr,
                        start_sample,
                        None if not sample_duration else sample_samples,
                    )
                except Exception as e:
                    logger.warning(
                        f"ffmpeg decode failed ({e}); falling back to soundfile"
                    )
                    y = None

            if y is None:
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
