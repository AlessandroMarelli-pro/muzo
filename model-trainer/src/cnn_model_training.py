"""
CNN-Based Music Classification Module

This module implements Convolutional Neural Network approaches for music genre and subgenre classification.
Supports both spectrogram-based CNNs and hybrid CNN-RNN architectures with GPU acceleration.
Designed to work with raw audio data and complement the existing Random Forest approach.

Based on the Muzo data model and AI service API specifications.
Optimized for AMD Ryzen 7 + RTX 4070 high-performance training.
"""

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
import soundfile as sf
from tqdm import tqdm


def process_segmentation_task(task):
    """Process a single segmentation task for balanced audio segments with smart positioning."""
    try:
        # Load audio file
        y, sr = librosa.load(task["input_file"], sr=task["sample_rate"])

        if len(y) == 0:
            return []

        # Calculate segment parameters
        segment_samples = int(task["segment_duration"] * sr)
        overlap_samples = int(segment_samples * task["overlap_ratio"])
        step_samples = segment_samples - overlap_samples

        segments_created = []

        # Smart segmentation: avoid intros, target middle sections
        audio_duration = len(y) / sr
        intro_skip_ratio = 0.15  # Skip first 15% (typical intro length)
        outro_skip_ratio = 0.10  # Skip last 10% (outro/fade)

        # Calculate usable audio range (skip intro/outro)
        intro_skip_samples = int(len(y) * intro_skip_ratio)
        outro_skip_samples = int(len(y) * outro_skip_ratio)
        usable_start = intro_skip_samples
        usable_end = len(y) - outro_skip_samples
        usable_length = usable_end - usable_start

        # If audio is too short, fall back to original method
        if usable_length < segment_samples:
            usable_start = 0
            usable_end = len(y)
            usable_length = len(y)

        # Create segments with smart positioning
        segment_idx = 0
        segments_needed = task["segments_needed"]

        if segments_needed == 1:
            # Single segment: take from the middle (best genre representation)
            middle_start = usable_start + (usable_length - segment_samples) // 2
            middle_start = max(0, min(middle_start, len(y) - segment_samples))

            segment = y[middle_start : middle_start + segment_samples]
            filename = f"{Path(task['input_file']).stem}_mid_000.wav"
            output_path = Path(task["output_dir"]) / filename

            import soundfile as sf

            sf.write(str(output_path), segment, sr)

            segments_created.append(
                {"file_path": str(output_path), "label": task["subgenre"]}
            )

        elif segments_needed <= 3:
            # Few segments: strategically place them in the most representative parts
            positions = []
            if segments_needed == 2:
                # Two segments: early-middle and late-middle
                positions = [0.3, 0.7]  # 30% and 70% through usable audio
            else:  # segments_needed == 3
                # Three segments: early-middle, center, late-middle
                positions = [0.25, 0.5, 0.75]  # 25%, 50%, 75% through usable audio

            for i, pos in enumerate(positions):
                if segment_idx >= segments_needed:
                    break

                start_pos = (
                    usable_start + int(usable_length * pos) - segment_samples // 2
                )
                start_pos = max(
                    usable_start, min(start_pos, usable_end - segment_samples)
                )

                segment = y[start_pos : start_pos + segment_samples]
                filename = (
                    f"{Path(task['input_file']).stem}_smart_{segment_idx:03d}.wav"
                )
                output_path = Path(task["output_dir"]) / filename

                import soundfile as sf

                sf.write(str(output_path), segment, sr)

                segments_created.append(
                    {"file_path": str(output_path), "label": task["subgenre"]}
                )

                segment_idx += 1

        else:
            # Many segments: use overlapping method but start from usable range
            start = usable_start

            while (
                start + segment_samples <= usable_end and segment_idx < segments_needed
            ):
                # Extract segment
                segment = y[start : start + segment_samples]

                # Save segment
                filename = f"{Path(task['input_file']).stem}_seg_{segment_idx:03d}.wav"
                output_path = Path(task["output_dir"]) / filename

                import soundfile as sf

                sf.write(str(output_path), segment, sr)

                segments_created.append(
                    {"file_path": str(output_path), "label": task["subgenre"]}
                )

                start += step_samples
                segment_idx += 1

        return segments_created

    except Exception as e:
        # Import logger here to avoid circular imports
        import logging

        logger = logging.getLogger(__name__)
        logger.error(f"Error processing {task['input_file']}: {e}")
        return []


# Deep learning imports
try:
    import torch
    import torch.nn as nn
    import torch.nn.functional as F
    import torch.optim as optim
    import torchvision.transforms as transforms
    from torch.cuda.amp import GradScaler, autocast
    from torch.utils.data import DataLoader, Dataset, random_split

    TORCH_AVAILABLE = True
    print("🚀 PyTorch available for CNN training")
except ImportError:
    TORCH_AVAILABLE = False
    print("⚠️  PyTorch not available. Install PyTorch for CNN support.")

# Try alternative deep learning frameworks
try:
    import tensorflow as tf
    from tensorflow import keras
    from tensorflow.keras import layers

    TF_AVAILABLE = True
    print("🚀 TensorFlow available for CNN training")
