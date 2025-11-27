#!/usr/bin/env python3
"""
Regenerate personal_features_genres.csv with standardized format columns
"""

import ast
import sys
import time
from pathlib import Path

import numpy as np
import pandas as pd

# Add src directory to path for imports
sys.path.append(str(Path(__file__).parent / "src"))

from feature_extraction import AudioFeatureExtractor


def extract_standardized_features_from_personal_data():
    """Extract features in standardized format from personal music files."""

    print("=" * 60)
    print("REGENERATING PERSONAL GENRES FEATURES WITH STANDARDIZED FORMAT")
    print("=" * 60)

    # Load existing personal data to get file paths and labels
    personal_data_path = "data/personal_features_genres.csv"

    if not Path(personal_data_path).exists():
        print(f"❌ Personal data file not found: {personal_data_path}")
        return False

    # Load existing data
    df_existing = pd.read_csv(personal_data_path)
    print(f"✅ Loaded existing personal data: {len(df_existing)} samples")

    # Show current genre distribution
    print(f"\n🎵 Current Genre Distribution:")
    genre_counts = df_existing["genre"].value_counts()
    for genre, count in genre_counts.items():
        percentage = (count / len(df_existing)) * 100
        print(f"   - {genre}: {count} samples ({percentage:.1f}%)")

    # Initialize feature extractor
    feature_extractor = AudioFeatureExtractor()

    # GTZAN format columns (from features_30_sec.csv)
    gtzan_columns = [
        "length",
        "chroma_stft_mean",
        "chroma_stft_var",
        "rms_mean",
        "rms_var",
        "spectral_centroid_mean",
        "spectral_centroid_var",
        "spectral_bandwidth_mean",
        "spectral_bandwidth_var",
        "rolloff_mean",
        "rolloff_var",
        "zero_crossing_rate_mean",
        "zero_crossing_rate_var",
        "harmony_mean",
        "harmony_var",
        "perceptr_mean",
        "perceptr_var",
        "tempo",
        "mfcc1_mean",
        "mfcc1_var",
        "mfcc2_mean",
        "mfcc2_var",
        "mfcc3_mean",
        "mfcc3_var",
        "mfcc4_mean",
        "mfcc4_var",
        "mfcc5_mean",
        "mfcc5_var",
        "mfcc6_mean",
        "mfcc6_var",
        "mfcc7_mean",
        "mfcc7_var",
        "mfcc8_mean",
        "mfcc8_var",
        "mfcc9_mean",
        "mfcc9_var",
        "mfcc10_mean",
        "mfcc10_var",
        "mfcc11_mean",
        "mfcc11_var",
        "mfcc12_mean",
        "mfcc12_var",
        "mfcc13_mean",
        "mfcc13_var",
        "mfcc14_mean",
        "mfcc14_var",
        "mfcc15_mean",
        "mfcc15_var",
        "mfcc16_mean",
        "mfcc16_var",
        "mfcc17_mean",
        "mfcc17_var",
        "mfcc18_mean",
        "mfcc18_var",
        "mfcc19_mean",
        "mfcc19_var",
        "mfcc20_mean",
        "mfcc20_var",
    ]

    print(f"\n🎵 Processing {len(df_existing)} music files...")

    # Initialize timing variables
    start_time = time.time()
    processed_count = 0
    failed_count = 0
    new_data = []

    for i, row in df_existing.iterrows():
        file_path = row["file_path"]
        current_file = Path(file_path).name

        # Calculate progress and time estimates
        elapsed_time = time.time() - start_time
        remaining_files = len(df_existing) - i

        if processed_count > 0:
            avg_time_per_file = elapsed_time / processed_count
            estimated_remaining_time = avg_time_per_file * remaining_files
            print(f"   {i + 1:3d}. Processing: {current_file}")
            print(
                f"       ⏱️  Elapsed: {elapsed_time / 60:.1f}m | Remaining: {estimated_remaining_time / 60:.1f}m | ETA: {time.strftime('%H:%M:%S', time.localtime(time.time() + estimated_remaining_time))}"
            )
        else:
            print(f"   {i + 1:3d}. Processing: {current_file}")
            print(f"       ⏱️  Starting...")

        try:
            # Extract features using personal format
            features = feature_extractor.extract_all_features(file_path)

            # Convert to GTZAN format
            gtzan_features = convert_to_gtzan_format(features)

            # Add metadata
            gtzan_features["filename"] = Path(file_path).name
            gtzan_features["label"] = row["genre"]
            gtzan_features["genre"] = row["genre"]
            gtzan_features["dataset"] = "personal"
            gtzan_features["extraction_date"] = "2025-09-20"

            new_data.append(gtzan_features)
            processed_count += 1
            print(f"       ✅ Success ({processed_count} successful)")

        except Exception as e:
            failed_count += 1
            print(f"       ❌ Error ({failed_count} failed): {str(e)}")
            continue

    # Final timing summary
    total_time = time.time() - start_time

    def format_time(seconds):
        if seconds < 60:
            return f"{seconds:.0f}s"
        elif seconds < 3600:
            return f"{seconds / 60:.1f}m"
        else:
            return f"{seconds / 3600:.1f}h"

    print(f"\n📊 Processing Summary:")
    print(f"   - Total files processed: {processed_count + failed_count}")
    print(f"   - Successful extractions: {processed_count}")
    print(f"   - Failed extractions: {failed_count}")
    print(
        f"   - Success rate: {(processed_count / (processed_count + failed_count) * 100):.1f}%"
    )
    print(f"   - Total processing time: {format_time(total_time)}")
    print(
        f"   - Average time per file: {total_time / (processed_count + failed_count):.2f}s"
    )

    if not new_data:
        print("❌ No data extracted successfully")
        return False

    # Create DataFrame
    df_new = pd.DataFrame(new_data)

    # Ensure all GTZAN columns are present
    for col in gtzan_columns:
        if col not in df_new.columns:
            df_new[col] = 0.0

    # Reorder columns to match GTZAN format
    metadata_columns = ["filename", "label", "genre", "dataset", "extraction_date"]
    ordered_columns = metadata_columns + gtzan_columns
    df_new = df_new[ordered_columns]

    # Save the new dataset
    output_path = "data/personal_features_genres_gtzan.csv"
    df_new.to_csv(output_path, index=False)

    print(f"\n✅ GTZAN format dataset saved to: {output_path}")
    print(f"📊 Final Dataset Stats:")
    print(f"   - Total samples: {len(df_new)}")
    print(f"   - Total columns: {len(df_new.columns)}")
    print(f"   - Feature columns: {len(gtzan_columns)}")

    # Show genre distribution in new dataset
    print(f"\n🎵 New Dataset Genre Distribution:")
    genre_counts = df_new["genre"].value_counts()
    for genre, count in genre_counts.items():
        percentage = (count / len(df_new)) * 100
        print(f"   - {genre}: {count} samples ({percentage:.1f}%)")

    return True


