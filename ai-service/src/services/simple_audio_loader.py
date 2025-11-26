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

    @monitor_performance("smart_audio_sample_loading")
    def smart_audio_sample_loading(
        self,
        file_path: str,
        sample_duration: float = None,
        skip_intro: float = 0.0,
    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray, int, dict, dict, dict]:
        """
        Intelligently load the best parts of an audio file for analysis.

        This method analyzes the audio file to find three optimal segments:
        - Harmonic: strongest harmonic/tonal content (for key, chords, melody)
        - Percussive: strongest percussive/rhythmic content (for rhythm analysis)
        - BPM: most suitable for BPM detection (regular beat, good energy)

        Args:
            file_path: Path to audio file
            sample_duration: Duration of each sample to load in seconds (default: 60s)
            skip_intro: Seconds to skip at the beginning
            skip_outro: Seconds to skip at the end

        Returns:
            Tuple of (harmonic_audio, percussive_audio, bpm_audio, sample_rate,
                     harmonic_metadata, percussive_metadata, bpm_metadata)
            where metadata dicts contain 'start_time', 'duration', and 'score'
        """
        try:
            logger.info(
                f"Smart loading audio samples ({sample_duration}s): {file_path}"
            )

            # Get file info first to determine total duration
            info = sf.info(file_path)
            total_duration = info.duration
            sr = info.samplerate

            # Apply intro/outro skipping
            available_duration = total_duration - skip_intro

            # If requested sample is longer than available, just load what we have
            if sample_duration is None or sample_duration >= available_duration:
                logger.info(
                    "Sample duration >= available duration, loading entire available section"
                )
                y, sr = self.load_audio_sample(file_path, sample_duration, skip_intro)
                metadata = {
                    "start_time": skip_intro,
                    "duration": len(y) / sr,
                    "score": 1.0,
                }
                # Return same sample for harmonic, percussive, and BPM
                return (
                    y.copy(),
                    y.copy(),
                    y,
                    sr,
                    metadata,
                    metadata.copy(),
                    metadata.copy(),
                )

            # Define analysis parameters
            # Analyze 10 segments distributed across the entire song at 10% intervals
            num_analysis_segments = 10
            analysis_window = sample_duration  # Analyze 10s chunks (or sample_duration if smaller)  # Analyze 10s chunks (or sample_duration if smaller)

            start_sample = int(skip_intro * sr)
            window_samples = int(analysis_window * sr)

            # Track best segments for each type
            best_harmonic_score = -1
            best_harmonic_start_time = 0.0
            best_percussive_score = -1
            best_percussive_start_time = 0.0
            best_bpm_score = -1
            best_bpm_start_time = 0.0

            logger.info(
                f"Analyzing {num_analysis_segments} segments of {analysis_window}s "
                f"distributed across {available_duration:.2f}s"
            )

            # Analyze segments at 0%, 10%, 20%, ..., 90% of the song
            for i in range(num_analysis_segments):
                # Calculate position as percentage of available duration
                position_pct = (
                    i / (num_analysis_segments - 1)
                    if num_analysis_segments > 1
                    else 0.0
                )
                segment_start_time = position_pct * available_duration + skip_intro

                # Calculate sample position
                segment_start_sample = int(segment_start_time * sr)

                # Ensure we don't go beyond the available duration
                max_start_sample = int(available_duration * sr)
                print(segment_start_sample, window_samples, max_start_sample)
                if segment_start_sample + window_samples > max_start_sample:
                    continue
                # Load segment
                segment, _ = sf.read(
                    file_path,
                    start=segment_start_sample,
                    stop=segment_start_sample + window_samples,
                )

                # Convert to mono if stereo
                if segment.ndim > 1:
                    segment = np.mean(segment, axis=1)

                # Calculate harmonic score (spectral features)
                harmonic_score = self._calculate_harmonic_score(segment, sr)

                # Calculate percussive score (onset/transient features)
                percussive_score = self._calculate_percussive_score(segment, sr)

                # Calculate BPM score (beat regularity and strength)
                bpm_score = self._calculate_bpm_score(segment, sr)

                # Track best harmonic segment
                if harmonic_score > best_harmonic_score:
                    best_harmonic_score = harmonic_score
                    best_harmonic_start_time = round(segment_start_time)

                # Track best percussive segment
                if percussive_score > best_percussive_score:
                    best_percussive_score = percussive_score
                    best_percussive_start_time = round(segment_start_time)

                # Track best BPM segment
                if bpm_score > best_bpm_score:
                    best_bpm_score = bpm_score
                    best_bpm_start_time = round(segment_start_time)

                del segment

            logger.info(
                f"Analyzed {num_analysis_segments} segments\n"
                f"  Best harmonic: score={best_harmonic_score:.4f} at {best_harmonic_start_time:.2f}s\n"
                f"  Best percussive: score={best_percussive_score:.4f} at {best_percussive_start_time:.2f}s\n"
                f"  Best BPM: score={best_bpm_score:.4f} at {best_bpm_start_time:.2f}s"
            )

            # Load the best harmonic segment
            harmonic_start_sample = int(best_harmonic_start_time * sr)
            sample_samples = int(sample_duration * sr)

            # Ensure we don't go beyond the file
            max_end_sample = int(total_duration * sr)
            if best_harmonic_start_time + sample_duration > max_end_sample:
                harmonic_start_sample = max(
                    harmonic_start_sample, max_end_sample - sample_samples
                )

            y_harmonic, _ = sf.read(
                file_path,
                start=harmonic_start_sample,
                stop=harmonic_start_sample + sample_samples,
            )

            # Convert to mono if stereo
            if y_harmonic.ndim > 1:
                y_harmonic = np.mean(y_harmonic, axis=1)

            # Normalize peak loudness
            max_val = np.abs(y_harmonic).max()
            if max_val > 0:
                y_harmonic = y_harmonic / max_val

            # Load the best percussive segment
            percussive_start_sample = int(best_percussive_start_time * sr)
            if percussive_start_sample + sample_samples > max_end_sample:
                percussive_start_sample = max(
                    start_sample, max_end_sample - sample_samples
                )

            y_percussive, _ = sf.read(
                file_path,
                start=percussive_start_sample,
                stop=percussive_start_sample + sample_samples,
            )

            # Convert to mono if stereo
            if y_percussive.ndim > 1:
                y_percussive = np.mean(y_percussive, axis=1)

            # Normalize peak loudness
            max_val = np.abs(y_percussive).max()
            if max_val > 0:
                y_percussive = y_percussive / max_val

            # Load the best BPM segment
            bpm_start_sample = int(best_bpm_start_time * sr)
            if bpm_start_sample + sample_samples > max_end_sample:
                bpm_start_sample = max(start_sample, max_end_sample - sample_samples)

            y_bpm, _ = sf.read(
                file_path,
                start=bpm_start_sample,
                stop=bpm_start_sample + sample_samples,
            )

            # Convert to mono if stereo
            if y_bpm.ndim > 1:
                y_bpm = np.mean(y_bpm, axis=1)

            # Normalize peak loudness
            max_val = np.abs(y_bpm).max()
            if max_val > 0:
                y_bpm = y_bpm / max_val

            # Cleanup
            del max_val
            gc.collect()

            # Prepare metadata
            harmonic_metadata = {
                "start_time": best_harmonic_start_time,
                "duration": len(y_harmonic) / sr,
                "score": best_harmonic_score,
            }

            percussive_metadata = {
                "start_time": best_percussive_start_time,
                "duration": len(y_percussive) / sr,
                "score": best_percussive_score,
            }

            bpm_metadata = {
                "start_time": best_bpm_start_time,
                "duration": len(y_bpm) / sr,
                "score": best_bpm_score,
            }

            logger.info(
                f"Smart samples extracted:\n"
                f"  Harmonic: {harmonic_metadata['start_time']:.2f}s-"
                f"{harmonic_metadata['start_time'] + harmonic_metadata['duration']:.2f}s\n"
                f"  Percussive: {percussive_metadata['start_time']:.2f}s-"
                f"{percussive_metadata['start_time'] + percussive_metadata['duration']:.2f}s\n"
                f"  BPM: {bpm_metadata['start_time']:.2f}s-"
                f"{bpm_metadata['start_time'] + bpm_metadata['duration']:.2f}s"
            )

            return (
                y_harmonic,
                y_percussive,
                y_bpm,
                sr,
                harmonic_metadata,
                percussive_metadata,
                bpm_metadata,
            )

        except Exception as e:
            logger.error(f"Failed to load smart audio samples: {e}")
            local = locals()
            # Clean up on error
            if "y_harmonic" in local:
                del local["y_harmonic"]
            if "y_percussive" in local:
                del local["y_percussive"]
            if "y_bpm" in local:
                del local["y_bpm"]
            if "segment" in locals():
                del local["segment"]
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
