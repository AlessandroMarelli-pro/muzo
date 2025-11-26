import audioflux as af
import numpy as np
from audioflux.type import NoveltyType, SpectralDataType, SpectralFilterBankScaleType
from loguru import logger

# Compatibility shim for madmom
try:
    # Restore deprecated numpy aliases for madmom compatibility
    if not hasattr(np, "float"):
        np.float = float
    if not hasattr(np, "int"):
        np.int = int
    if not hasattr(np, "complex"):
        np.complex = complex
except Exception:
    pass

from src.utils.performance_optimizer import monitor_performance


class SharedFeatures:
    features: dict = None
    mel_spectrum_arr: np.ndarray = None
    mel_spectrum_obj: af.BFT = None
    onset_env_arr: np.ndarray = None
    onset_env_obj: af.Onset = None

    def __init__(self):
        self.features = {}

    def _set_default_features(self):
        # Return empty features with proper structure

        default_spectral_values = {
            "mean": 0.0,
            "std": 0.0,
            "median": 0.0,
            "min": 0.0,
            "max": 0.0,
            "p25": 0.0,
            "p75": 0.0,
        }

        default_aggregate_values = {
            "mean": 0.0,
            "std": 0.0,
            "median": 0.0,
            "max": 0.0,
            "min": 0.0,
            "p25": 0.0,
            "p75": 0.0,
        }

        default_chroma_values = {
            "mean": [0.0] * 12,
            "std": [0.0] * 12,
            "max": [0.0] * 12,
            "overall_mean": 0.0,
            "overall_std": 0.0,
            "dominant_pitch": 0,
        }

        default_tonnetz_values = {
            "mean": [0.0] * 6,
            "std": [0.0] * 6,
            "max": [0.0] * 6,
            "overall_mean": 0.0,
            "overall_std": 0.0,
        }

        default_mfcc_values = [0.0] * 13

        self.features = {
            "spectral_centroids": default_spectral_values,
            "spectral_rolloffs": default_spectral_values,
            "spectral_bandwidths": default_spectral_values,
            "spectral_spreads": default_spectral_values,
            "spectral_flatnesses": default_spectral_values,
            "zero_crossing_rate": default_aggregate_values,
            "rms": default_aggregate_values,
            "chroma": default_chroma_values,
            "tonnetz": default_tonnetz_values,
            "mfcc_mean": default_mfcc_values,
            "energy_by_band": [0.0, 0.0, 0.0],
        }

    @monitor_performance("_set_mel_spectrum")
    def _set_mel_spectrum(self, y: np.ndarray, sr: int) -> np.ndarray:
        """
        Get power spectrum of audio data.
        """
        bft_obj = af.BFT(
            num=128,
            samplate=sr,
            radix2_exp=12,
            slide_length=2048,
            scale_type=SpectralFilterBankScaleType.MEL,
            data_type=SpectralDataType.POWER,
        )
        spec_arr = bft_obj.bft(y)
        spec_dB_arr = af.utils.power_to_db(np.abs(spec_arr))
        self.mel_spectrum_arr = spec_dB_arr
        self.mel_spectrum_obj = bft_obj

    def _get_mel_spectrum(self) -> tuple[np.ndarray, af.BFT]:
        """
        Get power spectrum of audio data.
        """
        return self.mel_spectrum_arr, self.mel_spectrum_obj

    @monitor_performance("_set_onset_env")
    def _set_onset_env(
        self,
    ) -> np.ndarray:
        """
        Get onset envelope of audio data.
        """
        spec_dB_arr, bft_obj = self._get_mel_spectrum()
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
        self.onset_env_arr = onset_env
        self.onset_env_obj = onset_obj

    def _get_onset_env(self) -> tuple[np.ndarray, af.Onset]:
        """
        Get onset envelope of audio data.
        """
        return self.onset_env_arr, self.onset_env_obj

    @monitor_performance("_get_syncopation")
    def _get_syncopation(self, tempo: float, sr: int, beat_strength: float) -> float:
        """
        Measures true syncopation by analyzing onset placement relative to the beat grid.

        Syncopation occurs when strong accents fall on weak beats or off-beats,
        creating rhythmic tension against the main pulse.

        Args:
            tempo: Tempo in BPM
            sr: Sample rate
            beat_strength: Beat strength (0-1)

        Returns:
            Syncopation score (0-1):
            - 0.0-0.3: Mostly on-beat, minimal syncopation
            - 0.3-0.6: Moderate syncopation
            - 0.6-1.0: Highly syncopated
        """
        if round(beat_strength, 1) < 0.2:
            return 0.0

        if tempo < 40 or tempo > 240:
            # Tempo out of reasonable range
            return 0.0

        if "syncopation" in self.features:
            return self.features["syncopation"]

        onset_env, onset_obj = self._get_onset_env()

        # Find onset peaks with their strengths
        threshold = np.mean(onset_env) + 0.5 * np.std(onset_env)
        onset_indices = np.where(onset_env > threshold)[0]
        onset_strengths = onset_env[onset_indices]

        if len(onset_indices) < 4:
            return 0.0

        # Convert onset indices to time in seconds
        # Onset envelope has a specific time resolution based on BFT parameters
        mel_spec_arr, mel_spec_obj = self._get_mel_spectrum()
        hop_length = mel_spec_obj.slide_length
        onset_times = onset_indices * (hop_length / sr)

        # Calculate beat period in seconds
        beat_period = 60.0 / tempo

        # Define beat grid positions (quantize to 16th notes for precision)
        # On-beats: 1, 2, 3, 4 (quarter notes)
        # Off-beats: 8th notes, 16th notes
        subdivision = 16  # Use 16th notes for precision

        # For each onset, find its position relative to the nearest beat
        off_beat_strength_total = 0.0
        on_beat_strength_total = 0.0

        for onset_time, onset_strength in zip(onset_times, onset_strengths):
            # Find position within the current beat
            beat_position = (onset_time % beat_period) / beat_period

            # Quantize to subdivision (16th notes)
            quantized_position = round(beat_position * subdivision) / subdivision

            # Determine if this is on a strong beat position
            # Strong positions: 0 (downbeat), 0.25, 0.5, 0.75 (quarter notes)
            # Weak positions: 0.125, 0.375, 0.625, 0.875 (8th note off-beats)
            # Very weak: other 16th positions

            # Calculate distance to nearest strong beat (quarter note)
            distances_to_strong_beats = [
                abs(quantized_position - 0.0),
                abs(quantized_position - 0.25),
                abs(quantized_position - 0.5),
                abs(quantized_position - 0.75),
            ]
            min_distance = min(distances_to_strong_beats)

            # Tolerance for "on-beat" (within 1/16th note of a quarter note)
            on_beat_tolerance = 1.0 / subdivision

            if min_distance <= on_beat_tolerance:
                # This onset is on a strong beat
                on_beat_strength_total += onset_strength
            else:
                # This onset is off-beat (syncopated)
                off_beat_strength_total += onset_strength

        # Calculate syncopation as ratio of off-beat to total strength
        total_strength = on_beat_strength_total + off_beat_strength_total

        if total_strength > 0:
            syncopation = off_beat_strength_total / total_strength
        else:
            syncopation = 0.0

        # Clip to valid range
        syncopation = float(np.clip(syncopation, 0.0, 1.0))
        self.features["syncopation"] = syncopation

        return syncopation

    @monitor_performance("_get_energy_factor")
    def _get_energy_factor(
        self,
    ) -> float:
        """
        Calculate energy factor based on spectral centroid.
        """
        # Calculate energy from magnitude spectrum
        rms = self.features["rms"]
        mean_energy = rms["mean"]

        # Convert to dB scale
        energy_db = 20 * np.log10(mean_energy + 1e-10)

        # Normalize (typical range -60 to -5 dB)
        min_db = -60
        max_db = -5

        energy_factor = (energy_db - min_db) / (max_db - min_db)

        return float(np.clip(energy_factor, 0.0, 1.0))

    def _get_weighted_mean(self, values: list, spec_arr) -> float:
        """
        Get weighted mean of a list of values.
        """

        energy_per_frame = np.mean(spec_arr, axis=0)

        # Match lengths
        min_length = min(len(values), len(energy_per_frame))
        values = values[:min_length]
        energy_per_frame = energy_per_frame[:min_length]

        # Weighted mean
        weights = energy_per_frame / (np.sum(energy_per_frame) + 1e-10)
        weighted_centroid = np.sum(values * weights)

        # Use weighted version
        mean_centroid = weighted_centroid

        return float(mean_centroid)

    @monitor_performance("_get_mfcc")
    def _get_mfcc(self, y: np.ndarray, sr: int) -> np.ndarray:
        spec_dB_arr, bft_obj = self._get_mel_spectrum()
        xxcc_obj = af.XXCC(bft_obj.num)
        xxcc_obj.set_time_length(time_length=spec_dB_arr.shape[1])
        mfcc_arr = xxcc_obj.xxcc(spec_dB_arr)[:13]
        mfcc_mean = np.mean(mfcc_arr, axis=1)
        return mfcc_mean.tolist()

    def _aggregate_spectral_features(
        self, spectral_feature: np.ndarray, spec_arr: np.ndarray
    ):
        """
        Convert large array to meaningful statistics.
        This is what you should store in your database.
        """
        return {
            "mean": float(self._get_weighted_mean(spectral_feature, spec_arr)),
            "std": float(np.std(spectral_feature)),
            "median": float(np.median(spectral_feature)),
            "min": float(np.min(spectral_feature)),
            "max": float(np.max(spectral_feature)),
            # Optional: percentiles for distribution shape
            "p25": float(np.percentile(spectral_feature, 25)),
            "p75": float(np.percentile(spectral_feature, 75)),
        }

    def _aggregate(self, zcr: np.ndarray) -> dict:
        """
        Reduce ZCR array to meaningful statistics.
        """
        return {
            "mean": float(np.mean(zcr)),
            "std": float(np.std(zcr)),
            "median": float(np.median(zcr)),
            "max": float(np.max(zcr)),
            "min": float(np.min(zcr)),
            "p25": float(np.percentile(zcr, 25)),
            "p75": float(np.percentile(zcr, 75)),
        }

    def _aggregate_chroma(self, chroma: np.ndarray) -> dict:
        """
        Convert (12, time_frames) to compact statistics.
        """
        return {
            "mean": np.mean(chroma, axis=1).tolist(),
            "std": np.std(chroma, axis=1).tolist(),
            "max": np.max(chroma, axis=1).tolist(),
            "overall_mean": float(np.mean(chroma)),
            "overall_std": float(np.std(chroma)),
            "dominant_pitch": int(np.argmax(np.mean(chroma, axis=1))),
        }

    @monitor_performance("_compute_tonnetz_from_chroma")
    def _compute_tonnetz_from_chroma(self, chroma: np.ndarray) -> np.ndarray:
        """
        Compute tonnetz features from chroma data.

        Args:
            chroma: Chroma feature matrix

        Returns:
            Tonnetz feature matrix
        """
        try:
            if chroma.ndim == 1:
                chroma = chroma.reshape(-1, 1)

            # Ensure chroma has 12 pitch classes
            if chroma.shape[0] != 12:
                logger.warning(f"Expected 12 chroma bins, got {chroma.shape[0]}")
                return {
                    "mean": [0.0] * 6,
                    "std": [0.0] * 6,
                    "overall_mean": 0.0,
                    "overall_std": 0.0,
                }

            # Create tonnetz-like features (6 dimensions representing harmonic relationships)
            tonnetz = np.zeros((6, chroma.shape[1]))
            # Map chroma to tonnetz dimensions (simplified mapping)
            tonnetz[0] = chroma[0] + chroma[7]  # C + G
            tonnetz[1] = chroma[2] + chroma[9]  # D + A
            tonnetz[2] = chroma[4] + chroma[11]  # E + B
            tonnetz[3] = chroma[5] + chroma[0]  # F + C
            tonnetz[4] = chroma[7] + chroma[2]  # G + D
            tonnetz[5] = chroma[9] + chroma[4]  # A + E

            return {
                "mean": tonnetz.mean(axis=1).tolist(),
                "std": tonnetz.std(axis=1).tolist(),
                "max": tonnetz.max(axis=1).tolist(),
                "overall_mean": float(tonnetz.mean()),
                "overall_std": float(tonnetz.std()),
            }

        except Exception as e:
            logger.error(f"Failed to compute tonnetz from chroma: {e}")
            return {
                "mean": [0.0] * 6,
                "std": [0.0] * 6,
                "max": [0.0] * 6,
                "overall_mean": 0.0,
                "overall_std": 0.0,
            }

    def _get_energy_by_band(self, freqs: np.ndarray, spec_arr: np.ndarray) -> list:
        """
        Get energy by frequency bands.
        Args:
            freqs: Frequency array
            spec_arr: Spectrogram array

        Returns:
            List of energy by frequency bands
        """
        # Safety check: Ensure spec_arr and freqs shapes match
        if spec_arr.shape[0] != len(freqs):
            # Fallback: approximate frequency division for OCTAVE scale (84 bins)
            num_bins = spec_arr.shape[0]
            # For OCTAVE scale: approximate low/mid/high by bin ranges
            # Rough approximation: low (bins 0-24), mid (bins 24-54), high (bins 54-84)
            low_freq_indices = np.arange(0, num_bins // 3)
            mid_freq_indices = np.arange(num_bins // 3, 2 * num_bins // 3)
            high_freq_indices = np.arange(2 * num_bins // 3, num_bins)
        else:
            # Define energy bands: low, mid, high based on actual frequencies
            low_freq_indices = np.where(freqs <= 200)[0]
            mid_freq_indices = np.where((freqs > 200) & (freqs <= 2000))[0]
            high_freq_indices = np.where(freqs > 2000)[0]

        energy_bands = []
        if len(low_freq_indices) > 0:
            low_energy = np.mean(spec_arr[low_freq_indices, :])
            energy_bands.append(float(low_energy))
        else:
            energy_bands.append(0.0)
        if len(mid_freq_indices) > 0:
            mid_energy = np.mean(spec_arr[mid_freq_indices, :])
            energy_bands.append(float(mid_energy))
        else:
            energy_bands.append(0.0)
        if len(high_freq_indices) > 0:
            high_energy = np.mean(spec_arr[high_freq_indices, :])
            energy_bands.append(float(high_energy))
        else:
            energy_bands.append(0.0)
        return energy_bands

    @monitor_performance("extract_shared_features")
    def extract_shared_features(
        self,
        y_harmonic: np.ndarray,
        y_percussive: np.ndarray,
        sr: int,
    ) -> dict:
        """
        Extract commonly used audioFlux features from harmonic and percussive samples.

        This method intelligently extracts features from the appropriate audio sample:
        - Harmonic features (chroma, tonnetz) from harmonic sample
        - Percussive features (onset, syncopation, energy) from percussive sample
        - General features (spectral) averaged from both samples

        Args:
            y_harmonic: Harmonic-rich audio sample
            y_percussive: Percussive-rich audio sample
            sr: Sample rate

        Returns:
            Dictionary containing shared features
        """
        try:
            # Set mel spectrum and onset from percussive sample (better for rhythm analysis)
            self._set_mel_spectrum(y_percussive, sr)
            self._set_onset_env()

            # === GENERAL SPECTRAL FEATURES (average from both samples) ===
            logger.debug("Extracting general spectral features from both samples")

            # Process harmonic sample
            bft_obj_h = af.BFT(
                num=2049,
                samplate=sr,
                radix2_exp=12,
                slide_length=1024,
                data_type=SpectralDataType.MAG,
                scale_type=SpectralFilterBankScaleType.LINEAR,
            )
            spec_arr_h = bft_obj_h.bft(y_harmonic)
            spec_arr_h = np.abs(spec_arr_h)
            spectral_obj_h = af.Spectral(
                num=bft_obj_h.num, fre_band_arr=bft_obj_h.get_fre_band_arr()
            )
            spectral_obj_h.set_time_length(spec_arr_h.shape[-1])

            # Process percussive sample
            bft_obj_p = af.BFT(
                num=2049,
                samplate=sr,
                radix2_exp=12,
                slide_length=1024,
                data_type=SpectralDataType.MAG,
                scale_type=SpectralFilterBankScaleType.LINEAR,
            )
            spec_arr_p = bft_obj_p.bft(y_percussive)
            spec_arr_p = np.abs(spec_arr_p)
            spectral_obj_p = af.Spectral(
                num=bft_obj_p.num, fre_band_arr=bft_obj_p.get_fre_band_arr()
            )
            spectral_obj_p.set_time_length(spec_arr_p.shape[-1])

            # Extract spectral features from both and average
            spectral_centroids_h = spectral_obj_h.centroid(spec_arr_h)
            spectral_centroids_p = spectral_obj_p.centroid(spec_arr_p)
            self.features["spectral_centroids"] = self._combine_spectral_features(
                spectral_centroids_h, spec_arr_h, spectral_centroids_p, spec_arr_p
            )

            spectral_rolloffs_h = spectral_obj_h.rolloff(spec_arr_h, threshold=0.85)
            spectral_rolloffs_p = spectral_obj_p.rolloff(spec_arr_p, threshold=0.85)
            self.features["spectral_rolloffs"] = self._combine_spectral_features(
                spectral_rolloffs_h, spec_arr_h, spectral_rolloffs_p, spec_arr_p
            )

            spectral_bandwidths_h = spectral_obj_h.band_width(spec_arr_h)
            spectral_bandwidths_p = spectral_obj_p.band_width(spec_arr_p)
            self.features["spectral_bandwidths"] = self._combine_spectral_features(
                spectral_bandwidths_h, spec_arr_h, spectral_bandwidths_p, spec_arr_p
            )

            spectral_spreads_h = spectral_obj_h.spread(spec_arr_h)
            spectral_spreads_p = spectral_obj_p.spread(spec_arr_p)
            self.features["spectral_spreads"] = self._combine_spectral_features(
                spectral_spreads_h, spec_arr_h, spectral_spreads_p, spec_arr_p
            )

            # Spectral flatness from harmonic sample (more meaningful for tonality)
            spectral_flatnesses = spectral_obj_h.flatness(spec_arr_h)
            self.features["spectral_flatnesses"] = self._aggregate_spectral_features(
                spectral_flatnesses, spec_arr_h
            )

            # MFCC from both samples averaged
            mfcc_mean_h = self._get_mfcc_from_sample(y_harmonic, sr)
            mfcc_mean_p = self._get_mfcc_from_sample(y_percussive, sr)
            self.features["mfcc_mean"] = [
                (h + p) / 2 for h, p in zip(mfcc_mean_h, mfcc_mean_p)
            ]

            # === PERCUSSIVE FEATURES (from percussive sample) ===
            logger.debug("Extracting percussive features from percussive sample")

            temporal_obj = af.Temporal(frame_length=2048, slide_length=1024)
            temporal_features = temporal_obj.temporal(
                y_percussive, has_rms=True, has_zcr=True
            )

            self.features["zero_crossing_rate"] = self._aggregate(
                temporal_features["zcr_arr"]
            )
            self.features["rms"] = self._aggregate(temporal_features["rms_arr"])

            # Energy by frequency bands from percussive sample
            freqs = bft_obj_p.y_coords()
            self.features["energy_by_band"] = self._get_energy_by_band(
                freqs, spec_arr_p
            )

            # === HARMONIC FEATURES (from harmonic sample) ===
            logger.debug("Extracting harmonic features from harmonic sample")

            chroma = af.chroma_linear(y_harmonic, samplate=sr)
            self.features["chroma"] = self._aggregate_chroma(chroma)
            self.features["tonnetz"] = self._compute_tonnetz_from_chroma(chroma)

            logger.debug(
                "Shared features extracted successfully from both harmonic and percussive samples"
            )

            return self.features

        except Exception as e:
            # Return empty features with proper structure
            self._set_default_features()
            logger.error(f"Failed to extract shared features: {e}")
            return self.features

    def _combine_spectral_features(
        self,
        feature_h: np.ndarray,
        spec_h: np.ndarray,
        feature_p: np.ndarray,
        spec_p: np.ndarray,
    ) -> dict:
        """
        Combine spectral features from harmonic and percussive samples by averaging.

        Args:
            feature_h: Feature array from harmonic sample
            spec_h: Spectrogram from harmonic sample
            feature_p: Feature array from percussive sample
            spec_p: Spectrogram from percussive sample

        Returns:
            Combined aggregated features
        """
        agg_h = self._aggregate_spectral_features(feature_h, spec_h)
        agg_p = self._aggregate_spectral_features(feature_p, spec_p)

        # Average the statistics
        return {
            "mean": (agg_h["mean"] + agg_p["mean"]) / 2,
            "std": (agg_h["std"] + agg_p["std"]) / 2,
            "median": (agg_h["median"] + agg_p["median"]) / 2,
            "min": min(agg_h["min"], agg_p["min"]),
            "max": max(agg_h["max"], agg_p["max"]),
            "p25": (agg_h["p25"] + agg_p["p25"]) / 2,
            "p75": (agg_h["p75"] + agg_p["p75"]) / 2,
        }

    def _get_mfcc_from_sample(self, y: np.ndarray, sr: int) -> list:
        """
        Extract MFCC from a specific audio sample.

        Args:
            y: Audio sample
            sr: Sample rate

        Returns:
            List of MFCC coefficients
        """
        bft_obj = af.BFT(
            num=128,
            samplate=sr,
            radix2_exp=12,
            slide_length=2048,
            scale_type=SpectralFilterBankScaleType.MEL,
            data_type=SpectralDataType.POWER,
        )
        spec_arr = bft_obj.bft(y)
        spec_dB_arr = af.utils.power_to_db(np.abs(spec_arr))

        xxcc_obj = af.XXCC(bft_obj.num)
        xxcc_obj.set_time_length(time_length=spec_dB_arr.shape[1])
        mfcc_arr = xxcc_obj.xxcc(spec_dB_arr)[:13]
        mfcc_mean = np.mean(mfcc_arr, axis=1)
        return mfcc_mean.tolist()
