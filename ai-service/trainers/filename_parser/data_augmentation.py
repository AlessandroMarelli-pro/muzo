#!/usr/bin/env python3
"""
Data Augmentation Module for Filename Parser Training

This module provides comprehensive data augmentation for audio filename parsing datasets.
It generates variations of filenames while preserving the correct metadata structure.
"""

import logging
import os
import random
from dataclasses import dataclass
from typing import Dict, List, Tuple

import pandas as pd

logger = logging.getLogger(__name__)


@dataclass
class ParsedMetadata:
    """Structured metadata extracted from filename"""

    artist: str
    title: str
    year: str
    label: str
    subtitle: str

    def to_dict(self) -> Dict[str, str]:
        return {
            "artist": self.artist,
            "title": self.title,
            "year": self.year,
            "label": self.label,
            "subtitle": self.subtitle,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, str]) -> "ParsedMetadata":
        return cls(
            artist=data.get("artist", ""),
            title=data.get("title", ""),
            year=data.get("year", ""),
            label=data.get("label", ""),
            subtitle=data.get("subtitle", ""),
        )


class FilenameAugmenter:
    """Data augmentation for filename parsing training data"""

    def __init__(self):
        self.separators = ["-", "–", "—", "~", ":"]
        self.unicode_chars = [
            "🇯🇵",
            "🎵",
            "🎶",
            "🎤",
            "🎧",
            "🎸",
            "🎹",
            "🎺",
            "🎻",
            "🥁",
        ]
        self.file_extensions = [".mp3", ".wav", ".flac", ".m4a", ".aac"]

        # Feature-aware augmentation patterns
        self.remix_variations = [
            "remix",
            "mix",
            "version",
            "edit",
            "extended",
            "original",
            "instrumental",
            "acapella",
            "dub",
            "radio",
        ]
        self.year_range = list(range(1950, 2025))
        self.label_prefixes = [
            "EP",
            "LP",
            "Single",
            "Album",
            "Compilation",
            "Soundtrack",
        ]

    def augment_filename(
        self, filename: str, metadata: ParsedMetadata
    ) -> List[Tuple[str, ParsedMetadata]]:
        """
        Generate augmented versions of a filename with its metadata.

        Args:
            filename: Original filename
            metadata: Original metadata

        Returns:
            List of (augmented_filename, metadata) tuples
        """
        augmented_samples = []

        # Original sample
        augmented_samples.append((filename, metadata))

        # 1. Vary separators
        augmented_samples.extend(self._vary_separators(filename, metadata))

        # 2. Add/remove spaces
        augmented_samples.extend(self._vary_spaces(filename, metadata))

        # 3. Change case
        augmented_samples.extend(self._vary_case(filename, metadata))

        # 4. Add/remove file extensions
        augmented_samples.extend(self._vary_extensions(filename, metadata))

        # 5. Insert Unicode characters
        augmented_samples.extend(self._insert_unicode(filename, metadata))

        # 6. Add feature-aware augmentations
        augmented_samples.extend(self._add_feature_patterns(filename, metadata))

        # 7. Combine multiple augmentations
        augmented_samples.extend(self._combine_augmentations(filename, metadata))

        return augmented_samples

    def _vary_separators(
        self, filename: str, metadata: ParsedMetadata
    ) -> List[Tuple[str, ParsedMetadata]]:
        """Generate variations with different separators"""
        samples = []

        # Remove extension for processing
        base_name = self._remove_extension(filename)

        # Try to find existing separator
        for sep in self.separators:
            if sep in base_name:
                # Replace with other separators
                for new_sep in self.separators:
                    if new_sep != sep:
                        new_filename = base_name.replace(sep, new_sep)
                        if filename.endswith((".mp3", ".wav", ".flac", ".m4a", ".aac")):
                            new_filename += os.path.splitext(filename)[1]
                        samples.append((new_filename, metadata))
                break

        return samples

    def _vary_spaces(
        self, filename: str, metadata: ParsedMetadata
    ) -> List[Tuple[str, ParsedMetadata]]:
        """Generate variations with different spacing"""
        samples = []

        base_name = self._remove_extension(filename)

        # Add extra spaces around separators
        for sep in self.separators:
            if sep in base_name:
                # Add spaces
                new_filename = base_name.replace(sep, f"  {sep}  ")
                if filename.endswith((".mp3", ".wav", ".flac", ".m4a", ".aac")):
                    new_filename += os.path.splitext(filename)[1]
                samples.append((new_filename, metadata))

                # Remove spaces
                new_filename = base_name.replace(f" {sep} ", sep)
                if filename.endswith((".mp3", ".wav", ".flac", ".m4a", ".aac")):
                    new_filename += os.path.splitext(filename)[1]
                samples.append((new_filename, metadata))
                break

        return samples

    def _vary_case(
        self, filename: str, metadata: ParsedMetadata
    ) -> List[Tuple[str, ParsedMetadata]]:
        """Generate variations with different cases"""
        samples = []

        # Lowercase
        samples.append((filename.lower(), metadata))

        # Uppercase
        samples.append((filename.upper(), metadata))

        # Title case
        samples.append((filename.title(), metadata))

        # Random case
        random_case = "".join(random.choice([c.upper(), c.lower()]) for c in filename)
        samples.append((random_case, metadata))

        return samples

    def _vary_extensions(
        self, filename: str, metadata: ParsedMetadata
    ) -> List[Tuple[str, ParsedMetadata]]:
        """Generate variations with different file extensions"""
        samples = []

        base_name = self._remove_extension(filename)

        # Add different extensions
        for ext in self.file_extensions:
            if not filename.endswith(ext):
                samples.append((base_name + ext, metadata))

        # Remove extension
        samples.append((base_name, metadata))

        return samples

    def _insert_unicode(
        self, filename: str, metadata: ParsedMetadata
    ) -> List[Tuple[str, ParsedMetadata]]:
        """Generate variations with Unicode characters"""
        samples = []

        base_name = self._remove_extension(filename)

        # Insert Unicode characters at random positions
        for char in self.unicode_chars:
            # Insert at the end of artist part
            if " - " in base_name:
                parts = base_name.split(" - ", 1)
                new_filename = f"{parts[0]} {char} - {parts[1]}"
                if filename.endswith((".mp3", ".wav", ".flac", ".m4a", ".aac")):
                    new_filename += os.path.splitext(filename)[1]
                samples.append((new_filename, metadata))

            # Insert at the beginning of title
            if " - " in base_name:
                parts = base_name.split(" - ", 1)
                new_filename = f"{parts[0]} - {char} {parts[1]}"
                if filename.endswith((".mp3", ".wav", ".flac", ".m4a", ".aac")):
                    new_filename += os.path.splitext(filename)[1]
                samples.append((new_filename, metadata))

        return samples

    def _combine_augmentations(
        self, filename: str, metadata: ParsedMetadata
    ) -> List[Tuple[str, ParsedMetadata]]:
        """Generate combinations of multiple augmentations"""
        samples = []

        # Combine separator + case changes
        base_name = self._remove_extension(filename)
        if " - " in base_name:
            # Change separator and case
            new_filename = base_name.replace(" - ", "~").lower()
            if filename.endswith((".mp3", ".wav", ".flac", ".m4a", ".aac")):
                new_filename += os.path.splitext(filename)[1]
            samples.append((new_filename, metadata))

            # Change separator and add Unicode
            new_filename = base_name.replace(" - ", "–") + " 🎵"
            if filename.endswith((".mp3", ".wav", ".flac", ".m4a", ".aac")):
                new_filename += os.path.splitext(filename)[1]
            samples.append((new_filename, metadata))

        return samples

    def _add_feature_patterns(
        self, filename: str, metadata: ParsedMetadata
    ) -> List[Tuple[str, ParsedMetadata]]:
        """Generate variations that include feature patterns the model expects"""
        samples = []
        base_name = self._remove_extension(filename)

        # Add year patterns if not present
        if not metadata.year and random.random() < 0.3:  # 30% chance
            year = str(random.choice(self.year_range))
            # Add year in parentheses
            new_filename = f"{base_name} ({year})"
            if filename.endswith((".mp3", ".wav", ".flac", ".m4a", ".aac")):
                new_filename += os.path.splitext(filename)[1]
            samples.append((new_filename, metadata))

            # Add year without parentheses
            new_filename = f"{base_name} {year}"
            if filename.endswith((".mp3", ".wav", ".flac", ".m4a", ".aac")):
                new_filename += os.path.splitext(filename)[1]
            samples.append((new_filename, metadata))

        # Add remix/mix patterns
        if random.random() < 0.2:  # 20% chance
            remix_type = random.choice(self.remix_variations)
            # Add in parentheses
            new_filename = f"{base_name} ({remix_type})"
            if filename.endswith((".mp3", ".wav", ".flac", ".m4a", ".aac")):
                new_filename += os.path.splitext(filename)[1]
            samples.append((new_filename, metadata))

            # Add without parentheses
            new_filename = f"{base_name} {remix_type}"
            if filename.endswith((".mp3", ".wav", ".flac", ".m4a", ".aac")):
                new_filename += os.path.splitext(filename)[1]
            samples.append((new_filename, metadata))

        # Add label patterns in brackets
        if not metadata.label and random.random() < 0.15:  # 15% chance
            label_prefix = random.choice(self.label_prefixes)
            label_name = f"{label_prefix} Records"
            new_filename = f"{base_name} [{label_name}]"
            if filename.endswith((".mp3", ".wav", ".flac", ".m4a", ".aac")):
                new_filename += os.path.splitext(filename)[1]
            samples.append((new_filename, metadata))

        # Add feat. patterns
        if random.random() < 0.1:  # 10% chance
            feat_artist = "feat. Guest Artist"
            # Insert feat. in title
            if " - " in base_name:
                parts = base_name.split(" - ", 1)
                new_filename = f"{parts[0]} - {parts[1]} {feat_artist}"
                if filename.endswith((".mp3", ".wav", ".flac", ".m4a", ".aac")):
                    new_filename += os.path.splitext(filename)[1]
                samples.append((new_filename, metadata))

        # Add underscore patterns
        if " - " in base_name and random.random() < 0.1:  # 10% chance
            new_filename = base_name.replace(" - ", "_")
            if filename.endswith((".mp3", ".wav", ".flac", ".m4a", ".aac")):
                new_filename += os.path.splitext(filename)[1]
            samples.append((new_filename, metadata))

        # Add dot patterns
        if " - " in base_name and random.random() < 0.1:  # 10% chance
            new_filename = base_name.replace(" - ", ".")
            if filename.endswith((".mp3", ".wav", ".flac", ".m4a", ".aac")):
                new_filename += os.path.splitext(filename)[1]
            samples.append((new_filename, metadata))

        return samples

    def _remove_extension(self, filename: str) -> str:
        """Remove file extension from filename"""
        for ext in self.file_extensions:
            if filename.endswith(ext):
                return filename[: -len(ext)]
        return filename


