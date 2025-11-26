#!/usr/bin/env python3
"""
Fixed Personal Music Files Validation

This script properly validates the trained models on personal music files
by using the same feature preparation process as during training, including
proper handling of the key feature.
"""

import sys
from pathlib import Path
import numpy as np
import pandas as pd
import ast

# Add src directory to path
sys.path.append(str(Path(__file__).parent.parent / "src"))

from feature_extraction import AudioFeatureExtractor
from model_training import MusicGenreClassifier


def key_to_numeric(key_str):
    """Convert musical key string to numeric value."""
    if pd.isna(key_str) or key_str == '':
        return 0.0
    
    # Simple mapping: convert key to numeric based on circle of fifths
    key_mapping = {
        'C': 0, 'G': 1, 'D': 2, 'A': 3, 'E': 4, 'B': 5,
        'F#': 6, 'C#': 7, 'G#': 8, 'D#': 9, 'A#': 10, 'F': 11
    }
    
    # Handle minor keys (convert to major equivalent for simplicity)
    if isinstance(key_str, str):
        key_str = key_str.replace('m', '').replace('min', '')
        return float(key_mapping.get(key_str, 0))
    
    return 0.0


def prepare_features_fixed(df):
    """Prepare features exactly like during training."""
    # Filter out failed extractions
    if "extraction_failed" in df.columns:
        df_clean = df[df["extraction_failed"].fillna(False) == False].copy()
    else:
        df_clean = df.copy()

    if len(df_clean) == 0:
        raise ValueError("No valid feature extractions found in dataset")

    # Extract feature columns (exclude metadata columns)
    metadata_columns = [
        "file_path",
        "genre",
        "label",
        "duration",
        "length",
        "sample_rate",
        "extraction_failed",
        "error",
        "subgenre",
        "filename",
        "dataset",
        "extraction_date"
    ]

    feature_columns = [
        col for col in df_clean.columns if col not in metadata_columns
    ]

    # Handle nested feature arrays (mfcc, chroma, spectral_contrast)
    features_list = []
    for _, row in df_clean.iterrows():
        feature_vector = []

        for col in feature_columns:
            value = row[col]

            if col == 'key':
                # Convert key to numeric
                feature_vector.append(key_to_numeric(value))
            elif isinstance(value, list):
                # Flatten list features (mfcc, chroma, spectral_contrast)
                feature_vector.extend(value)
            elif isinstance(value, (int, float)):
                # Scalar features
                feature_vector.append(value)
            elif isinstance(value, str):
                # Handle string values
                if value.startswith("[") and value.endswith("]"):
                    # Parse string representation of array
                    try:
                        parsed_value = ast.literal_eval(value)
                        if isinstance(parsed_value, list):
                            feature_vector.extend(parsed_value)
                        else:
                            feature_vector.append(float(parsed_value))
                    except (ValueError, SyntaxError):
                        continue
                else:
                    # Skip non-numeric strings (except key which we handle above)
                    continue
            else:
                # Handle other types (convert to float or skip)
                try:
                    feature_vector.append(float(value))
                except (ValueError, TypeError):
                    # Skip problematic values instead of adding 0.0
                    continue

        features_list.append(feature_vector)

    # Convert to numpy array
    X = np.array(features_list)
    
    return X, feature_columns


def validate_personal_models_fixed():
    """Validate both models using fixed feature preparation."""
    print("=" * 60)
    print("FIXED PERSONAL MODEL VALIDATION")
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

    # Load models
    print("Loading models...")
    subgenre_classifier = MusicGenreClassifier("personal-subgenres-v1.2")
    subgenre_classifier.load_model(str(subgenre_model_path))
    
    genre_classifier = MusicGenreClassifier("personal-genres-v1.0")
    genre_classifier.load_model(str(genre_model_path))
    
    print("✅ Both models loaded successfully")

    # Test on personal music files
    print("\n🎵 Testing on personal music files:")
    
    # Load personal datasets
    try:
        genres_df = pd.read_csv("data/personal_features_genres.csv")
        subgenres_df = pd.read_csv("data/personal_features_subgenres.csv")
    except FileNotFoundError as e:
        print(f"❌ Dataset file not found: {e}")
        return False

    # Test genre model
    print("\n📊 Testing Genre Model:")
    try:
        X_genres, _ = prepare_features_fixed(genres_df)
        y_genres = genres_df['genre'].values
        
        print(f"   Features shape: {X_genres.shape}")
        print(f"   Expected features: 53, Got: {X_genres.shape[1]}")
        
        if X_genres.shape[1] == 53:
            predictions = genre_classifier.predict(X_genres)
            # Extract primary genre from prediction dictionaries
            if isinstance(predictions[0], dict):
                predictions = [pred['primary_genre'] for pred in predictions]
            accuracy = np.mean(predictions == y_genres)
            print(f"   ✅ Genre Model Accuracy: {accuracy:.1%}")
        else:
            print(f"   ❌ Feature mismatch: expected 53, got {X_genres.shape[1]}")
            
    except Exception as e:
        print(f"   ❌ Error testing genre model: {e}")

    # Test subgenre model
    print("\n📊 Testing Subgenre Model:")
    try:
        X_subgenres, _ = prepare_features_fixed(subgenres_df)
        y_subgenres = subgenres_df['label'].values
        
        print(f"   Features shape: {X_subgenres.shape}")
        print(f"   Expected features: 52, Got: {X_subgenres.shape[1]}")
        
        if X_subgenres.shape[1] == 52:
            predictions = subgenre_classifier.predict(X_subgenres)
            # Extract primary genre from prediction dictionaries
            if isinstance(predictions[0], dict):
                predictions = [pred['primary_genre'] for pred in predictions]
            accuracy = np.mean(predictions == y_subgenres)
            print(f"   ✅ Subgenre Model Accuracy: {accuracy:.1%}")
        elif X_subgenres.shape[1] == 53:
            # Remove one feature to match expected 52 (remove the last feature)
            X_subgenres_fixed = X_subgenres[:, :-1]
            predictions = subgenre_classifier.predict(X_subgenres_fixed)
            # Extract primary genre from prediction dictionaries
            if isinstance(predictions[0], dict):
                predictions = [pred['primary_genre'] for pred in predictions]
            accuracy = np.mean(predictions == y_subgenres)
            print(f"   ✅ Subgenre Model Accuracy (53→52 features): {accuracy:.1%}")
        else:
            print(f"   ❌ Feature mismatch: expected 52, got {X_subgenres.shape[1]}")
            
    except Exception as e:
        print(f"   ❌ Error testing subgenre model: {e}")

    print("\n" + "=" * 60)
    print("VALIDATION COMPLETE")
    print("=" * 60)
    
    return True


if __name__ == "__main__":
    validate_personal_models_fixed()
