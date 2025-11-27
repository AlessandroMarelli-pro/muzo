#!/usr/bin/env python3
"""
Test UB40 song with the personal subgenres model
"""

import json
import sys
from pathlib import Path

import numpy as np

# Add src directory to path for imports
sys.path.append(str(Path(__file__).parent / "src"))

from feature_extraction import AudioFeatureExtractor
from model_training import MusicGenreClassifier


def test_ub40_with_personal_subgenres_model():
    """Test UB40 song with the personal subgenres model."""

    print("=" * 60)
    print("TESTING UB40 SONG WITH GTZAN FORMAT MODEL")
    print("=" * 60)

    # Song path
    song_path = "/Users/alessandro/Music/tidal/Tracks/UB40 - Kingston Town.flac"

    if not Path(song_path).exists():
        print(f"❌ Song file not found: {song_path}")
        return False

    # Load the GTZAN format model
    model_path = "models/personal-subgenres-gtzan-v1.0.pkl"

    if not Path(model_path).exists():
        print(f"❌ Model file not found: {model_path}")
        return False

    print(f"✅ Loading GTZAN format model from: {model_path}")
    classifier = MusicGenreClassifier()
    classifier.load_model(model_path)

    # Get model info
    model_info = classifier.get_model_info()
    print(f"📊 Model Info:")
    print(f"   - Model name: {model_info['model_name']}")
    print(f"   - Number of classes: {model_info['n_classes']}")
    print(f"   - Number of features: {model_info['n_features']}")
    print(f"   - Classes: {model_info['classes']}")

    # Extract features from the song
    print(f"\n🎵 Extracting features from: {Path(song_path).name}")
    feature_extractor = AudioFeatureExtractor()

    try:
        features = feature_extractor.extract_all_features(song_path)
        print(f"✅ Features extracted successfully")

        # Convert to GTZAN format
        gtzan_features = convert_to_gtzan_format(features)
        print(f"✅ Converted to GTZAN format: {len(gtzan_features)} features")

        # Make prediction
        print(f"\n🔮 Making prediction...")
        result = classifier.predict([gtzan_features])

        # Prepare JSON output
        output = {
            "song_info": {
                "filename": Path(song_path).name,
                "file_path": song_path,
                "duration": features["duration"],
                "sample_rate": features["sample_rate"],
                "tempo": features["tempo"],
                "key": features["key"],
                "energy": features["energy"],
                "valence": features["valence"],
                "danceability": features["danceability"],
            },
            "feature_extraction": {
                "gtzan_features_extracted": len(gtzan_features),
                "feature_format": "GTZAN compatible",
            },
            "classification": {
                "model_name": model_info["model_name"],
                "model_file": model_path,
                "predicted_subgenre": result["primary_genre"],
                "confidence": result["confidence"],
                "alternatives": result["alternative_genres"],
                "all_probabilities": result["all_probabilities"],
            },
            "success": True,
            "timestamp": "2025-09-20T09:30:00",
        }

        # Print results
        print(f"\n🎯 Classification Results:")
        print(f"   - Predicted subgenre: {result['primary_genre']}")
        print(
            f"   - Confidence: {result['confidence']:.4f} ({result['confidence'] * 100:.2f}%)"
        )
        print(f"   - Top alternatives:")
        for alt in result["alternative_genres"][:3]:
            print(
                f"     • {alt['genre']}: {alt['confidence']:.4f} ({alt['confidence'] * 100:.2f}%)"
            )

        # Save JSON output
        output_file = "ub40_gtzan_classification.json"
        with open(output_file, "w") as f:
            json.dump(output, f, indent=2)

        print(f"\n💾 Results saved to: {output_file}")

        return True

    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return False


def convert_to_gtzan_format(features):
    """Convert personal format features to GTZAN format."""

    gtzan_features = []

    # Basic info
    gtzan_features.append(features["length"])  # length

    # Chroma features (convert from array to mean/var)
    chroma_array = np.array(features["chroma"])
    gtzan_features.append(float(np.mean(chroma_array)))  # chroma_stft_mean
    gtzan_features.append(float(np.var(chroma_array)))  # chroma_stft_var

    # RMS features (convert from energy)
    gtzan_features.append(features["energy"])  # rms_mean
    gtzan_features.append(0.0)  # rms_var (we don't have variance)

    # Spectral features
    gtzan_features.append(features["spectral_centroid"])  # spectral_centroid_mean
    gtzan_features.append(0.0)  # spectral_centroid_var (we don't have variance)

    # Spectral bandwidth (we don't have this, use 0)
    gtzan_features.append(0.0)  # spectral_bandwidth_mean
    gtzan_features.append(0.0)  # spectral_bandwidth_var

    # Rolloff
    gtzan_features.append(features["spectral_rolloff"])  # rolloff_mean
    gtzan_features.append(0.0)  # rolloff_var (we don't have variance)

    # Zero crossing rate
    gtzan_features.append(features["zero_crossing_rate"])  # zero_crossing_rate_mean
    gtzan_features.append(0.0)  # zero_crossing_rate_var (we don't have variance)

    # Harmony and perceptr (we don't have these, use 0)
    gtzan_features.append(0.0)  # harmony_mean
    gtzan_features.append(0.0)  # harmony_var
    gtzan_features.append(0.0)  # perceptr_mean
    gtzan_features.append(0.0)  # perceptr_var

    # Tempo
    gtzan_features.append(features["tempo"])  # tempo

    # MFCC features (convert from array to individual mean/var)
    mfcc_array = np.array(features["mfcc"])
    # GTZAN uses 20 MFCC coefficients, we have 26, so we'll use first 20
    for i in range(1, 21):  # mfcc1 to mfcc20
        if i <= len(mfcc_array):
            gtzan_features.append(float(mfcc_array[i - 1]))  # mfcc{i}_mean
            gtzan_features.append(0.0)  # mfcc{i}_var (we don't have variance)
        else:
            gtzan_features.append(0.0)  # mfcc{i}_mean
            gtzan_features.append(0.0)  # mfcc{i}_var

    return gtzan_features


if __name__ == "__main__":
    success = test_ub40_with_personal_subgenres_model()
    sys.exit(0 if success else 1)
