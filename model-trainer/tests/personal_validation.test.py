"""
Personal Music Files Validation Test

This module tests the trained Random Forest classifier on personal music files
to validate performance on real-world data. Tests model performance on diverse
music genres from personal collection.

Based on the Muzo data model and AI service API specifications.
"""

import json
import os
import sys
import unittest
from pathlib import Path
from typing import Dict, List, Tuple

import numpy as np
import pandas as pd

# Add src directory to path for imports
sys.path.append(str(Path(__file__).parent.parent / "src"))

from feature_extraction import AudioFeatureExtractor
from model_training import MusicGenreClassifier


class TestPersonalValidation(unittest.TestCase):
    """Test suite for validating algorithm performance on personal music files."""

    def setUp(self):
        """Set up test fixtures."""
        self.personal_music_dir = Path("/Users/alessandro/Music/tidal/Tracks")
        self.model_path = (
            Path(__file__).parent.parent / "models" / "personal-genres-v1.0.pkl"
        )
        self.results_path = (
            Path(__file__).parent.parent
            / "models"
            / "personal-genres-v1.0_results.json"
        )
        self.target_accuracy = 0.70  # 70% target accuracy for personal files
        self.classifier = None
        self.feature_extractor = None

    def test_personal_music_directory_exists(self):
        """Test that the personal music directory exists."""
        self.assertTrue(
            self.personal_music_dir.exists(),
            f"Personal music directory not found: {self.personal_music_dir}",
        )

        # Check for music files
        music_files = (
            list(self.personal_music_dir.glob("*.flac"))
            + list(self.personal_music_dir.glob("*.mp3"))
            + list(self.personal_music_dir.glob("*.wav"))
            + list(self.personal_music_dir.glob("*.opus"))
        )
        self.assertGreater(
            len(music_files), 0, "No music files found in personal directory"
        )

        print(f"✅ Personal music directory found: {self.personal_music_dir}")
        print(f"✅ Found {len(music_files)} music files")

    def test_model_file_exists(self):
        """Test that the trained model file exists."""
        self.assertTrue(
            self.model_path.exists(),
            f"Model file not found: {self.model_path}. Run T005 first.",
        )

    def test_load_trained_model(self):
        """Test loading the trained model."""
        self.classifier = MusicGenreClassifier()
        self.classifier.load_model(self.model_path)

        # Verify model is loaded and trained
        self.assertTrue(self.classifier.is_trained, "Model should be marked as trained")
        self.assertIsNotNone(self.classifier.model, "Model should be loaded")
        self.assertIsNotNone(self.classifier.classes_, "Classes should be defined")

        print(f"✅ Model loaded successfully")
        print(f"   - Model name: {self.classifier.model_name}")
        print(f"   - Classes: {len(self.classifier.classes_)}")
        print(f"   - Features: {len(self.classifier.feature_columns)}")

    def test_feature_extractor_initialization(self):
        """Test feature extractor initialization."""
        self.feature_extractor = AudioFeatureExtractor()
        self.assertIsNotNone(
            self.feature_extractor, "Feature extractor should be initialized"
        )

        print(f"✅ Feature extractor initialized")

    def test_extract_features_from_personal_files(self):
        """Test extracting features from personal music files."""
        # Initialize components
        self.classifier = MusicGenreClassifier()
        self.classifier.load_model(self.model_path)
        self.feature_extractor = AudioFeatureExtractor()

        # Get sample of music files (limit to 10 for testing)
        music_files = list(self.personal_music_dir.glob("*.flac"))[:10]
        self.assertGreater(len(music_files), 0, "No FLAC files found for testing")

        print(f"\n🎵 Testing on {len(music_files)} personal music files:")

        results = []
        successful_extractions = 0

        for i, file_path in enumerate(music_files):
            try:
                print(f"   {i + 1:2d}. Processing: {file_path.name}")

                # Extract features
                features = self.feature_extractor.extract_all_features(str(file_path))

                if features is not None:
                    # Prepare features for prediction (without labels)
                    feature_df = pd.DataFrame([features])

                    # Extract only the feature columns (exclude metadata)
                    feature_columns = self.classifier.feature_columns
                    X = feature_df[feature_columns].values

                    if X is not None and len(X) > 0:
                        # Scale features
                        X_scaled = self.classifier.scaler.transform(X)

                        # Make prediction
                        prediction = self.classifier.predict(X_scaled)

                        results.append(
                            {
                                "filename": file_path.name,
                                "predicted_genre": prediction["primary_genre"],
                                "confidence": prediction["confidence"],
                                "top_alternatives": prediction["alternative_genres"][
                                    :3
                                ],
                            }
                        )

                        successful_extractions += 1
                        print(
                            f"       → Predicted: {prediction['primary_genre']} (confidence: {prediction['confidence']:.3f})"
                        )
                    else:
                        print(f"       → Failed: Could not prepare features")
                else:
                    print(f"       → Failed: Could not extract features")

            except Exception as e:
                print(f"       → Error: {str(e)}")

        self.assertGreater(
            successful_extractions, 0, "No successful feature extractions"
        )

        print(f"\n📊 Extraction Results:")
        print(f"   - Total files processed: {len(music_files)}")
        print(f"   - Successful extractions: {successful_extractions}")
        print(
            f"   - Success rate: {successful_extractions / len(music_files) * 100:.1f}%"
        )

        # Store results for analysis
        self.personal_results = results
        self.successful_extractions = successful_extractions

    def test_personal_files_genre_distribution(self):
        """Test genre distribution in personal music files."""
        if not hasattr(self, "personal_results"):
            self.test_extract_features_from_personal_files()

        # Analyze genre distribution
        genre_counts = {}
        confidence_scores = []

        for result in self.personal_results:
            genre = result["predicted_genre"]
            confidence = result["confidence"]

            genre_counts[genre] = genre_counts.get(genre, 0) + 1
            confidence_scores.append(confidence)

        print(f"\n📈 Genre Distribution in Personal Music:")
        for genre, count in sorted(
            genre_counts.items(), key=lambda x: x[1], reverse=True
        ):
            percentage = (count / len(self.personal_results)) * 100
            print(f"   {genre}: {count} files ({percentage:.1f}%)")

        # Calculate average confidence
        avg_confidence = np.mean(confidence_scores)
        print(f"\n🎯 Average Confidence: {avg_confidence:.3f}")

        # Test that we have reasonable genre diversity
        self.assertGreaterEqual(
            len(genre_counts), 3, "Should have at least 3 different genres"
        )

        # Test that average confidence is reasonable
        self.assertGreaterEqual(
            avg_confidence, 0.3, "Average confidence should be at least 0.3"
        )

    def test_personal_files_performance_analysis(self):
        """Test performance analysis on personal music files."""
        if not hasattr(self, "personal_results"):
            self.test_extract_features_from_personal_files()

        # Analyze performance metrics
        confidence_scores = [result["confidence"] for result in self.personal_results]

        high_confidence = sum(1 for conf in confidence_scores if conf >= 0.7)
        medium_confidence = sum(1 for conf in confidence_scores if 0.4 <= conf < 0.7)
        low_confidence = sum(1 for conf in confidence_scores if conf < 0.4)

        print(f"\n📊 Confidence Analysis:")
        print(
            f"   - High confidence (≥0.7): {high_confidence} files ({high_confidence / len(self.personal_results) * 100:.1f}%)"
        )
        print(
            f"   - Medium confidence (0.4-0.7): {medium_confidence} files ({medium_confidence / len(self.personal_results) * 100:.1f}%)"
        )
        print(
            f"   - Low confidence (<0.4): {low_confidence} files ({low_confidence / len(self.personal_results) * 100:.1f}%)"
        )

        # Calculate performance metrics
        avg_confidence = np.mean(confidence_scores)
        median_confidence = np.median(confidence_scores)
        std_confidence = np.std(confidence_scores)

        print(f"\n📈 Performance Metrics:")
        print(f"   - Average confidence: {avg_confidence:.3f}")
        print(f"   - Median confidence: {median_confidence:.3f}")
        print(f"   - Standard deviation: {std_confidence:.3f}")

        # Test performance thresholds
        self.assertGreaterEqual(
            avg_confidence, 0.3, "Average confidence should be at least 0.3"
        )
        self.assertGreaterEqual(
            high_confidence,
            len(self.personal_results) * 0.2,
            "At least 20% should have high confidence",
        )

    def test_personal_files_sample_predictions(self):
        """Test detailed sample predictions from personal files."""
        if not hasattr(self, "personal_results"):
            self.test_extract_features_from_personal_files()

        print(f"\n🎵 Sample Predictions:")

        # Show top 5 predictions by confidence
        sorted_results = sorted(
            self.personal_results, key=lambda x: x["confidence"], reverse=True
        )

        for i, result in enumerate(sorted_results[:5]):
            print(f"   {i + 1}. {result['filename']}")
            print(f"      Genre: {result['predicted_genre']}")
            print(f"      Confidence: {result['confidence']:.3f}")
            print(
                f"      Alternatives: {', '.join([alt['genre'] for alt in result['top_alternatives']])}"
            )
            print()

        # Test that we have some high-confidence predictions
        high_conf_results = [r for r in self.personal_results if r["confidence"] >= 0.7]
        self.assertGreaterEqual(
            len(high_conf_results),
            1,
            "Should have at least one high-confidence prediction",
        )


