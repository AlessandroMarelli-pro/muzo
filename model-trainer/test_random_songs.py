#!/usr/bin/env python3
"""
Test both subgenres and genres models on 10 random songs from Tidal Tracks folder
"""

import json
import random
import sys
import time
from pathlib import Path

import numpy as np
import pandas as pd

# Add src directory to path for imports
sys.path.append(str(Path(__file__).parent / "src"))

from feature_extraction import AudioFeatureExtractor
from model_training import MusicGenreClassifier


def test_random_songs():
    """Test both models on 10 random songs from Tidal Tracks folder."""

    print("=" * 60)
    print("TESTING RANDOM SONGS WITH BOTH MODELS")
    print("=" * 60)

    # Tracks folder path
    tracks_folder = Path("/Users/alessandro/Music/tidal/Tracks")

    if not tracks_folder.exists():
        print(f"❌ Tracks folder not found: {tracks_folder}")
        return False

    # Get all audio files
    audio_extensions = {".flac", ".mp3", ".wav", ".m4a", ".aac"}
    audio_files = []

    for file_path in tracks_folder.rglob("*"):
        if file_path.is_file() and file_path.suffix.lower() in audio_extensions:
            audio_files.append(file_path)

    if len(audio_files) < 10:
        print(
            f"❌ Not enough audio files found. Found {len(audio_files)}, need at least 10"
        )
        return False

    # Select 10 random songs
    selected_songs = random.sample(audio_files, 10)

    print(f"✅ Found {len(audio_files)} audio files")
    print(f"🎵 Selected 10 random songs for testing:")
    for i, song in enumerate(selected_songs, 1):
        print(f"   {i:2d}. {song.name}")

    # Load both models
    print(f"\n📚 Loading models...")

    # Subgenres model
    subgenres_model_path = "models/personal-subgenres-v1.2.pkl"
    if not Path(subgenres_model_path).exists():
        print(f"❌ Subgenres model not found: {subgenres_model_path}")
        return False

    subgenres_classifier = MusicGenreClassifier()
    subgenres_classifier.load_model(subgenres_model_path)
    subgenres_info = subgenres_classifier.get_model_info()

    # Genres model
    genres_model_path = "models/personal-genres-v1.0.pkl"
    if not Path(genres_model_path).exists():
        print(f"❌ Genres model not found: {genres_model_path}")
        return False

    genres_classifier = MusicGenreClassifier()
    genres_classifier.load_model(genres_model_path)
    genres_info = genres_classifier.get_model_info()

    print(f"✅ Both models loaded successfully")
    print(
        f"   - Subgenres model: {subgenres_info['n_classes']} classes, {subgenres_info['n_features']} features"
    )
    print(
        f"   - Genres model: {genres_info['n_classes']} classes, {genres_info['n_features']} features"
    )

    # Initialize feature extractor
    feature_extractor = AudioFeatureExtractor()

    # Test each song
    results = []
    successful_tests = 0
    failed_tests = 0

    print(f"\n🎵 Testing songs...")

    for i, song_path in enumerate(selected_songs, 1):
        print(f"\n   {i:2d}. Testing: {song_path.name}")

        try:
            # Extract features
            features = feature_extractor.extract_all_features(song_path)

            # Convert features to DataFrame format for personal models
            feature_df = pd.DataFrame([features])

            # Extract feature columns (exclude metadata columns)
            metadata_columns = ["file_path", "duration", "sample_rate", "length"]
            feature_columns = [
                col for col in feature_df.columns if col not in metadata_columns
            ]

            # Prepare features for prediction
            features_list = []
            for _, row in feature_df.iterrows():
                feature_vector = []
                for col in feature_columns:
                    value = row[col]
                    if isinstance(value, list):
                        # Flatten list features (mfcc, chroma, spectral_contrast)
                        feature_vector.extend(value)
                    elif isinstance(value, (int, float)):
                        # Scalar features
                        feature_vector.append(value)
                    else:
                        # Skip problematic values
                        continue
                features_list.append(feature_vector)

            # Convert to numpy array
            personal_features = np.array(features_list)

            # Test with subgenres model
            subgenres_result = subgenres_classifier.predict(personal_features)

            # Test with genres model
            genres_result = genres_classifier.predict(personal_features)

            # Prepare song result
            song_result = {
                "song_info": {
                    "filename": song_path.name,
                    "file_path": str(song_path),
                    "duration": features["duration"],
                    "sample_rate": features["sample_rate"],
                    "tempo": features["tempo"],
                    "key": features["key"],
                    "energy": features["energy"],
                    "valence": features["valence"],
                    "danceability": features["danceability"],
                },
                "feature_extraction": {
                    "personal_features_extracted": len(personal_features[0]),
                    "feature_format": "Personal dataset compatible",
                },
                "classifications": [
                    {
                        "model_name": "Personal Subgenres Model",
                        "model_file": subgenres_model_path,
                        "predicted_subgenre": subgenres_result["primary_genre"],
                        "confidence": subgenres_result["confidence"],
                        "alternatives": subgenres_result["alternative_genres"],
                        "all_probabilities": subgenres_result["all_probabilities"],
                    },
                    {
                        "model_name": "Personal Genres Model",
                        "model_file": genres_model_path,
                        "predicted_genre": genres_result["primary_genre"],
                        "confidence": genres_result["confidence"],
                        "alternatives": genres_result["alternative_genres"],
                        "all_probabilities": genres_result["all_probabilities"],
                    },
                ],
                "success": True,
            }

            results.append(song_result)
            successful_tests += 1

            print(f"       ✅ Success")
            print(
                f"       📊 Subgenres: {subgenres_result['primary_genre']} ({subgenres_result['confidence']:.3f})"
            )
            print(
                f"       📊 Genres: {genres_result['primary_genre']} ({genres_result['confidence']:.3f})"
            )

        except Exception as e:
            print(f"       ❌ Error: {str(e)}")
            failed_tests += 1

            # Add failed result
            failed_result = {
                "song_info": {
                    "filename": song_path.name,
                    "file_path": str(song_path),
                    "error": str(e),
                },
                "success": False,
            }
            results.append(failed_result)

    # Prepare final output
    output = {
        "test_summary": {
            "total_songs_tested": len(selected_songs),
            "successful_tests": successful_tests,
            "failed_tests": failed_tests,
            "success_rate": f"{(successful_tests / len(selected_songs) * 100):.1f}%",
            "test_date": time.strftime("%Y-%m-%d %H:%M:%S"),
        },
        "model_info": {
            "subgenres_model": {
                "name": subgenres_info["model_name"],
                "classes": subgenres_info["n_classes"],
                "features": subgenres_info["n_features"],
                "class_list": subgenres_info["classes"],
            },
            "genres_model": {
                "name": genres_info["model_name"],
                "classes": genres_info["n_classes"],
                "features": genres_info["n_features"],
                "class_list": genres_info["classes"],
            },
        },
        "results": results,
    }

    # Save results
    output_file = "random_songs_test_results.json"
    with open(output_file, "w") as f:
        json.dump(output, f, indent=2)

    print(f"\n📊 Test Summary:")
    print(f"   - Total songs tested: {len(selected_songs)}")
    print(f"   - Successful tests: {successful_tests}")
    print(f"   - Failed tests: {failed_tests}")
    print(f"   - Success rate: {(successful_tests / len(selected_songs) * 100):.1f}%")
    print(f"\n💾 Results saved to: {output_file}")

    return True


if __name__ == "__main__":
    success = test_random_songs()
    sys.exit(0 if success else 1)
