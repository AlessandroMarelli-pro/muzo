"""
API tests for SimpleAnalysisResource post method.

This module tests the POST endpoint functionality of the SimpleAnalysisResource
using a real audio file to ensure proper processing and response format.
"""

import json

import pytest
from loguru import logger
from src.services.enhanced_adaptive_bpm_detector import EnhancedAdaptiveBPMDetector

# from src.api.hierarchical_classification import initialize_service
from src.services.simple_audio_loader import SimpleAudioLoader


class TestBpmDetection:
    audio_loader = SimpleAudioLoader()
    bpm_detector = EnhancedAdaptiveBPMDetector()

    @pytest.fixture(autouse=True)
    def test_setup(self):
        # Remove default loguru handler
        print("Removing default loguru handler")
        logger.remove()

        # Add console handler
        logger.add(
            sink=lambda msg: print(msg, end=""),
            level="DEBUG",
            colorize=True,
            # format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>",
            format="<cyan>{time:YYYY-MM-DD HH:mm:ss}</cyan>| <level>{message}</level>",
        )

    def test_detect_bpm(self, test_audio_files):
        """
        Test detect bpm method.
        """
        results = []
        # Initialize service

        results = []
        correct_results = []
        incorrect_results = []
        # for test_audio_file in [test_audio_files_list[len(test_audio_files_list) - 2]]:
        for test_audio_file in test_audio_files:
            bpm = None

            bpm, beat_strength, bpm_results = self.bpm_detector.detect_bpm_from_file(
                test_audio_file["filename"],
                bpm_metadata=test_audio_file["bpm_metadata"],
            )
            result = {
                **test_audio_file,
                "beat_strength": beat_strength,
                "tempo": bpm,
            }
            results.append(result)
            if (
                abs(bpm - test_audio_file["tempo"]) < 3
                or abs(bpm / 2 - test_audio_file["tempo"]) < 3
            ):
                correct_results.append(result)
            else:
                incorrect_results.append(result)
            # expect bpm to be close to expected_tempo or expected_tempo /2
        print(results)
        print("incorrect_results:", json.dumps(incorrect_results, indent=4))
        # Assert more than 90% good results
        assert len(correct_results) / len(results) > 0.9, (
            "More than 90% of results should be correct"
        )
