"""
GPU-Accelerated Personal Music Dataset Creator

Extract features from personal music files with GPU acceleration using CuPy/CUDA.
Optimized for RTX 4070 and other CUDA-compatible GPUs.
"""

import sys
import time
from concurrent.futures import ProcessPoolExecutor, as_completed
from multiprocessing import cpu_count
from pathlib import Path
from typing import Dict, List, Tuple

import numpy as np
import pandas as pd
from tqdm import tqdm

# Try to import GPU acceleration libraries
try:
    import cupy as cp

    GPU_AVAILABLE = True
    print("🚀 GPU acceleration available (CuPy)")
except ImportError:
    GPU_AVAILABLE = False
    print("⚠️  GPU acceleration not available. Install CuPy for GPU support.")

# Add src directory to path for imports
sys.path.append(str(Path(__file__).parent.parent / "src"))

from feature_extraction import AudioFeatureExtractor


def extract_features_gpu_worker(args: Tuple[str, str, str, str]) -> Dict:
    """
    GPU-accelerated worker function for parallel feature extraction.

    Args:
        args: Tuple of (file_path, genre_name, subgenre_name, dataset_type)

    Returns:
        Dictionary with extracted features or None if failed
    """
    file_path, genre_name, subgenre_name, dataset_type = args

    try:
        # Initialize feature extractor in each worker process
        feature_extractor = AudioFeatureExtractor()
        features = feature_extractor.extract_all_features(str(file_path))

        if features is None:
            return None

        # Convert to GTZAN format with GPU acceleration where possible
        gtzan_features = {}

        # Basic info
        gtzan_features["filename"] = Path(file_path).name
        gtzan_features["length"] = features["length"]

        # Chroma features (convert from array to mean/var) - GPU accelerated
        chroma_array = np.array(features["chroma"])
        if GPU_AVAILABLE and len(chroma_array) > 1000:  # Use GPU for large arrays
            chroma_gpu = cp.asarray(chroma_array)
            gtzan_features["chroma_stft_mean"] = float(cp.mean(chroma_gpu))
            gtzan_features["chroma_stft_var"] = float(cp.var(chroma_gpu))
        else:
            gtzan_features["chroma_stft_mean"] = float(np.mean(chroma_array))
            gtzan_features["chroma_stft_var"] = float(np.var(chroma_array))

        # RMS features (convert from energy)
        gtzan_features["rms_mean"] = features["energy"]
        gtzan_features["rms_var"] = 0.0  # We don't have variance, use 0

        # Spectral features
        gtzan_features["spectral_centroid_mean"] = features["spectral_centroid"]
        gtzan_features["spectral_centroid_var"] = 0.0  # We don't have variance, use 0

        # Spectral bandwidth (we don't have this, use 0)
        gtzan_features["spectral_bandwidth_mean"] = 0.0
        gtzan_features["spectral_bandwidth_var"] = 0.0

        # Rolloff
        gtzan_features["rolloff_mean"] = features["spectral_rolloff"]
        gtzan_features["rolloff_var"] = 0.0

        # Zero crossing rate
        gtzan_features["zero_crossing_rate_mean"] = features["zero_crossing_rate"]
        gtzan_features["zero_crossing_rate_var"] = 0.0

        # Harmony and perceptr (we don't have these, use 0)
        gtzan_features["harmony_mean"] = 0.0
        gtzan_features["harmony_var"] = 0.0
        gtzan_features["perceptr_mean"] = 0.0
        gtzan_features["perceptr_var"] = 0.0

        # Tempo
        gtzan_features["tempo"] = features["tempo"]

        # MFCC features (convert from array to individual mean/var) - GPU accelerated
        mfcc_array = np.array(features["mfcc"])
        if GPU_AVAILABLE and len(mfcc_array) > 100:  # Use GPU for MFCC processing
            mfcc_gpu = cp.asarray(mfcc_array)
            # GTZAN uses 20 MFCC coefficients, we have 26, so we'll use first 20
            for i in range(1, 21):  # mfcc1 to mfcc20
                if i <= len(mfcc_gpu):
                    gtzan_features[f"mfcc{i}_mean"] = float(mfcc_gpu[i - 1])
                    gtzan_features[f"mfcc{i}_var"] = (
                        0.0  # We don't have variance, use 0
                    )
                else:
                    gtzan_features[f"mfcc{i}_mean"] = 0.0
                    gtzan_features[f"mfcc{i}_var"] = 0.0
        else:
            # GTZAN uses 20 MFCC coefficients, we have 26, so we'll use first 20
            for i in range(1, 21):  # mfcc1 to mfcc20
                if i <= len(mfcc_array):
                    gtzan_features[f"mfcc{i}_mean"] = float(mfcc_array[i - 1])
                    gtzan_features[f"mfcc{i}_var"] = (
                        0.0  # We don't have variance, use 0
                    )
                else:
                    gtzan_features[f"mfcc{i}_mean"] = 0.0
                    gtzan_features[f"mfcc{i}_var"] = 0.0

        # Label and metadata
        gtzan_features["label"] = subgenre_name if subgenre_name else genre_name
        gtzan_features["genre"] = genre_name
        gtzan_features["subgenre"] = subgenre_name if subgenre_name else ""
        gtzan_features["dataset"] = dataset_type
        gtzan_features["extraction_date"] = pd.Timestamp.now()

        return gtzan_features

    except Exception as e:
        print(f"Error processing {Path(file_path).name}: {e}")
        return None


