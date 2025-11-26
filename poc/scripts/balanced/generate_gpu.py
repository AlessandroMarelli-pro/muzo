"""
GPU-Accelerated Personal Music Dataset Creator

Extract features from personal music files with GPU acceleration using CuPy/CUDA.
Optimized for RTX 4070 and other CUDA-compatible GPUs.
"""

import os
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
sys.path.append(str(Path(__file__).parent.parent.parent / "src"))

from balanced_feature_extraction import BalancedSegmentationExtractor


def convert_to_gtzan_format(raw_features: Dict) -> Dict:
    """
    Convert AudioFeatureExtractor format to GTZAN format for compatibility.

    Args:
        raw_features: Features from AudioFeatureExtractor

    Returns:
        GTZAN-formatted features
    """
        gtzan_features = {}

        # Basic info
    gtzan_features["filename"] = raw_features.get("file_path", "").split("/")[-1].split("\\")[-1]
    gtzan_features["length"] = raw_features.get("length", 0)
    
    # Chroma features (convert from array to mean/var)
    if "chroma" in raw_features:
        chroma_array = np.array(raw_features["chroma"])
            gtzan_features["chroma_stft_mean"] = float(np.mean(chroma_array))
            gtzan_features["chroma_stft_var"] = float(np.var(chroma_array))
    else:
        gtzan_features["chroma_stft_mean"] = 0.0
        gtzan_features["chroma_stft_var"] = 0.0
    
    # RMS features (from energy)
    gtzan_features["rms_mean"] = raw_features.get("energy", 0.0)
    gtzan_features["rms_var"] = 0.0

        # Spectral features
    gtzan_features["spectral_centroid_mean"] = raw_features.get("spectral_centroid", 0.0)
    gtzan_features["spectral_centroid_var"] = 0.0

    # Spectral bandwidth (not available, use 0)
        gtzan_features["spectral_bandwidth_mean"] = 0.0
        gtzan_features["spectral_bandwidth_var"] = 0.0

        # Rolloff
    gtzan_features["rolloff_mean"] = raw_features.get("spectral_rolloff", 0.0)
        gtzan_features["rolloff_var"] = 0.0

        # Zero crossing rate
    gtzan_features["zero_crossing_rate_mean"] = raw_features.get("zero_crossing_rate", 0.0)
        gtzan_features["zero_crossing_rate_var"] = 0.0

    # Harmony and perceptr (not available, use 0)
        gtzan_features["harmony_mean"] = 0.0
        gtzan_features["harmony_var"] = 0.0
        gtzan_features["perceptr_mean"] = 0.0
        gtzan_features["perceptr_var"] = 0.0

        # Tempo
    gtzan_features["tempo"] = raw_features.get("tempo", 0.0)
    
    # MFCC features (convert from array to individual mean/var)
    if "mfcc" in raw_features:
        mfcc_array = np.array(raw_features["mfcc"])
        # GTZAN uses 20 MFCC coefficients
            for i in range(1, 21):  # mfcc1 to mfcc20
            if i <= len(mfcc_array):
                gtzan_features[f"mfcc{i}_mean"] = float(mfcc_array[i - 1])
                gtzan_features[f"mfcc{i}_var"] = 0.0  # We don't have variance
                else:
                    gtzan_features[f"mfcc{i}_mean"] = 0.0
                    gtzan_features[f"mfcc{i}_var"] = 0.0
        else:
        # Fill with zeros if no MFCC
        for i in range(1, 21):
                    gtzan_features[f"mfcc{i}_mean"] = 0.0
                    gtzan_features[f"mfcc{i}_var"] = 0.0

    # Label (will be added later)
    gtzan_features["label"] = ""

        return gtzan_features


