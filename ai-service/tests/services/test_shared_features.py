"""
API tests for SimpleAnalysisResource post method.

This module tests the POST endpoint functionality of the SimpleAnalysisResource
using a real audio file to ensure proper processing and response format.
"""

import os

from src.services.enhanced_adaptive_bpm_detector import EnhancedAdaptiveBPMDetector

# from src.api.hierarchical_classification import initialize_service
from src.services.features.shared_features import SharedFeatures
from src.services.simple_audio_loader import SimpleAudioLoader


class TestSharedFeatures:
    audio_loader = SimpleAudioLoader()
    bpm_detector = EnhancedAdaptiveBPMDetector()

    def test_extract_shared_features(self, test_audio_files):
        """Test extract_basic_features method directly."""

        # Import the service

        # Initialize service
        y, sr = self.audio_loader.load_audio_sample(
            test_audio_files[0]["filename"],
            sample_duration=5.0,
            skip_intro=test_audio_files[0]["harmonic_metadata"]["start_time"],
        )
        data = [[y, sr], [None, None]]
        for audio_arr, sample_rate in data:
            service = SharedFeatures()
            try:
                # Pass the same sample as both harmonic and percussive for testing
                service.extract_shared_features(audio_arr, audio_arr, sample_rate)

            except Exception as e:
                print(f"Error extracting shared features: {e}")

            # print keys of service.features
            keys = [
                "spectral_centroids",
                "spectral_rolloffs",
                "spectral_bandwidths",
                "spectral_spreads",
                "spectral_flatnesses",
                "zero_crossing_rate",
                "rms",
                "energy_by_band",
                "chroma",
                "tonnetz",
                "mfcc_mean",
            ]
            assert all(key in service.features for key in keys)

            # for spectral features assert it has mean, std, max, min, median, p25, p75
            for feature in [
                "spectral_centroids",
                "spectral_rolloffs",
                "spectral_bandwidths",
                "spectral_spreads",
                "spectral_flatnesses",
            ]:
                assert "mean" in service.features[feature]
                assert "std" in service.features[feature]
                assert "max" in service.features[feature]
                assert "min" in service.features[feature]
                assert "median" in service.features[feature]
                assert "p25" in service.features[feature]
                assert "p75" in service.features[feature]
            # for zero_crossing_rate assert it has mean, std, max, min, q25, q75
            assert "mean" in service.features["zero_crossing_rate"]
            assert "std" in service.features["zero_crossing_rate"]
            assert "max" in service.features["zero_crossing_rate"]
            assert "min" in service.features["zero_crossing_rate"]
            assert "p25" in service.features["zero_crossing_rate"]
            assert "p75" in service.features["zero_crossing_rate"]
            # for rms assert it has mean, std, max, min, median, p25, p75
            assert "mean" in service.features["rms"]
            assert "std" in service.features["rms"]
            assert "max" in service.features["rms"]
            assert "min" in service.features["rms"]
            assert "median" in service.features["rms"]
            assert "p25" in service.features["rms"]
            assert "p75" in service.features["rms"]
            # for chroma assert it has mean, std, max, overall_mean, overall_std, dominant_pitch
            assert "mean" in service.features["chroma"]
            assert len(service.features["chroma"]["mean"]) == 12
            assert "std" in service.features["chroma"]
            assert len(service.features["chroma"]["std"]) == 12
            assert "max" in service.features["chroma"]
            assert len(service.features["chroma"]["max"]) == 12
            assert "overall_mean" in service.features["chroma"]
            assert "overall_std" in service.features["chroma"]
            assert "dominant_pitch" in service.features["chroma"]
            assert service.features["energy_by_band"] is not None
            assert len(service.features["energy_by_band"]) == 3
            # for tonnetz assert it has mean, std, max, overall_mean, overall_std
            assert "mean" in service.features["tonnetz"]
            assert len(service.features["tonnetz"]["mean"]) == 6
            assert "std" in service.features["tonnetz"]
            assert len(service.features["tonnetz"]["std"]) == 6
            assert "max" in service.features["tonnetz"]
            assert len(service.features["tonnetz"]["max"]) == 6
            assert "overall_mean" in service.features["tonnetz"]
            assert "overall_std" in service.features["tonnetz"]

            # for mfcc_mean assert it has 13 values
            assert "mfcc_mean" in service.features
            assert len(service.features["mfcc_mean"]) == 13

    def test_syncopation(self, test_audio_files):
        """
        Test syncopation method.

        """
        results = []

        for audio_file in test_audio_files:
            filename = os.path.basename(audio_file["filename"])

            y_p, sr = self.audio_loader.load_audio_sample(
                audio_file["filename"],
                sample_duration=audio_file["percussive_metadata"]["duration"],
                skip_intro=audio_file["percussive_metadata"]["start_time"],
            )

            service = SharedFeatures()

            beat_strength = audio_file["beat_strength"]
            tempo = audio_file["tempo"]
            service.extract_shared_features(y_p, y_p, sr)
            syncopation = service._get_syncopation(tempo, sr, beat_strength)

            expected = audio_file["syncopation"]
            result = {
                "filename": filename,
                "syncopation": syncopation,
                "expected": expected,
                "beat_strength": beat_strength,
            }
            results.append(result)
            print(filename, syncopation, expected)
            assert syncopation is not None
            assert syncopation >= 0.0
            assert syncopation <= 1.0
            if expected == "full":
                assert syncopation == 1.0
            if expected == "high":
                assert syncopation > 0.5
            elif expected == "low":
                assert syncopation < 0.5

    def test_energy_factor(self, test_audio_files):
        """
        Test energy factor method.
        """
        service = SharedFeatures()

        for audio_file in test_audio_files[:1]:
            y, sr = self.audio_loader.load_audio_sample(
                audio_file["filename"],
                sample_duration=audio_file["percussive_metadata"]["duration"],
                skip_intro=audio_file["percussive_metadata"]["start_time"],
            )
            # Pass the same sample as both harmonic and percussive for testing
            service.extract_shared_features(y, y, sr)
            energy_factor = service._get_energy_factor()
            assert energy_factor is not None
            assert energy_factor >= 0.0
            assert energy_factor <= 1.0