def convert_to_gtzan_format(features):
    """Convert personal format features to GTZAN format."""

    gtzan_features = {}

    # Basic info
    gtzan_features["length"] = features["length"]

    # Chroma features (convert from array to mean/var)
    chroma_array = np.array(features["chroma"])
    gtzan_features["chroma_stft_mean"] = float(np.mean(chroma_array))
    gtzan_features["chroma_stft_var"] = float(np.var(chroma_array))

    # RMS features (convert from energy)
    gtzan_features["rms_mean"] = features["energy"]
    gtzan_features["rms_var"] = 0.0  # We don't have variance

    # Spectral features
    gtzan_features["spectral_centroid_mean"] = features["spectral_centroid"]
    gtzan_features["spectral_centroid_var"] = 0.0  # We don't have variance

    # Spectral bandwidth (we don't have this, use 0)
    gtzan_features["spectral_bandwidth_mean"] = 0.0
    gtzan_features["spectral_bandwidth_var"] = 0.0

    # Rolloff
    gtzan_features["rolloff_mean"] = features["spectral_rolloff"]
    gtzan_features["rolloff_var"] = 0.0  # We don't have variance

    # Zero crossing rate
    gtzan_features["zero_crossing_rate_mean"] = features["zero_crossing_rate"]
    gtzan_features["zero_crossing_rate_var"] = 0.0  # We don't have variance

    # Harmony and perceptr (we don't have these, use 0)
    gtzan_features["harmony_mean"] = 0.0
    gtzan_features["harmony_var"] = 0.0
    gtzan_features["perceptr_mean"] = 0.0
    gtzan_features["perceptr_var"] = 0.0

    # Tempo
    gtzan_features["tempo"] = features["tempo"]

    # MFCC features (convert from array to individual mean/var)
    mfcc_array = np.array(features["mfcc"])
    # GTZAN uses 20 MFCC coefficients, we have 26, so we'll use first 20
    for i in range(1, 21):  # mfcc1 to mfcc20
        if i <= len(mfcc_array):
            gtzan_features[f"mfcc{i}_mean"] = float(mfcc_array[i - 1])
            gtzan_features[f"mfcc{i}_var"] = 0.0  # We don't have variance
        else:
            gtzan_features[f"mfcc{i}_mean"] = 0.0
            gtzan_features[f"mfcc{i}_var"] = 0.0

    return gtzan_features


if __name__ == "__main__":
    success = extract_standardized_features_from_personal_data()
    sys.exit(0 if success else 1)
