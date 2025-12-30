"""
CNN-Based Subgenre Classification Module (Per-Genre Specialists)

This module implements specialized CNN models for subgenre classification within specific genres.
Each model is trained on subgenres of a single parent genre, creating focused specialists.
Designed to work as the second stage of a hierarchical classification system.

Architecture: Genre Classifier → Subgenre Specialists
- Step 1: Use main CNN to predict genre (Alternative, Dance_EDM, etc.)
- Step 2: Use genre-specific subgenre model for fine-grained classification

Based on the proven cnn_model_training.py architecture with 82.38% genre accuracy.
Optimized for deployment with the Muzo AI service.
"""

import json
import logging
import os
import time
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Union

import joblib
import librosa
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

# Import all the proven components from the main CNN module
from cnn_model_training import (
    # PyTorch availability
    TORCH_AVAILABLE,
    # Core classes
    AudioSpectrogramDataset,
    CNNMusicClassifier,
    HybridCNNRNN,
    SpectrogramCNN,
    build_genre_mapping_from_dataset,
    create_balanced_audio_segments,
    # Utility functions
    process_segmentation_task,
)
from tqdm import tqdm

# Deep learning imports (reuse from main module)
if TORCH_AVAILABLE:
    import torch
    import torch.nn as nn
    import torch.nn.functional as F
    import torch.optim as optim
    from torch.cuda.amp import GradScaler, autocast
    from torch.utils.data import DataLoader, Dataset, random_split

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class SubgenreSpecialistTrainer:
    """
    Trains specialized CNN models for subgenre classification within a specific genre.
    Each instance handles one genre and its subgenres.
    """

    def __init__(
        self,
        target_genre: str,
        model_name_prefix: str = "subgenre-specialist",
        architecture: str = "hybrid",
        sample_rate: int = 22050,
        duration: float = 30.0,
        n_mels: int = 128,
        device: str = "auto",
        random_state: int = 42,
        batch_size: int = 32,
    ):
        """
        Initialize subgenre specialist trainer.

        Args:
            target_genre: The specific genre this model will specialize in
            model_name_prefix: Prefix for model naming
            architecture: Model architecture ("cnn" or "hybrid")
            sample_rate: Audio sample rate
            duration: Duration of audio segments
            n_mels: Number of mel bands
            device: Device to use ("cpu", "cuda", or "auto")
            random_state: Random state for reproducibility
            batch_size: Batch size for training
        """
        self.target_genre = target_genre
        self.model_name_prefix = model_name_prefix
        self.architecture = architecture
        self.sample_rate = sample_rate
        self.duration = duration
        self.n_mels = n_mels
        self.random_state = random_state
        self.batch_size = batch_size

        # Set device
        if device == "auto":
            self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        else:
            self.device = torch.device(device)

        logger.info(f"🎵 Initializing Subgenre Specialist for: {target_genre}")
        logger.info(f"🔧 Architecture: {architecture}")
        logger.info(f"💻 Device: {self.device}")

        # Model components
        self.classifier = None
        self.subgenre_classes = None
        self.is_trained = False

        # Training metadata
        self.training_results = None
        self.model_path = None

    def filter_dataset_by_genre(
        self,
        dataset_path: str,
        audio_files: List[str] = None,
        labels: List[Dict] = None,
    ) -> Tuple[List[str], List[str]]:
        """
        Filter dataset to only include samples from the target genre.

        Args:
            dataset_path: Path to hierarchical dataset
            audio_files: Optional pre-loaded audio files
            labels: Optional pre-loaded labels

        Returns:
            Tuple of (filtered_audio_files, filtered_subgenre_labels)
        """
        logger.info(f"🔍 Filtering dataset for genre: {self.target_genre}")

        if audio_files is None or labels is None:
            # Scan dataset to find files
            audio_files = []
            labels = []

            dataset_path = Path(dataset_path)
            target_genre_path = dataset_path / self.target_genre

            if not target_genre_path.exists():
                raise ValueError(f"Genre directory not found: {target_genre_path}")

            # Scan subgenre directories within target genre
            for subgenre_dir in target_genre_path.iterdir():
                if not subgenre_dir.is_dir():
                    continue

                subgenre_name = subgenre_dir.name
                subgenre_files = (
                    list(subgenre_dir.glob("*.flac"))
                    + list(subgenre_dir.glob("*.mp3"))
                    + list(subgenre_dir.glob("*.wav"))
                    + list(subgenre_dir.glob("*.opus"))
                )

                logger.info(f"  📂 {subgenre_name}: {len(subgenre_files)} files")

                for audio_file in subgenre_files:
                    audio_files.append(str(audio_file))
                    labels.append(
                        {
                            "genre": self.target_genre,
                            "subgenre": subgenre_name,
                            "label": subgenre_name,
                        }
                    )

        # Filter existing dataset for target genre
        filtered_files = []
        filtered_labels = []

        for audio_file, label_info in zip(audio_files, labels):
            # Handle both dict and string labels
            if isinstance(label_info, dict):
                genre = label_info.get("genre", "")
                subgenre = label_info.get("subgenre", label_info.get("label", ""))
            else:
                # If string label, assume it's a subgenre and map to genre
                genre_mapping = build_genre_mapping_from_dataset(
                    str(Path(dataset_path).parent)
                )
                subgenre = label_info
                genre = genre_mapping.get(subgenre, "")

            if genre == self.target_genre:
                filtered_files.append(audio_file)
                filtered_labels.append(subgenre)

        # Get unique subgenres
        unique_subgenres = sorted(list(set(filtered_labels)))

        logger.info(f"✅ Filtered dataset for {self.target_genre}:")
        logger.info(f"   📊 Total samples: {len(filtered_files)}")
        logger.info(f"   🎵 Subgenres: {len(unique_subgenres)}")
        logger.info(f"   📝 Subgenres: {', '.join(unique_subgenres)}")

        # Check if we have enough subgenres for meaningful classification
        if len(unique_subgenres) < 2:
            raise ValueError(
                f"Not enough subgenres for {self.target_genre}. Found: {unique_subgenres}"
            )

        return filtered_files, filtered_labels

    def train_subgenre_specialist(
        self,
        dataset_path: str,
        output_dir: str = "models/subgenre_specialists",
        target_samples_per_subgenre: int = 500,
        segment_duration: float = 30.0,
        num_epochs: int = 50,
        learning_rate: float = 0.001,
        validation_split: float = 0.2,
        max_workers: int = None,
        use_preprocessing: bool = True,
    ) -> Dict:
        """
        Train a specialized CNN model for subgenres within the target genre.

        Args:
            dataset_path: Path to hierarchical music dataset
            output_dir: Directory to save the trained specialist model
            target_samples_per_subgenre: Target samples per subgenre for balancing
            segment_duration: Duration of audio segments
            num_epochs: Number of training epochs
            learning_rate: Learning rate for training
            validation_split: Fraction for validation
            max_workers: Number of parallel workers
            use_preprocessing: Whether to use balanced segmentation preprocessing

        Returns:
            Dictionary with training results
        """
        logger.info(f"🚀 Training Subgenre Specialist: {self.target_genre}")
        logger.info(f"📊 Target samples per subgenre: {target_samples_per_subgenre}")
        logger.info(f"⏱️ Segment duration: {segment_duration}s")

        start_time = time.time()

        # Create output directory for this genre specialist
        genre_output_dir = Path(output_dir) / self.target_genre
        genre_output_dir.mkdir(parents=True, exist_ok=True)

        if use_preprocessing:
            # Step 1: Create balanced segments for this genre only
            logger.info(
                f"📊 Step 1: Creating balanced segments for {self.target_genre}..."
            )

            # Create a temporary dataset path containing only target genre
            temp_dataset_path = Path(dataset_path) / self.target_genre
            if not temp_dataset_path.exists():
                raise ValueError(f"Genre directory not found: {temp_dataset_path}")

            segments_dir = genre_output_dir / "segments"

            # Calculate total target samples (distributed across subgenres)
            # First, count subgenres to determine distribution
            subgenre_count = len([d for d in temp_dataset_path.iterdir() if d.is_dir()])
            total_target_samples = target_samples_per_subgenre * subgenre_count

            logger.info(f"🎯 Found {subgenre_count} subgenres in {self.target_genre}")
            logger.info(f"📈 Total target samples: {total_target_samples}")

            # Use the proven balanced segmentation but treat each subgenre as a "genre"
            # Note: We need to ensure exact balancing for subgenres
            audio_files, labels = create_balanced_audio_segments(
                dataset_path=str(temp_dataset_path),
                output_dir=str(segments_dir),
                target_samples_per_genre=target_samples_per_subgenre,  # Per subgenre
                segment_duration=segment_duration,
                max_workers=max_workers,
                genre_only=False,  # We want subgenre-level detail
            )

            # Enforce exact target balancing for subgenres (same logic as genre-only mode)
            logger.info(
                f"🎯 Enforcing exact target balance: {target_samples_per_subgenre} samples per subgenre"
            )

            # Group by subgenre
            subgenre_segments = {}
            for file_path, label in zip(audio_files, labels):
                if label not in subgenre_segments:
                    subgenre_segments[label] = []
                subgenre_segments[label].append(file_path)

            # Balance to exact target
            balanced_files = []
            balanced_labels = []

            for subgenre, segments in subgenre_segments.items():
                if len(segments) >= target_samples_per_subgenre:
                    # Take exactly target_samples_per_subgenre segments
                    selected_segments = segments[:target_samples_per_subgenre]
                else:
                    # Duplicate segments to reach target (with cycling)
                    selected_segments = []
                    while len(selected_segments) < target_samples_per_subgenre:
                        remaining = target_samples_per_subgenre - len(selected_segments)
                        to_add = min(remaining, len(segments))
                        selected_segments.extend(segments[:to_add])

                balanced_files.extend(selected_segments)
                balanced_labels.extend([subgenre] * len(selected_segments))

                logger.info(
                    f"  🎵 {subgenre}: {len(segments)} → {len(selected_segments)} samples"
                )

            audio_files = balanced_files
            labels = balanced_labels

            # Verify exact balance
            from collections import Counter

            label_counts = Counter(labels)
            logger.info(f"📊 Final distribution verification:")
            for label, count in sorted(label_counts.items()):
                logger.info(f"  🎵 {label}: {count} samples")

            # Check if all subgenres have exactly the target count
            all_balanced = all(
                count == target_samples_per_subgenre for count in label_counts.values()
            )
            if all_balanced:
                logger.info(
                    f"✅ Perfect balance achieved: {target_samples_per_subgenre} samples per subgenre"
                )
            else:
                logger.warning(
                    f"⚠️ Balance verification failed - some subgenres don't have exactly {target_samples_per_subgenre} samples"
                )

            preprocessing_time = time.time() - start_time
            logger.info(f"✅ Preprocessing completed in {preprocessing_time:.1f}s")

        else:
            # Use existing files without preprocessing
            logger.info(f"📁 Using existing files for {self.target_genre}...")
            audio_files, labels = self.filter_dataset_by_genre(dataset_path)
            preprocessing_time = 0

        # Step 2: Train the specialist CNN model
        logger.info(f"🧠 Step 2: Training CNN specialist for {self.target_genre}...")

        model_name = f"{self.model_name_prefix}-{self.target_genre.lower()}-v1.0"

        # Initialize the CNN classifier (reuse proven architecture)
        self.classifier = CNNMusicClassifier(
            model_name=model_name,
            architecture=self.architecture,
            sample_rate=self.sample_rate,
            duration=self.duration,
            n_mels=self.n_mels,
            device=str(self.device),
            random_state=self.random_state,
            batch_size=self.batch_size,
        )

        training_start = time.time()

        # Train the model on subgenres
        training_results = self.classifier.train(
            audio_files=audio_files,
            labels=labels,  # Subgenre labels
            num_epochs=num_epochs,
            learning_rate=learning_rate,
            validation_split=validation_split,
        )

        training_time = time.time() - training_start
        total_time = time.time() - start_time

        # Step 3: Save the specialist model
        model_filename = f"{model_name}.pth"
        model_path = genre_output_dir / model_filename
        self.classifier.save_model(str(model_path))
        self.model_path = str(model_path)

        # Save training results with metadata
        results = {
            "specialist_info": {
                "target_genre": self.target_genre,
                "model_name": model_name,
                "architecture": self.architecture,
                "model_path": str(model_path),
                "subgenre_classes": self.classifier.genre_classes,  # Actually subgenre classes
                "num_subgenres": len(self.classifier.genre_classes),
            },
            "training_results": training_results,
            "timing": {
                "preprocessing_time": preprocessing_time,
                "training_time": training_time,
                "total_time": total_time,
            },
            "dataset_info": {
                "total_samples": len(audio_files),
                "target_samples_per_subgenre": target_samples_per_subgenre,
                "segment_duration": segment_duration,
                "use_preprocessing": use_preprocessing,
            },
        }

        # Save results to JSON
        results_path = genre_output_dir / f"{model_name}_results.json"
        with open(results_path, "w") as f:
            json.dump(results, f, indent=2, default=str)

        self.training_results = results
        self.subgenre_classes = self.classifier.genre_classes
        self.is_trained = True

        # Log success
        final_acc = training_results["final_val_acc"]
        logger.info(f"✅ Subgenre Specialist Training Complete!")
        logger.info(f"🎯 Genre: {self.target_genre}")
        logger.info(f"🎵 Subgenres: {len(self.subgenre_classes)}")
        logger.info(f"📈 Final Validation Accuracy: {final_acc:.2f}%")
        logger.info(f"💾 Model saved: {model_path}")
        logger.info(f"📊 Results saved: {results_path}")
        logger.info(f"⏱️ Total time: {total_time:.1f}s")

        return results

    def predict_subgenre(self, audio_files: Union[str, List[str]]) -> Dict:
        """
        Predict subgenres for audio files using the trained specialist.

        Args:
            audio_files: Single audio file path or list of paths

        Returns:
            Dictionary with prediction results
        """
        if not self.is_trained:
            raise ValueError("Specialist must be trained before making predictions")

        return self.classifier.predict(audio_files)

    def load_specialist(self, model_path: str) -> None:
        """
        Load a trained specialist model.

        Args:
            model_path: Path to the saved specialist model
        """
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Specialist model not found: {model_path}")

        # Initialize classifier
        self.classifier = CNNMusicClassifier(
            model_name=f"{self.model_name_prefix}-{self.target_genre}",
            architecture=self.architecture,
            device=str(self.device),
        )

        # Load the model
        self.classifier.load_model(model_path)
        self.subgenre_classes = self.classifier.genre_classes
        self.is_trained = True
        self.model_path = model_path

        logger.info(f"✅ Loaded specialist for {self.target_genre}: {model_path}")