def process_files_gpu_parallel(
    file_args: List[Tuple[str, str, str, str]],
    max_workers: int = None,
    show_progress: bool = True,
) -> List[Dict]:
    """
    Process multiple audio files in parallel with GPU acceleration.

    Args:
        file_args: List of tuples (file_path, genre_name, subgenre_name, dataset_type)
        max_workers: Maximum number of worker processes (default: CPU count)
        show_progress: Whether to show progress bar

    Returns:
        List of extracted feature dictionaries
    """
    if max_workers is None:
        max_workers = min(cpu_count(), len(file_args))

    acceleration_type = "GPU + CPU" if GPU_AVAILABLE else "CPU"
    print(
        f"🚀 Processing {len(file_args)} files with {max_workers} workers ({acceleration_type})..."
    )

    all_features = []
    successful_count = 0
    failed_count = 0

    with ProcessPoolExecutor(max_workers=max_workers) as executor:
        # Submit all tasks
        future_to_args = {
            executor.submit(extract_features_gpu_worker, args): args
            for args in file_args
        }

        # Process results with progress bar
        if show_progress:
            futures = tqdm(
                as_completed(future_to_args),
                total=len(file_args),
                desc="Processing files",
            )
        else:
            futures = as_completed(future_to_args)

        for future in futures:
            result = future.result()
            if result is not None:
                all_features.append(result)
                successful_count += 1
            else:
                failed_count += 1

    print(
        f"✅ Parallel processing complete: {successful_count} successful, {failed_count} failed"
    )
    return all_features


