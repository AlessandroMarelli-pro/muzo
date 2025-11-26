"""
Balanced Segmentation Feature Extraction

This module creates balanced feature datasets by segmenting audio files
to ensure even distribution across genres and subgenres.

Key features:
- Temporary segmentation (original files untouched)
- Balanced distribution across genres and subgenres
- Preprocessing phase for optimal chunk distribution
- Configurable target samples per genre/subgenre
"""

import logging
import os
import tempfile
import shutil
import time
from collections import defaultdict, Counter
from pathlib import Path
from typing import Dict, List, Tuple, Union
import pandas as pd
import numpy as np

# Import the proven feature extractor
from feature_extraction import AudioFeatureExtractor

# Try to import progress bar
try:
    from tqdm import tqdm
    PROGRESS_BAR_AVAILABLE = True
except ImportError:
    PROGRESS_BAR_AVAILABLE = False
    # Fallback progress function
    def tqdm(iterable, *args, **kwargs):
        return iterable

# Try to import audio processing libraries
try:
    import librosa
    AUDIO_PROCESSING_AVAILABLE = True
    print("🎵 Audio processing available (librosa)")
except ImportError:
    AUDIO_PROCESSING_AVAILABLE = False
    print("⚠️  Audio processing not available. Install librosa for audio segmentation.")

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class BalancedSegmentationExtractor:
    """
    Balanced feature extraction with segmentation for even genre/subgenre distribution.
    """
    
    def __init__(self, 
                 target_samples_per_genre: int = 1000,
                 min_segment_duration: float = 10.0,
                 max_segment_duration: float = 180.0,
                 sample_rate: int = 22050,
                 hop_length: int = 512,
                 n_mfcc: int = 13,
                 n_chroma: int = 12):
        """
        Initialize the balanced segmentation extractor.
        
        Args:
            target_samples_per_genre: Target number of samples per genre
            min_segment_duration: Minimum segment duration in seconds (prevents too small chunks)
            max_segment_duration: Maximum segment duration in seconds (prevents too large chunks)
            sample_rate: Target sample rate for audio loading
            hop_length: Number of samples between successive frames
            n_mfcc: Number of MFCC coefficients to extract
            n_chroma: Number of chroma bins
        """
        self.target_samples_per_genre = target_samples_per_genre
        self.min_segment_duration = min_segment_duration
        self.max_segment_duration = max_segment_duration
        
        # Initialize the proven feature extractor
        self.feature_extractor = AudioFeatureExtractor(
            sample_rate=sample_rate,
            hop_length=hop_length,
            n_mfcc=n_mfcc,
            n_chroma=n_chroma
        )
        
        # Analysis results
        self.dataset_analysis = {}
        self.segmentation_plan = {}
        
    def analyze_dataset(self, dataset_path: Union[str, Path]) -> Dict:
        """
        Analyze the dataset structure to understand genre/subgenre distribution.
        
        Args:
            dataset_path: Path to the dataset directory
            
        Returns:
            Dictionary with dataset analysis
        """
        logger.info(f"🔍 Analyzing dataset: {dataset_path}")
        
        dataset_path = Path(dataset_path)
        analysis = {
            'genres': {},
            'total_files': 0,
            'total_duration': 0.0,
            'genre_counts': Counter(),
            'subgenre_counts': Counter(),
            'genre_subgenre_map': defaultdict(list)
        }
        
        # Traverse dataset directory
        for genre_dir in dataset_path.iterdir():
            if not genre_dir.is_dir():
                continue
                
            genre_name = genre_dir.name
            analysis['genres'][genre_name] = {
                'subgenres': {},
                'total_files': 0,
                'total_duration': 0.0
            }
            
            for subgenre_dir in genre_dir.iterdir():
                if not subgenre_dir.is_dir():
                    continue
                    
                subgenre_name = subgenre_dir.name
                analysis['genre_subgenre_map'][genre_name].append(subgenre_name)
                
                # Count audio files and estimate duration
                audio_files = list(subgenre_dir.glob('*.flac')) + \
                             list(subgenre_dir.glob('*.mp3')) + \
                             list(subgenre_dir.glob('*.wav'))
                
                file_count = len(audio_files)
                estimated_duration = file_count * 180.0  # Assume 3 minutes per song
                
                # Try to get actual duration for a few files
                actual_durations = []
                for audio_file in audio_files[:5]:  # Sample first 5 files
                    try:
                        if AUDIO_PROCESSING_AVAILABLE:
                            duration = librosa.get_duration(path=str(audio_file))
                            actual_durations.append(duration)
                    except:
                        pass
                
                if actual_durations:
                    avg_duration = np.mean(actual_durations)
                    estimated_duration = file_count * avg_duration
                
                analysis['genres'][genre_name]['subgenres'][subgenre_name] = {
                    'files': audio_files,
                    'file_count': file_count,
                    'estimated_duration': estimated_duration
                }
                
                analysis['genres'][genre_name]['total_files'] += file_count
                analysis['genres'][genre_name]['total_duration'] += estimated_duration
                analysis['total_files'] += file_count
                analysis['total_duration'] += estimated_duration
                analysis['genre_counts'][genre_name] += file_count
                analysis['subgenre_counts'][subgenre_name] += file_count
        
        self.dataset_analysis = analysis
        
        # Log analysis results
        logger.info(f"Dataset Analysis Complete:")
        logger.info(f"  Total files: {analysis['total_files']}")
        logger.info(f"  Total estimated duration: {analysis['total_duration']/3600:.1f} hours")
        logger.info(f"  Genres: {len(analysis['genres'])}")
        logger.info(f"  Total subgenres: {len(analysis['subgenre_counts'])}")
        
        logger.info(f"\nGenre Distribution:")
        for genre, count in analysis['genre_counts'].most_common():
            subgenre_count = len(analysis['genre_subgenre_map'][genre])
            logger.info(f"  {genre}: {count} files, {subgenre_count} subgenres")
        
        return analysis
    
    def create_segmentation_plan(self) -> Dict:
        """
        Create a balanced segmentation plan with dynamic chunk calculation.
        
        Calculates optimal chunk size based on:
        - Current samples vs target samples needed
        - Available audio duration
        - Even distribution across subgenres
        
        Example: Subgenre A has 30 samples, needs 500 samples
        -> Each sample needs to be split into 500/30 = 17 chunks
        -> If sample is 3 minutes, each chunk = 180s/17 = 10.6 seconds
        
        Returns:
            Dictionary with segmentation plan for each genre/subgenre
        """
        if not self.dataset_analysis:
            raise ValueError("Dataset analysis must be performed first")
        
        logger.info(f"📋 Creating balanced segmentation plan...")
        logger.info(f"Target samples per genre: {self.target_samples_per_genre}")
        
        plan = {}
        
        for genre_name, genre_data in self.dataset_analysis['genres'].items():
            subgenres = genre_data['subgenres']
            num_subgenres = len(subgenres)
            
            if num_subgenres == 0:
                continue
            
            # Calculate target samples per subgenre for even distribution
            target_per_subgenre = self.target_samples_per_genre // num_subgenres
            
            logger.info(f"\n{genre_name} ({num_subgenres} subgenres):")
            logger.info(f"  Target per subgenre: {target_per_subgenre} samples")
            
            plan[genre_name] = {}
            
            for subgenre_name, subgenre_data in subgenres.items():
                current_samples = subgenre_data['file_count']
                available_duration = subgenre_data['estimated_duration']
                files = subgenre_data['files']
                
                # Calculate how many chunks we need per file
                if current_samples > 0:
                    chunks_needed_per_file = target_per_subgenre / current_samples
                    chunks_needed_per_file = max(1, int(np.ceil(chunks_needed_per_file)))
                else:
                    chunks_needed_per_file = 1
                
                # Calculate optimal chunk duration
                if available_duration > 0 and current_samples > 0:
                    avg_file_duration = available_duration / current_samples
                    optimal_chunk_duration = avg_file_duration / chunks_needed_per_file
                    
                    # Apply constraints
                    chunk_duration = max(self.min_segment_duration, 
                                       min(optimal_chunk_duration, self.max_segment_duration))
                else:
                    chunk_duration = self.min_segment_duration
                
                # Calculate overlap needed (if chunks don't fit naturally)
                if available_duration > 0 and current_samples > 0:
                    natural_chunks_per_file = available_duration / current_samples / chunk_duration
                    if natural_chunks_per_file < chunks_needed_per_file:
                        # Need overlap to achieve target
                        overlap_ratio = 1 - (natural_chunks_per_file / chunks_needed_per_file)
                        overlap_ratio = max(0, min(0.8, overlap_ratio))  # Cap at 80%
                    else:
                        overlap_ratio = 0.0
                else:
                    overlap_ratio = 0.0
                
                plan[genre_name][subgenre_name] = {
                    'target_samples': target_per_subgenre,
                    'current_samples': current_samples,
                    'chunks_needed_per_file': chunks_needed_per_file,
                    'chunk_duration': chunk_duration,
                    'overlap_ratio': overlap_ratio,
                    'available_duration': available_duration,
                    'files': files
                }
                
                logger.info(f"    {subgenre_name}: {current_samples} → {target_per_subgenre} samples")
                logger.info(f"      Chunks per file: {chunks_needed_per_file}")
                logger.info(f"      Chunk duration: {chunk_duration:.1f}s")
                logger.info(f"      Overlap: {overlap_ratio*100:.1f}%")
        
        self.segmentation_plan = plan
        return plan
    
    def extract_features_from_audio_segment(self, audio_segment: np.ndarray, sr: int) -> Dict:
        """
        Extract comprehensive features from an audio segment using AudioFeatureExtractor.
        
        This method creates a temporary audio file to use the existing extract_all_features method,
        ensuring complete compatibility with the proven feature extraction system.
        
        Args:
            audio_segment: Audio data as numpy array
            sr: Sample rate
            
        Returns:
            Dictionary with extracted features (identical to feature_extraction.py)
        """
        temp_path = None
        try:
            import tempfile
            import soundfile as sf
            import time
            
            # Create temporary file for the audio segment
            with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_file:
                temp_path = temp_file.name
            
            # Write audio segment to temporary file
            sf.write(temp_path, audio_segment, sr)
            
            # Use the proven extract_all_features method
            features = self.feature_extractor.extract_all_features(temp_path)
            
            # Remove file-specific metadata that's not relevant for segments
            features_clean = {k: v for k, v in features.items() 
                            if k not in ['file_path', 'duration', 'length', 'sample_rate']}
            
            return features_clean
                
        except ImportError:
            logger.warning("soundfile not available, falling back to manual feature extraction")
            return self._extract_features_manual(audio_segment, sr)
        except Exception as e:
            logger.warning(f"Error extracting features: {e}")
            return self._get_default_features()
        finally:
            # Clean up temporary file with retry logic for Windows
            if temp_path and os.path.exists(temp_path):
                max_retries = 5
                for attempt in range(max_retries):
                    try:
                        os.unlink(temp_path)
                        break
                    except (OSError, PermissionError) as e:
                        if attempt == max_retries - 1:
                            logger.warning(f"Could not delete temporary file {temp_path}: {e}")
                        else:
                            time.sleep(0.1)  # Wait 100ms before retry
    
    def _extract_features_manual(self, audio_segment: np.ndarray, sr: int) -> Dict:
        """
        Manual feature extraction fallback when soundfile is not available.
        
        Args:
            audio_segment: Audio data as numpy array
            sr: Sample rate
            
        Returns:
            Dictionary with extracted features
        """
        try:
            features = {}
            
            # Use individual feature extraction methods as fallback
            mfcc_features = self.feature_extractor.extract_mfcc(audio_segment)
            features['mfcc'] = mfcc_features.tolist()
            
            features['zero_crossing_rate'] = self.feature_extractor.extract_zero_crossing_rate(audio_segment)
            
            spectral_features = self.feature_extractor.extract_spectral_features(audio_segment)
            features.update(spectral_features)
            
            features['chroma'] = self.feature_extractor.extract_chroma_features(audio_segment).tolist()
            features['tempo'] = self.feature_extractor.extract_tempo(audio_segment)
            features['key'] = self.feature_extractor.extract_key(audio_segment)
            features['energy'] = self.feature_extractor.extract_energy(audio_segment)
            
            valence, danceability = self.feature_extractor.extract_valence_danceability(audio_segment)
            features['valence'] = valence
            features['danceability'] = danceability
            
            return features
            
        except Exception as e:
            logger.warning(f"Manual feature extraction failed: {e}")
            return self._get_default_features()
    
    def _get_default_features(self) -> Dict:
        """
        Get default feature dictionary when extraction fails.
        
        Returns:
            Dictionary with default feature values
        """
        return {
            # MFCC features (26 total)
            **{f'mfcc_{i}': 0.0 for i in range(26)},
            # Basic features
            'zero_crossing_rate': 0.0,
            'spectral_centroid': 0.0,
            'spectral_rolloff': 0.0,
            # Spectral contrast (7 features)
            **{f'spectral_contrast_{i}': 0.0 for i in range(7)},
            # Chroma features (12 features)
            **{f'chroma_{i}': 0.0 for i in range(12)},
            # Musical features
            'tempo': 120.0,
            'key': 0.0,
            'energy': 0.0,
            'valence': 0.5,
            'danceability': 0.5,
        }
    
    def create_balanced_features(self, output_path: str = "data/features_balanced.csv", show_progress: bool = True) -> pd.DataFrame:
        """
        Create balanced feature dataset using the segmentation plan.
        
        Args:
            output_path: Path to save the balanced features CSV
            show_progress: Whether to show progress bar during processing
            
        Returns:
            DataFrame with balanced features
        """
        if not self.segmentation_plan:
            raise ValueError("Segmentation plan must be created first")
        
        if not AUDIO_PROCESSING_AVAILABLE:
            raise ValueError("Audio processing (librosa) is required for feature extraction")
        
        logger.info(f"🎵 Creating balanced feature dataset...")
        
        # Calculate total expected samples for progress tracking
        total_expected_samples = 0
        for genre_plan in self.segmentation_plan.values():
            for subgenre_plan in genre_plan.values():
                total_expected_samples += subgenre_plan['target_samples']
        
        all_features = []
        total_created = 0
        
        # Initialize progress bar
        if show_progress and PROGRESS_BAR_AVAILABLE:
            pbar = tqdm(total=total_expected_samples, desc="Creating balanced features", unit="samples")
        else:
            pbar = None
        
        for genre_name, genre_plan in self.segmentation_plan.items():
            logger.info(f"\nProcessing {genre_name}...")
            genre_samples = 0
            
            for subgenre_name, subgenre_plan in genre_plan.items():
                target_samples = subgenre_plan['target_samples']
                chunks_needed_per_file = subgenre_plan['chunks_needed_per_file']
                chunk_duration = subgenre_plan['chunk_duration']
                overlap_ratio = subgenre_plan['overlap_ratio']
                files = subgenre_plan['files']
                
                logger.info(f"  {subgenre_name}: targeting {target_samples} samples...")
                
                subgenre_samples = 0
                
                for audio_file in files:
                    if subgenre_samples >= target_samples:
                        break
                    
                    try:
                        # Load audio file
                        y, sr = librosa.load(str(audio_file), sr=None)
                        duration = len(y) / sr
                        
                        if duration < self.min_segment_duration:
                            logger.warning(f"File {audio_file.name} too short ({duration:.1f}s), skipping")
                            continue
                        
                        # Calculate chunk parameters
                        chunk_samples = int(chunk_duration * sr)
                        overlap_samples = int(overlap_ratio * chunk_samples)
                        step_samples = chunk_samples - overlap_samples
                        
                        # Create chunks for this file
                        start = 0
                        file_chunks = 0
                        
                        while (start + chunk_samples <= len(y) and 
                               file_chunks < chunks_needed_per_file and
                               subgenre_samples < target_samples):
                            
                            # Extract chunk
                            chunk = y[start:start + chunk_samples]
                            
                            # Extract features using the proven extract_all_features method
                            features = self.extract_features_from_audio_segment(chunk, sr)
                            
                            # Add metadata
                            features.update({
                                'genre': genre_name,
                                'subgenre': subgenre_name,
                                'original_file': str(audio_file),
                                'chunk_start': start / sr,
                                'chunk_end': (start + chunk_samples) / sr,
                                'chunk_duration': chunk_duration,
                                'chunk_index': file_chunks,
                                'original_duration': duration,
                                'chunks_needed_per_file': chunks_needed_per_file,
                                'overlap_ratio': overlap_ratio
                            })
                            
                            all_features.append(features)
                            
                            start += step_samples
                            file_chunks += 1
                            subgenre_samples += 1
                            total_created += 1
                            
                            # Update progress bar
                            if pbar:
                                pbar.update(1)
                    
                    except Exception as e:
                        logger.error(f"Error processing {audio_file}: {e}")
                        continue
                
                logger.info(f"    Created {subgenre_samples} samples for {subgenre_name}")
                genre_samples += subgenre_samples
            
            logger.info(f"  Total for {genre_name}: {genre_samples} samples")
        
        # Close progress bar
        if pbar:
            pbar.close()
        
        # Convert to DataFrame
        df = pd.DataFrame(all_features)
        
        # Save to CSV
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        df.to_csv(output_path, index=False)
        
        logger.info(f"\n✅ Balanced feature extraction complete!")
        logger.info(f"Total samples created: {total_created}")
        logger.info(f"Features saved to: {output_path}")
        
        # Log final distribution
        logger.info(f"\nFinal Distribution:")
        genre_dist = df['genre'].value_counts()
        for genre, count in genre_dist.items():
            logger.info(f"  {genre}: {count} samples")
        
        return df


