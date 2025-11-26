# Muzo AI Service

This directory contains the Python Flask AI service for audio analysis, fingerprinting, and genre classification in the Muzo project.

## Overview

The AI service provides REST API endpoints for:

- **Audio Analysis**: Comprehensive feature extraction from audio files
- **Audio Fingerprinting**: Unique fingerprint generation for audio identification
- **Genre Classification**: AI-powered genre classification using trained models

## Features

### 🎵 **Audio Analysis**

- **Feature Extraction**: MFCC, spectral, rhythm, and melodic features
- **Audio Processing**: Support for multiple audio formats (WAV, MP3, FLAC, M4A, AAC, OGG)
- **Comprehensive Analysis**: Duration, tempo, energy, spectral characteristics

### 🔍 **Audio Fingerprinting**

- **Unique Identification**: Generate unique fingerprints for audio files
- **Multiple Fingerprint Types**: File hash, audio hash, spectral, rhythm, and melodic fingerprints
- **Similarity Comparison**: Compare fingerprints for duplicate detection

### 🎭 **Genre Classification**

- **AI-Powered**: Machine learning-based genre classification
- **Multiple Genres**: Support for 20+ music genres
- **Confidence Scores**: Detailed confidence scores for all genres
- **Mock Classification**: Fallback classification when model is not available

## API Endpoints

### **Health Check**

```
GET /api/v1/health
```

Returns service health status and component information.

### **Audio Analysis**

```
POST /api/v1/audio/analyze
Content-Type: multipart/form-data
Body: audio_file (file)
```

Comprehensive audio analysis including features, fingerprint, and genre classification.

### **Audio Fingerprinting**

```
POST /api/v1/audio/fingerprint
Content-Type: multipart/form-data
Body: audio_file (file)
```

Generate unique fingerprint for audio file.

### **Genre Classification**

```
POST /api/v1/audio/genre
Content-Type: multipart/form-data
Body: audio_file (file)
```

Classify the genre of an audio file.

## Installation

### Prerequisites

- Python 3.8+
- pip or conda

### Setup

1. **Install dependencies**:

   ```bash
   pip install -r requirements.txt
   ```

2. **Set environment variables** (optional):

   ```bash
   export FLASK_HOST=0.0.0.0
   export FLASK_PORT=4000
   export FLASK_DEBUG=True
   export LOG_LEVEL=INFO
   ```

3. **Run the service**:
   ```bash
   python app.py
   ```

## Configuration

### Environment Variables

- `FLASK_HOST`: Host to bind the service (default: 0.0.0.0)
- `FLASK_PORT`: Port to bind the service (default: 4000)
- `FLASK_DEBUG`: Enable debug mode (default: False)
- `LOG_LEVEL`: Logging level (default: INFO)
- `LOG_FILE`: Log file path (optional)
- `CORS_ORIGINS`: Allowed CORS origins (default: \*)
- `MODEL_DIR`: Directory for trained models (default: models)
- `TEMP_AUDIO_DIR`: Temporary directory for audio files (default: /tmp/muzo_audio)

### Audio Processing Settings

- `SAMPLE_RATE`: Audio sample rate (default: 22050)
- `HOP_LENGTH`: Hop length for analysis (default: 512)
- `N_MELS`: Number of mel bands (default: 128)
- `N_MFCC`: Number of MFCC coefficients (default: 13)

## Usage Examples

### **Health Check**

```bash
curl http://localhost:4000/api/v1/health
```

### **Audio Analysis**

```bash
curl -X POST -F "audio_file=@example.wav" http://localhost:4000/api/v1/audio/analyze
```

### **Genre Classification**

```bash
curl -X POST -F "audio_file=@example.wav" http://localhost:4000/api/v1/audio/genre
```

### **Audio Fingerprinting**

```bash
curl -X POST -F "audio_file=@example.wav" http://localhost:4000/api/v1/audio/fingerprint
```

## Response Formats

### **Audio Analysis Response**