class HierarchicalModelMatrix:
    """
    Manages the complete hierarchical classification system.
    Coordinates genre classification and subgenre specialists.
    """

    def __init__(
        self,
        genre_model_path: str,
        specialists_dir: str = "models/subgenre_specialists",
    ):
        """
        Initialize the hierarchical model matrix.

        Args:
            genre_model_path: Path to the main genre classifier
            specialists_dir: Directory containing subgenre specialists
        """
        self.genre_model_path = genre_model_path
        self.specialists_dir = Path(specialists_dir)

        # Models
        self.genre_classifier = None
        self.subgenre_specialists = {}

        # Model mapping
        self.genre_to_specialist = {}

        logger.info(f"🏗️ Initializing Hierarchical Model Matrix")
        logger.info(f"🎯 Genre model: {genre_model_path}")
        logger.info(f"🎵 Specialists directory: {specialists_dir}")

    def load_genre_classifier(self) -> None:
        """Load the main genre classification model."""
        logger.info(f"📥 Loading genre classifier...")

        self.genre_classifier = CNNMusicClassifier()
        self.genre_classifier.load_model(self.genre_model_path)

        logger.info(f"✅ Genre classifier loaded")
        logger.info(f"🎵 Available genres: {self.genre_classifier.genre_classes}")

    def discover_and_load_specialists(self) -> None:
        """Discover and load all available subgenre specialists."""
        logger.info(f"🔍 Discovering subgenre specialists...")

        if not self.specialists_dir.exists():
            logger.warning(f"Specialists directory not found: {self.specialists_dir}")
            return

        specialists_loaded = 0

        for genre_dir in self.specialists_dir.iterdir():
            if not genre_dir.is_dir():
                continue

            genre_name = genre_dir.name

            # Look for model files
            model_files = list(genre_dir.glob("*.pth"))
            if not model_files:
                logger.warning(f"No model file found for genre: {genre_name}")
                continue

            model_path = model_files[0]  # Take first .pth file

            try:
                # Load specialist
                specialist = SubgenreSpecialistTrainer(target_genre=genre_name)
                specialist.load_specialist(str(model_path))

                self.subgenre_specialists[genre_name] = specialist
                self.genre_to_specialist[genre_name] = genre_name
                specialists_loaded += 1

                logger.info(
                    f"  ✅ {genre_name}: {len(specialist.subgenre_classes)} subgenres"
                )

            except Exception as e:
                logger.error(f"Failed to load specialist for {genre_name}: {e}")

        logger.info(f"✅ Loaded {specialists_loaded} subgenre specialists")

    def load_complete_system(self) -> None:
        """Load both genre classifier and all subgenre specialists."""
        logger.info(f"🚀 Loading complete hierarchical system...")

        self.load_genre_classifier()
        self.discover_and_load_specialists()

        logger.info(f"🎉 Hierarchical system ready!")
        logger.info(
            f"🎯 Genre classifier: {len(self.genre_classifier.genre_classes)} genres"
        )
        logger.info(f"🎵 Subgenre specialists: {len(self.subgenre_specialists)} loaded")

    def predict_hierarchical(self, audio_file: str) -> Dict:
        """
        Perform complete hierarchical classification.

        Args:
            audio_file: Path to audio file

        Returns:
            Dictionary with hierarchical prediction results
        """
        if not self.genre_classifier:
            raise ValueError("Genre classifier not loaded")

        logger.info(f"🎵 Hierarchical classification: {Path(audio_file).name}")

        # Step 1: Predict genre
        genre_result = self.genre_classifier.predict(audio_file)
        predicted_genre = genre_result["predictions"]["predicted_genre"]
        genre_confidence = genre_result["predictions"]["confidence"]
        logger.info(f"  🎯 Predicted genre: {predicted_genre} ({genre_confidence:.2%})")

        # Step 2: Predict subgenre using specialist
        subgenre_result = None
        subgenre_confidence = 0.0
        predicted_subgenre = "Unknown"

        if predicted_genre in self.subgenre_specialists:
            specialist = self.subgenre_specialists[predicted_genre]
            subgenre_result = specialist.predict_subgenre(audio_file)
            predicted_subgenre = subgenre_result["predictions"]["predicted_genre"]
            subgenre_confidence = subgenre_result["predictions"]["confidence"]
            logger.info(
                f"  🎵 Predicted subgenre: {predicted_subgenre} ({subgenre_confidence:.2%})"
            )
        else:
            logger.warning(f"  ⚠️ No specialist available for genre: {predicted_genre}")

        # Combine results
        combined_confidence = genre_confidence * subgenre_confidence

        result = {
            "file_path": audio_file,
            "hierarchical_prediction": {
                "genre": predicted_genre,
                "subgenre": predicted_subgenre,
                "genre_confidence": genre_confidence,
                "subgenre_confidence": subgenre_confidence,
                "combined_confidence": combined_confidence,
            },
            "genre_details": genre_result["predictions"],
            "subgenre_details": subgenre_result["predictions"]
            if subgenre_result
            else None,
        }

        logger.info(
            f"  🎉 Final: {predicted_genre} → {predicted_subgenre} ({combined_confidence:.2%})"
        )

        return result

    def get_system_info(self) -> Dict:
        """Get information about the loaded hierarchical system."""
        info = {
            "genre_classifier": {
                "loaded": self.genre_classifier is not None,
                "model_path": self.genre_model_path,
                "genres": self.genre_classifier.genre_classes
                if self.genre_classifier
                else [],
            },
            "subgenre_specialists": {},
            "coverage": {
                "total_genres": len(self.genre_classifier.genre_classes)
                if self.genre_classifier
                else 0,
                "specialists_available": len(self.subgenre_specialists),
                "coverage_percentage": 0,
            },
        }

        # Add specialist details
        for genre, specialist in self.subgenre_specialists.items():
            info["subgenre_specialists"][genre] = {
                "model_path": specialist.model_path,
                "subgenres": specialist.subgenre_classes,
                "num_subgenres": len(specialist.subgenre_classes),
            }

        # Calculate coverage
        if self.genre_classifier:
            coverage_pct = (
                len(self.subgenre_specialists)
                / len(self.genre_classifier.genre_classes)
            ) * 100
            info["coverage"]["coverage_percentage"] = coverage_pct

        return info


