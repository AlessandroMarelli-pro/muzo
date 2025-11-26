#!/usr/bin/env python3
"""
Example CNN Training Script

This script demonstrates how to use the CNN-based music classification system.
It shows how to train both CNN and hybrid CNN-RNN models on your music dataset.
"""

import glob
import os
import sys
from pathlib import Path

# Add src directory to path
sys.path.append(str(Path(__file__).parent / "src"))

from cnn_model_training import CNNMusicClassifier, train_cnn_music_model


def collect_audio_files(dataset_path: str):
    """
    Collect audio files from dataset directory.

    Args:
        dataset_path: Path to dataset with genre subdirectories

    Returns:
        Tuple of (audio_files, labels)
    """
    audio_files = []
    labels = []

    # Supported audio formats
    audio_extensions = ["*.wav", "*.mp3", "*.flac", "*.m4a"]

    for genre_dir in os.listdir(dataset_path):
        genre_path = os.path.join(dataset_path, genre_dir)
        if os.path.isdir(genre_path):
            genre_files = []
            for ext in audio_extensions:
                genre_files.extend(glob.glob(os.path.join(genre_path, ext)))

            audio_files.extend(genre_files)
            labels.extend([genre_dir] * len(genre_files))

    return audio_files, labels


def train_cnn_example():
    """Train a standard CNN model."""
    print("=" * 60)
    print("TRAINING CNN MODEL")
    print("=" * 60)

    # Dataset path (adjust to your dataset)
    dataset_path = "training_data"  # Your dataset directory

    if not os.path.exists(dataset_path):
        print(f"❌ Dataset path not found: {dataset_path}")
        print("Please create a dataset directory with genre subdirectories.")
        return

    # Collect audio files
    audio_files, labels = collect_audio_files(dataset_path)

    if len(audio_files) == 0:
        print("❌ No audio files found in dataset.")
        return

    print(f"✅ Found {len(audio_files)} audio files")
    print(f"🎵 Genres: {set(labels)}")

    # Train CNN model
    results = train_cnn_music_model(
        audio_files=audio_files,
        labels=labels,
        output_dir="models",
        model_name="cnn-example-v1.0",
        architecture="cnn",
        num_epochs=20,  # Reduced for example
        learning_rate=0.001,
        validation_split=0.2,
    )

    print("\n=== CNN Training Results ===")
    print(f"Final validation accuracy: {results['final_val_acc']:.2f}%")
    print(f"Training time: {results['training_time']:.1f} seconds")


def train_hybrid_example():
    """Train a hybrid CNN-RNN model."""
    print("=" * 60)
    print("TRAINING HYBRID CNN-RNN MODEL")
    print("=" * 60)

    # Dataset path (adjust to your dataset)
    dataset_path = "training_data"

    if not os.path.exists(dataset_path):
        print(f"❌ Dataset path not found: {dataset_path}")
        return

    # Collect audio files
    audio_files, labels = collect_audio_files(dataset_path)

    if len(audio_files) == 0:
        print("❌ No audio files found in dataset.")
        return

    print(f"✅ Found {len(audio_files)} audio files")
    print(f"🎵 Genres: {set(labels)}")

    # Train hybrid model
    results = train_cnn_music_model(
        audio_files=audio_files,
        labels=labels,
        output_dir="models",
        model_name="hybrid-example-v1.0",
        architecture="hybrid",  # Use hybrid CNN-RNN
        num_epochs=20,
        learning_rate=0.001,
        validation_split=0.2,
    )

    print("\n=== Hybrid Training Results ===")
    print(f"Final validation accuracy: {results['final_val_acc']:.2f}%")
    print(f"Training time: {results['training_time']:.1f} seconds")


def predict_example():
    """Example of using trained model for prediction."""
    print("=" * 60)
    print("CNN PREDICTION EXAMPLE")
    print("=" * 60)

    # Load trained model
    model_path = "models/cnn-example-v1.0.pth"

    if not os.path.exists(model_path):
        print(f"❌ Model not found: {model_path}")
        print("Please train a model first using train_cnn_example()")
        return

    # Initialize classifier and load model
    classifier = CNNMusicClassifier()
    classifier.load_model(model_path)

    print(f"✅ Loaded model: {classifier.model_name}")
    print(f"🎵 Classes: {classifier.genre_classes}")

    # Find some test audio files
    test_files = []
    for ext in ["*.wav", "*.mp3", "*.flac"]:
        test_files.extend(glob.glob(f"training_data/*/{ext}"))

    if len(test_files) == 0:
        print("❌ No test audio files found.")
        return

    # Test on first few files
    test_files = test_files[:3]  # Test on 3 files

    print(f"\n🔍 Testing on {len(test_files)} files:")

    for test_file in test_files:
        print(f"\n📁 File: {os.path.basename(test_file)}")

        try:
            # Predict
            result = classifier.predict(test_file)
            prediction = result["predictions"]

            print(f"🎯 Predicted genre: {prediction['predicted_genre']}")
            print(f"🎯 Confidence: {prediction['confidence']:.3f}")

            # Show top 3 predictions
            probs = prediction["all_probabilities"]
            top_3 = sorted(probs.items(), key=lambda x: x[1], reverse=True)[:3]

            print("📊 Top 3 predictions:")
            for genre, prob in top_3:
                print(f"   {genre}: {prob:.3f}")

        except Exception as e:
            print(f"❌ Error: {str(e)}")


def compare_models():
    """Compare CNN vs Random Forest performance."""
    print("=" * 60)
    print("MODEL COMPARISON: CNN vs RANDOM FOREST")
    print("=" * 60)

    print("CNN Model Advantages:")
    print("✅ Learns features automatically from raw audio")
    print("✅ Better at capturing temporal patterns")
    print("✅ Can handle complex audio relationships")
    print("✅ Scalable with more data")
    print("✅ GPU acceleration support")

    print("\nRandom Forest Advantages:")
    print("✅ Works well with small datasets (< 1000 samples)")
    print("✅ Fast training and prediction")
    print("✅ Interpretable feature importance")
    print("✅ No need for GPU")
    print("✅ Less prone to overfitting with limited data")

    print("\nRecommendations:")
    print("📊 Dataset size < 1,000 samples: Use Random Forest")
    print("📊 Dataset size > 5,000 samples: Use CNN")
    print("📊 Need interpretability: Use Random Forest")
    print("📊 Have GPU and time: Use CNN")
    print("📊 Best of both: Use ensemble of both models")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="CNN Music Classification Examples")
    parser.add_argument(
        "action",
        choices=["train-cnn", "train-hybrid", "predict", "compare"],
        help="Action to perform",
    )

    args = parser.parse_args()

    try:
        if args.action == "train-cnn":
            train_cnn_example()
        elif args.action == "train-hybrid":
            train_hybrid_example()
        elif args.action == "predict":
            predict_example()
        elif args.action == "compare":
            compare_models()

    except KeyboardInterrupt:
        print("\n⚠️  Training interrupted by user")
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback

        traceback.print_exc()
