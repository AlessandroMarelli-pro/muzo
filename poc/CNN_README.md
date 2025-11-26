# CNN-Based Music Classification

This module provides Convolutional Neural Network (CNN) approaches for music genre and subgenre classification, complementing the existing Random Forest implementation.

## 🚀 Key Features

- **Spectrogram-based CNNs**: Process mel-spectrograms for automatic feature learning
- **Hybrid CNN-RNN**: Combine CNNs for local features with RNNs for temporal modeling
- **GPU acceleration**: Full CUDA support with mixed precision training
- **Attention mechanisms**: Focus on important temporal segments
- **Real-time prediction**: Fast inference on trained models
- **Comprehensive logging**: Detailed training progress and metrics

## 📋 Requirements

### Core Dependencies

```bash
pip install torch torchvision torchaudio
pip install librosa soundfile matplotlib
```

### Full Requirements

```bash
pip install -r requirements-cnn.txt
```

### GPU Support (Optional)

For CUDA acceleration:

```bash
# For CUDA 11.x
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118

# For CUDA 12.x
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
```

## 🏗️ Architecture Overview

### 1. Spectrogram CNN (`SpectrogramCNN`)

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

### 2. Hybrid CNN-RNN (`HybridCNNRNN`)

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

## 🎯 When to Use CNN vs Random Forest

| Criteria                | Random Forest   | CNN             | Hybrid CNN-RNN   |
| ----------------------- | --------------- | --------------- | ---------------- |
| **Dataset Size**        | < 1,000 samples | > 5,000 samples | > 10,000 samples |
| **Training Time**       | Minutes         | Hours           | Hours            |
| **Accuracy**            | 70-85%          | 80-95%          | 85-98%           |
| **Interpretability**    | High            | Low             | Low              |
| **GPU Required**        | No              | Recommended     | Recommended      |
| **Feature Engineering** | Manual          | Automatic       | Automatic        |
| **Overfitting Risk**    | Low             | Medium          | Medium           |

## 📊 Performance Comparison

Based on your current Random Forest results:

- **Random Forest**: 36% test accuracy (significant overfitting)
- **Expected CNN**: 75-90% with proper data augmentation
- **Expected Hybrid**: 80-95% with sufficient data

## 🚀 Quick Start

### 1. Basic CNN Training

```python
from src.cnn_model_training import train_cnn_music_model

# Prepare your data
audio_files = ["path/to/song1.wav", "path/to/song2.wav", ...]
labels = ["rock", "jazz", "electronic", ...]

# Train CNN model
results = train_cnn_music_model(
    audio_files=audio_files,
    labels=labels,
    model_name="my-cnn-v1.0",
    architecture="cnn",
    num_epochs=50,
    learning_rate=0.001
)

print(f"Validation accuracy: {results['final_val_acc']:.2f}%")
```

### 2. Hybrid CNN-RNN Training

```python
# Train hybrid model for better temporal modeling
results = train_cnn_music_model(
    audio_files=audio_files,
    labels=labels,
    model_name="my-hybrid-v1.0",
    architecture="hybrid",  # Use CNN-RNN hybrid
    num_epochs=50
)
```

### 3. Making Predictions

```python
from src.cnn_model_training import CNNMusicClassifier

# Load trained model
classifier = CNNMusicClassifier()
classifier.load_model("models/my-cnn-v1.0.pth")

# Predict on new audio
result = classifier.predict("path/to/new_song.wav")
print(f"Predicted genre: {result['predictions']['predicted_genre']}")
print(f"Confidence: {result['predictions']['confidence']:.3f}")
```

## 📁 Dataset Structure

Organize your dataset as follows:

```
dataset/
├── rock/
│   ├── song1.wav
│   ├── song2.wav
│   └── ...
├── jazz/
│   ├── song1.wav
│   ├── song2.wav
│   └── ...
├── electronic/
│   └── ...
└── classical/
    └── ...
```

## 🛠️ Advanced Usage

### Custom Model Architecture

```python
from src.cnn_model_training import CNNMusicClassifier

# Initialize with custom parameters
classifier = CNNMusicClassifier(
    model_name="custom-model",
    architecture="hybrid",
    sample_rate=44100,  # Higher sample rate
    duration=60.0,      # Longer audio segments
    n_mels=256,         # More mel bands
    device="cuda"       # Force GPU usage
)
```

### Training with Custom Parameters