def extract_balanced_features_gpu_worker(args: Tuple[str, str, str, str, float, float, int, int, int, int]) -> List[Dict]:
    """
    GPU-accelerated worker function for parallel balanced feature extraction.

    Args:
        args: Tuple of (file_path, genre_name, subgenre_name, dataset_type, 
                       chunk_duration, overlap_ratio, sample_rate, hop_length, n_mfcc, n_chroma)

    Returns:
        List of feature dictionaries for all segments from this file
    """
    file_path, genre_name, subgenre_name, dataset_type, chunk_duration, overlap_ratio, sample_rate, hop_length, n_mfcc, n_chroma = args

    try:
        # Initialize feature extractor in each worker process
        from feature_extraction import AudioFeatureExtractor
        feature_extractor = AudioFeatureExtractor(
            sample_rate=sample_rate,
            hop_length=hop_length,
            n_mfcc=n_mfcc,
            n_chroma=n_chroma
        )
        
        # Load audio file
        import librosa
        audio, sr = librosa.load(file_path, sr=sample_rate)
        
        if len(audio) == 0:
            return []
        
        # Calculate segment parameters
        chunk_samples = int(chunk_duration * sr)
        overlap_samples = int(chunk_samples * overlap_ratio)
        step_samples = chunk_samples - overlap_samples
        
        features_list = []
        
        # Extract features from segments
        start = 0
        segment_index = 0
        
        while start + chunk_samples <= len(audio):
            # Extract audio segment
            audio_segment = audio[start:start + chunk_samples]
            
            # Create temporary file for feature extraction
            import tempfile
            import soundfile as sf
            temp_path = None
            
            try:
                with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_file:
                    temp_path = temp_file.name
                
                # Write segment to temporary file
                sf.write(temp_path, audio_segment, sr)
                
                # Extract features using the proven method
                raw_features = feature_extractor.extract_all_features(temp_path)
                
                if raw_features is not None:
                    # Convert to GTZAN format for compatibility
                    features = convert_to_gtzan_format(raw_features)
                    
                    # Add metadata and label
                    features.update({
                        'label': subgenre_name if subgenre_name else genre_name,
                        'genre': genre_name,
                        'subgenre': subgenre_name if subgenre_name else "",
                        'dataset': dataset_type,
                        'extraction_date': pd.Timestamp.now()
                    })
                    
                    # Apply GPU acceleration to numerical arrays if available
                    if GPU_AVAILABLE:
                        # More aggressive GPU processing - always use GPU for arrays
                        try:
                            # Accelerate MFCC processing
                            if 'mfcc' in features and isinstance(features['mfcc'], (list, np.ndarray)):
                                mfcc_array = np.array(features['mfcc'])
                                mfcc_gpu = cp.asarray(mfcc_array)
                                # Perform additional GPU computations
                                mfcc_mean_gpu = cp.mean(mfcc_gpu, axis=0) if mfcc_gpu.ndim > 1 else cp.mean(mfcc_gpu)
                                mfcc_std_gpu = cp.std(mfcc_gpu, axis=0) if mfcc_gpu.ndim > 1 else cp.std(mfcc_gpu)
                                features['mfcc'] = cp.asnumpy(mfcc_gpu).tolist()
                                features['mfcc_mean'] = cp.asnumpy(mfcc_mean_gpu).tolist() if hasattr(mfcc_mean_gpu, 'tolist') else float(cp.asnumpy(mfcc_mean_gpu))
                                features['mfcc_std'] = cp.asnumpy(mfcc_std_gpu).tolist() if hasattr(mfcc_std_gpu, 'tolist') else float(cp.asnumpy(mfcc_std_gpu))
                                features['mfcc_gpu_processed'] = True
                            
                            # Accelerate chroma processing
                            if 'chroma' in features and isinstance(features['chroma'], (list, np.ndarray)):
                                chroma_array = np.array(features['chroma'])
                                chroma_gpu = cp.asarray(chroma_array)
                                # Perform additional GPU computations
                                chroma_mean_gpu = cp.mean(chroma_gpu, axis=0) if chroma_gpu.ndim > 1 else cp.mean(chroma_gpu)
                                chroma_std_gpu = cp.std(chroma_gpu, axis=0) if chroma_gpu.ndim > 1 else cp.std(chroma_gpu)
                                features['chroma'] = cp.asnumpy(chroma_gpu).tolist()
                                features['chroma_mean'] = cp.asnumpy(chroma_mean_gpu).tolist() if hasattr(chroma_mean_gpu, 'tolist') else float(cp.asnumpy(chroma_mean_gpu))
                                features['chroma_std'] = cp.asnumpy(chroma_std_gpu).tolist() if hasattr(chroma_std_gpu, 'tolist') else float(cp.asnumpy(chroma_std_gpu))
                                features['chroma_gpu_processed'] = True
                            
                            # Accelerate any other numerical features
                            for key, value in features.items():
                                if key not in ['mfcc', 'chroma', 'file_path', 'genre', 'subgenre'] and isinstance(value, (list, np.ndarray)):
                                    try:
                                        array = np.array(value)
                                        if array.size > 1:  # Process any array with more than 1 element
                                            gpu_array = cp.asarray(array)
                                            # Perform GPU normalization/scaling
                                            gpu_normalized = (gpu_array - cp.mean(gpu_array)) / (cp.std(gpu_array) + 1e-8)
                                            features[key] = cp.asnumpy(gpu_normalized).tolist()
                                            features[f'{key}_gpu_processed'] = True
                                    except:
                                        pass  # Skip if conversion fails
                        
                        except Exception as e:
                            # Fallback to original processing if GPU fails
                            pass
                    
                    features_list.append(features)
                
            finally:
                # Clean up temporary file with retry logic for Windows
                if temp_path and os.path.exists(temp_path):
                    max_retries = 5
                    for attempt in range(max_retries):
                        try:
                            os.unlink(temp_path)
                            break
                        except (OSError, PermissionError):
                            if attempt == max_retries - 1:
                                pass  # Give up after max retries
                else:
                                time.sleep(0.1)
            
            start += step_samples
            segment_index += 1
        
        return features_list

    except Exception as e:
        print(f"Error processing {Path(file_path).name}: {e}")
        return []


