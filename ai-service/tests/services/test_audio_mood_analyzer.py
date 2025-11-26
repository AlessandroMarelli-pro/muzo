"""
API tests for SimpleAnalysisResource post method.

This module tests the POST endpoint functionality of the SimpleAnalysisResource
using a real audio file to ensure proper processing and response format.
"""

import json

from src.services.enhanced_adaptive_bpm_detector import EnhancedAdaptiveBPMDetector
from src.services.features.audio_mood_analyzer import AudioMoodAnalyzer
from src.services.features.key_detector import KeyDetector

# from src.api.hierarchical_classification import initialize_service
from src.services.features.shared_features import SharedFeatures
from src.services.simple_audio_loader import SimpleAudioLoader


class TestAudioMoodAnalyzer:
    audio_loader = SimpleAudioLoader()
    bpm_detector = EnhancedAdaptiveBPMDetector()

    def test_get_brightness_factor(self, test_audio_files):
        """
        Test get brightness factor method.
        """

        for test_audio_file in test_audio_files:
            y_h, sr = self.audio_loader.load_audio_sample(
                test_audio_file["filename"],
                sample_duration=test_audio_file["harmonic_metadata"]["duration"],
                skip_intro=test_audio_file["harmonic_metadata"]["start_time"],
            )
            y_p, sr = self.audio_loader.load_audio_sample(
                test_audio_file["filename"],
                sample_duration=test_audio_file["percussive_metadata"]["duration"],
                skip_intro=test_audio_file["percussive_metadata"]["start_time"],
            )
            shared_features = SharedFeatures()
            shared_features.extract_shared_features(y_h, y_p, sr)
            brightness_factor = AudioMoodAnalyzer(
                shared_features
            )._get_brightness_factor()
            assert brightness_factor >= 0.0
            assert brightness_factor <= 1.0

    def test_get_harmonic_factor(self, test_audio_files):
        """
        Test get harmonic factor method.
        """
        results = []
        for test_audio_file in test_audio_files:
            y_h, sr = self.audio_loader.load_audio_sample(
                test_audio_file["filename"],
                sample_duration=test_audio_file["harmonic_metadata"]["duration"],
                skip_intro=test_audio_file["harmonic_metadata"]["start_time"],
            )
            y_p, sr = self.audio_loader.load_audio_sample(
                test_audio_file["filename"],
                sample_duration=test_audio_file["percussive_metadata"]["duration"],
                skip_intro=test_audio_file["percussive_metadata"]["start_time"],
            )
            shared_features = SharedFeatures()
            shared_features.extract_shared_features(y_h, y_p, sr)
            harmonic_factor = AudioMoodAnalyzer(shared_features)._get_harmonic_factor()
            expected = test_audio_file["flatness"]
            results.append(
                {
                    "filename": test_audio_file["filename"],
                    "harmonic_factor": harmonic_factor,
                }
            )
            print(test_audio_file["filename"], harmonic_factor, expected)

            if expected == "high":
                assert harmonic_factor >= 0.9
                assert harmonic_factor <= 1.0
            elif expected == "moderate":
                assert harmonic_factor >= 0.4
                assert harmonic_factor <= 0.9
            elif expected == "low":
                assert harmonic_factor >= 0
                assert harmonic_factor <= 0.4

        print(json.dumps(results, indent=4))

    def test_get_spectral_balance_factor(self, test_audio_files):
        """
        Test get spectral balance factor method.
        """
        results = []
        for test_audio_file in test_audio_files:
            y_h, sr = self.audio_loader.load_audio_sample(
                test_audio_file["filename"],
                sample_duration=test_audio_file["harmonic_metadata"]["duration"],
                skip_intro=test_audio_file["harmonic_metadata"]["start_time"],
            )
            y_p, sr = self.audio_loader.load_audio_sample(
                test_audio_file["filename"],
                sample_duration=test_audio_file["percussive_metadata"]["duration"],
                skip_intro=test_audio_file["percussive_metadata"]["start_time"],
            )
            shared_features = SharedFeatures()
            shared_features.extract_shared_features(y_h, y_p, sr)
            # Use harmonic sample for spectral balance analysis
            spectral_balance_factor = AudioMoodAnalyzer(
                shared_features
            )._get_spectral_balance_factor(y_h, sr)
            expected = test_audio_file["spectral_balance"]
            results.append(
                {
                    "filename": test_audio_file["filename"],
                    "spectral_balance_factor": spectral_balance_factor,
                }
            )
            print(test_audio_file["filename"], spectral_balance_factor, expected)
            if expected == "very-bright":
                assert spectral_balance_factor >= 0.9
                assert spectral_balance_factor <= 1.0
            elif expected == "bright":
                assert spectral_balance_factor >= 0.7
                assert spectral_balance_factor <= 0.9
            elif expected == "balanced":
                assert spectral_balance_factor >= 0.5
                assert spectral_balance_factor <= 0.7
            elif expected == "warm":
                assert spectral_balance_factor >= 0.3
                assert spectral_balance_factor <= 0.5
            elif expected == "very-dark":
                assert spectral_balance_factor >= 0
                assert spectral_balance_factor <= 0.3
        print(json.dumps(results, indent=4))

    def test_get_mode_valence_factor(self, test_audio_files):
        """
        Test get mode valence factor method.
        """

        for mode, expected in [
            ["major", 0.8],
            ["minor", 0.3],
            ["neutral", 0.5],
        ]:
            mode_valence_factor = AudioMoodAnalyzer(
                SharedFeatures()
            )._get_mode_valence_factor(mode)
            assert mode_valence_factor == expected

    def test_get_tempo_valence_factor(self, test_audio_files):
        """
        Test get tempo valence factor method.
        """
        for tempo, expected in [
            [70, 0.0],
            [120, 0.5],
            [170, 1.0],
        ]:
            tempo_valence_factor = AudioMoodAnalyzer(
                SharedFeatures()
            )._get_tempo_valence_factor(tempo)
            assert tempo_valence_factor == expected

    def test_analyze_audio_mood(self, test_audio_files):
        """
        Test analyze audio mood method.
        """
        results = []
        for test_audio_file in test_audio_files:
            bpm_metadata = test_audio_file["bpm_metadata"]
            harmonic_metadata = test_audio_file["harmonic_metadata"]
            percussive_metadata = test_audio_file["percussive_metadata"]

            y_h, sr = self.audio_loader.load_audio_sample(
                test_audio_file["filename"],
                sample_duration=test_audio_file["harmonic_metadata"]["duration"],
                skip_intro=test_audio_file["harmonic_metadata"]["start_time"],
            )
            y_p, sr = self.audio_loader.load_audio_sample(
                test_audio_file["filename"],
                sample_duration=test_audio_file["percussive_metadata"]["duration"],
                skip_intro=test_audio_file["percussive_metadata"]["start_time"],
            )
            shared_features = SharedFeatures()
            shared_features.extract_shared_features(y_h, y_p, sr)
            # Use harmonic sample for key and mood analysis
            key, camelot_key, tonnetz_mode = KeyDetector(
                shared_features
            ).get_simple_key(
                y_h,
                sr,
            )
            print(y_h)
            tempo = (
                test_audio_file["real_tempo"]
                if "real_tempo" in test_audio_file
                else test_audio_file["tempo"]
            )
            valence, arousal, valence_mood, arousal_mood, mood_calculation = (
                AudioMoodAnalyzer(shared_features).analyze_audio_mood(
                    y_h,
                    sr,
                    tempo,
                    tonnetz_mode,
                    test_audio_file["beat_strength"],
                )
            )
            print(mood_calculation)
            expected_valence_mood = test_audio_file["valence_mood"]
            expected_arousal_mood = test_audio_file["arousal_mood"]
            results.append(
                {
                    **test_audio_file,
                    "valence_mood": valence_mood,
                    "arousal_mood": arousal_mood,
                }
            )
            assert tonnetz_mode == test_audio_file["real_tonnetz_mode"], (
                "Tonnetz mode should match"
            )
            assert valence_mood == expected_valence_mood
            assert arousal_mood == expected_arousal_mood
        # print(results)
