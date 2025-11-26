#!/usr/bin/env python3
"""
Test UB40 song and output results in JSON format
"""

import json
import sys
from pathlib import Path

import numpy as np

# Add src directory to path for imports
sys.path.append(str(Path(__file__).parent / "src"))

from feature_extraction import AudioFeatureExtractor
from model_training import MusicGenreClassifier


def test_ub40_json_output():
    """Test UB40 song and output results in JSON format."""

    # Song path
    song_path = "/Users/alessandro/Music/tidal/Tracks/UB40 - Kingston Town.flac"

    # Check if file exists
    if not Path(song_path).exists():
        result = {"error": f"Song file not found: {song_path}", "success": False}
        print(json.dumps(result, indent=2))
        return False

    # Initialize feature extractor
    feature_extractor = AudioFeatureExtractor()

    # Extract features
    try:
        features = feature_extractor.extract_all_features(song_path)
    except Exception as e:
        result = {"error": f"Failed to extract features: {str(e)}", "success": False}
        print(json.dumps(result, indent=2))
        return False

    # Test on personal models
    models_to_test = [
        ("personal-genres-v1.0.pkl", "Personal Genres Model", 53),
        ("personal-subgenres-v1.2.pkl", "Personal Subgenres Model", 52),
    ]

    results = []

    for model_file, model_name, expected_features in models_to_test:
        model_path = Path(__file__).parent / "models" / model_file

        if not model_path.exists():
            continue

        try:
            # Load model
            classifier = MusicGenreClassifier()
            classifier.load_model(model_path)

            # Prepare feature vector (exclude metadata)
            metadata_keys = ["file_path", "duration", "sample_rate"]
            feature_vector = []

            for key, value in features.items():
                if key not in metadata_keys:
                    if isinstance(value, list):
                        feature_vector.extend(value)
                    elif isinstance(value, (int, float)):
                        feature_vector.append(value)
                    elif isinstance(value, str):
                        # Skip string values like key
                        continue

            # Adjust to expected feature count
            if len(feature_vector) < expected_features:
                feature_vector.extend([0.0] * (expected_features - len(feature_vector)))
            elif len(feature_vector) > expected_features:
                feature_vector = feature_vector[:expected_features]

            # Convert to numpy array and reshape
            X = np.array(feature_vector).reshape(1, -1)

            # Scale features
            X_scaled = classifier.scaler.transform(X)

            # Make prediction
            prediction = classifier.predict(X_scaled)

            results.append(
                {
                    "model_name": model_name,
                    "model_file": model_file,
                    "predicted_genre": prediction["primary_genre"],
                    "confidence": float(prediction["confidence"]),
                    "alternatives": [
                        {"genre": alt["genre"], "confidence": float(alt["confidence"])}
                        for alt in prediction["alternative_genres"][:3]
                    ],
                    "all_probabilities": {
                        genre: float(prob)
                        for genre, prob in prediction["all_probabilities"].items()
                    },
                }
            )

        except Exception as e:
            results.append(
                {
                    "model_name": model_name,
                    "model_file": model_file,
                    "error": str(e),
                    "success": False,
                }
            )

    # Prepare final result
    final_result = {
        "song_info": {
            "filename": Path(song_path).name,
            "file_path": song_path,
            "duration": float(features["duration"]),
            "sample_rate": int(features["sample_rate"]),
            "tempo": float(features["tempo"]),
            "key": features["key"],
            "energy": float(features["energy"]),
            "valence": float(features["valence"]),
            "danceability": float(features["danceability"]),
        },
        "feature_extraction": {
            "mfcc_coefficients": len(features["mfcc"]),
            "chroma_features": len(features["chroma"]),
            "spectral_contrast_features": len(features["spectral_contrast"]),
            "total_features_extracted": len(
                [
                    k
                    for k in features.keys()
                    if k not in ["file_path", "duration", "sample_rate"]
                ]
            ),
        },
        "classifications": results,
        "summary": {
            "total_models_tested": len(results),
            "successful_classifications": len([r for r in results if "error" not in r]),
            "failed_classifications": len([r for r in results if "error" in r]),
            "genre_distribution": {},
            "average_confidence": 0.0,
        },
        "success": True,
        "timestamp": str(np.datetime64("now")),
    }

    # Calculate summary statistics
    successful_results = [r for r in results if "error" not in r]
    if successful_results:
        # Genre distribution
        genre_counts = {}
        confidence_scores = []

        for result in successful_results:
            genre = result["predicted_genre"]
            confidence = result["confidence"]

            genre_counts[genre] = genre_counts.get(genre, 0) + 1
            confidence_scores.append(confidence)

        final_result["summary"]["genre_distribution"] = {
            genre: {
                "count": count,
                "percentage": round((count / len(successful_results)) * 100, 1),
            }
            for genre, count in genre_counts.items()
        }

        final_result["summary"]["average_confidence"] = round(
            float(np.mean(confidence_scores)), 3
        )

    # Output JSON
    print(json.dumps(final_result, indent=2))
    return True


if __name__ == "__main__":
    success = test_ub40_json_output()
    sys.exit(0 if success else 1)