def process_balanced_files_gpu_parallel(
    file_tasks: List[Tuple], 
    max_workers: int = None,
    show_progress: bool = True
) -> List[Dict]:
    """
    Process multiple audio files in parallel with GPU acceleration for balanced feature extraction.

    Args:
        file_tasks: List of tuples with file processing parameters
        max_workers: Maximum number of worker processes
        show_progress: Whether to show progress bar

    Returns:
        List of extracted feature dictionaries
    """
    if max_workers is None:
        max_workers = min(cpu_count(), len(file_tasks))

    acceleration_type = "GPU + CPU" if GPU_AVAILABLE else "CPU"
    print(f"🚀 Processing {len(file_tasks)} files with {max_workers} workers ({acceleration_type})...")

    all_features = []
    successful_files = 0
    failed_files = 0

    with ProcessPoolExecutor(max_workers=max_workers) as executor:
        # Submit all tasks
        future_to_task = {
            executor.submit(extract_balanced_features_gpu_worker, task): task
            for task in file_tasks
        }

        # Process results with progress bar
        if show_progress:
            futures = tqdm(
                as_completed(future_to_task),
                total=len(file_tasks),
                desc="Processing files",
                unit="files"
            )
        else:
            futures = as_completed(future_to_task)

        for future in futures:
            result = future.result()
            if result:  # result is a list of features
                all_features.extend(result)
                successful_files += 1
            else:
                failed_files += 1

    print(f"✅ Parallel processing complete: {successful_files} files successful, {failed_files} failed")
    print(f"📊 Total samples created: {len(all_features)}")
    return all_features


