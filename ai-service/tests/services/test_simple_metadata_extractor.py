"""
API tests for SimpleAnalysisResource post method.

This module tests the POST endpoint functionality of the SimpleAnalysisResource
using a real audio file to ensure proper processing and response format.
"""

import json
import os

from src.services.enhanced_adaptive_bpm_detector import EnhancedAdaptiveBPMDetector
from src.services.features.audio_mood_analyzer import AudioMoodAnalyzer
from src.services.features.key_detector import KeyDetector

# from src.api.hierarchical_classification import initialize_service
from src.services.features.shared_features import SharedFeatures
from src.services.simple_audio_loader import SimpleAudioLoader
from src.services.simple_metadata_extractor import SimpleMetadataExtractor


class TestAudioMoodAnalyzer:
    audio_loader = SimpleAudioLoader()
    bpm_detector = EnhancedAdaptiveBPMDetector()

    def test_get_brightness_factor(self, test_audio_metadata_files):
        """
        Test get brightness factor method.
        """

        for test_audio_file in test_audio_metadata_files:
            original_filename = os.path.basename(test_audio_file)
            metadata = SimpleMetadataExtractor().extract_id3_tags(
                test_audio_file, original_filename
            )
            print(metadata)
