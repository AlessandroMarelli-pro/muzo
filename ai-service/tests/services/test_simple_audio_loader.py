"""
API tests for SimpleAnalysisResource post method.

This module tests the POST endpoint functionality of the SimpleAnalysisResource
using a real audio file to ensure proper processing and response format.
"""

import os

import numpy as np
from src.services.enhanced_adaptive_bpm_detector import EnhancedAdaptiveBPMDetector

# from src.api.hierarchical_classification import initialize_service
from src.services.features.shared_features import SharedFeatures
from src.services.simple_analysis import SimpleAnalysisService
from src.services.simple_audio_loader import SimpleAudioLoader


class TestSimpleAudioLoader:
    audio_loader = SimpleAudioLoader()

    def test_smart_audio_sample_loading(self, test_audio_files):
        """Test smart_audio_sample_loading method."""
        results = []
        for test_audio_file in test_audio_files:
            (
                y_harmonic,
                y_percussive,
                y_bpm,
                sr,
                harmonic_metadata,
                percussive_metadata,
                bpm_metadata,
            ) = self.audio_loader.smart_audio_sample_loading(
                test_audio_file["filename"],
                sample_duration=10.0,
                skip_intro=30.0,
            )

            y_h, sr = self.audio_loader.load_audio_sample(
                test_audio_file["filename"],
                sample_duration=harmonic_metadata["duration"],
                skip_intro=harmonic_metadata["start_time"],
            )
            y_p, sr = self.audio_loader.load_audio_sample(
                test_audio_file["filename"],
                sample_duration=percussive_metadata["duration"],
                skip_intro=percussive_metadata["start_time"],
            )
            y_bpm, sr = self.audio_loader.load_audio_sample(
                test_audio_file["filename"],
                sample_duration=bpm_metadata["duration"],
                skip_intro=bpm_metadata["start_time"],
            )

            assert np.allclose(y_h, y_harmonic), "Harmonic audio should match"
            assert np.allclose(y_p, y_percussive), "Percussive audio should match"
            assert np.allclose(y_bpm, y_bpm), "BPM audio should match"

            results.append(
                {
                    **test_audio_file,
                    "filename": test_audio_file["filename"],
                    "harmonic_metadata": harmonic_metadata,
                    "percussive_metadata": percussive_metadata,
                    "bpm_metadata": bpm_metadata,
                }
            )
        print(results)