```python
results = classifier.train(
    audio_files=audio_files,
    labels=labels,
    num_epochs=100,
    learning_rate=0.0001,           # Lower learning rate
    validation_split=0.15,          # Less validation data
    early_stopping_patience=15,     # More patience
    save_best_model=True           # Save best model
)
```

### Batch Prediction

```python
# Predict on multiple files
audio_files = ["song1.wav", "song2.wav", "song3.wav"]
results = classifier.predict(audio_files)

for i, prediction in enumerate(results['predictions']):
    print(f"File {i+1}: {prediction['predicted_genre']} ({prediction['confidence']:.3f})")
```

## 🎛️ Hyperparameter Tuning

### Learning Rate Schedule

```python
# The CNN implementation includes automatic learning rate scheduling
# ReduceLROnPlateau: reduces LR when validation loss plateaus
# Default: patience=5, factor=0.5
```

### Data Augmentation (Future Enhancement)

```python
# Potential augmentations for audio:
# - Time stretching
# - Pitch shifting
# - Noise addition
# - Frequency masking
# - Time masking
```

## 🔧 Troubleshooting

### Common Issues

**1. CUDA Out of Memory**

```python
# Reduce batch size
# Default batch size is 32, try 16 or 8
```

**2. Poor Performance**

```python
# Solutions:
# - Increase dataset size (> 5,000 samples)
# - Increase training epochs (50-100)
# - Try hybrid architecture
# - Adjust learning rate (0.001 → 0.0001)
```

**3. Overfitting**

```python
# Solutions:
# - Increase dropout rate (0.5 → 0.7)
# - Add data augmentation
# - Reduce model complexity
# - Early stopping (already implemented)
```

## 📈 Monitoring Training

The CNN implementation provides comprehensive logging:

- Real-time loss and accuracy
- Learning rate scheduling
- Early stopping notifications
- GPU memory usage
- Training time estimates

Example output:

```
🚀 Using device: cuda
🎵 Classes: ['electronic', 'jazz', 'rock', 'classical']
Epoch 1/50, Batch 10/45, Loss: 1.3456
Epoch 1/50:
  Train Loss: 1.2345, Train Acc: 45.67%
  Val Loss: 1.1234, Val Acc: 52.34%
✅ CNN training completed in 1234.5 seconds
📈 Best validation accuracy: 87.65%
```

## 🔄 Integration with Existing System

The CNN approach integrates seamlessly with your existing Random Forest system:

```python
# Use both models for ensemble prediction
from src.model_training import MusicGenreClassifier as RFClassifier
from src.cnn_model_training import CNNMusicClassifier

# Load both models
rf_model = RFClassifier()
rf_model.load_model("models/random-forest-v1.0.pkl")

cnn_model = CNNMusicClassifier()
cnn_model.load_model("models/cnn-v1.0.pth")

# Ensemble prediction
def ensemble_predict(audio_file):
    # Get CNN prediction
    cnn_result = cnn_model.predict(audio_file)

    # Extract features for RF model
    from src.feature_extraction import AudioFeatureExtractor
    extractor = AudioFeatureExtractor()
    features = extractor.extract_all_features(audio_file)

    # Get RF prediction
    rf_result = rf_model.predict(features)

    # Combine predictions (simple average)
    return {
        "cnn_prediction": cnn_result,
        "rf_prediction": rf_result,
        "ensemble_confidence": (
            cnn_result['predictions']['confidence'] +
            rf_result['genre_prediction']['confidence']
        ) / 2
    }
```

## 🎯 Performance Optimization

### GPU Optimization

- Mixed precision training (automatic)
- Batch size optimization
- Memory-efficient data loading
- Gradient accumulation for large models

### CPU Optimization

- Multi-worker data loading
- Optimized audio preprocessing
- Efficient tensor operations

## 📚 References

- **Mel-spectrograms**: [Librosa Documentation](https://librosa.org/)
- **CNN for Audio**: [Deep Learning for Audio](https://arxiv.org/abs/1905.00078)
- **Music Classification**: [Music Genre Classification](https://arxiv.org/abs/1804.01149)
- **PyTorch**: [Official PyTorch Tutorials](https://pytorch.org/tutorials/)

## 🤝 Contributing

To extend the CNN implementation:

1. **Add new architectures** in `cnn_model_training.py`
2. **Implement data augmentation** in `AudioSpectrogramDataset`
3. **Add new loss functions** for multi-label classification
4. **Create ensemble methods** combining CNN + RF predictions

## 📄 License

This CNN implementation follows the same license as the main Muzo project.
