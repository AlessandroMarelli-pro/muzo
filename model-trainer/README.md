# 🎵 Muzo Model Trainer

A high-performance music genre and subgenre classification system using both traditional Machine Learning (Random Forest) and Deep Learning (CNN/Hybrid CNN-RNN) approaches. Designed for GPU-accelerated training with support for hierarchical classification.

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Requirements](#requirements)
- [Installation](#installation)
- [GPU Training Setup](#gpu-training-setup)
- [Quick Start](#quick-start)
- [Training Models](#training-models)
- [Project Structure](#project-structure)
- [Model Architectures](#model-architectures)
- [Configuration](#configuration)
- [Performance](#performance)
- [API Reference](#api-reference)
- [Troubleshooting](#troubleshooting)

---

## Overview

The Muzo Model Trainer is a comprehensive system for training music classification models. It supports:

- **Genre Classification**: Classify music into broad categories (Rock, Electronic, Jazz, etc.)
- **Subgenre Classification**: Fine-grained classification within genres (Grunge, House, Bebop, etc.)
- **Hierarchical Classification**: Two-stage approach for improved accuracy

The system is optimized for high-performance training on modern hardware (AMD Ryzen 7 + RTX 4070 or similar).

---

## Features

- 🚀 **GPU Acceleration**: Full CUDA support with PyTorch for CNN training
- 🎯 **Hierarchical Classification**: 82%+ genre accuracy with specialized subgenre models
- 🔄 **Multiple Architectures**: Random Forest, CNN, and Hybrid CNN-RNN
- 📊 **Smart Data Augmentation**: Intelligent audio segmentation avoiding intros/outros
- 🎛️ **Configurable Training**: Extensive hyperparameter tuning options
- 📈 **Progress Tracking**: Real-time training metrics and visualization
- 💾 **Model Persistence**: Save/load trained models for deployment

---

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     MUZO MODEL TRAINER                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌──────────────────┐    ┌───────────────┐  │
│  │ Audio Files │───▶│ Feature Extractor │───▶│ ML Models     │  │
│  │ (.flac/.wav)│    │ (librosa/mel-spec)│    │ (RF/CNN/RNN)  │  │
│  └─────────────┘    └──────────────────┘    └───────────────┘  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              HIERARCHICAL CLASSIFICATION                 │   │
│  │                                                          │   │
│  │  Step 1: Genre Classifier (82.38% accuracy)             │   │
│  │     ↓ Input: Audio → Output: Genre + Confidence          │   │
│  │                                                          │   │
│  │  Step 2: Subgenre Specialist (Per-genre models)         │   │
│  │     ↓ Input: Audio → Output: Subgenre + Confidence       │   │
│  │                                                          │   │
│  │  Step 3: Combined Result                                 │   │
│  │     → Final: Genre + Subgenre + Combined Confidence      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### CNN Architecture

```
Input: Mel-spectrogram (128 x 1292)
├── Conv2D + BatchNorm + ReLU + MaxPool (32 filters)
├── Conv2D + BatchNorm + ReLU + MaxPool (64 filters)
├── Conv2D + BatchNorm + ReLU + MaxPool (128 filters)
├── Conv2D + BatchNorm + ReLU + MaxPool (256 filters)
├── Flatten
├── Dense(512) + ReLU + Dropout
├── Dense(128) + ReLU + Dropout
└── Dense(num_classes) → Output
```

### Hybrid CNN-RNN Architecture

```
Input: Mel-spectrogram (128 x 1292)
├── CNN Feature Extractor
│   ├── Conv2D + BatchNorm + ReLU + MaxPool
│   ├── Conv2D + BatchNorm + ReLU + MaxPool
│   └── Conv2D + BatchNorm + ReLU + MaxPool
├── Reshape for RNN (time_steps, features)
├── Bidirectional LSTM (128 hidden units)
├── Attention Mechanism
├── Dense Layer + Dropout
└── Dense(num_classes) → Output
```

---

## Requirements

### System Requirements

- **Python**: 3.11+
- **OS**: Windows, macOS, or Linux
- **RAM**: 16GB+ recommended
- **GPU**: NVIDIA GPU with CUDA support (optional but recommended)

### Core Dependencies

```txt
# Audio processing and ML
librosa>=0.11.0
scikit-learn>=1.7.0
pandas>=2.3.0
joblib>=1.5.0
numpy>=2.3.0

# Testing
pytest>=8.4.0

# Audio file handling
soundfile>=0.13.0
tabulate>=0.10.0
```

### CNN Dependencies (Deep Learning)

```txt
# PyTorch ecosystem
torch>=2.0.0
torchvision>=0.15.0
torchaudio>=2.0.0

# Visualization
matplotlib>=3.7.0
seaborn>=0.12.0

# Progress tracking
tqdm>=4.65.0
```

---

## Installation

### 1. Clone and Setup Virtual Environment

```bash
cd model-trainer

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On macOS/Linux:
source venv/bin/activate
# On Windows:
.\venv\Scripts\activate
```

### 2. Install Base Dependencies

```bash
pip install -r requirements.txt
```

### 3. Install CNN Dependencies (Optional)

```bash
pip install -r requirements-cnn.txt
```

---

## GPU Training Setup

### NVIDIA CUDA Setup

GPU training significantly accelerates CNN model training. Follow these steps to enable GPU support:

#### 1. Check CUDA Compatibility

```bash
# Check if NVIDIA GPU is available
nvidia-smi
```

#### 2. Install PyTorch with CUDA Support

```bash
# For CUDA 11.8
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118

# For CUDA 12.1
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121

# For CUDA 12.4 (latest)
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu124
```

#### 3. Verify GPU Installation

```python
import torch

print(f"PyTorch version: {torch.__version__}")
print(f"CUDA available: {torch.cuda.is_available()}")
print(f"CUDA version: {torch.version.cuda}")
print(f"GPU device: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'N/A'}")
```

#### 4. Optional: CuPy for Random Forest GPU Acceleration

```bash
# For CUDA 11.x
pip install cupy-cuda11x

# For CUDA 12.x
pip install cupy-cuda12x
```

### GPU Memory Optimization

For large datasets or limited GPU memory:

```bash
# Reduce batch size
--batch-size 8  # or 4 for very limited memory

# Use gradient accumulation (implicit with smaller batches)
# Enable mixed precision (automatic in PyTorch 2.0+)
```

### Multi-GPU Training

The system automatically detects and uses available GPUs:

```python
# Check available GPUs
import torch
print(f"Available GPUs: {torch.cuda.device_count()}")
for i in range(torch.cuda.device_count()):
    print(f"  GPU {i}: {torch.cuda.get_device_name(i)}")
```

---

## Quick Start

### Train a Genre Classification Model (CNN)

```bash
# Activate virtual environment
source venv/bin/activate  # or .\venv\Scripts\activate on Windows

# Train CNN model
python src/cnn_model_training.py \
  --dataset "/path/to/your/music/dataset" \
  --output "models/my_model" \
  --model-name "genre-classifier-v1.0" \
  --architecture hybrid \
  --epochs 50 \
  --batch-size 32 \
  --genre-only
```

### Train a Random Forest Model

```bash
python src/model_training.py \
  --features "data/features.csv" \
  --output "models" \
  --model-name "rf-classifier-v1.0"
```

### Quick Prediction

```python
from src.cnn_model_training import CNNMusicClassifier

# Load trained model
classifier = CNNMusicClassifier()
classifier.load_model("models/my_model/genre-classifier-v1.0.pth")

# Predict
result = classifier.predict("path/to/song.flac")
print(f"Genre: {result['predictions']['predicted_genre']}")
print(f"Confidence: {result['predictions']['confidence']:.2%}")
```

---

## Training Models

### Dataset Structure

Organize your music files in a hierarchical folder structure:

```
dataset/
├── Rock/
│   ├── Alternative Rock/
│   │   ├── song1.flac
│   │   └── song2.flac
│   ├── Grunge/
│   │   └── ...
│   └── Hard Rock/
│       └── ...
├── Electronic/
│   ├── House/
│   ├── Techno/
│   └── Ambient/
├── Jazz/
│   ├── Bebop/
│   ├── Smooth Jazz/
│   └── Fusion/
└── ...
```

### Training Commands

#### 1. CNN Genre Classification

```bash
python src/cnn_model_training.py \
  --dataset "/path/to/dataset" \
  --output "models/genre_model" \
  --model-name "genre-v1.0" \
  --architecture hybrid \
  --use-preprocessing \
  --target-samples 1500 \
  --segment-duration 90 \
  --epochs 50 \
  --lr 0.0001 \
  --batch-size 32 \
  --workers 8 \
  --val-split 0.2 \
  --genre-only
```

#### 2. Subgenre Specialists

```bash
python src/cnn_model_training_subgenre.py \
  --dataset "/path/to/dataset" \
  --output "models/subgenre_specialists" \
  --architecture hybrid \
  --target-samples 1000 \
  --segment-duration 90 \
  --epochs 50 \
  --lr 0.0001 \
  --batch-size 32 \
  --workers 8 \
  --val-split 0.2 \
  --genres "Alternative,Dance_EDM,Electronic,Hip-Hop_Rap,Jazz"
```

#### 3. Hierarchical System Deployment

```bash
python scripts/deploy_hierarchical_system.py \
  --train-all \
  --dataset "/path/to/dataset" \
  --target-samples 500 \
  --segment-duration 30.0 \
  --epochs 50 \
  --architecture hybrid \
  --batch-size 32
```

### Training Parameters Reference

| Parameter | Description | Default |
|-----------|-------------|---------|
| `--dataset` | Path to music dataset | Required |
| `--output` | Output directory for models | `models/` |
| `--model-name` | Name for the trained model | `music-v1.0` |
| `--architecture` | Model type: `cnn`, `hybrid` | `hybrid` |
| `--epochs` | Number of training epochs | `50` |
| `--lr` | Learning rate | `0.001` |
| `--batch-size` | Training batch size | `32` |
| `--workers` | Data loader workers | `8` |
| `--val-split` | Validation split ratio | `0.2` |
| `--target-samples` | Target samples per class | `1000` |
| `--segment-duration` | Audio segment length (seconds) | `30` |
| `--genre-only` | Train only genre classifier | `False` |
| `--use-preprocessing` | Apply smart audio preprocessing | `False` |

### Using Training Scripts

#### Windows (PowerShell)

```powershell
.\train.ps1
```

#### Linux/macOS (Bash)

```bash
chmod +x train.sh
./train.sh
```

---

## Project Structure

```
model-trainer/
├── src/
│   ├── cnn_model_training.py        # CNN-based training (main)
│   ├── cnn_model_training_subgenre.py # Subgenre specialist training
│   ├── model_training.py            # Random Forest training
│   ├── feature_extraction.py        # Audio feature extraction
│   ├── hierarchical_training.py     # Hierarchical classification
│   └── balanced_feature_extraction.py # Balanced dataset creation
│
├── scripts/
│   ├── deploy_hierarchical_system.py # Full system deployment
│   ├── generate_gpu.py              # GPU-optimized data generation
│   ├── generate_optimized.py        # Optimized feature generation
│   ├── upload_genre_model.py        # Model upload utilities
│   └── upload_subgenre_specialists.py
│
├── models/                          # Trained model outputs
│   ├── *.pth                        # PyTorch CNN models
│   ├── *.pkl                        # Scikit-learn models
│   └── *_results.json               # Training results/metrics
│
├── data/                            # Feature datasets
│   └── *.csv                        # Extracted features
│
├── training_data/                   # Preprocessed audio segments
│
├── tests/                           # Test suites
│   ├── test_ub40_genres.py
│   ├── test_ub40_subgenres.py
│   └── test_random_songs.py
│
├── requirements.txt                 # Base dependencies
├── requirements-cnn.txt             # CNN/PyTorch dependencies
├── requirements-performance.txt     # Performance profiling deps
│
├── train.sh                         # Linux/macOS training script
├── train.ps1                        # Windows training script
│
├── genres-tree.json                 # Genre/subgenre taxonomy
├── CNN_README.md                    # CNN-specific documentation
├── MODEL_IMPROVEMENT_SUMMARY.md     # Model optimization history
└── HIERARCHICAL_DEPLOYMENT_GUIDE.md # Deployment guide
```

---

## Model Architectures

### When to Use Each Architecture

| Criteria | Random Forest | CNN | Hybrid CNN-RNN |
|----------|---------------|-----|----------------|
| **Dataset Size** | < 1,000 samples | > 5,000 samples | > 10,000 samples |
| **Training Time** | Minutes | Hours | Hours |
| **Expected Accuracy** | 70-85% | 80-95% | 85-98% |
| **Interpretability** | High | Low | Low |
| **GPU Required** | No | Recommended | Recommended |
| **Feature Engineering** | Manual | Automatic | Automatic |

### Random Forest

Best for:
- Quick prototyping
- Small datasets
- When interpretability is important

```python
from src.model_training import MusicGenreClassifier

classifier = MusicGenreClassifier(
    model_name="rf-v1.0",
    max_workers=16,
    use_gpu=True  # Uses CuPy if available
)
```

### CNN (Spectrogram-based)

Best for:
- Large datasets
- Production deployments
- When GPU is available

### Hybrid CNN-RNN

Best for:
- Maximum accuracy
- Temporal pattern recognition
- Complex genre distinctions

---

## Configuration

### Genre Taxonomy

The system supports a comprehensive genre hierarchy defined in `genres-tree.json`:

```json
{
  "Pop": ["Dance-pop", "Synth-pop", "Indie pop", "K-Pop", ...],
  "Rock": ["Alternative rock", "Hard rock", "Punk rock", "Grunge", ...],
  "Electronic Dance Music (EDM)": ["House", "Techno", "Trance", "Dubstep", ...],
  "Hip Hop": ["Rap", "Trap", "Gangsta rap", "Drill", ...],
  "Jazz": ["Bebop", "Swing", "Fusion", "Smooth jazz", ...],
  "Classical": ["Baroque", "Romantic", "Symphony", "Opera", ...],
  ...
}
```

### Environment Configuration

Create a `.env` file for custom settings:

```env
# GPU Settings
CUDA_VISIBLE_DEVICES=0
PYTORCH_CUDA_ALLOC_CONF=max_split_size_mb:512

# Training Settings
DEFAULT_BATCH_SIZE=32
DEFAULT_WORKERS=8
DEFAULT_EPOCHS=50

# Paths
MODEL_OUTPUT_DIR=./models
DATA_DIR=./data
```

---

## Performance

### Achieved Results

| Model | Accuracy | Training Time | Notes |
|-------|----------|---------------|-------|
| Genre (Hybrid CNN-RNN) | 82.38% | ~2-3 hours | 7 genres |
| Subgenre Specialists | 70-85% | ~1 hour each | Per-genre |
| Random Forest (Genre) | 73.36% | ~5 minutes | 5 genres |
| Random Forest (Subgenre) | 38.16% | ~5 minutes | 33 subgenres |

### Inference Performance

- **Processing Time**: 2-3 seconds per song
- **Memory Usage**: ~2-4GB (with all specialists loaded)
- **GPU Utilization**: Optimal on RTX 3070/4070

### Optimization Tips

1. **Increase batch size** if GPU memory allows
2. **Use mixed precision** training (automatic in PyTorch 2.0+)
3. **Enable data loader workers** for faster data loading
4. **Use SSD storage** for dataset to reduce I/O bottlenecks

---

## API Reference

### CNNMusicClassifier

```python
from src.cnn_model_training import CNNMusicClassifier

# Initialize
classifier = CNNMusicClassifier(
    model_name="my-model",
    architecture="hybrid",  # "cnn" or "hybrid"
    sample_rate=22050,
    duration=30.0,
    n_mels=128,
    device="cuda"  # or "cpu"
)

# Train
results = classifier.train(
    audio_files=["song1.wav", "song2.wav", ...],
    labels=["rock", "jazz", ...],
    num_epochs=50,
    learning_rate=0.001,
    validation_split=0.2,
    early_stopping_patience=10
)

# Predict
prediction = classifier.predict("new_song.flac")
# Returns: {'predictions': {'predicted_genre': 'rock', 'confidence': 0.89, ...}}

# Save/Load
classifier.save_model("models/my-model.pth")
classifier.load_model("models/my-model.pth")
```

### MusicGenreClassifier (Random Forest)

```python
from src.model_training import MusicGenreClassifier

classifier = MusicGenreClassifier(
    model_name="rf-model",
    random_state=42,
    max_workers=16,
    use_gpu=True
)

# Train from features CSV
classifier.train_from_csv("data/features.csv")

# Predict
result = classifier.predict(features_array)
```

### AudioFeatureExtractor

```python
from src.feature_extraction import AudioFeatureExtractor

extractor = AudioFeatureExtractor(
    sample_rate=22050,
    hop_length=512,
    n_mfcc=13,
    n_chroma=12
)

# Extract features
features = extractor.extract_all_features("song.flac")
# Returns dict with: mfcc, spectral_centroid, spectral_rolloff, chroma, tempo, etc.
```

---

## Troubleshooting

### Common Issues

#### 1. CUDA Out of Memory

```bash
# Solution: Reduce batch size
python src/cnn_model_training.py --batch-size 8

# Or set environment variable
export PYTORCH_CUDA_ALLOC_CONF=max_split_size_mb:512
```

#### 2. Audio Loading Errors

```bash
# Install audio codecs
pip install soundfile
pip install audioread

# On Ubuntu/Debian
sudo apt-get install libsndfile1 ffmpeg
```

#### 3. Poor Model Performance

- **Increase dataset size**: Aim for 500+ samples per class
- **Use data augmentation**: Enable with `--use-preprocessing`
- **Try hybrid architecture**: `--architecture hybrid`
- **Adjust learning rate**: Try `0.0001` instead of `0.001`

#### 4. Training Too Slow

- **Enable GPU**: Verify CUDA is properly installed
- **Increase workers**: `--workers 8` or higher
- **Use SSD**: Move dataset to fast storage
- **Reduce segment duration**: `--segment-duration 30`

#### 5. Model Not Converging

- **Lower learning rate**: `--lr 0.0001`
- **Increase epochs**: `--epochs 100`
- **Check data quality**: Ensure audio files are valid
- **Balance dataset**: Use `--target-samples` to balance classes

### Getting Help

1. Check the detailed documentation in:
   - `CNN_README.md` - CNN-specific details
   - `MODEL_IMPROVEMENT_SUMMARY.md` - Optimization history
   - `HIERARCHICAL_DEPLOYMENT_GUIDE.md` - Deployment guide

2. Run tests to verify setup:
   ```bash
   pytest tests/ -v
   ```

---

## License

This project is part of the Muzo music platform. See the main project license for details.

---

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `pytest tests/ -v`
5. Submit a pull request

---

## Acknowledgments

- [librosa](https://librosa.org/) - Audio analysis
- [PyTorch](https://pytorch.org/) - Deep learning framework
- [scikit-learn](https://scikit-learn.org/) - Machine learning
- [tqdm](https://tqdm.github.io/) - Progress bars