def create_balanced_dataset(dataset_path: str,
                          output_path: str = "data/features_balanced.csv",
                          target_samples_per_genre: int = 1000,
                          min_segment_duration: float = 10.0,
                          max_segment_duration: float = 180.0,
                          sample_rate: int = 22050,
                          hop_length: int = 512,
                          n_mfcc: int = 13,
                          n_chroma: int = 12,
                          show_progress: bool = True) -> pd.DataFrame:
    """
    Create a balanced feature dataset from audio files with dynamic chunk calculation.
    
    Args:
        dataset_path: Path to the dataset directory
        output_path: Path to save the balanced features CSV
        target_samples_per_genre: Target number of samples per genre
        min_segment_duration: Minimum chunk duration in seconds
        max_segment_duration: Maximum chunk duration in seconds
        sample_rate: Target sample rate for audio loading
        hop_length: Number of samples between successive frames
        n_mfcc: Number of MFCC coefficients to extract
        n_chroma: Number of chroma bins
        show_progress: Whether to show progress bar during processing
        
    Returns:
        DataFrame with balanced features
    """
    extractor = BalancedSegmentationExtractor(
        target_samples_per_genre=target_samples_per_genre,
        min_segment_duration=min_segment_duration,
        max_segment_duration=max_segment_duration,
        sample_rate=sample_rate,
        hop_length=hop_length,
        n_mfcc=n_mfcc,
        n_chroma=n_chroma
    )
    
    # Analyze dataset
    extractor.analyze_dataset(dataset_path)
    
    # Create segmentation plan
    extractor.create_segmentation_plan()
    
    # Create balanced features
    return extractor.create_balanced_features(output_path, show_progress)


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Create balanced feature dataset with dynamic chunking")
    parser.add_argument("--dataset", required=True, help="Path to dataset directory")
    parser.add_argument("--output", default="data/features_balanced.csv", help="Output CSV path")
    parser.add_argument("--target-per-genre", type=int, default=1000, help="Target samples per genre")
    parser.add_argument("--min-chunk-duration", type=float, default=10.0, help="Minimum chunk duration in seconds")
    parser.add_argument("--max-chunk-duration", type=float, default=180.0, help="Maximum chunk duration in seconds")
    parser.add_argument("--sample-rate", type=int, default=44100, help="Target sample rate for audio loading")
    parser.add_argument("--hop-length", type=int, default=512, help="Number of samples between successive frames")
    parser.add_argument("--n-mfcc", type=int, default=13, help="Number of MFCC coefficients to extract")
    parser.add_argument("--n-chroma", type=int, default=12, help="Number of chroma bins")
    
    args = parser.parse_args()
    
    try:
        df = create_balanced_dataset(
            dataset_path=args.dataset,
            output_path=args.output,
            target_samples_per_genre=args.target_per_genre,
            min_segment_duration=args.min_chunk_duration,
            max_segment_duration=args.max_chunk_duration,
            sample_rate=args.sample_rate,
            hop_length=args.hop_length,
            n_mfcc=args.n_mfcc,
            n_chroma=args.n_chroma
        )
        
        print(f"\n🎉 Success! Created {len(df)} balanced samples")
        print(f"Saved to: {args.output}")
        
    except Exception as e:
        logger.error(f"Failed to create balanced dataset: {e}")
        raise