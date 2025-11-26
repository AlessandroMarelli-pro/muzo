"""
API tests for SimpleAnalysisResource post method.

This module tests the POST endpoint functionality of the SimpleAnalysisResource
using a real audio file to ensure proper processing and response format.
"""

import json

from src.services.enhanced_adaptive_bpm_detector import EnhancedAdaptiveBPMDetector
from src.services.features.danceability_analyzer import DanceabilityAnalyzer

# from src.api.hierarchical_classification import initialize_service
from src.services.features.shared_features import SharedFeatures
from src.services.simple_audio_loader import SimpleAudioLoader


class TestDanceabilityAnalyzer:
    audio_loader = SimpleAudioLoader()
    bpm_detector = EnhancedAdaptiveBPMDetector()

    def test_tempo_appropriateness(self):
        """
        Test tempo appropriateness method.
        """
        service = DanceabilityAnalyzer(SharedFeatures())
        for tempo, expected in [
            [60, 0.2],
            [80, 0.4],
            [90, 0.5],
            [100, 0.6],
            [110, 0.7],
            [120, 0.8],
            [130, 0.9],
            [140, 1.0],
            [160, 0.8],
            [180, 0.6],
            [200, 0.2],
        ]:
            tempo_appropriateness = service._get_tempo_appropriateness(tempo)
            assert tempo_appropriateness == expected

    def test_danceability_feeling(self):
        """
        Test danceability feeling method.
        """
        service = DanceabilityAnalyzer(SharedFeatures())
        for danceability, expected in [
            [0.75, "highly-danceable"],
            [0.60, "danceable"],
            [0.55, "moderately-danceable"],
            [0.35, "slightly-danceable"],
            [0.20, "minimally-danceable"],
            [0.10, "ambient"],
            [0.00, "experimental"],
        ]:
            danceability_feeling = service._get_danceability_feeling(danceability)
            assert danceability_feeling == expected

    def test_tempo_regularity(self, test_audio_files):
        """
        Test tempo regularity method.
        """
        service = DanceabilityAnalyzer(SharedFeatures())
        for audio_file in test_audio_files:
            y_h, sr = self.audio_loader.load_audio_sample(
                audio_file["filename"],
                sample_duration=audio_file["harmonic_metadata"]["duration"],
                skip_intro=audio_file["harmonic_metadata"]["start_time"],
            )
            y_p, sr = self.audio_loader.load_audio_sample(
                audio_file["filename"],
                sample_duration=audio_file["percussive_metadata"]["duration"],
                skip_intro=audio_file["percussive_metadata"]["start_time"],
            )

            shared_features = SharedFeatures()
            shared_features.extract_shared_features(y_h, y_p, sr)
            onset_env_arr, onset_env_obj = shared_features._get_onset_env()
            tempo_regularity = service._get_tempo_regularity(
                onset_env_arr, audio_file["beat_strength"]
            )
            expected = audio_file["tempo_regularity"]
            print(audio_file["filename"], tempo_regularity, expected)
            if expected == "high" or expected is None:
                assert tempo_regularity is not None
                assert tempo_regularity >= 0.7
                assert tempo_regularity <= 1.0
            if expected == "mid" or expected is None:
                assert tempo_regularity is not None
                assert tempo_regularity >= 0.4
                assert tempo_regularity < 0.7
            elif expected == "zero":
                assert tempo_regularity is not None
                assert tempo_regularity == 0.0
            else:
                assert tempo_regularity is not None

    def test_rhythm_stability(self, test_audio_files):
        """
        Test tempo regularity method.
        """
        service = DanceabilityAnalyzer(SharedFeatures())
        results = []
        for audio_file in test_audio_files[:10]:
            y_h, sr = self.audio_loader.load_audio_sample(
                audio_file["filename"],
                sample_duration=audio_file["harmonic_metadata"]["duration"],
                skip_intro=audio_file["harmonic_metadata"]["start_time"],
            )
            y_p, sr = self.audio_loader.load_audio_sample(
                audio_file["filename"],
                sample_duration=audio_file["percussive_metadata"]["duration"],
                skip_intro=audio_file["percussive_metadata"]["start_time"],
            )

            shared_features = SharedFeatures()
            shared_features.extract_shared_features(y_h, y_p, sr)
            onset_env_arr, onset_env_obj = shared_features._get_onset_env()
            rhythm_stability = service._get_rhythm_stability(onset_env_arr)
            results.append(
                {
                    "filename": audio_file["filename"],
                    "rhythm_stability": rhythm_stability,
                }
            )
            assert rhythm_stability is not None
            assert rhythm_stability >= 0.8
            assert rhythm_stability <= 1.0

    def test_bass_presence(self, test_audio_files):
        """
        Test bass presence method.
        """
        service = DanceabilityAnalyzer(SharedFeatures())

        for audio_file in test_audio_files:
            y_bpm, sr = self.audio_loader.load_audio_sample(
                audio_file["filename"],
                sample_duration=audio_file["bpm_metadata"]["duration"],
                skip_intro=audio_file["bpm_metadata"]["start_time"],
            )

            # Use percussive sample for bass detection
            bass_presence = service._get_bass_presence(y_bpm, sr)
            print(audio_file["filename"], bass_presence)
            assert bass_presence is not None
            bass_presence_expected = (
                audio_file["bass_presence"] if "bass_presence" in audio_file else None
            )
            if bass_presence_expected == "low":
                assert bass_presence >= 0.1
                assert bass_presence <= 0.5
            elif bass_presence_expected == "zero":
                assert bass_presence < 0.1
            else:
                assert bass_presence >= 0.5
                assert bass_presence <= 1.0

    def test_calculate_danceability(self, test_audio_files):
        """
        Test calculate danceability method.
        """
        results = []
        print_results = []
        for audio_file in test_audio_files:
            y_h, sr = self.audio_loader.load_audio_sample(
                audio_file["filename"],
                sample_duration=audio_file["harmonic_metadata"]["duration"],
                skip_intro=audio_file["harmonic_metadata"]["start_time"],
            )
            y_p, sr = self.audio_loader.load_audio_sample(
                audio_file["filename"],
                sample_duration=audio_file["percussive_metadata"]["duration"],
                skip_intro=audio_file["percussive_metadata"]["start_time"],
            )
            y_bpm, sr = self.audio_loader.load_audio_sample(
                audio_file["filename"],
                sample_duration=audio_file["bpm_metadata"]["duration"],
                skip_intro=audio_file["bpm_metadata"]["start_time"],
            )
            shared_features = SharedFeatures()
            shared_features.extract_shared_features(y_h, y_p, sr)
            service = DanceabilityAnalyzer(shared_features)
            # Use percussive sample for danceability analysis (rhythm-based)
            danceability, danceability_feeling, danceability_calculation = (
                service.calculate_danceability(
                    audio_file["beat_strength"],
                    y_bpm,
                    sr,
                    audio_file["tempo"],
                )
            )
            print_results.append(
                {
                    **audio_file,
                    "danceability_feeling": danceability_feeling,
                }
            )
            results.append(
                {
                    "filename": audio_file["filename"],
                    "danceability": danceability,
                    "danceability_feeling": danceability_feeling,
                    "danceability_calculation": danceability_calculation,
                }
            )
            print(
                f"Danceability: {danceability}",
                audio_file["filename"],
                danceability_feeling,
            )
            assert audio_file["danceability_feeling"] == danceability_feeling
            assert danceability is not None
            assert danceability >= 0.0
            assert danceability <= 1.0
            assert danceability_feeling is not None
            assert danceability_feeling in [
                "highly-danceable",
                "danceable",
                "moderately-danceable",
                "slightly-danceable",
                "minimally-danceable",
                "ambient",
                "experimental",
            ]
            service = None

        print("results:", json.dumps(results, indent=4))
        print(print_results)
