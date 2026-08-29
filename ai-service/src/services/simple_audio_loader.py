"""
Simple audio loading service for efficient audio file handling.

This service provides audio loading functionality with support for various formats
and efficient sample loading for analysis.
"""

import gc
import os
from typing import Tuple

import audioflux as af
import numpy as np
import soundfile as sf
from audioflux.type import NoveltyType, SpectralDataType, SpectralFilterBankScaleType
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
        logger.info("SimpleAudioLoader initialized")

    def convert_m4a_to_wav(self, file_path: str) -> str:
        """
        Convert an M4A file to a WAV file.

        Args:
            file_path: Path to M4A file

        Returns:
            Path to converted WAV file
        """
        try:
            logger.info(f"Converting M4A to WAV: {file_path}")

            m4a_file = file_path  # I have downloaded sample audio from this link https://getsamplefiles.com/sample-audio-files/m4a
            wav_filename = file_path.replace(".m4a", ".wav")

            sound = AudioSegment.from_file(m4a_file, format="m4a")
            sound.export(wav_filename, format="wav")
            logger.info(f"Converted M4A to WAV: {wav_filename}")

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
            logger.info(
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

            logger.info(
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

    def _calculate_harmonic_score(self, segment: np.ndarray, sr: int) -> float:
        """
        Calculate a score representing harmonic/tonal content in an audio segment.

        Args:
            segment: Audio segment
            sr: Sample rate

        Returns:
            Harmonic score (0-1)
        """
        try:
            # Use spectral features to identify harmonic content
            # Higher spectral centroid and spectral contrast indicate harmonic content

            # Calculate STFT
            fft_length = 2048
            hop_length = 512

            bft_obj = af.BFT(
                num=fft_length,  # Match number of bins (84 for OCTAVE default)
                samplate=sr,
                radix2_exp=12,
                slide_length=1024,
                data_type=SpectralDataType.MAG,
                scale_type=SpectralFilterBankScaleType.LINEAR,
            )
            spec_arr = bft_obj.bft(segment)
            spec_arr = np.abs(spec_arr)
            spectral_obj = af.Spectral(
                num=bft_obj.num, fre_band_arr=bft_obj.get_fre_band_arr()
            )
            n_time = spec_arr.shape[
                -1
            ]  # Or use bft_obj.cal_time_length(audio_arr.shape[-1])
            spectral_obj.set_time_length(n_time)

            # Spectral Centroid: center of mass of spectrum (higher for harmonic content)
            spectral_centroid = spectral_obj.centroid(spec_arr)
            centroid_score = np.mean(spectral_centroid) / (sr / 2)  # Normalize to 0-1

            # Spectral Flatness: how noise-like vs tonal the signal is (lower = more tonal)
            spectral_flatness = spectral_obj.flatness(spec_arr)
            tonality_score = 1.0 - np.mean(
                spectral_flatness
            )  # Invert: high tonality = low flatness

            # Combine scores
            harmonic_score = centroid_score * 0.4 + tonality_score * 0.6

            # Clip to valid range
            harmonic_score = np.clip(harmonic_score, 0.0, 1.0)

            del spectral_obj, spec_arr, bft_obj

            return float(harmonic_score)

        except Exception as e:
            logger.warning(f"Error calculating harmonic score: {e}")
            return 0.5  # Return neutral score on error

    def _calculate_percussive_score(self, segment: np.ndarray, sr: int) -> float:
        """
        Calculate a score representing percussive/rhythmic content in an audio segment.

        Args:
            segment: Audio segment
            sr: Sample rate

        Returns:
            Percussive score (0-1)
        """
        try:
            bft_obj = af.BFT(
                num=128,
                samplate=sr,
                radix2_exp=12,
                slide_length=2048,
                scale_type=SpectralFilterBankScaleType.MEL,
                data_type=SpectralDataType.POWER,
            )
            spec_arr = bft_obj.bft(segment)
            spec_dB_arr = af.utils.power_to_db(np.abs(spec_arr))
            n_fre, n_time = spec_dB_arr.shape
            onset_obj = af.Onset(
                time_length=n_time,
                fre_length=n_fre,
                slide_length=bft_obj.slide_length,
                samplate=bft_obj.samplate,
                novelty_type=NoveltyType.FLUX,
            )
            params = af.NoveltyParam(1, 2, 0, 1, 0, 0, 0, 1)
            point_arr, onset_env, time_arr, value_arr = onset_obj.onset(
                spec_dB_arr, novelty_param=params
            )
            # Calculate onset density and strength
            onset_threshold = np.mean(onset_env) + 0.5 * np.std(onset_env)
            num_onsets = np.sum(onset_env > onset_threshold)
            onset_density = num_onsets / (len(segment) / sr)  # Onsets per second

            # Normalize: typical percussive music has 2-8 onsets per second
            density_score = np.clip(onset_density / 8.0, 0.0, 1.0)

            # Onset strength
            strength_score = np.clip(np.mean(onset_env) * 2, 0.0, 1.0)

            # Combine scores
            percussive_score = density_score * 0.5 + strength_score * 0.5

            del onset_obj, onset_env

            return float(percussive_score)

        except Exception as e:
            logger.warning(f"Error calculating percussive score: {e}")
            return 0.5  # Return neutral score on error

    def _calculate_bpm_score(self, segment: np.ndarray, sr: int) -> float:
        """
        Calculate a score representing suitability for BPM detection.

        Good BPM segments have:
        - Strong, regular beat (consistent onset intervals)
        - Good energy (not intro/outro/breakdown)
        - Clear rhythmic pulse
        - Multiple beats present

        Args:
            segment: Audio segment
            sr: Sample rate

        Returns:
            BPM suitability score (0-1)
        """
        try:
            bft_obj = af.BFT(
                num=128,
                samplate=sr,
                radix2_exp=12,
                slide_length=2048,
                scale_type=SpectralFilterBankScaleType.MEL,
                data_type=SpectralDataType.POWER,
            )
            spec_arr = bft_obj.bft(segment)
            spec_dB_arr = af.utils.power_to_db(np.abs(spec_arr))
            n_fre, n_time = spec_dB_arr.shape
            onset_obj = af.Onset(
                time_length=n_time,
                fre_length=n_fre,
                slide_length=bft_obj.slide_length,
                samplate=bft_obj.samplate,
                novelty_type=NoveltyType.FLUX,
            )
            params = af.NoveltyParam(1, 2, 0, 1, 0, 0, 0, 1)
            point_arr, onset_env, time_arr, value_arr = onset_obj.onset(
                spec_dB_arr, novelty_param=params
            )

            # 1. Onset regularity (low coefficient of variation = regular beat)
            onset_threshold = np.mean(onset_env) + 0.5 * np.std(onset_env)
            onset_peaks = np.where(onset_env > onset_threshold)[0]

            if len(onset_peaks) < 4:
                return 0.0  # Not enough beats

            # Calculate inter-onset intervals
            intervals = np.diff(onset_peaks)
            if len(intervals) < 3:
                return 0.0

            # Regularity: low CV = consistent beat
            mean_interval = np.mean(intervals)
            if mean_interval > 0:
                cv = np.std(intervals) / mean_interval
                # Invert: we want LOW CV to give HIGH score
                regularity_score = np.clip(1.0 - cv, 0.0, 1.0)
            else:
                regularity_score = 0.0

            # 2. Onset strength (clear, strong beats)
            strength_score = np.clip(np.mean(onset_env) * 2, 0.0, 1.0)

            # 3. Energy level (avoid quiet intros/outros)
            rms = np.sqrt(np.mean(segment**2))
            energy_score = np.clip(rms * 10, 0.0, 1.0)  # Normalize RMS

            # 4. Onset density (enough beats, but not too many)
            onset_density = len(onset_peaks) / (len(segment) / sr)
            # Ideal: 2-4 beats per second (120-240 BPM range)
            if onset_density < 1.5:
                density_score = onset_density / 1.5  # Too sparse
            elif onset_density > 5.0:
                density_score = 1.0 - (onset_density - 5.0) / 5.0  # Too dense
            else:
                density_score = 1.0  # Perfect range
            density_score = np.clip(density_score, 0.0, 1.0)

            # Combine all factors
            # Regularity is most important for BPM detection
            bpm_score = (
                0.50 * regularity_score  # Most important: consistent beat
                + 0.25 * strength_score  # Clear onsets
                + 0.15 * energy_score  # Good energy
                + 0.10 * density_score  # Reasonable beat density
            )

            del onset_obj, onset_env, bft_obj

            return float(bpm_score)

        except Exception as e:
            logger.warning(f"Error calculating BPM score: {e}")
            return 0.5  # Return neutral score on error