```json
{
  "filename": "example.wav",
  "features": {
    "basic_properties": {
      "duration": 180.5,
      "sample_rate": 22050,
      "rms_energy": 0.123,
      "tempo": 120.5
    },
    "spectral_features": {
      "spectral_centroid_mean": 2000.5,
      "spectral_centroid_std": 500.2
    },
    "mfcc_features": {
      "mfcc_mean": [1.2, -0.5, 0.8, ...],
      "mfcc_std": [0.3, 0.2, 0.4, ...]
    }
  },
  "fingerprint": {
    "file_hash": "sha256_hash",
    "audio_hash": "sha256_hash",
    "spectral_fingerprint": {...},
    "rhythm_fingerprint": {...}
  },
  "genre_classification": {
    "predicted_genre": "rock",
    "confidence": 0.85,
    "all_scores": {...},
    "top_genres": [...]
  },
  "status": "success"
}
```

### **Genre Classification Response**

```json
{
  "filename": "example.wav",
  "classification": {
    "predicted_genre": "rock",
    "confidence": 0.85,
    "all_scores": {
      "rock": 0.85,
      "pop": 0.10,
      "jazz": 0.03,
      ...
    },
    "top_genres": [
      ["rock", 0.85],
      ["pop", 0.10],
      ["jazz", 0.03]
    ],
    "model_used": true
  },
  "status": "success"
}
```

## Architecture

### **Service Structure**

```
ai-service/
├── app.py                 # Main Flask application
├── requirements.txt       # Python dependencies
├── src/
│   ├── api/              # API endpoints
│   │   ├── health.py
│   │   ├── audio_analysis.py
│   │   ├── fingerprint.py
│   │   └── genre_classification.py
│   ├── services/         # Business logic services
│   │   ├── audio_processor.py
│   │   ├── audio_fingerprinting.py
│   │   └── genre_classifier.py
│   ├── config/           # Configuration
│   │   └── settings.py
│   └── utils/            # Utility functions
└── tests/               # Test files
    ├── unit/
    ├── integration/
    └── contract/
```

### **Service Dependencies**

- **Flask**: Web framework
- **librosa**: Audio analysis library
- **scikit-learn**: Machine learning library
- **numpy**: Numerical computing
- **pandas**: Data manipulation
- **loguru**: Logging

## Development

### **Running Tests**

```bash
pytest tests/
```

### **Code Quality**

```bash
# Format code
black src/

# Lint code
flake8 src/

# Type checking
mypy src/
```

### **Adding New Features**

1. Add new service in `src/services/`
2. Create API endpoint in `src/api/`
3. Add tests in `tests/`
4. Update documentation

## Model Training

The genre classification model is trained using the POC scripts and saved as a pickle file. The model should be placed in the `models/` directory.

### **Model Requirements**

- File format: `.pkl` (pickle)
- Model type: scikit-learn classifier
- Expected features: 50-dimensional feature vector
- Supported genres: 20+ music genres

## Error Handling

The service includes comprehensive error handling:

- **File validation**: Check file types and sizes
- **Audio processing errors**: Handle corrupted or unsupported files
- **Model errors**: Fallback to mock classification
- **API errors**: Proper HTTP status codes and error messages

## Security

- **File upload limits**: Maximum file size restrictions
- **CORS configuration**: Configurable cross-origin resource sharing
- **Input validation**: File type and content validation
- **Temporary files**: Automatic cleanup of uploaded files

## Performance

- **Efficient processing**: Optimized audio analysis algorithms
- **Memory management**: Proper cleanup of audio data
- **Concurrent requests**: Support for multiple simultaneous requests
- **Caching**: Optional caching for repeated requests

## Monitoring

- **Health checks**: Service health monitoring
- **Logging**: Comprehensive logging with loguru
- **Error tracking**: Detailed error logging and reporting
- **Performance metrics**: Request timing and resource usage

## Integration

The AI service integrates with:

- **Backend**: HTTP API communication
- **Frontend**: REST API endpoints
- **POC**: Model training and validation
- **Electron**: Desktop application integration

## License

MIT License - see the main project LICENSE file for details.