class DatasetProcessor:
    """Process CSV datasets for training"""

    def __init__(self):
        self.augmenter = FilenameAugmenter()

    def load_csv(self, csv_path: str) -> pd.DataFrame:
        """Load CSV dataset"""
        try:
            df = pd.read_csv(csv_path)
            logger.info(f"Loaded dataset with {len(df)} samples")
            return df
        except Exception as e:
            logger.error(f"Failed to load CSV: {e}")
            raise

    def augment_dataset(self, df: pd.DataFrame) -> pd.DataFrame:
        """Augment the entire dataset"""
        augmented_data = []

        for _, row in df.iterrows():
            filename = row["filename"]
            metadata = ParsedMetadata(
                artist=row.get("artist", ""),
                title=row.get("title", ""),
                year=row.get("year", ""),
                label=row.get("label", ""),
                subtitle=row.get("subtitle", ""),
            )

            # Generate augmented samples
            augmented_samples = self.augmenter.augment_filename(filename, metadata)

            for aug_filename, aug_metadata in augmented_samples:
                augmented_data.append(
                    {
                        "filename": aug_filename,
                        "artist": aug_metadata.artist,
                        "title": aug_metadata.title,
                        "year": aug_metadata.year,
                        "label": aug_metadata.label,
                        "subtitle": aug_metadata.subtitle,
                    }
                )

        augmented_df = pd.DataFrame(augmented_data)
        logger.info(f"Augmented dataset from {len(df)} to {len(augmented_df)} samples")

        return augmented_df

    def save_augmented_dataset(self, df: pd.DataFrame, output_path: str):
        """Save augmented dataset to CSV"""
        try:
            df.to_csv(output_path, index=False)
            logger.info(f"Saved augmented dataset to {output_path}")
        except Exception as e:
            logger.error(f"Failed to save dataset: {e}")
            raise

    def create_training_data(self, csv_path: str, output_path: str):
        """Complete pipeline: load, augment, and save dataset"""
        logger.info("Starting dataset processing pipeline")

        # Load original dataset
        df = self.load_csv(csv_path)

        # Augment dataset
        augmented_df = self.augment_dataset(df)

        # Save augmented dataset
        self.save_augmented_dataset(augmented_df, output_path)

        logger.info("Dataset processing completed")
        return augmented_df


def main():
    """Main function for testing the augmentation"""
    processor = DatasetProcessor()

    # Example usage
    sample_data = {
        "filename": ["Artist - Title.mp3", "Band – Song (1999).mp3"],
        "artist": ["Artist", "Band"],
        "title": ["Title", "Song"],
        "year": ["", "1999"],
        "label": ["", ""],
        "subtitle": ["", ""],
    }

    df = pd.DataFrame(sample_data)

    # Test augmentation
    augmented_df = processor.augment_dataset(df)

    print("Original samples:")
    print(df)
    print("\nAugmented samples:")
    print(augmented_df.head(10))


if __name__ == "__main__":
    main()
