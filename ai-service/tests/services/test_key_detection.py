"""
Tests for musical key detection via SkeyExtractor (Deezer S-KEY model).
"""

from src.services.features.key_detector import KeyDetector
from src.services.features.skey_extractor import SkeyExtractor
from src.services.simple_audio_loader import SimpleAudioLoader


class TestKeyDetection:
    audio_loader = SimpleAudioLoader()
    skey_extractor = SkeyExtractor()

    def test_key_detection(self, test_audio_files):
        """
        Run S-KEY against the full track for each fixture file and compare
        against its ground-truth `key`. Mirrors the sanity-check pattern used
        for tempo/mood elsewhere in this suite -- a loose accuracy bound
        rather than an exact per-file assertion, since key detection on real-
        world tracks (as opposed to the model's own curated test set) is
        inherently imperfect for any method.
        """
        results = []

        for test_audio_file in test_audio_files:
            y, sr = self.audio_loader.load_audio_sample(
                test_audio_file["filename"], sample_duration=None
            )
            skey_result = self.skey_extractor.extract_from_audio(y, sr)
            key = skey_result.get("key", "Unknown")
            camelot_key = KeyDetector.camelot_wheel.get(key.upper(), "Unknown")

            results.append(
                {
                    "filename": test_audio_file["filename"],
                    "expected_key": test_audio_file["key"],
                    "key": key,
                    "camelot_key": camelot_key,
                }
            )

        correct = [r for r in results if r["key"] == r["expected_key"]]
        incorrect = [r for r in results if r["key"] != r["expected_key"]]
        print(len(correct), len(incorrect))
        print(incorrect)

        # Loose sanity bound, not a strict accuracy benchmark -- catches a
        # broken pipeline (e.g. wrong sample rate, model failing to load)
        # without being a tight assertion on model accuracy itself.
        assert len(correct) / len(results) >= 0.3, (
            "At least 30% of key predictions should match ground truth"
        )
