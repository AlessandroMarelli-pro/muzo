#!/usr/bin/env python3
"""
Validate Personal Music Models

Test both subgenre and genre models on personal music files.
"""

import sys
from pathlib import Path

import numpy as np
import pandas as pd

# Add src directory to path
sys.path.append(str(Path(__file__).parent.parent / "src"))

from feature_extraction import AudioFeatureExtractor
from model_training import MusicGenreClassifier


def validate_personal_models():
    """Validate both subgenre and genre models."""
    print("=" * 60)
    print("VALIDATING PERSONAL MUSIC MODELS")
    print("=" * 60)

    # Model paths
    subgenre_model_path = Path("models/personal-subgenres-v1.2.pkl")
    genre_model_path = Path("models/personal-genres-v1.0.pkl")

    # Check if models exist
    if not subgenre_model_path.exists():
        print(f"❌ Subgenre model not found: {subgenre_model_path}")
        return False

    if not genre_model_path.exists():
        print(f"❌ Genre model not found: {genre_model_path}")
        return False

    print(f"✅ Subgenre model found: {subgenre_model_path}")
    print(f"✅ Genre model found: {genre_model_path}")

    # Load models
    subgenre_classifier = MusicGenreClassifier()
    genre_classifier = MusicGenreClassifier()

    try:
        subgenre_classifier.load_model(str(subgenre_model_path))
        genre_classifier.load_model(str(genre_model_path))
        print("✅ Both models loaded successfully")
    except Exception as e:
        print(f"❌ Error loading models: {e}")
        return False

    # Initialize feature extractor
    feature_extractor = AudioFeatureExtractor()

    # Test on a few files from the personal dataset
    test_files = [
        "/Users/alessandro/Music/personal_dataset/electronic/techno/Kiss My Acid.flac",
        "/Users/alessandro/Music/personal_dataset/hiphop/rap/Drake - God's Plan.flac",
        "/Users/alessandro/Music/personal_dataset/jazz/bebop/Signal.flac",
        "/Users/alessandro/Music/personal_dataset/reggae/two-tone/03. Madness - One Step Beyond (2009 Remaster).flac",
        "/Users/alessandro/Music/personal_dataset/rock/psychedelic/Magic Carpet Ride.flac",
    ]

    print(f"\n🎵 Testing on {len(test_files)} personal music files:")

    results = []

    for i, file_path in enumerate(test_files, 1):
        file_path = Path(file_path)
        if not file_path.exists():
            print(f"   {i}. ⚠️  File not found: {file_path.name}")
            continue

        try:
            # Extract features
            features = feature_extractor.extract_all_features(str(file_path))
            if features is None:
                print(f"   {i}. ❌ Failed to extract features: {file_path.name}")
                continue

            # Prepare features for prediction (bypass label handling)
            feature_df = pd.DataFrame([features])

            # Extract feature columns (exclude metadata columns)
            metadata_columns = [
                "file_path",
                "genre",
                "label",
                "duration",
                "sample_rate",
                "extraction_failed",
                "error",
                "filename",
                "dataset",
                "extraction_date",
            ]
            feature_columns = [
                col for col in feature_df.columns if col not in metadata_columns
            ]

            # Handle nested feature arrays
            features_list = []
            for _, row in feature_df.iterrows():
                feature_vector = []
                for col in feature_columns:
                    value = row[col]
                    if isinstance(value, list):
                        feature_vector.extend(value)
                    elif isinstance(value, (int, float)):
                        feature_vector.append(value)
                    elif isinstance(value, str):
                        if value.startswith("[") and value.endswith("]"):
                            try:
                                import ast

                                parsed_value = ast.literal_eval(value)
                                if isinstance(parsed_value, list):
                                    feature_vector.extend(parsed_value)
                                else:
                                    feature_vector.append(float(parsed_value))
                            except (ValueError, SyntaxError):
                                continue
                        else:
                            continue
                    else:
                        try:
                            feature_vector.append(float(value))
                        except (ValueError, TypeError):
                            continue
                features_list.append(feature_vector)

            X = np.array(features_list)

            # Ensure feature vector matches model expectations
            expected_features_subgenre = (
                len(subgenre_classifier.feature_columns)
                if hasattr(subgenre_classifier, "feature_columns")
                else 52
            )
            expected_features_genre = (
                len(genre_classifier.feature_columns)
                if hasattr(genre_classifier, "feature_columns")
                else 53
            )

            print(f"      Debug: Extracted {len(features_list[0])} features")
            print(
                f"      Debug: Subgenre model expects {expected_features_subgenre} features"
            )
            print(
                f"      Debug: Genre model expects {expected_features_genre} features"
            )

            # Make predictions
            subgenre_pred = subgenre_classifier.predict(X)[0]
            genre_pred = genre_classifier.predict(X)[0]

            # Get confidence scores
            subgenre_proba = subgenre_classifier.predict_proba(X)[0]
            genre_proba = genre_classifier.predict_proba(X)[0]

            subgenre_conf = np.max(subgenre_proba)
            genre_conf = np.max(genre_proba)

            print(f"   {i}. {file_path.name}")
            print(f"      Subgenre: {subgenre_pred} (confidence: {subgenre_conf:.3f})")
            print(f"      Genre: {genre_pred} (confidence: {genre_conf:.3f})")

            results.append(
                {
                    "file": file_path.name,
                    "subgenre_pred": subgenre_pred,
                    "genre_pred": genre_pred,
                    "subgenre_conf": subgenre_conf,
                    "genre_conf": genre_conf,
                }
            )

        except Exception as e:
            print(f"   {i}. ❌ Error processing {file_path.name}: {e}")

    if not results:
        print("❌ No files processed successfully")
        return False

    # Summary
    print(f"\n📊 Results Summary:")
    print(f"   - Files processed: {len(results)}")
    print(
        f"   - Average subgenre confidence: {np.mean([r['subgenre_conf'] for r in results]):.3f}"
    )
    print(
        f"   - Average genre confidence: {np.mean([r['genre_conf'] for r in results]):.3f}"
    )

    # Genre distribution
    genre_counts = {}
    subgenre_counts = {}

    for result in results:
        genre = result["genre_pred"]
        subgenre = result["subgenre_pred"]

        genre_counts[genre] = genre_counts.get(genre, 0) + 1
        subgenre_counts[subgenre] = subgenre_counts.get(subgenre, 0) + 1

    print(f"\n📈 Genre Distribution:")
    for genre, count in genre_counts.items():
        percentage = (count / len(results)) * 100
        print(f"   {genre}: {count} files ({percentage:.1f}%)")

    print(f"\n🎶 Subgenre Distribution:")
    for subgenre, count in subgenre_counts.items():
        percentage = (count / len(results)) * 100
        print(f"   {subgenre}: {count} files ({percentage:.1f}%)")

    print(f"\n✅ SUCCESS: Both models work on personal music files!")
    print(f"   - Subgenre model: {len(subgenre_classifier.classes_)} classes")
    print(f"   - Genre model: {len(genre_classifier.classes_)} classes")
    print(f"   - Both models successfully processed personal music")

    return True


if __name__ == "__main__":
    success = validate_personal_models()
    sys.exit(0 if success else 1)
