"""
Audio Feature Extraction Module

This module implements audio feature extraction using librosa for music classification.
Extracts MFCC, spectral features, chroma, and other characteristics needed for
genre classification and audio fingerprinting.

Based on the Muzo data model and AI service API specifications.
"""

import logging
import os
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Union

import librosa
import numpy as np
import pandas as pd

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class AudioFeatureExtractor:
    """
    Audio feature extraction class using librosa.

    Extracts comprehensive audio features including:
    - MFCC (Mel-frequency cepstral coefficients)
    - Spectral features (centroid, rolloff, contrast)
    - Chroma features
    - Rhythm features (tempo, zero crossing rate)
    - Musical features (key, energy, valence, danceability)
    """

    def __init__(
        self,
        sample_rate: int = 22050,
        hop_length: int = 512,
        n_mfcc: int = 13,
        n_chroma: int = 12,
    ):
        """
        Initialize the feature extractor.

        Args:
            sample_rate: Target sample rate for audio loading
            hop_length: Number of samples between successive frames
            n_mfcc: Number of MFCC coefficients to extract
            n_chroma: Number of chroma bins
        """
        self.sample_rate = sample_rate
        self.hop_length = hop_length
        self.n_mfcc = n_mfcc
        self.n_chroma = n_chroma

    def load_audio(self, file_path: Union[str, Path]) -> Tuple[np.ndarray, int]:
        """
        Load audio file using librosa.

        Args:
            file_path: Path to audio file

        Returns:
            Tuple of (audio_data, sample_rate)

        Raises:
            FileNotFoundError: If file doesn't exist
            librosa.util.exceptions.ParameterError: If file is corrupted
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Audio file not found: {file_path}")

        try:
            y, sr = librosa.load(file_path, sr=self.sample_rate)
            logger.info(f"Loaded audio: {file_path}, duration: {len(y) / sr:.2f}s")
            return y, sr
        except Exception as e:
            logger.error(f"Error loading audio file {file_path}: {str(e)}")
            raise

    def extract_mfcc(self, y: np.ndarray) -> np.ndarray:
        """
        Extract Mel-frequency cepstral coefficients (MFCC).

        Args:
            y: Audio time series

        Returns:
            MFCC features as numpy array
        """
        mfcc = librosa.feature.mfcc(
            y=y, sr=self.sample_rate, n_mfcc=self.n_mfcc, hop_length=self.hop_length
        )

        # Return mean and std of MFCC coefficients
        mfcc_mean = np.mean(mfcc, axis=1)
        mfcc_std = np.std(mfcc, axis=1)

        return np.concatenate([mfcc_mean, mfcc_std])

    def extract_spectral_features(self, y: np.ndarray) -> Dict[str, float]:
        """
        Extract spectral features including centroid, rolloff, and contrast.

        Args:
            y: Audio time series

        Returns:
            Dictionary of spectral features
        """
        # Spectral centroid
        spectral_centroids = librosa.feature.spectral_centroid(
            y=y, sr=self.sample_rate, hop_length=self.hop_length
        )
        spectral_centroid = np.mean(spectral_centroids)

        # Spectral rolloff
        spectral_rolloff = librosa.feature.spectral_rolloff(
            y=y, sr=self.sample_rate, hop_length=self.hop_length
        )
        spectral_rolloff = np.mean(spectral_rolloff)

        # Spectral contrast
        spectral_contrast = librosa.feature.spectral_contrast(
            y=y, sr=self.sample_rate, hop_length=self.hop_length
        )
        spectral_contrast_mean = np.mean(spectral_contrast, axis=1)

        return {
            "spectral_centroid": float(spectral_centroid),
            "spectral_rolloff": float(spectral_rolloff),
            "spectral_contrast": spectral_contrast_mean.tolist(),
        }

    def extract_chroma_features(self, y: np.ndarray) -> np.ndarray:
        """
        Extract chroma features (pitch class profile).

        Args:
            y: Audio time series

        Returns:
            Chroma features as numpy array
        """
        chroma = librosa.feature.chroma_stft(
            y=y, sr=self.sample_rate, hop_length=self.hop_length, n_chroma=self.n_chroma
        )

        # Return mean chroma features
        return np.mean(chroma, axis=1)

    def extract_zero_crossing_rate(self, y: np.ndarray) -> float:
        """
        Extract zero crossing rate.

        Args:
            y: Audio time series

        Returns:
            Zero crossing rate
        """
        zcr = librosa.feature.zero_crossing_rate(y, hop_length=self.hop_length)
        return float(np.mean(zcr))

    def extract_tempo(self, y: np.ndarray) -> float:
        """
        Extract tempo (beats per minute).

        Args:
            y: Audio time series

        Returns:
            Tempo in BPM
        """
        tempo, _ = librosa.beat.beat_track(y=y, sr=self.sample_rate)
        return float(tempo)

    def extract_key(self, y: np.ndarray) -> Optional[str]:
        """
        Extract musical key.

        Args:
            y: Audio time series

        Returns:
            Musical key as string (e.g., 'C', 'G#', 'Fm')
        """
        try:
            chroma = librosa.feature.chroma_stft(y=y, sr=self.sample_rate)
            key = librosa.feature.chroma_stft(y=y, sr=self.sample_rate)

            # Simple key detection based on chroma peaks
            key_profiles = {
                "C": [1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1],  # C major
                "G": [1, 0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1],  # G major
                "D": [0, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1],  # D major
                "A": [1, 0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1],  # A major
                "E": [0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 1],  # E major
                "B": [1, 0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1],  # B major
                "F#": [0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 1],  # F# major
                "C#": [1, 0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1],  # C# major
            }

            chroma_mean = np.mean(chroma, axis=1)
            correlations = {}

            for key_name, profile in key_profiles.items():
                correlation = np.corrcoef(chroma_mean, profile)[0, 1]
                correlations[key_name] = correlation

            # Return key with highest correlation
            detected_key = max(correlations, key=correlations.get)
            return detected_key

        except Exception as e:
            logger.warning(f"Could not detect key: {str(e)}")
            return None

    def extract_energy(self, y: np.ndarray) -> float:
        """
        Extract energy level (RMS energy).

        Args:
            y: Audio time series

        Returns:
            Energy level (0-1)
        """
        rms = librosa.feature.rms(y=y, hop_length=self.hop_length)
        energy = np.mean(rms)
        # Normalize to 0-1 range
        return float(min(energy, 1.0))

    def extract_valence_danceability(self, y: np.ndarray) -> Tuple[float, float]:
        """
        Extract valence and danceability features.

        Note: This is a simplified implementation. In production, you might
        want to use more sophisticated models or external APIs.

        Args:
            y: Audio time series

        Returns:
            Tuple of (valence, danceability) scores (0-1)
        """
        # Simplified valence based on spectral centroid and energy
        spectral_centroids = librosa.feature.spectral_centroid(y=y, sr=self.sample_rate)
        spectral_centroid = np.mean(spectral_centroids)

        # Higher spectral centroid suggests brighter/more positive valence
        valence = min(spectral_centroid / 3000.0, 1.0)  # Normalize to 0-1

        # Simplified danceability based on tempo and rhythm
        tempo, _ = librosa.beat.beat_track(y=y, sr=self.sample_rate)

        # Tempo-based danceability (120-140 BPM is most danceable)
        if 120 <= tempo <= 140:
            danceability = 1.0
        elif 100 <= tempo < 120 or 140 < tempo <= 160:
            danceability = 0.7
        else:
            danceability = 0.4

        return float(valence), float(danceability)

    def extract_all_features(self, file_path: Union[str, Path]) -> Dict:
        """
        Extract all audio features from a file.

        Args:
            file_path: Path to audio file

        Returns:
            Dictionary containing all extracted features

        Raises:
            FileNotFoundError: If file doesn't exist
            Exception: If feature extraction fails
        """
        try:
            # Load audio
            y, sr = self.load_audio(file_path)

            # Extract all features
            features = {}

            # Basic features
            features["mfcc"] = self.extract_mfcc(y).tolist()
            features["zero_crossing_rate"] = self.extract_zero_crossing_rate(y)

            # Spectral features
            spectral_features = self.extract_spectral_features(y)
            features.update(spectral_features)

            # Chroma features
            features["chroma"] = self.extract_chroma_features(y).tolist()

            # Rhythm and musical features
            features["tempo"] = self.extract_tempo(y)
            features["key"] = self.extract_key(y)
            features["energy"] = self.extract_energy(y)

            # Mood features
            valence, danceability = self.extract_valence_danceability(y)
            features["valence"] = valence
            features["danceability"] = danceability

            # Add metadata
            features["file_path"] = str(file_path)
            features["duration"] = len(y) / sr
            features["length"] = len(y) / sr  # Duration in seconds
            features["sample_rate"] = sr

            logger.info(f"Successfully extracted features from {file_path}")
            return features

        except Exception as e:
            logger.error(f"Failed to extract features from {file_path}: {str(e)}")
            raise

    def extract_features_batch(self, file_paths: List[Union[str, Path]]) -> List[Dict]:
        """
        Extract features from multiple files.

        Args:
            file_paths: List of audio file paths

        Returns:
            List of feature dictionaries
        """
        features_list = []

        for file_path in file_paths:
            try:
                features = self.extract_all_features(file_path)
                features_list.append(features)
            except Exception as e:
                logger.error(f"Skipping file {file_path} due to error: {str(e)}")
                # Add error information
                features_list.append(
                    {
                        "file_path": str(file_path),
                        "error": str(e),
                        "extraction_failed": True,
                    }
                )

        return features_list


def extract_dataset_features(
    dataset_path: str, output_path: str, sample_size: Optional[int] = None
) -> pd.DataFrame:
    """
    Extract features from music dataset and save to CSV.

    Args:
        dataset_path: Path to music dataset directory
        output_path: Path to save features CSV
        sample_size: Optional sample size for testing (None for full dataset)

    Returns:
        DataFrame with extracted features
    """
    extractor = AudioFeatureExtractor()

    # Get all audio files
    audio_files = []
    genres = []

    for genre_dir in os.listdir(dataset_path):
        genre_path = os.path.join(dataset_path, genre_dir)
        if os.path.isdir(genre_path):
            for file_name in os.listdir(genre_path):
                if file_name.endswith(".wav"):
                    file_path = os.path.join(genre_path, file_name)
                    audio_files.append(file_path)
                    genres.append(genre_dir)

    # Sample if requested
    if sample_size and sample_size < len(audio_files):
        indices = np.random.choice(len(audio_files), sample_size, replace=False)
        audio_files = [audio_files[i] for i in indices]
        genres = [genres[i] for i in indices]

    logger.info(f"Extracting features from {len(audio_files)} files")

    # Extract features
    features_list = extractor.extract_features_batch(audio_files)

    # Add genre labels
    for i, features in enumerate(features_list):
        if not features.get("extraction_failed", False):
            features["genre"] = genres[i]

    # Convert to DataFrame
    df = pd.DataFrame(features_list)

    # Save to CSV
    df.to_csv(output_path, index=False)
    logger.info(f"Features saved to {output_path}")

    return df


if __name__ == "__main__":
    """
    Example usage and testing.
    """
    import argparse

    parser = argparse.ArgumentParser(
        description="Extract audio features from music dataset"
    )
    parser.add_argument(
        "--dataset", default="../data/genres_original", help="Path to music dataset"
    )
    parser.add_argument(
        "--output",
        default="../data/features_extracted.csv",
        help="Output CSV file path",
    )
    parser.add_argument(
        "--sample",
        type=int,
        default=None,
        help="Sample size for testing (None for full dataset)",
    )

    args = parser.parse_args()

    # Extract features
    df = extract_dataset_features(args.dataset, args.output, args.sample)

    print(f"Extracted features from {len(df)} files")
    print(f"Features shape: {df.shape}")
    print(f"Genres: {df['genre'].value_counts().to_dict()}")

    # Show sample features
    if len(df) > 0:
        print("\nSample features:")
        print(df.head())