def train_all_subgenre_specialists(
    dataset_path: str,
    output_dir: str = "models/subgenre_specialists",
    target_samples_per_subgenre: int = 500,
    segment_duration: float = 30.0,
    num_epochs: int = 50,
    learning_rate: float = 0.001,
    validation_split: float = 0.2,
    max_workers: int = None,
    architecture: str = "hybrid",
    batch_size: int = 32,
    genres_to_train: List[str] = None,
) -> Dict:
    """
    Train subgenre specialists for all genres in the dataset.

    Args:
        dataset_path: Path to hierarchical music dataset
        output_dir: Directory to save all specialist models
        target_samples_per_subgenre: Target samples per subgenre
        segment_duration: Duration of audio segments
        num_epochs: Number of training epochs
        learning_rate: Learning rate for training
        validation_split: Fraction for validation
        max_workers: Number of parallel workers
        architecture: Model architecture ("cnn" or "hybrid")
        batch_size: Batch size for training
        genres_to_train: Specific genres to train (None = all genres)

    Returns:
        Dictionary with all training results
    """
    logger.info(f"🚀 Training ALL Subgenre Specialists")
    logger.info(f"📁 Dataset: {dataset_path}")
    logger.info(f"💾 Output: {output_dir}")

    start_time = time.time()

    # Discover available genres
    dataset_path = Path(dataset_path)
    available_genres = [d.name for d in dataset_path.iterdir() if d.is_dir()]

    if genres_to_train:
        # Filter to specified genres
        genres_to_process = [g for g in genres_to_train if g in available_genres]
        missing_genres = [g for g in genres_to_train if g not in available_genres]
        if missing_genres:
            logger.warning(f"Requested genres not found: {missing_genres}")
    else:
        # Train all available genres
        genres_to_process = available_genres

    logger.info(f"🎵 Genres to train: {len(genres_to_process)}")
    logger.info(f"📝 Genre list: {', '.join(genres_to_process)}")

    # Train each specialist
    all_results = {
        "training_summary": {
            "total_genres": len(genres_to_process),
            "successful_training": 0,
            "failed_training": 0,
            "start_time": start_time,
        },
        "specialist_results": {},
        "failed_genres": [],
    }

    for i, genre in enumerate(genres_to_process, 1):
        logger.info(f"\n🎯 Training Specialist {i}/{len(genres_to_process)}: {genre}")

        try:
            # Initialize specialist trainer
            specialist = SubgenreSpecialistTrainer(
                target_genre=genre, architecture=architecture, batch_size=batch_size
            )

            # Train the specialist
            results = specialist.train_subgenre_specialist(
                dataset_path=str(dataset_path),
                output_dir=output_dir,
                target_samples_per_subgenre=target_samples_per_subgenre,
                segment_duration=segment_duration,
                num_epochs=num_epochs,
                learning_rate=learning_rate,
                validation_split=validation_split,
                max_workers=max_workers,
                use_preprocessing=True,
            )

            all_results["specialist_results"][genre] = results
            all_results["training_summary"]["successful_training"] += 1

            logger.info(f"✅ {genre} specialist completed successfully!")

        except Exception as e:
            logger.error(f"❌ Failed to train {genre} specialist: {e}")
            all_results["failed_genres"].append({"genre": genre, "error": str(e)})
            all_results["training_summary"]["failed_training"] += 1

    total_time = time.time() - start_time
    all_results["training_summary"]["total_time"] = total_time
    all_results["training_summary"]["end_time"] = time.time()

    # Save complete results
    results_path = Path(output_dir) / "all_specialists_results.json"
    results_path.parent.mkdir(parents=True, exist_ok=True)  # Ensure directory exists
    with open(results_path, "w") as f:
        json.dump(all_results, f, indent=2, default=str)

    # Final summary
    successful = all_results["training_summary"]["successful_training"]
    failed = all_results["training_summary"]["failed_training"]

    logger.info(f"\n🎉 ALL SUBGENRE SPECIALISTS TRAINING COMPLETE!")
    logger.info(f"✅ Successful: {successful}/{len(genres_to_process)} specialists")
    logger.info(f"❌ Failed: {failed}/{len(genres_to_process)} specialists")
    logger.info(f"⏱️ Total time: {total_time / 60:.1f} minutes")
    logger.info(f"💾 Results saved: {results_path}")

    if failed > 0:
        logger.warning(
            f"⚠️ Failed genres: {[f['genre'] for f in all_results['failed_genres']]}"
        )

    return all_results