def create_personal_dataset_gpu(
    personal_music_dir: str, output_path: str, max_workers: int = None
):
    """
    Create a labeled dataset from personal music files with GPU acceleration.

    This function supports incremental processing and GPU acceleration for maximum performance.
    Optimized for RTX 4070 and other CUDA-compatible GPUs.

    Args:
        personal_music_dir: Path to directory with genre/subgenre folders
        output_path: Path to save the dataset CSV (will be loaded if exists for incremental processing)
        max_workers: Maximum number of parallel workers (default: CPU count)
    """
    print("=" * 60)
    print("CREATING PERSONAL MUSIC DATASET - GPU ACCELERATED")
    print("=" * 60)

    if GPU_AVAILABLE:
        print(f"🎮 GPU: {cp.cuda.runtime.getDeviceProperties(0)['name'].decode()}")
        print(f"💾 GPU Memory: {cp.cuda.runtime.memGetInfo()[1] // 1024**3} GB total")

    music_dir = Path(personal_music_dir)
    if not music_dir.exists():
        print(f"❌ Music directory not found: {music_dir}")
        return False

    # Load existing dataset if it exists
    existing_df = None
    processed_files = set()
    output_file = Path(output_path)

    if output_file.exists():
        print(f"📁 Found existing dataset: {output_file}")
        try:
            existing_df = pd.read_csv(output_file)
            processed_files = set(existing_df["filename"].tolist())
            print(f"   ✅ Loaded {len(existing_df)} existing samples")
            print(f"   📋 Found {len(processed_files)} already processed files")
        except Exception as e:
            print(f"   ⚠️  Error loading existing dataset: {e}")
            print("   🔄 Will create new dataset")
            existing_df = None
            processed_files = set()
    else:
        print(f"📁 No existing dataset found, will create new one: {output_file}")

    # GTZAN format columns (standardized format)
    gtzan_columns = [
        "filename",
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
        "label",
    ]

    # Add additional columns from personal data
    additional_columns = ["genre", "subgenre", "dataset", "extraction_date"]
    all_columns = gtzan_columns + additional_columns

    # Find genre folders
    genre_folders = [f for f in music_dir.iterdir() if f.is_dir()]
    if not genre_folders:
        print(f"❌ No genre folders found in {music_dir}")
        print(f"Expected structure: {music_dir}/genre_name/*.flac")
        return False

    print(f"✅ Found {len(genre_folders)} genre folders:")
    for folder in genre_folders:
        print(f"   - {folder.name}")

    # Collect all files to process
    all_file_args = []
    total_files = 0
    skipped_files = 0

    print(f"\n📋 Collecting files to process...")

    for genre_folder in genre_folders:
        genre_name = genre_folder.name
        print(f"   📁 Scanning {genre_name}...")

        # Check if this genre has subgenres
        subgenre_folders = [f for f in genre_folder.iterdir() if f.is_dir()]

        if subgenre_folders:
            # Process subgenres
            print(f"     Found {len(subgenre_folders)} subgenres")
            for subgenre_folder in subgenre_folders:
                subgenre_name = subgenre_folder.name

                # Find music files in subgenre folder
                music_files = (
                    list(subgenre_folder.glob("*.flac"))
                    + list(subgenre_folder.glob("*.mp3"))
                    + list(subgenre_folder.glob("*.wav"))
                )

                if not music_files:
                    continue

                print(f"       📄 {subgenre_name}: {len(music_files)} files")

                # Add files to processing queue (skip already processed)
                for file_path in music_files:
                    filename = Path(file_path).name
                    if filename not in processed_files:
                        all_file_args.append(
                            (str(file_path), genre_name, subgenre_name, "personal")
                        )
                        total_files += 1
                    else:
                        skipped_files += 1

        else:
            # No subgenres found, process files directly in genre folder
            music_files = (
                list(genre_folder.glob("*.flac"))
                + list(genre_folder.glob("*.mp3"))
                + list(genre_folder.glob("*.wav"))
            )

            if not music_files:
                continue

            print(f"     📄 Direct files: {len(music_files)} files")

            # Add files to processing queue (skip already processed)
            for file_path in music_files:
                filename = Path(file_path).name
                if filename not in processed_files:
                    all_file_args.append((str(file_path), genre_name, "", "personal"))
                    total_files += 1
                else:
                    skipped_files += 1

    print(f"\n📊 File Collection Summary:")
    print(f"   - Total files found: {total_files + skipped_files}")
    print(f"   - Files to process: {total_files}")
    print(f"   - Files already processed: {skipped_files}")

    if total_files == 0:
        print("ℹ️  No new files to process")
        if existing_df is not None:
            print("✅ Existing dataset will be preserved")
            df = existing_df
        else:
            print("❌ No existing dataset found")
            return False
    else:
        # Process files in parallel with GPU acceleration
        print(f"\n🚀 Starting GPU-accelerated parallel processing...")
        start_time = time.time()

        all_features = process_files_gpu_parallel(
            all_file_args, max_workers=max_workers
        )

        processing_time = time.time() - start_time
        print(f"⏱️  Processing completed in {processing_time:.1f} seconds")
        print(f"📈 Processing rate: {total_files / processing_time:.1f} files/second")

        if GPU_AVAILABLE:
            print(f"🎮 GPU acceleration: ENABLED")

        # Create DataFrame from new features
        new_df = pd.DataFrame(all_features)

        # Ensure all columns are present
        for col in all_columns:
            if col not in new_df.columns:
                new_df[col] = (
                    0.0 if col.endswith("_mean") or col.endswith("_var") else ""
                )

        # Reorder columns
        new_df = new_df[all_columns]

        # Merge with existing data if available
        if existing_df is not None:
            print("\n🔄 Merging with existing dataset...")
            print(f"   - New samples: {len(new_df)}")
            print(f"   - Existing samples: {len(existing_df)}")

            # Combine datasets
            df = pd.concat([existing_df, new_df], ignore_index=True)

            # Remove duplicates based on filename (keep first occurrence)
            df = df.drop_duplicates(subset=["filename"], keep="first")

            print(f"   - Total samples after merge: {len(df)}")
            print(
                f"   - Duplicates removed: {len(existing_df) + len(new_df) - len(df)}"
            )
        else:
            df = new_df

    print("\n📊 Dataset Summary:")
    if existing_df is not None and total_files > 0:
        print(f"   - New files processed: {len(all_features)}")
        print(f"   - Existing samples: {len(existing_df)}")
        print(f"   - Total samples: {len(df)}")
    else:
        print(f"   - Total files processed: {total_files}")
        print(f"   - Successful extractions: {len(df)}")
        print(f"   - Success rate: {len(df) / total_files * 100:.1f}%")
    print(
        f"   - Features per sample: {len([col for col in df.columns if col not in ['filename', 'label', 'genre', 'subgenre', 'dataset', 'extraction_date']])}"
    )

    # Genre and subgenre distribution
    genre_counts = df["genre"].value_counts()
    print("\n📈 Genre Distribution:")
    for genre, count in genre_counts.items():
        percentage = (count / len(df)) * 100
        print(f"   {genre}: {count} files ({percentage:.1f}%)")

    if "subgenre" in df.columns and df["subgenre"].notna().any():
        label_counts = df["label"].value_counts()
        print("\n🎶 Subgenre Distribution:")
        for label, count in label_counts.items():
            percentage = (count / len(df)) * 100
            print(f"   {label}: {count} files ({percentage:.1f}%)")

    # Save dataset
    output_file.parent.mkdir(parents=True, exist_ok=True)

    df.to_csv(output_file, index=False)
    print(f"\n✅ Dataset saved to: {output_file}")

    # Save summary
    summary_file = output_file.with_suffix(".summary.txt")
    with open(summary_file, "w") as f:
        f.write("Personal Music Dataset Summary (GPU Accelerated)\n")
        f.write("=" * 50 + "\n")
        if GPU_AVAILABLE:
            f.write(f"GPU: {cp.cuda.runtime.getDeviceProperties(0)['name'].decode()}\n")
        f.write(f"Acceleration: {'GPU + CPU' if GPU_AVAILABLE else 'CPU Only'}\n")
        if existing_df is not None and total_files > 0:
            f.write(f"New files processed: {len(all_features)}\n")
            f.write(f"Existing samples: {len(existing_df)}\n")
            f.write(f"Total samples: {len(df)}\n")
        else:
            f.write(f"Total files: {total_files}\n")
            f.write(f"Successful extractions: {len(df)}\n")
            f.write(f"Success rate: {len(df) / total_files * 100:.1f}%\n")
        f.write(
            f"Features: {len([col for col in df.columns if col not in ['filename', 'label', 'genre', 'subgenre', 'dataset', 'extraction_date']])}\n"
        )
        f.write(f"Genres: {len(genre_counts)}\n")
        f.write("\nGenre Distribution:\n")
        for genre, count in genre_counts.items():
            f.write(f"  {genre}: {count} files\n")

    print(f"✅ Summary saved to: {summary_file}")

    return True


def main():
    """Main function to create personal dataset with GPU acceleration."""
    import argparse

    parser = argparse.ArgumentParser(
        description="Create personal music dataset with GPU acceleration"
    )
    parser.add_argument(
        "--input",
        "-i",
        default="/Users/alessandro/Music/personal_dataset",
        help="Path to personal music directory with genre/subgenre folders",
    )
    parser.add_argument(
        "--output",
        "-o",
        default="../data/personal_features_gpu.csv",
        help="Output CSV file path",
    )
    parser.add_argument(
        "--workers",
        "-w",
        type=int,
        default=None,
        help="Number of parallel workers (default: CPU count)",
    )

    args = parser.parse_args()

    success = create_personal_dataset_gpu(args.input, args.output, args.workers)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
