#!/usr/bin/env python3
"""
Simple Personal Model Validation

Test both subgenre and genre models using the existing personal dataset.
"""

import sys
from pathlib import Path

import numpy as np
import pandas as pd

# Add src directory to path
sys.path.append(str(Path(__file__).parent.parent / "src"))

from model_training import MusicGenreClassifier


def validate_personal_models_simple():
    """Validate both models using the personal dataset."""
    print("=" * 60)
    print("SIMPLE PERSONAL MODEL VALIDATION")
    print("=" * 60)

    # Model paths
    subgenre_model_path = Path("models/personal-subgenres-v1.2.pkl")
    genre_model_path = Path("models/personal-genres-v1.0.pkl")

    # Dataset paths
    subgenre_dataset_path = Path("data/personal_features_subgenres.csv")
    genre_dataset_path = Path("data/personal_features_genres.csv")

    # Check if files exist
    if not subgenre_model_path.exists():
        print(f"❌ Subgenre model not found: {subgenre_model_path}")
        return False

    if not genre_model_path.exists():
        print(f"❌ Genre model not found: {genre_model_path}")
        return False

    if not subgenre_dataset_path.exists():
        print(f"❌ Subgenre dataset not found: {subgenre_dataset_path}")
        return False

    if not genre_dataset_path.exists():
        print(f"❌ Genre dataset not found: {genre_dataset_path}")
        return False

    print(f"✅ All files found")

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

    # Load datasets
    try:
        subgenre_df = pd.read_csv(subgenre_dataset_path)
        genre_df = pd.read_csv(genre_dataset_path)
        print(
            f"✅ Datasets loaded: {len(subgenre_df)} subgenre samples, {len(genre_df)} genre samples"
        )
    except Exception as e:
        print(f"❌ Error loading datasets: {e}")
        return False

    # Test subgenre model
    print(f"\n🎶 Testing Subgenre Model:")
    try:
        X_subgenre, y_subgenre = subgenre_classifier.prepare_features(subgenre_df)
        subgenre_pred = subgenre_classifier.predict(X_subgenre)
        subgenre_accuracy = np.mean(subgenre_pred == y_subgenre)

        print(f"   - Classes: {len(subgenre_classifier.classes_)}")
        print(f"   - Features: {X_subgenre.shape[1]}")
        print(f"   - Samples: {X_subgenre.shape[0]}")
        print(f"   - Accuracy: {subgenre_accuracy:.3f}")

        # Show class distribution
        unique, counts = np.unique(y_subgenre, return_counts=True)
        print(f"   - Class distribution:")
        for cls, count in zip(unique, counts):
            percentage = (count / len(y_subgenre)) * 100
            print(f"     {cls}: {count} samples ({percentage:.1f}%)")

    except Exception as e:
        print(f"   ❌ Error testing subgenre model: {e}")
        return False

    # Test genre model
    print(f"\n🎵 Testing Genre Model:")
    try:
        X_genre, y_genre = genre_classifier.prepare_features(genre_df)
        genre_pred = genre_classifier.predict(X_genre)
        genre_accuracy = np.mean(genre_pred == y_genre)

        print(f"   - Classes: {len(genre_classifier.classes_)}")
        print(f"   - Features: {X_genre.shape[1]}")
        print(f"   - Samples: {X_genre.shape[0]}")
        print(f"   - Accuracy: {genre_accuracy:.3f}")

        # Show class distribution
        unique, counts = np.unique(y_genre, return_counts=True)
        print(f"   - Class distribution:")
        for cls, count in zip(unique, counts):
            percentage = (count / len(y_genre)) * 100
            print(f"     {cls}: {count} samples ({percentage:.1f}%)")

    except Exception as e:
        print(f"   ❌ Error testing genre model: {e}")
        return False

    # Summary
    print(f"\n📊 Summary:")
    print(
        f"   - Subgenre model: {subgenre_accuracy:.1%} accuracy on {len(subgenre_classifier.classes_)} classes"
    )
    print(
        f"   - Genre model: {genre_accuracy:.1%} accuracy on {len(genre_classifier.classes_)} classes"
    )

    if subgenre_accuracy > 0.4 and genre_accuracy > 0.5:
        print(f"\n✅ SUCCESS: Both models are working!")
        print(
            f"   - Subgenre classification: {len(subgenre_classifier.classes_)} classes"
        )
        print(f"   - Genre classification: {len(genre_classifier.classes_)} classes")
        print(f"   - Both models trained on personal music data")
        return True
    else:
        print(f"\n⚠️  Models need improvement:")
        print(f"   - Subgenre accuracy: {subgenre_accuracy:.1%} (target: >40%)")
        print(f"   - Genre accuracy: {genre_accuracy:.1%} (target: >50%)")
        return False


if __name__ == "__main__":
    success = validate_personal_models_simple()
    sys.exit(0 if success else 1)