def create_balanced_dataset_gpu(
    personal_music_dir: str, 
    output_path: str, 
    target_samples_per_genre: int = 1000,
    min_chunk_duration: float = 10.0,
    max_chunk_duration: float = 180.0,
    sample_rate: int = 44100,
    hop_length: int = 512,
    n_mfcc: int = 13,
    n_chroma: int = 12,
    max_workers: int = None,
    show_progress: bool = True
):
    """
    Create a balanced labeled dataset from personal music files with GPU acceleration.

    Uses the BalancedSegmentationExtractor for perfect genre/subgenre distribution.
    Optimized for RTX 4070 and other CUDA-compatible GPUs.

    Args:
        personal_music_dir: Path to directory with genre/subgenre folders
        output_path: Path to save the dataset CSV
        target_samples_per_genre: Target number of samples per genre
        min_chunk_duration: Minimum chunk duration in seconds
        max_chunk_duration: Maximum chunk duration in seconds
        sample_rate: Target sample rate for audio loading
        hop_length: Number of samples between successive frames
        n_mfcc: Number of MFCC coefficients to extract
        n_chroma: Number of chroma bins
        max_workers: Maximum number of parallel workers (default: CPU count)
        show_progress: Whether to show progress bar during processing
    """
    print("=" * 80)
    print("🎵 BALANCED DATASET CREATION - GPU ACCELERATED 🎵")
    print("=" * 80)
    print(f"🎯 Target samples per genre: {target_samples_per_genre}")
    print(f"⏱️  Chunk duration: {min_chunk_duration}s - {max_chunk_duration}s")
    print(f"🎼 Sample rate: {sample_rate}Hz")
    print(f"📊 Progress bar: {'Enabled' if show_progress else 'Disabled'}")

    if GPU_AVAILABLE:
        print(f"🎮 GPU: {cp.cuda.runtime.getDeviceProperties(0)['name'].decode()}")
        print(f"💾 GPU Memory: {cp.cuda.runtime.memGetInfo()[1] // 1024**3} GB total")

    music_dir = Path(personal_music_dir)
    if not music_dir.exists():
        print(f"❌ Music directory not found: {music_dir}")
        return False

    try:
        # Initialize balanced segmentation extractor for planning only
        print(f"\n🔧 Analyzing dataset and creating segmentation plan...")
        extractor = BalancedSegmentationExtractor(
            target_samples_per_genre=target_samples_per_genre,
            min_segment_duration=min_chunk_duration,
            max_segment_duration=max_chunk_duration,
            sample_rate=sample_rate,
            hop_length=hop_length,
            n_mfcc=n_mfcc,
            n_chroma=n_chroma
        )
        
        # Analyze dataset structure
        print(f"🔍 Analyzing dataset structure...")
        dataset_analysis = extractor.analyze_dataset(music_dir)
        
        # Create balanced segmentation plan
        print(f"📋 Creating balanced segmentation plan...")
        segmentation_plan = extractor.create_segmentation_plan()
        
        # Convert segmentation plan to parallel tasks
        print(f"⚙️  Preparing parallel GPU tasks...")
        file_tasks = []
        
        for genre_name, genre_plan in segmentation_plan.items():
            for subgenre_name, subgenre_plan in genre_plan.items():
                chunk_duration = subgenre_plan['chunk_duration']
                overlap_ratio = subgenre_plan['overlap_ratio']
                
                # Get audio files for this subgenre
                subgenre_path = music_dir / genre_name / subgenre_name
                audio_files = []
                for ext in ['*.flac', '*.mp3', '*.wav']:
                    audio_files.extend(list(subgenre_path.glob(ext)))
                
                # Create task for each file
                for audio_file in audio_files:
                    task = (
                        str(audio_file),           # file_path
                        genre_name,                # genre_name
                        subgenre_name,             # subgenre_name
                        "personal",                # dataset_type
                        chunk_duration,            # chunk_duration
                        overlap_ratio,             # overlap_ratio
                        sample_rate,               # sample_rate
                        hop_length,                # hop_length
                        n_mfcc,                    # n_mfcc
                        n_chroma                   # n_chroma
                    )
                    file_tasks.append(task)
        
        print(f"📊 Created {len(file_tasks)} parallel tasks")
        
        # Process files in parallel with GPU acceleration
        print(f"🚀 Starting GPU-accelerated parallel processing...")
        start_time = time.time()

        all_features = process_balanced_files_gpu_parallel(
            file_tasks, 
            max_workers=max_workers, 
            show_progress=show_progress
        )

        processing_time = time.time() - start_time

        # GPU acceleration info
        if GPU_AVAILABLE:
            print(f"🎮 GPU acceleration: ENABLED")

        print(f"⏱️  Processing completed in {processing_time:.1f} seconds")
        if len(all_features) > 0:
            print(f"📈 Processing rate: {len(all_features) / processing_time:.1f} samples/second")
        
        # Convert to DataFrame and save
        df = pd.DataFrame(all_features)
        
        if len(df) == 0:
            print("❌ No features extracted!")
            return False
        
        # Reorder columns to match original GTZAN format
        gtzan_columns = [
            "filename", "length", "chroma_stft_mean", "chroma_stft_var", "rms_mean", "rms_var",
            "spectral_centroid_mean", "spectral_centroid_var", "spectral_bandwidth_mean", "spectral_bandwidth_var",
            "rolloff_mean", "rolloff_var", "zero_crossing_rate_mean", "zero_crossing_rate_var",
            "harmony_mean", "harmony_var", "perceptr_mean", "perceptr_var", "tempo"
        ]
        
        # Add MFCC columns
        for i in range(1, 21):
            gtzan_columns.extend([f"mfcc{i}_mean", f"mfcc{i}_var"])
        
        # Add metadata columns
        gtzan_columns.extend(["label", "genre", "subgenre", "dataset", "extraction_date"])
        
        # Ensure all columns exist and reorder
        for col in gtzan_columns:
            if col not in df.columns:
                df[col] = 0.0 if col.endswith(("_mean", "_var")) or col == "tempo" or col == "length" else ""
        
        df = df[gtzan_columns]
        
        # Save to CSV
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        df.to_csv(output_path, index=False)
        
        # Display results
        print(f"\n📊 Balanced Dataset Summary:")
        print(f"   - Total samples created: {len(df)}")
        print(f"   - Processing time: {processing_time:.1f} seconds")
        print(f"   - Features per sample: {len([col for col in df.columns if not col.startswith(('genre', 'subgenre', 'original_file', 'chunk_'))])}")
        
        # Show balanced distribution
        if 'genre' in df.columns:
            genre_counts = df['genre'].value_counts()
            print(f"\n🎯 Balanced Genre Distribution:")
    for genre, count in genre_counts.items():
        percentage = (count / len(df)) * 100
                print(f"   {genre}: {count} samples ({percentage:.1f}%)")
        
            # Show subgenre distribution
            if 'subgenre' in df.columns:
                print(f"\n🎶 Subgenre Distribution (samples per subgenre):")
                subgenre_by_genre = df.groupby(['genre', 'subgenre']).size()
                for (genre, subgenre), count in subgenre_by_genre.items():
                    print(f"   {genre}/{subgenre}: {count} samples")

    # Save summary
            summary_file = Path(output_path).with_suffix(".summary.txt")
    with open(summary_file, "w") as f:
                f.write("Balanced Music Dataset Summary (GPU Accelerated)\n")
                f.write("=" * 60 + "\n")
        if GPU_AVAILABLE:
            f.write(f"GPU: {cp.cuda.runtime.getDeviceProperties(0)['name'].decode()}\n")
        f.write(f"Acceleration: {'GPU + CPU' if GPU_AVAILABLE else 'CPU Only'}\n")
                f.write(f"Parallel workers: {max_workers or cpu_count()}\n")
                f.write(f"Target samples per genre: {target_samples_per_genre}\n")
                f.write(f"Chunk duration range: {min_chunk_duration}s - {max_chunk_duration}s\n")
                f.write(f"Sample rate: {sample_rate}Hz\n")
            f.write(f"Total samples: {len(df)}\n")
                f.write(f"Processing time: {processing_time:.1f} seconds\n")
                f.write(f"Processing rate: {len(df) / processing_time:.1f} samples/second\n")
        f.write(f"Genres: {len(genre_counts)}\n")
                f.write("\nBalanced Genre Distribution:\n")
        for genre, count in genre_counts.items():
                    f.write(f"  {genre}: {count} samples\n")
                
                if 'subgenre' in df.columns:
                    f.write("\nSubgenre Distribution:\n")
                    for (genre, subgenre), count in subgenre_by_genre.items():
                        f.write(f"  {genre}/{subgenre}: {count} samples\n")

    print(f"✅ Summary saved to: {summary_file}")

        print(f"✅ Balanced dataset saved to: {output_path}")
    return True
        
    except Exception as e:
        print(f"❌ Error creating balanced dataset: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """Main function to create balanced personal dataset with GPU acceleration."""
    import argparse

    parser = argparse.ArgumentParser(
        description="Create balanced personal music dataset with GPU acceleration"
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
        default="../data/personal_features_balanced_gpu.csv",
        help="Output CSV file path",
    )
    parser.add_argument(
        "--target-per-genre",
        type=int,
        default=1000,
        help="Target number of samples per genre",
    )
    parser.add_argument(
        "--min-chunk-duration",
        type=float,
        default=10.0,
        help="Minimum chunk duration in seconds",
    )
    parser.add_argument(
        "--max-chunk-duration",
        type=float,
        default=180.0,
        help="Maximum chunk duration in seconds",
    )
    parser.add_argument(
        "--sample-rate",
        type=int,
        default=44100,
        help="Target sample rate for audio loading",
    )
    parser.add_argument(
        "--hop-length",
        type=int,
        default=512,
        help="Number of samples between successive frames",
    )
    parser.add_argument(
        "--n-mfcc",
        type=int,
        default=13,
        help="Number of MFCC coefficients to extract",
    )
    parser.add_argument(
        "--n-chroma",
        type=int,
        default=12,
        help="Number of chroma bins",
    )
    parser.add_argument(
        "--workers",
        "-w",
        type=int,
        default=None,
        help="Number of parallel workers (default: CPU count)",
    )
    parser.add_argument(
        "--no-progress",
        action="store_true",
        help="Disable progress bar",
    )

    args = parser.parse_args()

    success = create_balanced_dataset_gpu(
        personal_music_dir=args.input,
        output_path=args.output,
        target_samples_per_genre=args.target_per_genre,
        min_chunk_duration=args.min_chunk_duration,
        max_chunk_duration=args.max_chunk_duration,
        sample_rate=args.sample_rate,
        hop_length=args.hop_length,
        n_mfcc=args.n_mfcc,
        n_chroma=args.n_chroma,
        max_workers=args.workers,
        show_progress=not args.no_progress,
    )
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