except ImportError:
    TF_AVAILABLE = False
    print("⚠️  TensorFlow not available.")

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def create_balanced_audio_segments(
    dataset_path: str,
    output_dir: str,
    target_samples_per_genre: int = 2000,
    segment_duration: float = 10.0,
    overlap_ratio: float = 0.5,
    sample_rate: int = 22050,
    max_workers: int = None,
    genre_only: bool = False,
) -> Tuple[List[str], List[str]]:
    """
    Create balanced audio segments for CNN training.

    Args:
        dataset_path: Path to the hierarchical music dataset
        output_dir: Directory to save segmented audio files
        target_samples_per_genre: Target number of samples per genre
        segment_duration: Duration of each segment in seconds
        overlap_ratio: Overlap ratio between segments (0.0 to 1.0)
        sample_rate: Target sample rate
        max_workers: Number of parallel workers

    Returns:
        Tuple of (audio_files, labels) for CNN training
    """
    logger.info(f"🎵 Creating balanced audio segments for CNN training...")
    logger.info(f"Dataset: {dataset_path}")
    logger.info(f"Target samples per genre: {target_samples_per_genre}")
    logger.info(f"Segment duration: {segment_duration}s")
    logger.info(f"Overlap ratio: {overlap_ratio}")

    dataset_path = Path(dataset_path)
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    # Analyze dataset structure
    genre_structure = {}
    total_files = 0

    for genre_dir in dataset_path.iterdir():
        if not genre_dir.is_dir():
            continue

        genre_name = genre_dir.name
        genre_structure[genre_name] = {}

        # Check for subgenres
        subgenre_dirs = [d for d in genre_dir.iterdir() if d.is_dir()]

        if subgenre_dirs:
            # Has subgenres
            for subgenre_dir in subgenre_dirs:
                subgenre_name = subgenre_dir.name
                audio_files = (
                    list(subgenre_dir.glob("*.flac"))
                    + list(subgenre_dir.glob("*.mp3"))
                    + list(subgenre_dir.glob("*.wav"))
                )

                genre_structure[genre_name][subgenre_name] = audio_files
                total_files += len(audio_files)
        else:
            # Direct genre files
            audio_files = (
                list(genre_dir.glob("*.flac"))
                + list(genre_dir.glob("*.mp3"))
                + list(genre_dir.glob("*.wav"))
            )

            genre_structure[genre_name]["_direct"] = audio_files
            total_files += len(audio_files)

    logger.info(f"Found {len(genre_structure)} genres, {total_files} total files")

    # Calculate segmentation plan
    segmentation_tasks = []

    if genre_only:
        # For genre-only mode, flatten all subgenres into single genre folders
        # BUT ensure balanced sampling from each subgenre
        logger.info(f"🎯 Genre-only mode: Flattening subgenres with balanced sampling")

        for genre_name, subgenres in genre_structure.items():
            if len(subgenres) == 0:
                continue

            # Calculate target samples per subgenre (evenly distributed)
            subgenre_count = len(subgenres)
            target_per_subgenre = target_samples_per_genre // subgenre_count
            remaining_samples = target_samples_per_genre % subgenre_count

            logger.info(
                f"  🎵 {genre_name}: {subgenre_count} subgenres, {target_per_subgenre} samples each (+{remaining_samples} extra)"
            )

            # Create single output directory for the genre (no subgenre folders)
            output_subdir = output_dir / genre_name
            output_subdir.mkdir(parents=True, exist_ok=True)

            # Process each subgenre with balanced sampling
            subgenre_index = 0
            for subgenre_name, audio_files in subgenres.items():
                if len(audio_files) == 0:
                    continue

                # Calculate target samples for this subgenre
                # Give extra samples to first few subgenres if there's a remainder
                current_target = target_per_subgenre
                if subgenre_index < remaining_samples:
                    current_target += 1

                if current_target == 0:
                    continue

                # Calculate segments needed per file for this subgenre
                if len(audio_files) >= current_target:
                    # We have enough files, use 1 segment per file for first current_target files
                    segments_per_file = 1
                    files_to_use = audio_files[:current_target]
                else:
                    # We need multiple segments per file
                    segments_per_file = (current_target + len(audio_files) - 1) // len(
                        audio_files
                    )  # Ceiling division
                    files_to_use = audio_files

                logger.info(
                    f"    📊 {subgenre_name}: {len(files_to_use)}/{len(audio_files)} files → {current_target} samples ({segments_per_file} per file)"
                )

                # Add segmentation tasks for this subgenre
                for audio_file in files_to_use:
                    task = {
                        "input_file": str(audio_file),
                        "output_dir": str(output_subdir),
                        "genre": genre_name,
                        "subgenre": genre_name,  # Use genre name as subgenre for consistency
                        "segments_needed": segments_per_file,
                        "segment_duration": segment_duration,
                        "overlap_ratio": overlap_ratio,
                        "sample_rate": sample_rate,
                    }
                    segmentation_tasks.append(task)

                subgenre_index += 1
    else:
        # Original hierarchical mode
        for genre_name, subgenres in genre_structure.items():
            subgenre_count = len(subgenres)
            target_per_subgenre = target_samples_per_genre // subgenre_count

            for subgenre_name, audio_files in subgenres.items():
                if len(audio_files) == 0:
                    continue

                # Calculate segments needed per file
                segments_per_file = max(1, target_per_subgenre // len(audio_files))

                # Create output directory for this subgenre
                if subgenre_name == "_direct":
                    output_subdir = output_dir / genre_name
                else:
                    output_subdir = output_dir / genre_name / subgenre_name
                output_subdir.mkdir(parents=True, exist_ok=True)

                # Add segmentation tasks
                for audio_file in audio_files:
                    task = {
                        "input_file": str(audio_file),
                        "output_dir": str(output_subdir),
                        "genre": genre_name,
                        "subgenre": subgenre_name
                        if subgenre_name != "_direct"
                        else genre_name,
                        "segments_needed": segments_per_file,
                        "segment_duration": segment_duration,
                        "overlap_ratio": overlap_ratio,
                        "sample_rate": sample_rate,
                    }
                    segmentation_tasks.append(task)

    logger.info(f"Created {len(segmentation_tasks)} segmentation tasks")

    # Process segments in parallel
    if max_workers is None:
        max_workers = min(8, os.cpu_count())

    all_audio_files = []
    all_labels = []

    # Execute segmentation with progress bar
    with ProcessPoolExecutor(max_workers=max_workers) as executor:
        futures = [
            executor.submit(process_segmentation_task, task)
            for task in segmentation_tasks
        ]

        for future in tqdm(
            as_completed(futures), total=len(futures), desc="Creating segments"
        ):
            segments = future.result()
            for segment in segments:
                all_audio_files.append(segment["file_path"])
                all_labels.append(segment["label"])

    logger.info(f"✅ Created {len(all_audio_files)} audio segments before balancing")

    # Enforce exact target balancing for genre-only mode
    if genre_only:
        logger.info(
            f"🎯 Enforcing exact target balance: {target_samples_per_genre} samples per genre"
        )

        # Group by genre
        genre_segments = {}
        for file_path, label in zip(all_audio_files, all_labels):
            if label not in genre_segments:
                genre_segments[label] = []
            genre_segments[label].append(file_path)

        # Balance to exact target
        balanced_files = []
        balanced_labels = []

        for genre, segments in genre_segments.items():
            if len(segments) >= target_samples_per_genre:
                # Take exactly target_samples_per_genre segments
                selected_segments = segments[:target_samples_per_genre]
            else:
                # Duplicate segments to reach target (with cycling)
                selected_segments = []
                while len(selected_segments) < target_samples_per_genre:
                    remaining = target_samples_per_genre - len(selected_segments)
                    to_add = min(remaining, len(segments))
                    selected_segments.extend(segments[:to_add])

            balanced_files.extend(selected_segments)
            balanced_labels.extend([genre] * len(selected_segments))

            logger.info(
                f"  🎵 {genre}: {len(segments)} → {len(selected_segments)} samples"
            )

        all_audio_files = balanced_files
        all_labels = balanced_labels

    logger.info(f"✅ Final balanced dataset: {len(all_audio_files)} segments")
    logger.info(f"📊 Unique labels: {len(set(all_labels))}")

    # Verify balance
    if genre_only:
        from collections import Counter

        label_counts = Counter(all_labels)
        logger.info(f"📊 Final distribution verification:")
        for label, count in sorted(label_counts.items()):
            logger.info(f"  🎵 {label}: {count} samples")

    # Save segment manifest
    manifest_path = output_dir / "segment_manifest.csv"
    manifest_df = pd.DataFrame({"file_path": all_audio_files, "label": all_labels})
    manifest_df.to_csv(manifest_path, index=False)
    logger.info(f"Segment manifest saved to: {manifest_path}")

    return all_audio_files, all_labels


class AudioSpectrogramDataset(Dataset):
    """
    PyTorch Dataset for audio spectrograms.
    Converts audio files to mel-spectrograms for CNN training.
    Includes data augmentation for better generalization.
    """

    def __init__(
        self,
        audio_files: List[str],
        labels: List[str],
        sample_rate: int = 22050,
        duration: float = 30.0,
        n_mels: int = 128,
        hop_length: int = 512,
        transform=None,
        augment: bool = True,
        augment_prob: float = 0.5,
    ):
        """
        Initialize the dataset.

        Args:
            audio_files: List of audio file paths
            labels: List of corresponding labels
            sample_rate: Target sample rate
            duration: Duration to extract from each audio file
            n_mels: Number of mel bands
            hop_length: Hop length for STFT
            transform: Optional transforms to apply
        """
        self.audio_files = audio_files
        self.labels = labels
        self.sample_rate = sample_rate
        self.duration = duration
        self.n_mels = n_mels
        self.hop_length = hop_length
        self.transform = transform
        self.augment = augment
        self.augment_prob = augment_prob

        # Create label encoder
        self.unique_labels = sorted(list(set(labels)))
        self.label_to_idx = {label: idx for idx, label in enumerate(self.unique_labels)}
        self.idx_to_label = {idx: label for label, idx in self.label_to_idx.items()}

    def __len__(self):
        return len(self.audio_files)

    def __getitem__(self, idx):
        """
        Get a single item from the dataset.

        Returns:
            Tuple of (spectrogram, label_idx)
        """
        audio_file = self.audio_files[idx]
        label = self.labels[idx]

        try:
            # Load audio
            y, sr = librosa.load(
                audio_file, sr=self.sample_rate, duration=self.duration
            )
            print("load init")
            # Pad or truncate to fixed length
            target_length = int(self.sample_rate * self.duration)
            if len(y) < target_length:
                y = np.pad(y, (0, target_length - len(y)), mode="constant")
            else:
                y = y[:target_length]

            # Convert to mel-spectrogram
            mel_spec = librosa.feature.melspectrogram(
                y=y, sr=self.sample_rate, n_mels=self.n_mels, hop_length=self.hop_length
            )

            # Convert to dB scale
            mel_spec_db = librosa.power_to_db(mel_spec, ref=np.max)

            # Normalize to [0, 1]
            mel_spec_norm = (mel_spec_db - mel_spec_db.min()) / (
                mel_spec_db.max() - mel_spec_db.min() + 1e-8
            )

            # Apply data augmentation if enabled
            if self.augment and np.random.random() < self.augment_prob:
                mel_spec_norm = self._apply_augmentation(mel_spec_norm)

            # Convert to tensor and add channel dimension
            spectrogram = torch.FloatTensor(mel_spec_norm).unsqueeze(0)

            # Apply transforms if any
            if self.transform:
                spectrogram = self.transform(spectrogram)

            label_idx = self.label_to_idx[label]

            return spectrogram, label_idx

        except Exception as e:
            logger.error(f"Error loading {audio_file}: {str(e)}")
            # Return zero spectrogram and label
            zero_spec = torch.zeros(
                1, self.n_mels, int(target_length // self.hop_length)
            )
            return zero_spec, self.label_to_idx[label]

    def _apply_augmentation(self, mel_spec: np.ndarray) -> np.ndarray:
        """
        Apply data augmentation techniques to mel-spectrogram.
        Based on the improvements from MODEL_IMPROVEMENT_SUMMARY.md
        """
        augmented = mel_spec.copy()

        # Random noise addition (frequency masking effect)
        if np.random.random() < 0.3:
            noise = np.random.normal(0, 0.01, augmented.shape)
            augmented = augmented + noise

        # Time masking (mask random time frames)
        if np.random.random() < 0.3:
            time_mask_size = int(0.1 * augmented.shape[1])  # Mask 10% of time frames
            time_start = np.random.randint(
                0, max(1, augmented.shape[1] - time_mask_size)
            )
            augmented[:, time_start : time_start + time_mask_size] = 0

        # Frequency masking (mask random frequency bands)
        if np.random.random() < 0.3:
            freq_mask_size = int(0.1 * augmented.shape[0])  # Mask 10% of freq bands
            freq_start = np.random.randint(
                0, max(1, augmented.shape[0] - freq_mask_size)
            )
            augmented[freq_start : freq_start + freq_mask_size, :] = 0

        # Amplitude scaling (simulate volume variations)
        if np.random.random() < 0.3:
            scale_factor = np.random.uniform(0.8, 1.2)
            augmented = augmented * scale_factor

        # Ensure values stay in [0, 1] range
        augmented = np.clip(augmented, 0, 1)

        return augmented


class SpectrogramCNN(nn.Module):
    """
    Convolutional Neural Network for spectrogram-based music classification.
    Uses 2D convolutions to process mel-spectrograms.
    """

    def __init__(
        self,
        num_classes: int,
        input_height: int = 128,  # n_mels
        input_width: int = 1292,  # time frames (30s at 22050 Hz with hop_length=512)
        dropout_rate: float = 0.5,
    ):
        """
        Initialize the CNN.

        Args:
            num_classes: Number of output classes
            input_height: Height of input spectrogram (n_mels)
            input_width: Width of input spectrogram (time frames)
            dropout_rate: Dropout rate for regularization
        """
        super(SpectrogramCNN, self).__init__()

        self.num_classes = num_classes

        # Convolutional layers
        self.conv1 = nn.Conv2d(1, 32, kernel_size=(3, 3), stride=(1, 1), padding=(1, 1))
        self.bn1 = nn.BatchNorm2d(32)
        self.pool1 = nn.MaxPool2d(kernel_size=(2, 2), stride=(2, 2))

        self.conv2 = nn.Conv2d(
            32, 64, kernel_size=(3, 3), stride=(1, 1), padding=(1, 1)
        )
        self.bn2 = nn.BatchNorm2d(64)
        self.pool2 = nn.MaxPool2d(kernel_size=(2, 2), stride=(2, 2))

        self.conv3 = nn.Conv2d(
            64, 128, kernel_size=(3, 3), stride=(1, 1), padding=(1, 1)
        )
        self.bn3 = nn.BatchNorm2d(128)
        self.pool3 = nn.MaxPool2d(kernel_size=(2, 2), stride=(2, 2))

        self.conv4 = nn.Conv2d(
            128, 256, kernel_size=(3, 3), stride=(1, 1), padding=(1, 1)
        )
        self.bn4 = nn.BatchNorm2d(256)
        self.pool4 = nn.MaxPool2d(kernel_size=(2, 2), stride=(2, 2))

        # Calculate the size after convolutions
        conv_output_size = self._get_conv_output_size(input_height, input_width)

        # Fully connected layers
        self.dropout = nn.Dropout(dropout_rate)
        self.fc1 = nn.Linear(conv_output_size, 512)
        self.fc2 = nn.Linear(512, 128)
        self.fc3 = nn.Linear(128, num_classes)

    def _get_conv_output_size(self, height, width):
        """Calculate the output size after all conv and pooling layers."""
        # Each pooling layer reduces size by 2
        h = height // (2**4)  # 4 pooling layers
        w = width // (2**4)  # 4 pooling layers
        return 256 * h * w  # 256 channels from last conv layer

    def forward(self, x):
        """Forward pass through the network."""
        # Convolutional layers with batch norm and ReLU
        x = self.pool1(F.relu(self.bn1(self.conv1(x))))
        x = self.pool2(F.relu(self.bn2(self.conv2(x))))
        x = self.pool3(F.relu(self.bn3(self.conv3(x))))
        x = self.pool4(F.relu(self.bn4(self.conv4(x))))

        # Flatten for fully connected layers
        x = x.view(x.size(0), -1)

        # Fully connected layers with dropout
        x = F.relu(self.fc1(x))
        x = self.dropout(x)
        x = F.relu(self.fc2(x))
        x = self.dropout(x)
        x = self.fc3(x)

        return x


class HybridCNNRNN(nn.Module):
    """
    Hybrid CNN-RNN model for music classification.
    Uses CNN for local feature extraction and RNN for temporal modeling.
    """

    def __init__(
        self,
        num_classes: int,
        input_height: int = 128,
        input_width: int = 1292,
        rnn_hidden_size: int = 128,
        rnn_num_layers: int = 2,
        dropout_rate: float = 0.5,
    ):
        """
        Initialize the hybrid model.

        Args:
            num_classes: Number of output classes
            input_height: Height of input spectrogram
            input_width: Width of input spectrogram
            rnn_hidden_size: Hidden size for RNN
            rnn_num_layers: Number of RNN layers
            dropout_rate: Dropout rate
        """
        super(HybridCNNRNN, self).__init__()

        self.num_classes = num_classes

        # CNN feature extractor
        self.conv1 = nn.Conv2d(1, 32, kernel_size=(3, 3), padding=(1, 1))
        self.bn1 = nn.BatchNorm2d(32)
        self.pool1 = nn.MaxPool2d((2, 1))  # Pool only in frequency dimension

        self.conv2 = nn.Conv2d(32, 64, kernel_size=(3, 3), padding=(1, 1))
        self.bn2 = nn.BatchNorm2d(64)
        self.pool2 = nn.MaxPool2d((2, 1))

        self.conv3 = nn.Conv2d(64, 128, kernel_size=(3, 3), padding=(1, 1))
        self.bn3 = nn.BatchNorm2d(128)
        self.pool3 = nn.MaxPool2d((2, 1))

        # Calculate CNN output dimensions
        cnn_output_height = input_height // 8  # 3 pooling layers with factor 2
        cnn_feature_size = 128 * cnn_output_height  # 128 channels

        # RNN for temporal modeling
        self.lstm = nn.LSTM(
            input_size=cnn_feature_size,
            hidden_size=rnn_hidden_size,
            num_layers=rnn_num_layers,
            batch_first=True,
            dropout=dropout_rate if rnn_num_layers > 1 else 0,
            bidirectional=True,
        )

        # Attention mechanism
        self.attention = nn.Linear(rnn_hidden_size * 2, 1)  # *2 for bidirectional

        # Final classifier
        self.dropout = nn.Dropout(dropout_rate)
        self.fc = nn.Linear(rnn_hidden_size * 2, num_classes)

    def forward(self, x):
        """Forward pass through the hybrid network."""
        batch_size, channels, height, width = x.size()

        # CNN feature extraction
        x = self.pool1(F.relu(self.bn1(self.conv1(x))))
        x = self.pool2(F.relu(self.bn2(self.conv2(x))))
        x = self.pool3(F.relu(self.bn3(self.conv3(x))))

        # Reshape for RNN: (batch, time, features)
        x = x.view(
            batch_size, x.size(1) * x.size(2), x.size(3)
        )  # (batch, features, time)
        x = x.transpose(1, 2)  # (batch, time, features)

        # RNN processing
        lstm_out, _ = self.lstm(x)  # (batch, time, hidden_size * 2)

        # Attention mechanism
        attention_weights = F.softmax(
            self.attention(lstm_out), dim=1
        )  # (batch, time, 1)
        attended_features = torch.sum(
            attention_weights * lstm_out, dim=1
        )  # (batch, hidden_size * 2)

        # Final classification
        output = self.dropout(attended_features)
        output = self.fc(output)

        return output


class CNNMusicClassifier:
    """
    CNN-based music genre and subgenre classifier.
    Supports both pure CNN and hybrid CNN-RNN architectures.
    """

    def __init__(
        self,
        model_name: str = "cnn-music-v1.0",
        architecture: str = "cnn",  # "cnn" or "hybrid"
        sample_rate: int = 22050,
        duration: float = 30.0,
        n_mels: int = 128,
        device: str = "auto",
        random_state: int = 42,
        batch_size: int = 32,
    ):
        """
        Initialize the CNN classifier.

        Args:
            model_name: Name/version of the model
            architecture: Model architecture ("cnn" or "hybrid")
            sample_rate: Audio sample rate
            duration: Duration of audio segments
            n_mels: Number of mel bands
            device: Device to use ("cpu", "cuda", or "auto")
            random_state: Random state for reproducibility
        """
        if not TORCH_AVAILABLE:
            raise ImportError(
                "PyTorch is required for CNN training. Please install PyTorch."
            )

        self.model_name = model_name
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

        logger.info(f"Using device: {self.device}")

        # Model components
        self.model = None
        self.genre_classes = None
        self.subgenre_classes = None
        self.is_trained = False
        self.training_mode = "genre_only"

        # Set random seeds for reproducibility
        torch.manual_seed(random_state)
        if torch.cuda.is_available():
            torch.cuda.manual_seed(random_state)
        np.random.seed(random_state)

    def prepare_data_from_files(
        self, audio_files: List[str], labels: List[str], validation_split: float = 0.2
    ) -> Tuple[DataLoader, DataLoader, List[str]]:
        """
        Prepare data loaders from audio files.

        Args:
            audio_files: List of audio file paths
            labels: List of corresponding labels
            validation_split: Fraction of data for validation

        Returns:
            Tuple of (train_loader, val_loader, unique_labels)
        """
        # Create dataset
        dataset = AudioSpectrogramDataset(
            audio_files=audio_files,
            labels=labels,
            sample_rate=self.sample_rate,
            duration=self.duration,
            n_mels=self.n_mels,
        )

        # Split dataset
        val_size = int(len(dataset) * validation_split)
        train_size = len(dataset) - val_size

        train_dataset, val_dataset = random_split(
            dataset,
            [train_size, val_size],
            generator=torch.Generator().manual_seed(self.random_state),
        )

        # Create data loaders - use specified batch size
        batch_size = self.batch_size
        num_workers = min(8, os.cpu_count())  # Optimal for 6-core Ryzen

        train_loader = DataLoader(
            train_dataset,
            batch_size=batch_size,
            shuffle=True,
            num_workers=num_workers,
            pin_memory=True if self.device.type == "cuda" else False,
            persistent_workers=True,  # Keep workers alive between epochs
            prefetch_factor=4,  # Prefetch more batches
        )

        val_loader = DataLoader(
            val_dataset,
            batch_size=batch_size,
            shuffle=False,
            num_workers=num_workers,
            pin_memory=True if self.device.type == "cuda" else False,
            persistent_workers=True,
            prefetch_factor=4,
        )

        return train_loader, val_loader, dataset.unique_labels

    def create_model(self, num_classes: int) -> nn.Module:
        """
        Create the CNN model based on architecture choice.

        Args:
            num_classes: Number of output classes

        Returns:
            PyTorch model
        """
        # Calculate input width (time frames)
        input_width = int(self.duration * self.sample_rate / 512)  # hop_length = 512

        if self.architecture == "cnn":
            model = SpectrogramCNN(
                num_classes=num_classes,
                input_height=self.n_mels,
                input_width=input_width,
            )
        elif self.architecture == "hybrid":
            model = HybridCNNRNN(
                num_classes=num_classes,
                input_height=self.n_mels,
                input_width=input_width,
            )
        else:
            raise ValueError(f"Unknown architecture: {self.architecture}")

        return model.to(self.device)

    def train(
        self,
        audio_files: List[str],
        labels: List[str],
        num_epochs: int = 50,
        learning_rate: float = 0.001,
        validation_split: float = 0.2,
        early_stopping_patience: int = 10,
        save_best_model: bool = True,
    ) -> Dict:
        """
        Train the CNN model.

        Args:
            audio_files: List of audio file paths
            labels: List of corresponding labels
            num_epochs: Number of training epochs
            learning_rate: Learning rate for optimizer
            validation_split: Fraction of data for validation
            early_stopping_patience: Patience for early stopping
            save_best_model: Whether to save the best model

        Returns:
            Dictionary with training results
        """
        logger.info(f"Starting CNN training: {self.model_name}")
        logger.info(f"Architecture: {self.architecture}")
        logger.info(f"Device: {self.device}")
        logger.info(f"Training samples: {len(audio_files)}")

        start_time = time.time()

        # Prepare data
        train_loader, val_loader, unique_labels = self.prepare_data_from_files(
            audio_files, labels, validation_split
        )

        self.genre_classes = unique_labels
        num_classes = len(unique_labels)

        logger.info(f"Classes: {unique_labels}")
        logger.info(f"Number of classes: {num_classes}")

        # Create model
        self.model = self.create_model(num_classes)

        # Class balancing - calculate class weights
        unique_classes, class_counts = np.unique(labels, return_counts=True)
        class_weights = len(labels) / (len(unique_classes) * class_counts)
        class_weights_tensor = torch.FloatTensor(class_weights).to(self.device)

        logger.info(f"📊 Class distribution analysis:")
        for i, (cls, count) in enumerate(zip(unique_classes, class_counts)):
            weight = class_weights[i]
            percentage = (count / len(labels)) * 100
            logger.info(
                f"   {cls}: {count} samples ({percentage:.1f}%), weight: {weight:.3f}"
            )

        # Loss function with class balancing
        criterion = nn.CrossEntropyLoss(weight=class_weights_tensor)

        # Optimizer with weight decay for regularization
        optimizer = optim.AdamW(  # AdamW is better for weight decay
            self.model.parameters(),
            lr=learning_rate,
            weight_decay=1e-3,  # Stronger regularization
            betas=(0.9, 0.999),
            eps=1e-8,
        )

        # Learning rate scheduler with warmup
        scheduler = optim.lr_scheduler.OneCycleLR(
            optimizer,
            max_lr=learning_rate * 10,
            steps_per_epoch=len(train_loader),
            epochs=num_epochs,
            pct_start=0.1,  # 10% warmup
            anneal_strategy="cos",
        )

        # Mixed precision training for GPU - optimized for RTX 3070
        scaler = GradScaler() if self.device.type == "cuda" else None

        # GPU memory optimization
        if self.device.type == "cuda":
            torch.backends.cudnn.benchmark = True  # Optimize for fixed input sizes
            torch.backends.cudnn.deterministic = (
                False  # Allow non-deterministic for speed
            )

            # Clear GPU cache
            torch.cuda.empty_cache()

            # Log GPU info
            gpu_name = torch.cuda.get_device_name(0)
            gpu_memory = torch.cuda.get_device_properties(0).total_memory / 1e9
            logger.info(f"🎮 GPU: {gpu_name}")
            logger.info(f"💾 GPU Memory: {gpu_memory:.1f} GB")
            logger.info(f"🚀 Mixed Precision: Enabled")
            logger.info(f"⚡ CuDNN Benchmark: Enabled")

        # Training history
        train_losses = []
        val_losses = []
        train_accuracies = []
        val_accuracies = []

        best_val_loss = float("inf")
        patience_counter = 0
        best_model_state = None

        # Training loop with time estimation and progress tracking
        epoch_start_time = time.time()
        logger.info(f"🚀 Starting training for {num_epochs} epochs...")
        logger.info(f"📊 Training batches per epoch: {len(train_loader)}")
        logger.info(f"📊 Validation batches per epoch: {len(val_loader)}")
        logger.info(f"💾 Batch size: {train_loader.batch_size}")

        # Create overall progress bar for epochs
        epoch_pbar = tqdm(
            range(num_epochs),
            desc="Training Progress",
            position=0,
            leave=True,
            ncols=100,
        )

        for epoch in epoch_pbar:
            epoch_iter_start = time.time()

            # Training phase
            self.model.train()
            train_loss = 0.0
            train_correct = 0
            train_total = 0

            # Create progress bar for batches
            train_pbar = tqdm(
                enumerate(train_loader),
                total=len(train_loader),
                desc=f"Epoch {epoch + 1}/{num_epochs} [Train]",
                leave=False,
                ncols=120,
            )

            for batch_idx, (data, target) in train_pbar:
                data, target = data.to(self.device), target.to(self.device)

                optimizer.zero_grad()

                if scaler and self.device.type == "cuda":
                    with autocast():
                        output = self.model(data)
                        loss = criterion(output, target)

                    scaler.scale(loss).backward()
                    scaler.step(optimizer)
                    scaler.update()
                else:
                    output = self.model(data)
                    loss = criterion(output, target)
                    loss.backward()
                    optimizer.step()

                train_loss += loss.item()
                _, predicted = torch.max(output.data, 1)
                train_total += target.size(0)
                train_correct += (predicted == target).sum().item()

                # Step the OneCycleLR scheduler every batch
                scheduler.step()

                # Update progress bar with current metrics
                current_lr = optimizer.param_groups[0]["lr"]
                current_acc = (
                    100.0 * train_correct / train_total if train_total > 0 else 0
                )
                train_pbar.set_postfix(
                    {
                        "Loss": f"{loss.item():.4f}",
                        "Acc": f"{current_acc:.1f}%",
                        "LR": f"{current_lr:.6f}",
                    }
                )

                # Log detailed info every 20 batches
                if batch_idx % 20 == 0:
                    logger.info(
                        f"__main__:Epoch {epoch + 1}/{num_epochs}, Batch {batch_idx + 1}/{len(train_loader)}, Loss: {loss.item():.4f}, LR: {current_lr:.6f}"
                    )

            # Validation phase with progress tracking
            self.model.eval()
            val_loss = 0.0
            val_correct = 0
            val_total = 0

            # Create progress bar for validation
            val_pbar = tqdm(
                val_loader,
                desc=f"Epoch {epoch + 1}/{num_epochs} [Val]",
                leave=False,
                ncols=120,
            )

            with torch.no_grad():
                for data, target in val_pbar:
                    data, target = data.to(self.device), target.to(self.device)
                    output = self.model(data)
                    loss = criterion(output, target)

                    val_loss += loss.item()
                    _, predicted = torch.max(output.data, 1)
                    val_total += target.size(0)
                    val_correct += (predicted == target).sum().item()

                    # Update validation progress bar
                    current_val_acc = (
                        100.0 * val_correct / val_total if val_total > 0 else 0
                    )
                    val_pbar.set_postfix(
                        {"Loss": f"{loss.item():.4f}", "Acc": f"{current_val_acc:.1f}%"}
                    )

            # Calculate metrics
            train_loss /= len(train_loader)
            val_loss /= len(val_loader)
            train_acc = 100.0 * train_correct / train_total
            val_acc = 100.0 * val_correct / val_total

            train_losses.append(train_loss)
            val_losses.append(val_loss)
            train_accuracies.append(train_acc)
            val_accuracies.append(val_acc)

            # Calculate epoch time and estimate remaining time
            epoch_time = time.time() - epoch_iter_start
            avg_epoch_time = (time.time() - epoch_start_time) / (epoch + 1)
            remaining_epochs = num_epochs - (epoch + 1)
            estimated_remaining_time = avg_epoch_time * remaining_epochs

            # Format time estimates
            def format_time(seconds):
                if seconds < 60:
                    return f"{seconds:.1f}s"
                elif seconds < 3600:
                    return f"{seconds / 60:.1f}m"
                else:
                    return f"{seconds / 3600:.1f}h {(seconds % 3600) / 60:.0f}m"

            logger.info(
                f"Epoch {epoch + 1}/{num_epochs} completed in {format_time(epoch_time)}"
            )
            logger.info(f"  Train Loss: {train_loss:.4f}, Train Acc: {train_acc:.2f}%")
            logger.info(f"  Val Loss: {val_loss:.4f}, Val Acc: {val_acc:.2f}%")

            # Update overall epoch progress bar
            epoch_pbar.set_postfix(
                {
                    "Train Acc": f"{train_acc:.1f}%",
                    "Val Acc": f"{val_acc:.1f}%",
                    "Val Loss": f"{val_loss:.4f}",
                    "Time": format_time(epoch_time),
                }
            )

            if remaining_epochs > 0:
                logger.info(f"  ⏱️  Avg epoch time: {format_time(avg_epoch_time)}")
                logger.info(
                    f"  🕐 Est. remaining time: {format_time(estimated_remaining_time)} ({remaining_epochs} epochs left)"
                )
            else:
                logger.info(f"  🎉 Training completed!")

            # Learning rate scheduling - OneCycleLR steps every batch, not epoch
            # (OneCycleLR is stepped in the training loop, not here)

            # Early stopping and best model saving
            if val_loss < best_val_loss:
                best_val_loss = val_loss
                patience_counter = 0
                if save_best_model:
                    best_model_state = self.model.state_dict().copy()
                    logger.info(
                        f"  💾 New best model saved (val_loss: {best_val_loss:.4f})"
                    )
            else:
                patience_counter += 1
                logger.info(
                    f"  ⏳ Patience: {patience_counter}/{early_stopping_patience}"
                )

                if patience_counter >= early_stopping_patience:
                    logger.info(f"🛑 Early stopping at epoch {epoch + 1}")
                    epoch_pbar.close()
                    break

        # Close progress bars
        if "epoch_pbar" in locals():
            epoch_pbar.close()

        # Load best model if saved
        if save_best_model and best_model_state:
            self.model.load_state_dict(best_model_state)
            logger.info(
                f"🔄 Loaded best model with validation loss: {best_val_loss:.4f}"
            )

        training_time = time.time() - start_time
        self.is_trained = True

        # Format final time summary
        def format_time(seconds):
            if seconds < 60:
                return f"{seconds:.1f}s"
            elif seconds < 3600:
                return f"{seconds / 60:.1f}m"
            else:
                return f"{seconds / 3600:.1f}h {(seconds % 3600) / 60:.0f}m"

        # Prepare results
        results = {
            "model_name": self.model_name,
            "architecture": self.architecture,
            "training_samples": len(audio_files),
            "num_classes": num_classes,
            "classes": unique_labels,
            "num_epochs_trained": len(train_losses),
            "training_time": training_time,
            "avg_epoch_time": training_time / len(train_losses) if train_losses else 0,
            "best_val_loss": best_val_loss,
            "final_train_acc": train_accuracies[-1],
            "final_val_acc": val_accuracies[-1],
            "train_losses": train_losses,
            "val_losses": val_losses,
            "train_accuracies": train_accuracies,
            "val_accuracies": val_accuracies,
            "device": str(self.device),
        }

        # Enhanced training summary
        logger.info(f"✅ CNN training completed!")
        logger.info(f"⏱️  Total training time: {format_time(training_time)}")
        logger.info(f"📊 Epochs trained: {len(train_losses)}/{num_epochs}")
        logger.info(f"⚡ Average epoch time: {format_time(results['avg_epoch_time'])}")
        logger.info(f"🎯 Best validation accuracy: {max(val_accuracies):.2f}%")
        logger.info(f"📈 Final validation accuracy: {val_accuracies[-1]:.2f}%")
        logger.info(f"🔥 GPU utilization: {str(self.device).upper()}")

        return results

    def predict(self, audio_files: Union[str, List[str]]) -> Dict:
        """
        Predict genres for audio files.

        Args:
            audio_files: Single audio file path or list of paths

        Returns:
            Dictionary with prediction results
        """
        if not self.is_trained:
            raise ValueError("Model must be trained before making predictions")

        if isinstance(audio_files, str):
            audio_files = [audio_files]

        self.model.eval()
        predictions = []

        with torch.no_grad():
            for audio_file in audio_files:
                try:
                    # Load and preprocess audio
                    y, sr = sf.read(
                        audio_file,
                        dtype="float32",
                        always_2d=False,
                    )
                    if y.ndim > 1:
                        y = np.mean(y, axis=1)

                    if sr != self.sample_rate:
                        y = librosa.resample(
                            y,
                            orig_sr=sr,
                            target_sr=self.sample_rate,
                            res_type="soxr_hq",
                        )

                    # bool_result = y == y2
                    ## print the number of True and False in bool_result
                    # print(np.sum(bool_result), np.sum(~bool_result))

                    # Pad or truncate
                    target_length = int(self.sample_rate * self.duration)
                    if len(y) < target_length:
                        y = np.pad(y, (0, target_length - len(y)), mode="constant")
                    else:
                        y = y[:target_length]

                    # Create mel-spectrogram
                    mel_spec = librosa.feature.melspectrogram(
                        y=y, sr=self.sample_rate, n_mels=self.n_mels, hop_length=512
                    )

                    mel_spec_db = librosa.power_to_db(mel_spec, ref=np.max)
                    mel_spec_norm = (mel_spec_db - mel_spec_db.min()) / (
                        mel_spec_db.max() - mel_spec_db.min()
                    )

                    # Convert to tensor
                    spectrogram = (
                        torch.FloatTensor(mel_spec_norm).unsqueeze(0).unsqueeze(0)
                    )  # Add batch and channel dims
                    spectrogram = spectrogram.to(self.device)

                    # Predict
                    output = self.model(spectrogram)
                    probabilities = F.softmax(output, dim=1).cpu().numpy()[0]
                    predicted_class = np.argmax(probabilities)

                    # Prepare result
                    result = {
                        "file_path": audio_file,
                        "predicted_genre": self.genre_classes[predicted_class],
                        "confidence": float(probabilities[predicted_class]),
                        "all_probabilities": {
                            self.genre_classes[i]: float(prob)
                            for i, prob in enumerate(probabilities)
                        },
                        "model_name": self.model_name,
                    }

                    predictions.append(result)

                except Exception as e:
                    logger.error(f"Error predicting {audio_file}: {str(e)}")
                    predictions.append({"file_path": audio_file, "error": str(e)})

        return {"predictions": predictions[0] if len(predictions) == 1 else predictions}

    def save_model(self, file_path: Union[str, Path]) -> None:
        """
        Save the trained model.

        Args:
            file_path: Path to save the model
        """
        if not self.is_trained:
            raise ValueError("Model must be trained before saving")

        model_data = {
            "model_state_dict": self.model.state_dict(),
            "model_name": self.model_name,
            "architecture": self.architecture,
            "genre_classes": self.genre_classes,
            "sample_rate": self.sample_rate,
            "duration": self.duration,
            "n_mels": self.n_mels,
            "random_state": self.random_state,
            "training_mode": self.training_mode,
            "num_classes": len(self.genre_classes) if self.genre_classes else 0,
        }

        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        torch.save(model_data, file_path)
        logger.info(f"CNN model saved to: {file_path}")

    def load_model(self, file_path: Union[str, Path]) -> None:
        """
        Load a trained model.

        Args:
            file_path: Path to the saved model
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Model file not found: {file_path}")

        model_data = torch.load(file_path, map_location=self.device)

        # Restore model parameters
        self.model_name = model_data["model_name"]
        self.architecture = model_data["architecture"]
        self.genre_classes = model_data["genre_classes"]
        self.sample_rate = model_data["sample_rate"]
        self.duration = model_data["duration"]
        self.n_mels = model_data["n_mels"]
        self.random_state = model_data["random_state"]
        self.training_mode = model_data["training_mode"]

        # Recreate and load model
        num_classes = model_data["num_classes"]
        self.model = self.create_model(num_classes)
        self.model.load_state_dict(model_data["model_state_dict"])

        self.is_trained = True
        logger.info(f"CNN model loaded from: {file_path}")


class HierarchicalCNNMusicClassifier:
    """
    Hierarchical CNN classifier that predicts both genre and subgenre.
    Uses two separate models: one for genre classification, one for subgenre.
    """

    def __init__(
        self,
        model_name: str = "hierarchical-cnn-v1.0",
        architecture: str = "hybrid",
        sample_rate: int = 22050,
        duration: float = 30.0,
        n_mels: int = 128,
        device: str = "auto",
        random_state: int = 42,
    ):
        """Initialize hierarchical CNN classifier."""
        self.model_name = model_name
        self.architecture = architecture
        self.sample_rate = sample_rate
        self.duration = duration
        self.n_mels = n_mels
        self.random_state = random_state

        # Set device
        if device == "auto":
            self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        else:
            self.device = torch.device(device)

        # Models
        self.genre_classifier = None
        self.subgenre_classifier = None
        self.genre_classes = None
        self.subgenre_classes = None
        self.is_trained = False

        # Set random seeds
        torch.manual_seed(random_state)
        if torch.cuda.is_available():
            torch.cuda.manual_seed(random_state)
        np.random.seed(random_state)

    def train(
        self,
        audio_files: List[str],
        labels: List[Dict],  # List of {'genre': str, 'subgenre': str, 'label': str}
        num_epochs: int = 50,
        learning_rate: float = 0.001,
        validation_split: float = 0.2,
    ) -> Dict:
        """Train both genre and subgenre classifiers."""
        logger.info(f"🎵 Starting Hierarchical CNN Training...")
        logger.info(f"Device: {self.device}")
        logger.info(f"Training samples: {len(audio_files)}")

        start_time = time.time()

        # Extract genre and subgenre labels
        genre_labels = [label_info["genre"] for label_info in labels]
        subgenre_labels = [label_info["subgenre"] for label_info in labels]

        # Train genre classifier
        logger.info(f"🎯 Training Genre Classifier...")
        genre_classifier = CNNMusicClassifier(
            model_name=f"{self.model_name}-genre",
            architecture=self.architecture,
            sample_rate=self.sample_rate,
            duration=self.duration,
            n_mels=self.n_mels,
            device=str(self.device),
            random_state=self.random_state,
        )

        genre_results = genre_classifier.train(
            audio_files=audio_files,
            labels=genre_labels,
            num_epochs=num_epochs,
            learning_rate=learning_rate,
            validation_split=validation_split,
        )

        # Train subgenre classifier
        logger.info(f"🎶 Training Subgenre Classifier...")
        subgenre_classifier = CNNMusicClassifier(
            model_name=f"{self.model_name}-subgenre",
            architecture=self.architecture,
            sample_rate=self.sample_rate,
            duration=self.duration,
            n_mels=self.n_mels,
            device=str(self.device),
            random_state=self.random_state,
        )

        subgenre_results = subgenre_classifier.train(
            audio_files=audio_files,
            labels=subgenre_labels,
            num_epochs=num_epochs,
            learning_rate=learning_rate,
            validation_split=validation_split,
        )

        # Store models
        self.genre_classifier = genre_classifier
        self.subgenre_classifier = subgenre_classifier
        self.genre_classes = genre_classifier.genre_classes
        self.subgenre_classes = (
            subgenre_classifier.genre_classes
        )  # Using genre_classes field
        self.is_trained = True

        training_time = time.time() - start_time

        # Combine results
        results = {
            "model_name": self.model_name,
            "architecture": self.architecture,
            "training_time": training_time,
            "genre_results": genre_results,
            "subgenre_results": subgenre_results,
            "device": str(self.device),
        }

        logger.info(
            f"✅ Hierarchical CNN training completed in {training_time:.1f} seconds"
        )
        logger.info(f"🎯 Genre accuracy: {genre_results['final_val_acc']:.2f}%")
        logger.info(f"🎶 Subgenre accuracy: {subgenre_results['final_val_acc']:.2f}%")

        return results

    def predict(self, audio_files: Union[str, List[str]]) -> Dict:
        """Predict both genre and subgenre for audio files."""
        if not self.is_trained:
            raise ValueError("Model must be trained before making predictions")

        # Get predictions from both models
        genre_pred = self.genre_classifier.predict(audio_files)
        subgenre_pred = self.subgenre_classifier.predict(audio_files)

        # Combine predictions
        if isinstance(audio_files, str):
            # Single file
            return {
                "file_path": audio_files,
                "predicted_genre": genre_pred["predictions"]["predicted_genre"],
                "genre_confidence": genre_pred["predictions"]["confidence"],
                "predicted_subgenre": subgenre_pred["predictions"][
                    "predicted_genre"
                ],  # Using genre field
                "subgenre_confidence": subgenre_pred["predictions"]["confidence"],
                "combined_confidence": genre_pred["predictions"]["confidence"]
                * subgenre_pred["predictions"]["confidence"],
            }
        else:
            # Multiple files
            combined_predictions = []
            for i, file_path in enumerate(audio_files):
                combined_predictions.append(
                    {
                        "file_path": file_path,
                        "predicted_genre": genre_pred["predictions"][i][
                            "predicted_genre"
                        ],
                        "genre_confidence": genre_pred["predictions"][i]["confidence"],
                        "predicted_subgenre": subgenre_pred["predictions"][i][
                            "predicted_genre"
                        ],
                        "subgenre_confidence": subgenre_pred["predictions"][i][
                            "confidence"
                        ],
                        "combined_confidence": genre_pred["predictions"][i][
                            "confidence"
                        ]
                        * subgenre_pred["predictions"][i]["confidence"],
                    }
                )

            return {"predictions": combined_predictions}

    def save_model(self, file_path: Union[str, Path]) -> None:
        """Save both genre and subgenre models."""
        if not self.is_trained:
            raise ValueError("Model must be trained before saving")

        # Save genre model
        genre_path = str(file_path).replace(".pth", "_genre.pth")
        self.genre_classifier.save_model(genre_path)

        # Save subgenre model
        subgenre_path = str(file_path).replace(".pth", "_subgenre.pth")
        self.subgenre_classifier.save_model(subgenre_path)

        # Save hierarchical model info
        model_info = {
            "model_name": self.model_name,
            "architecture": self.architecture,
            "genre_model_path": genre_path,
            "subgenre_model_path": subgenre_path,
            "genre_classes": self.genre_classes,
            "subgenre_classes": self.subgenre_classes,
        }

        info_path = str(file_path).replace(".pth", "_info.json")
        import json

        with open(info_path, "w") as f:
            json.dump(model_info, f, indent=2)

        logger.info(f"Hierarchical CNN model saved:")
        logger.info(f"  Genre model: {genre_path}")
        logger.info(f"  Subgenre model: {subgenre_path}")
        logger.info(f"  Model info: {info_path}")


def build_genre_mapping_from_dataset(dataset_path: str) -> Dict[str, str]:
    """
    Build genre mapping from dataset folder structure.

    Args:
        dataset_path: Path to hierarchical dataset (genre/subgenre/files)

    Returns:
        Dictionary mapping subgenre -> genre
    """
    genre_mapping = {}

    if not os.path.exists(dataset_path):
        logger.warning(f"Dataset path does not exist: {dataset_path}")
        return genre_mapping

    try:
        for genre_dir in os.listdir(dataset_path):
            genre_path = os.path.join(dataset_path, genre_dir)
            if os.path.isdir(genre_path):
                # Check for subgenre directories
                subgenre_dirs = [
                    d
                    for d in os.listdir(genre_path)
                    if os.path.isdir(os.path.join(genre_path, d))
                ]

                if subgenre_dirs:
                    # Hierarchical structure: genre/subgenre/files
                    for subgenre_dir in subgenre_dirs:
                        genre_mapping[subgenre_dir] = genre_dir
                        logger.debug(f"  {subgenre_dir} -> {genre_dir}")
                else:
                    # Flat structure: genre/files (genre is also the subgenre)
                    genre_mapping[genre_dir] = genre_dir
                    logger.debug(f"  {genre_dir} -> {genre_dir}")

    except Exception as e:
        logger.error(f"Error building genre mapping: {e}")
        return {}

    return genre_mapping


def train_hierarchical_cnn_music_model(
    audio_files: List[str],
    labels: List[Dict],
    output_dir: str = "models",
    model_name: str = "hierarchical-cnn-v1.0",
    architecture: str = "hybrid",
    num_epochs: int = 50,
    learning_rate: float = 0.001,
    validation_split: float = 0.2,
) -> Dict:
    """Train hierarchical CNN model that predicts both genre and subgenre."""
    logger.info(f"🎵 Training Hierarchical CNN model on {len(audio_files)} audio files")
    logger.info(f"Architecture: {architecture}")

    # Initialize classifier
    classifier = HierarchicalCNNMusicClassifier(
        model_name=model_name, architecture=architecture
    )

    # Train model
    results = classifier.train(
        audio_files=audio_files,
        labels=labels,
        num_epochs=num_epochs,
        learning_rate=learning_rate,
        validation_split=validation_split,
    )

    # Save model
    model_path = os.path.join(output_dir, f"{model_name}.pth")
    classifier.save_model(model_path)

    # Save training results
    results_path = os.path.join(output_dir, f"{model_name}_results.json")
    import json

    with open(results_path, "w") as f:
        json.dump(results, f, indent=2, default=str)

    logger.info(f"Hierarchical CNN training completed. Models saved to: {output_dir}")
    logger.info(f"Results saved to: {results_path}")

    return results


def train_cnn_from_dataset(
    dataset_path: str,
    output_dir: str = "models",
    model_name: str = "cnn-music-v1.0",
    architecture: str = "hybrid",  # Default to hybrid for better performance
    target_samples_per_genre: int = 2000,
    segment_duration: float = 10.0,
    num_epochs: int = 100,
    learning_rate: float = 0.001,
    validation_split: float = 0.2,
    max_workers: int = None,
    genre_only: bool = False,  # Add genre_only parameter
    batch_size: int = 32,
) -> Dict:
    """
    Complete CNN training pipeline: preprocessing + training.

    Args:
        dataset_path: Path to the hierarchical music dataset
        output_dir: Directory to save models and segments
        model_name: Name/version of the model
        architecture: Model architecture ("cnn" or "hybrid")
        target_samples_per_genre: Target samples per genre for balancing
        segment_duration: Duration of audio segments
        num_epochs: Number of training epochs
        learning_rate: Learning rate for training
        validation_split: Fraction for validation
        max_workers: Number of parallel workers
        genre_only: Whether to train only on genres
        batch_size: Batch size for training
    Returns:
        Dictionary with complete training results
    """
    logger.info(f"🎵 Starting complete CNN training pipeline...")
    logger.info(f"Dataset: {dataset_path}")
    logger.info(f"Architecture: {architecture}")
    logger.info(f"Target samples per genre: {target_samples_per_genre}")

    start_time = time.time()

    # Step 1: Create balanced audio segments
    segments_dir = Path(output_dir) / "segments"
    logger.info(f"📊 Step 1: Creating balanced segments...")

    audio_files, labels = create_balanced_audio_segments(
        dataset_path=dataset_path,
        output_dir=str(segments_dir),
        target_samples_per_genre=target_samples_per_genre,
        segment_duration=segment_duration,
        max_workers=max_workers,
        genre_only=genre_only,
    )

    preprocessing_time = time.time() - start_time
    logger.info(f"✅ Preprocessing completed in {preprocessing_time:.1f}s")
    logger.info(f"📈 Created {len(audio_files)} balanced segments")

    # Step 2: Train CNN model
    if genre_only:
        logger.info(f"🚀 Step 2: Training Genre-Only CNN model...")
    else:
        logger.info(f"🚀 Step 2: Training Hierarchical CNN model...")

    training_start = time.time()

    if genre_only:
        # For genre-only training, extract just the genre labels
        if labels and isinstance(labels[0], str):
            # Dynamically build genre mapping from dataset structure
            logger.info("🗂️  Building genre mapping from dataset structure...")
            genre_mapping = build_genre_mapping_from_dataset(dataset_path)
            genre_labels = [genre_mapping.get(label, label) for label in labels]
        else:
            # Labels are already hierarchical, extract genres
            genre_labels = [label_info["genre"] for label_info in labels]

        logger.info(f"🎯 Genre-only training with {len(set(genre_labels))} genres")

        results = train_cnn_music_model(
            audio_files=audio_files,
            labels=genre_labels,  # Only genre labels
            output_dir=output_dir,
            model_name=model_name,
            architecture=architecture,
            num_epochs=num_epochs,
            learning_rate=learning_rate,
            validation_split=validation_split,
            batch_size=batch_size,
        )
    else:
        # Convert labels to hierarchical format if they aren't already
        if labels and isinstance(labels[0], str):
            # Dynamically build genre mapping from dataset structure
            logger.info("🗂️  Building genre mapping from dataset structure...")
            genre_mapping = build_genre_mapping_from_dataset(dataset_path)

            hierarchical_labels = []
            for label in labels:
                genre = genre_mapping.get(
                    label, label
                )  # Fallback to label if not found
                hierarchical_labels.append(
                    {"genre": genre, "subgenre": label, "label": label}
                )
            labels = hierarchical_labels

            logger.info(
                f"📊 Genre mapping created: {len(set(genre_mapping.values()))} genres, {len(genre_mapping)} subgenres"
            )

        results = train_hierarchical_cnn_music_model(
            audio_files=audio_files,
            labels=labels,  # Now hierarchical
            output_dir=output_dir,
            model_name=model_name,
            architecture=architecture,
            num_epochs=num_epochs,
            learning_rate=learning_rate,
            validation_split=validation_split,
        )

    training_time = time.time() - training_start
    total_time = time.time() - start_time

    # Add preprocessing info to results
    results.update(
        {
            "preprocessing_time": preprocessing_time,
            "total_time": total_time,
            "segments_created": len(audio_files),
            "target_samples_per_genre": target_samples_per_genre,
            "segment_duration": segment_duration,
            "segments_directory": str(segments_dir),
        }
    )

    logger.info(f"🎉 Complete CNN pipeline finished!")
    logger.info(f"⏱️  Preprocessing: {preprocessing_time:.1f}s")
    logger.info(f"🚀 Training: {training_time:.1f}s")
    logger.info(f"📈 Total time: {total_time:.1f}s")

    # Handle different result structures
    if "final_val_acc" in results:
        # Simple CNN training result
        logger.info(f"🎯 Final validation accuracy: {results['final_val_acc']:.2f}%")
    elif "genre_results" in results and "subgenre_results" in results:
        # Hierarchical training results
        genre_acc = results["genre_results"]["final_val_acc"]
        subgenre_acc = results["subgenre_results"]["final_val_acc"]
        logger.info(f"🎯 Genre validation accuracy: {genre_acc:.2f}%")
        logger.info(f"🎵 Subgenre validation accuracy: {subgenre_acc:.2f}%")
    else:
        logger.info("🎯 Training completed (accuracy metrics not available)")

    return results


def train_cnn_music_model(
    audio_files: List[str],
    labels: List[str],
    output_dir: str = "models",
    model_name: str = "cnn-music-v1.0",
    architecture: str = "cnn",
    num_epochs: int = 50,
    learning_rate: float = 0.001,
    validation_split: float = 0.2,
    batch_size: int = 32,
) -> Dict:
    """
    Train CNN model on music dataset.

    Args:
        audio_files: List of audio file paths
        labels: List of corresponding labels
        output_dir: Directory to save the trained model
        model_name: Name/version of the model
        architecture: Model architecture ("cnn" or "hybrid")
        num_epochs: Number of training epochs
        learning_rate: Learning rate for training
        validation_split: Fraction of data for validation
        batch_size: Batch size for training
    Returns:
        Dictionary with training results
    """
    logger.info(f"Training CNN model on {len(audio_files)} audio files")
    logger.info(f"Architecture: {architecture}")

    # Initialize classifier
    classifier = CNNMusicClassifier(
        model_name=model_name, architecture=architecture, batch_size=batch_size
    )

    # Train model
    results = classifier.train(
        audio_files=audio_files,
        labels=labels,
        num_epochs=num_epochs,
        learning_rate=learning_rate,
        validation_split=validation_split,
    )

    # Save model
    model_path = os.path.join(output_dir, f"{model_name}.pth")
    classifier.save_model(model_path)

    # Save training results
    results_path = os.path.join(output_dir, f"{model_name}_results.json")
    import json

    with open(results_path, "w") as f:
        json.dump(results, f, indent=2)

    logger.info(f"CNN training completed. Model saved to: {model_path}")
    logger.info(f"Results saved to: {results_path}")

    return results


if __name__ == "__main__":
    """
    Example usage and training script.
    """
    import argparse
    import glob

    parser = argparse.ArgumentParser(description="Train CNN model on music dataset")
    parser.add_argument(
        "--dataset", required=True, help="Path to music dataset directory"
    )
    parser.add_argument(
        "--output", default="models", help="Output directory for trained model"
    )
    parser.add_argument(
        "--model-name", default="cnn-music-v1.0", help="Model name/version"
    )
    parser.add_argument(
        "--architecture",
        choices=["cnn", "hybrid"],
        default="cnn",
        help="Model architecture",
    )
    parser.add_argument(
        "--epochs", type=int, default=50, help="Number of training epochs"
    )
    parser.add_argument("--lr", type=float, default=0.001, help="Learning rate")
    parser.add_argument(
        "--val-split", type=float, default=0.2, help="Validation split fraction"
    )
    parser.add_argument(
        "--target-samples", type=int, default=2000, help="Target samples per genre"
    )
    parser.add_argument(
        "--segment-duration",
        type=float,
        default=10.0,
        help="Segment duration in seconds",
    )
    parser.add_argument(
        "--workers", type=int, default=None, help="Number of parallel workers"
    )
    parser.add_argument(
        "--use-preprocessing",
        action="store_true",
        help="Use complete pipeline with preprocessing",
    )
    parser.add_argument(
        "--genre-only",
        action="store_true",
        help="Train only on genres (16 classes) instead of subgenres (93 classes)",
    )
    parser.add_argument(
        "--batch-size", type=int, default=32, help="Batch size for training"
    )

    args = parser.parse_args()

    # Collect audio files and labels
    audio_files = []
    labels = []

    print(f"Scanning dataset directory: {args.dataset}")

    # Handle hierarchical dataset structure: dataset/genre/subgenre/audio_files
    if not os.path.exists(args.dataset):
        print(f"❌ Dataset directory does not exist: {args.dataset}")
        exit(1)

    for genre_dir in os.listdir(args.dataset):
        genre_path = os.path.join(args.dataset, genre_dir)
        if os.path.isdir(genre_path):
            print(f"📁 Found genre directory: {genre_dir}")

            # Check for subgenre directories
            subgenre_dirs = [
                d
                for d in os.listdir(genre_path)
                if os.path.isdir(os.path.join(genre_path, d))
            ]

            if subgenre_dirs:
                # Hierarchical structure: genre/subgenre/files
                print(f"   📂 Found {len(subgenre_dirs)} subgenres: {subgenre_dirs}")
                for subgenre_dir in subgenre_dirs:
                    subgenre_path = os.path.join(genre_path, subgenre_dir)
                    subgenre_files = (
                        glob.glob(os.path.join(subgenre_path, "*.wav"))
                        + glob.glob(os.path.join(subgenre_path, "*.mp3"))
                        + glob.glob(os.path.join(subgenre_path, "*.flac"))
                    )

                    print(f"      🎵 {subgenre_dir}: {len(subgenre_files)} files")
                    audio_files.extend(subgenre_files)
                    # Store both genre and subgenre information
                    for _ in subgenre_files:
                        labels.append(
                            {
                                "genre": genre_dir,
                                "subgenre": subgenre_dir,
                                "label": subgenre_dir,  # For compatibility
                            }
                        )
            else:
                # Flat structure: genre/files
                genre_files = (
                    glob.glob(os.path.join(genre_path, "*.wav"))
                    + glob.glob(os.path.join(genre_path, "*.mp3"))
                    + glob.glob(os.path.join(genre_path, "*.flac"))
                )

                print(f"   🎵 Direct files: {len(genre_files)} files")
                audio_files.extend(genre_files)
                # For flat structure, genre is the same as subgenre
                for _ in genre_files:
                    labels.append(
                        {"genre": genre_dir, "subgenre": genre_dir, "label": genre_dir}
                    )

    # Extract labels for display
    genre_labels = [
        label_info["genre"] if isinstance(label_info, dict) else label_info
        for label_info in labels
    ]
    subgenre_labels = [
        label_info["subgenre"] if isinstance(label_info, dict) else label_info
        for label_info in labels
    ]
    simple_labels = [
        label_info["label"] if isinstance(label_info, dict) else label_info
        for label_info in labels
    ]

    # Handle genre-only training
    if args.genre_only:
        print(f"🎯 Genre-Only Training Mode Enabled")
        print(
            f"📊 Converting {len(set(subgenre_labels))} subgenres to {len(set(genre_labels))} genres"
        )

        # Convert labels to genre-only
        if isinstance(labels[0], dict):
            # Convert hierarchical labels to genre-only
            labels = [
                {
                    "genre": label_info["genre"],
                    "subgenre": label_info["genre"],
                    "label": label_info["genre"],
                }
                for label_info in labels
            ]
        else:
            # For flat labels, this would need genre mapping - but we have hierarchical structure
            pass

        # Update display labels
        genre_labels = [label_info["genre"] for label_info in labels]
        subgenre_labels = [
            label_info["genre"] for label_info in labels
        ]  # Same as genre for genre-only
        simple_labels = [label_info["genre"] for label_info in labels]

    print(f"Found {len(audio_files)} audio files")
    print(f"Genres: {set(genre_labels)}")
    print(f"Subgenres: {set(subgenre_labels)}")

    # Show detected hierarchical structure
    if isinstance(labels[0], dict):
        print(f"\n📊 Detected Hierarchical Structure:")
        genre_to_subgenres = {}
        for label_info in labels:
            genre = label_info["genre"]
            subgenre = label_info["subgenre"]
            if genre not in genre_to_subgenres:
                genre_to_subgenres[genre] = set()
            genre_to_subgenres[genre].add(subgenre)

        for genre, subgenres in sorted(genre_to_subgenres.items()):
            print(
                f"  🎵 {genre} ({len(subgenres)} subgenres): {', '.join(sorted(subgenres))}"
            )
        print()

    if len(audio_files) == 0:
        print("No audio files found. Please check the dataset path.")
        exit(1)

    # Train model
    try:
        if args.use_preprocessing:
            # Use complete pipeline with preprocessing
            results = train_cnn_from_dataset(
                dataset_path=args.dataset,
                output_dir=args.output,
                model_name=args.model_name,
                architecture=args.architecture,
                target_samples_per_genre=args.target_samples,
                segment_duration=args.segment_duration,
                num_epochs=args.epochs,
                learning_rate=args.lr,
                validation_split=args.val_split,
                max_workers=args.workers,
                genre_only=args.genre_only,  # Pass genre_only flag
                batch_size=args.batch_size,
            )
        else:
            # Use existing audio files with hierarchical training
            if args.genre_only:
                # For genre-only, use simple CNN training with genre labels
                genre_only_labels = [
                    label_info["genre"] if isinstance(label_info, dict) else label_info
                    for label_info in labels
                ]
                results = train_cnn_music_model(
                    audio_files=audio_files,
                    labels=genre_only_labels,  # Only genre labels
                    output_dir=args.output,
                    model_name=args.model_name,
                    architecture=args.architecture,
                    num_epochs=args.epochs,
                    learning_rate=args.lr,
                    validation_split=args.val_split,
                    batch_size=args.batch_size,
                )
            else:
                # Use hierarchical training for both genre and subgenre
                results = train_hierarchical_cnn_music_model(
                    audio_files=audio_files,
                    labels=labels,  # Now contains genre/subgenre info
                    output_dir=args.output,
                    model_name=args.model_name,
                    architecture=args.architecture,
                    num_epochs=args.epochs,
                    learning_rate=args.lr,
                    validation_split=args.val_split,
                )

        print("\n=== CNN Training Results ===")
        print(f"Model: {results['model_name']}")
        print(f"Architecture: {results['architecture']}")
        print(f"Training time: {results['training_time']:.1f}s")
        print(f"Device used: {results['device']}")

        # Handle different result structures
        if "final_val_acc" in results:
            # Simple CNN training result
            print(f"\n🎯 Classification Results:")
            print(f"  Classes: {results['num_classes']}")
            print(f"  Training samples: {results['training_samples']}")
            print(f"  Epochs trained: {results['num_epochs_trained']}")
            print(f"  Final train accuracy: {results['final_train_acc']:.2f}%")
            print(f"  Final validation accuracy: {results['final_val_acc']:.2f}%")

            # Set variables for target accuracy check
            genre_acc = results["final_val_acc"]
            subgenre_acc = 0  # Not applicable for simple training

        elif "genre_results" in results and "subgenre_results" in results:
            # Hierarchical training results
            genre_res = results["genre_results"]
            subgenre_res = results["subgenre_results"]

            print(f"\n🎯 Genre Classification:")
            print(f"  Classes: {len(genre_res['classes'])}")
            print(f"  Training samples: {genre_res['training_samples']}")
            print(f"  Epochs trained: {genre_res['num_epochs_trained']}")
            print(f"  Final train accuracy: {genre_res['final_train_acc']:.2f}%")
            print(f"  Final validation accuracy: {genre_res['final_val_acc']:.2f}%")

            print(f"\n🎶 Subgenre Classification:")
            print(f"  Classes: {len(subgenre_res['classes'])}")
            print(f"  Training samples: {subgenre_res['training_samples']}")
            print(f"  Epochs trained: {subgenre_res['num_epochs_trained']}")
            print(f"  Final train accuracy: {subgenre_res['final_train_acc']:.2f}%")
            print(f"  Final validation accuracy: {subgenre_res['final_val_acc']:.2f}%")

            # Set variables for target accuracy check
            genre_acc = genre_res["final_val_acc"]
            subgenre_acc = subgenre_res["final_val_acc"]
        else:
            print("\n⚠️  Results format not recognized")
            genre_acc = 0
            subgenre_acc = 0

        # Check if target accuracy is met
        target_accuracy = 80.0  # 80% target

        print(f"\n🎯 Target Accuracy Analysis (>= {target_accuracy}%):")

        # For genre-only training, adjust target to be more realistic
        if args.genre_only:
            target_accuracy = 70.0  # Lower target for genre-only
            print(f"  (Genre-only training - target adjusted to {target_accuracy}%)")

        if genre_acc >= target_accuracy:
            print(f"  ✅ Primary: {genre_acc:.2f}% - SUCCESS")
        else:
            print(f"  ❌ Primary: {genre_acc:.2f}% - Below target")

        # Only check subgenre if it's hierarchical training
        if subgenre_acc > 0:  # Hierarchical training
            if subgenre_acc >= target_accuracy:
                print(f"  ✅ Subgenre: {subgenre_acc:.2f}% - SUCCESS")
            else:
                print(f"  ❌ Subgenre: {subgenre_acc:.2f}% - Below target")

            success = genre_acc >= target_accuracy and subgenre_acc >= target_accuracy
        else:  # Simple training
            success = genre_acc >= target_accuracy

        if success:
            print(f"\n🎉 SUCCESS: Model achieved target accuracy!")
        else:
            print(f"\n⚠️  NEEDS IMPROVEMENT: Below target accuracy")
            print("Consider:")
            print("- Increasing number of epochs")
            print("- Using preprocessing with more audio segments")
            print("- Adjusting learning rate")
            print("- Trying different architectures (cnn vs hybrid)")
            print("- Reducing number of classes (genre-only vs hierarchical)")

    except Exception as e:
        logger.error(f"CNN training failed: {str(e)}")
        raise