if __name__ == "__main__":
    """
    Command-line interface for training subgenre specialists.
    """
    import argparse

    parser = argparse.ArgumentParser(description="Train CNN subgenre specialists")
    parser.add_argument(
        "--dataset", required=True, help="Path to hierarchical music dataset"
    )
    parser.add_argument(
        "--output",
        default="models/subgenre_specialists",
        help="Output directory for specialists",
    )
    parser.add_argument(
        "--target-genre", help="Specific genre to train (default: train all genres)"
    )
    parser.add_argument(
        "--target-samples", type=int, default=500, help="Target samples per subgenre"
    )
    parser.add_argument(
        "--segment-duration",
        type=float,
        default=30.0,
        help="Segment duration in seconds",
    )
    parser.add_argument(
        "--epochs", type=int, default=50, help="Number of training epochs"
    )
    parser.add_argument("--lr", type=float, default=0.001, help="Learning rate")
    parser.add_argument(
        "--val-split", type=float, default=0.2, help="Validation split fraction"
    )
    parser.add_argument(
        "--workers", type=int, default=None, help="Number of parallel workers"
    )
    parser.add_argument(
        "--architecture",
        choices=["cnn", "hybrid"],
        default="hybrid",
        help="Model architecture",
    )
    parser.add_argument(
        "--batch-size", type=int, default=32, help="Batch size for training"
    )
    parser.add_argument(
        "--genres",
        nargs="+",
        help="Specific genres to train (space-separated or comma-separated)",
    )

    args = parser.parse_args()

    # Handle comma-separated genres if provided as a single string
    if args.genres and len(args.genres) == 1 and "," in args.genres[0]:
        args.genres = [genre.strip() for genre in args.genres[0].split(",")]

    try:
        if args.target_genre:
            # Train single specialist
            logger.info(f"🎯 Training single specialist for: {args.target_genre}")

            specialist = SubgenreSpecialistTrainer(
                target_genre=args.target_genre,
                architecture=args.architecture,
                batch_size=args.batch_size,
            )

            results = specialist.train_subgenre_specialist(
                dataset_path=args.dataset,
                output_dir=args.output,
                target_samples_per_subgenre=args.target_samples,
                segment_duration=args.segment_duration,
                num_epochs=args.epochs,
                learning_rate=args.lr,
                validation_split=args.val_split,
                max_workers=args.workers,
                use_preprocessing=True,
            )

            print(f"\n=== Subgenre Specialist Results ===")
            print(f"Genre: {args.target_genre}")
            print(f"Subgenres: {len(results['specialist_info']['subgenre_classes'])}")
            print(
                f"Final accuracy: {results['training_results']['final_val_acc']:.2f}%"
            )
            print(f"Model saved: {results['specialist_info']['model_path']}")

        else:
            # Train all specialists
            logger.info(f"🚀 Training ALL subgenre specialists")

            results = train_all_subgenre_specialists(
                dataset_path=args.dataset,
                output_dir=args.output,
                target_samples_per_subgenre=args.target_samples,
                segment_duration=args.segment_duration,
                num_epochs=args.epochs,
                learning_rate=args.lr,
                validation_split=args.val_split,
                max_workers=args.workers,
                architecture=args.architecture,
                batch_size=args.batch_size,
                genres_to_train=args.genres,
            )

            successful = results["training_summary"]["successful_training"]
            total = results["training_summary"]["total_genres"]

            print(f"\n=== All Specialists Training Results ===")
            print(f"Total genres: {total}")
            print(f"Successful: {successful}")
            print(f"Failed: {total - successful}")
            print(f"Success rate: {(successful / total) * 100:.1f}%")
            print(
                f"Total time: {results['training_summary']['total_time'] / 60:.1f} minutes"
            )

    except Exception as e:
        logger.error(f"Training failed: {str(e)}")
        raise