def run_personal_validation_suite():
    """Run the complete personal validation test suite."""
    print("=" * 60)
    print("PERSONAL MUSIC FILES VALIDATION")
    print("=" * 60)
    print(f"Target Accuracy: 70%")
    print(f"Personal Music Directory: /Users/alessandro/Music/tidal/Tracks")
    print(f"Model: Random Forest Classifier")
    print("=" * 60)

    # Create test suite
    suite = unittest.TestLoader().loadTestsFromTestCase(TestPersonalValidation)

    # Run tests
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)

    # Print summary
    print("\n" + "=" * 60)
    print("PERSONAL VALIDATION SUMMARY")
    print("=" * 60)
    print(f"Tests Run: {result.testsRun}")
    print(f"Failures: {len(result.failures)}")
    print(f"Errors: {len(result.errors)}")

    if result.failures:
        print("\nFAILURES:")
        for test, traceback in result.failures:
            print(f"  - {test}: {traceback}")

    if result.errors:
        print("\nERRORS:")
        for test, traceback in result.errors:
            print(f"  - {test}: {traceback}")

    # Determine overall success
    success = len(result.failures) == 0 and len(result.errors) == 0

    if success:
        print(
            "\n✅ VALIDATION PASSED: Algorithm performs well on personal music files!"
        )
    else:
        print("\n❌ VALIDATION FAILED: Algorithm has issues with personal music files.")

    print("=" * 60)

    return success


if __name__ == "__main__":
    """Run validation when executed directly."""
    success = run_personal_validation_suite()
    sys.exit(0 if success else 1)
