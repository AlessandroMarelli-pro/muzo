"""
API tests for SimpleAnalysisResource post method.

This module tests the POST endpoint functionality of the SimpleAnalysisResource
using a real audio file to ensure proper processing and response format.
"""

from src.services.features.key_detector import KeyDetector

# from src.api.hierarchical_classification import initialize_service
from src.services.features.shared_features import SharedFeatures
from src.services.simple_audio_loader import SimpleAudioLoader


class TestKeyDetection:
    audio_loader = SimpleAudioLoader()

    def test_key_detection(self, test_audio_files):
        """
        Test detect bpm method.
        """
        results = []
        # Initialize service

        print_results = []
        # for test_audio_file in [test_audio_files_list[len(test_audio_files_list) - 2]]:
        for test_audio_file in test_audio_files:
            y, sr = self.audio_loader.load_audio_sample(
                test_audio_file["filename"],
                sample_duration=test_audio_file["harmonic_metadata"]["duration"],
                skip_intro=test_audio_file["harmonic_metadata"]["start_time"],
            )
            shared_features = SharedFeatures()
            # Pass the same sample as both harmonic and percussive for testing
            shared_features.extract_shared_features(y, y, sr)
            # Use harmonic sample for key detection
            key, camelot_key, tonnetz_mode = KeyDetector(
                shared_features
            ).get_simple_key(
                y,
                sr,
            )

            assert key == test_audio_file["real_key"], "Key should match"
            assert camelot_key == test_audio_file["real_camelot_key"], (
                "Camelot key should match"
            )
            assert tonnetz_mode == test_audio_file["real_tonnetz_mode"], (
                "Tonnetz mode should match"
            )
            print_results.append(
                {
                    **test_audio_file,
                    "real_key": key,
                    "real_camelot_key": camelot_key,
                    "real_tonnetz_mode": tonnetz_mode,
                    "key": key,
                    "camelot_key": camelot_key,
                    "tonnetz_mode": tonnetz_mode,
                }
            )

            results.append(
                {
                    "filename": test_audio_file["filename"],
                    "expected_key": test_audio_file["key"],
                    "expected_key_alt": test_audio_file["key_alt"]
                    if "key_alt" in test_audio_file
                    else None,
                    "expected_key_relative": test_audio_file["key_relative"]
                    if "key_relative" in test_audio_file
                    else None,
                    "expected_key_alt_relative": test_audio_file["key_alt_relative"]
                    if "key_alt_relative" in test_audio_file
                    else None,
                    "key": key,
                    "camelot_key": camelot_key,
                    "tonnetz_mode": tonnetz_mode,
                }
            )
        correct_profiles = []
        incorrect_profiles = []
        for result in results:
            profile = result["tonnetz_mode"]
            expected_profile = result["expected_key"].split(" ")[1]
            if profile == expected_profile:
                correct_profiles.append(result)
            else:
                incorrect_profiles.append(result)
        print(
            len(correct_profiles),
            len(incorrect_profiles),
        )
        print(incorrect_profiles)
        print(print_results)
        # Assert more than 60% good results
        assert len(correct_profiles) / len(results) >= 0.5, (
            "More than 50% of results should be correct"
        )
