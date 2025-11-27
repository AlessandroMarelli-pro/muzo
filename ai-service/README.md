# Muzo AI Service

AI-powered audio analysis and classification service for the Muzo project. Built with Flask and Python, this service provides comprehensive audio analysis capabilities including BPM detection, genre classification, key detection, mood analysis, and audio fingerprinting.

## Features

### 🎵 Audio Analysis
- **BPM Detection**: Adaptive FFT-based tempo detection with multiple algorithm support (madmom, librosa)
- **Key Detection**: Musical key and scale identification (major/minor)
- **Mood Analysis**: Audio mood classification and emotional characteristics
- **Danceability Analysis**: Rhythm and groove analysis for dance suitability

### 🎭 Genre Classification
- **Hierarchical Classification**: Multi-level genre/subgenre classification using CNN models
- **HuggingFace Integration**: Pre-trained models downloaded from HuggingFace Hub
- **Batch Processing**: Process multiple files efficiently

### 🔍 Audio Fingerprinting & Metadata
- **Feature Extraction**: MFCC, spectral, rhythm, and melodic features
- **Metadata Extraction**: ID3 tags, file properties, and technical details
- **Third-party Integration**: Discogs, MusicBrainz lookups

### 📊 Supported Formats
WAV, MP3, FLAC, M4A, AAC, OGG

## Quick Start

### Prerequisites
- Python 3.10+
- FFmpeg (for audio format conversion)

### Installation

```bash
# Create and activate virtual environment
python -m venv .venv
source .venv/bin/activate  # Linux/macOS
# or: .venv\Scripts\activate  # Windows
# or: source activate.sh

# Install dependencies
pip install -r requirements.txt
```

### Running the Service

Use `run_services.py` to start the service with different configurations:

```bash
# Simple Analysis only (audioFlux-based, no threading conflicts)
python run_services.py --simple-only --port=4001

# Hierarchical Classification only (CNN-based, multithreaded)
python run_services.py --hierarchical-only --port=4010

# Full service (both features enabled)
python run_services.py --port=4000

# With debug mode
python run_services.py --debug --port=4000
```

| Mode            | Flag                  | Use Case                                                     |
| --------------- | --------------------- | ------------------------------------------------------------ |
| Simple Analysis | `--simple-only`       | audioFlux-based feature extraction, fingerprinting, metadata |
| Hierarchical    | `--hierarchical-only` | CNN-based genre classification using HuggingFace models      |
| Full            | (no flag)             | All features enabled                                         |

Additional options: `--host <address>`, `--debug`

## API Endpoints

### Core Endpoints

| Endpoint                 | Method | Description                          |
| ------------------------ | ------ | ------------------------------------ |
| `/`                      | GET    | Service info and available endpoints |
| `/api/v1/health`         | GET    | Health check                         |
| `/api/v1/service-status` | GET    | Detailed service status              |
| `/api/v1/performance`    | GET    | Performance metrics                  |

### BPM Detection (Always Enabled)

```bash
curl -X POST -F "audio_file=@track.mp3" http://localhost:4000/api/v1/audio/bpm/detect
```

**Response:**
```json
{
  "bpm": 128.0,
  "confidence": 0.95,
  "method": "adaptive_fft"
}
```

### Hierarchical Classification

Enable with `--hierarchical-only` or full mode.

| Endpoint                               | Method | Description                |
| -------------------------------------- | ------ | -------------------------- |
| `/api/v1/audio/analyze/classification` | POST   | Single file classification |
| `/api/v1/audio/hierarchical/batch`     | POST   | Batch classification       |
| `/api/v1/audio/hierarchical/status`    | GET    | Service status             |
| `/api/v1/audio/hierarchical/genres`    | GET    | Available genres           |
| `/api/v1/audio/hierarchical/health`    | GET    | Health check               |
| `/api/v1/audio/hierarchical/example`   | GET    | Example response           |

**Example:**
```bash
curl -X POST -F "audio_file=@track.mp3" http://localhost:4000/api/v1/audio/analyze/classification
```

**Response:**
```json
{
  "genre": "Electronic",
  "subgenre": "House",
  "confidence": 0.87,
  "all_genres": {
    "Electronic": 0.87,
    "Pop": 0.08,
    "Hip-Hop": 0.05
  }
}
```

### Simple Analysis

Enable with `--simple-only` or full mode.

```bash
curl -X POST -F "audio_file=@track.mp3" http://localhost:4000/api/v1/audio/analyze/simple
```

**Response:**
```json
{
  "filename": "track.mp3",
  "duration": 180.5,
  "sample_rate": 44100,
  "bpm": 128.0,
  "key": "A minor",
  "mood": "energetic",
  "danceability": 0.82,
  "features": {
    "mfcc": [...],
    "spectral_centroid": 2500.0,
    "spectral_rolloff": 8000.0
  }
}
```

## Configuration

### Environment Variables

#### Core Settings

| Variable       | Default             | Description                     |
| -------------- | ------------------- | ------------------------------- |
| `FLASK_HOST`   | `0.0.0.0`           | Host address                    |
| `FLASK_PORT`   | `4000`              | Port number                     |
| `FLASK_DEBUG`  | `False`             | Debug mode                      |
| `SECRET_KEY`   | `dev-secret-key...` | Flask secret key                |
| `LOG_LEVEL`    | `INFO`              | Logging level (DEBUG, INFO, WARNING, ERROR) |
| `LOG_FILE`     | -                   | Optional log file path          |
| `CORS_ORIGINS` | `*`                 | Comma-separated allowed origins |

#### Service Toggles

| Variable                             | Default | Description                                     |
| ------------------------------------ | ------- | ----------------------------------------------- |
| `ENABLE_SIMPLE_ANALYSIS`             | `true`  | Enable simple analysis endpoints                |
| `ENABLE_HIERARCHICAL_CLASSIFICATION` | `true`  | Enable hierarchical classification              |
| `PERFORMANCE_MONITORING`             | `true`  | Enable performance monitoring                   |
| `SLOW_OPERATION_THRESHOLD`           | `1.0`   | Threshold (seconds) for slow operation warnings |

#### Audio Processing

| Variable              | Default           | Description                    |
| --------------------- | ----------------- | ------------------------------ |
| `SAMPLE_RATE`         | `44100`           | Audio sample rate (Hz)         |
| `HOP_LENGTH`          | `512`             | Hop length for analysis        |
| `N_MELS`              | `128`             | Number of mel bands            |
| `N_MFCC`              | `13`              | Number of MFCC coefficients    |
| `MAX_AUDIO_FILE_SIZE` | `104857600`       | Max file size in bytes (100MB) |
| `TEMP_AUDIO_DIR`      | `/tmp/muzo_audio` | Temp directory for audio files |

#### Model Configuration

| Variable                    | Default          | Description                    |
| --------------------------- | ---------------- | ------------------------------ |
| `MODEL_DIR`                 | `src/models`     | Directory for trained models   |
| `GENRE_CLASSIFIER_MODEL`    | `music-v1.0.pkl` | Genre classifier model file    |
| `SUBGENRE_CLASSIFIER_MODEL` | `music-v1.0.pkl` | Subgenre classifier model file |

#### API Settings

| Variable                  | Default | Description                |
| ------------------------- | ------- | -------------------------- |
| `API_TIMEOUT`             | `30`    | Request timeout in seconds |
| `MAX_CONCURRENT_REQUESTS` | `10`    | Max concurrent requests    |

#### Redis & Caching

| Variable                | Default     | Description              |
| ----------------------- | ----------- | ------------------------ |
| `CACHE_TYPE`            | `simple`    | Cache type (simple, redis) |
| `CACHE_DEFAULT_TIMEOUT` | `300`       | Cache timeout in seconds |
| `REDIS_HOST`            | `localhost` | Redis host               |
| `REDIS_PORT`            | `6379`      | Redis port               |
| `REDIS_PASSWORD`        | -           | Redis password           |
| `REDIS_DB`              | `0`         | Redis database number    |

#### Discogs Integration

| Variable                          | Default | Description                      |
| --------------------------------- | ------- | -------------------------------- |
| `DISCOGS_API_KEYS`                | -       | Comma-separated Discogs API keys |
| `DISCOGS_CACHE_TTL`               | `3600`  | Discogs cache TTL (1 hour)       |
| `ARTIST_CACHE_TTL`                | `7200`  | Artist cache TTL (2 hours)       |
| `DISCOGS_CIRCUIT_BREAKER_ENABLED` | `true`  | Enable circuit breaker           |
| `DISCOGS_FAILURE_THRESHOLD`       | `5`     | Failures before circuit opens    |
| `DISCOGS_RECOVERY_TIMEOUT`        | `300`   | Recovery timeout in seconds      |

#### HuggingFace Models

| Variable   | Default | Description                               |
| ---------- | ------- | ----------------------------------------- |
| `HF_TOKEN` | -       | HuggingFace API token (for private repos) |

Models are downloaded from HuggingFace Hub and cached locally in `models/huggingface_cache`:

| Model | Repository | File |
|-------|------------|------|
| Genre Classifier | `CosmicSurfer/muzo-genre-classifier` | `genre_classifier.pth` |
| Subgenre Specialists | `CosmicSurfer/muzo-subgenre-specialists` | `{genre}_specialist.pth` |

## Project Structure

```
ai-service/
├── app.py                      # Flask application entry point
├── run_services.py             # Service runner with configuration flags
├── requirements.txt            # Python dependencies
├── LICENSE                     # MIT License
├── src/
│   ├── api/                    # API endpoints (Flask-RESTful resources)
│   │   ├── bpm_detection.py
│   │   ├── health.py
│   │   ├── hierarchical_classification.py
│   │   └── simple_analysis.py
│   ├── services/               # Business logic and audio processing
│   │   ├── enhanced_adaptive_bpm_detector.py
│   │   ├── fft_bpm_detector.py
│   │   ├── hierarchical_music_classifier.py
│   │   ├── huggingface_model_manager.py
│   │   ├── simple_audio_loader.py
│   │   ├── simple_feature_extractor.py
│   │   ├── simple_fingerprint_generator.py
│   │   ├── simple_metadata_extractor.py
│   │   ├── simple_technical_analyzer.py
│   │   ├── simple_filename_parser.py
│   │   ├── simple_analysis.py
│   │   ├── features/           # Audio feature extractors
│   │   │   ├── audio_mood_analyzer.py
│   │   │   ├── danceability_analyzer.py
│   │   │   ├── key_detector.py
│   │   │   └── shared_features.py
│   │   └── third_parties/      # External API integrations
│   │       ├── discogs.py
│   │       └── musicbrainz.py
│   ├── scrappers/              # Web scrapers for metadata
│   │   ├── apple_music_scrapper.py
│   │   ├── bancamp_scrapper.py
│   │   ├── lastfm_scrapper.py
│   │   └── musicbrainz_scrapper.py
│   ├── config/                 # Configuration
│   │   ├── settings.py
│   │   ├── music_identification_config.py
│   │   └── redis_config.py
│   └── utils/                  # Utilities
│       ├── keyfinder.py
│       ├── performance_analyzer.py
│       ├── performance_optimizer.py
│       └── redis_cache.py
├── models/                     # Trained models and HuggingFace cache
├── tests/                      # Test suite
│   ├── unit/
│   ├── integration/
│   └── contract/
└── trainers/                   # Model training scripts
```

## Development

### Running Tests

```bash
# Run all tests
pytest tests/

# Run with coverage
pytest tests/ --cov=src --cov-report=html

# Run specific test file
pytest tests/unit/test_bpm_detection.py

# Run async tests
pytest tests/ -v --asyncio-mode=auto
```

### Code Quality

```bash
# Format code
black src/ tests/

# Lint code
flake8 src/ tests/

# Type checking
mypy src/

# All checks
black src/ && flake8 src/ && mypy src/
```

### Performance Analysis

```bash
# Analyze service performance
python analyze_performance.py
```

## Dependencies

### Core Framework
- **Flask** (3.0+): Web framework
- **Flask-RESTful**: REST API extensions
- **Flask-CORS**: Cross-origin resource sharing

### Audio Processing
- **librosa** (0.10+): Audio analysis and feature extraction
- **audioflux**: Advanced audio feature extraction
- **madmom**: Beat and tempo detection
- **soundfile**: Audio file I/O
- **pydub**: Audio manipulation
- **mutagen**: Audio metadata

### Machine Learning
- **PyTorch** (2.0+): Deep learning framework
- **transformers**: HuggingFace transformers
- **huggingface_hub**: Model downloads
- **scikit-learn**: ML utilities

### Data Processing
- **numpy**: Numerical computing
- **pandas**: Data manipulation
- **scipy**: Scientific computing

### External APIs
- **python3-discogs-client**: Discogs API
- **musicbrainzngs**: MusicBrainz API
- **pylast**: Last.fm API
- **pyacoustid**: AcoustID fingerprinting

### Caching & Storage
- **redis**: Redis client for caching

### Development
- **pytest**: Testing framework
- **black**: Code formatter
- **flake8**: Linter
- **mypy**: Type checker
- **loguru**: Logging

## Troubleshooting

### Common Issues

**audioFlux threading conflicts:**
Use `--simple-only` mode to avoid threading issues with audioFlux.

**Model download failures:**
Ensure `HF_TOKEN` is set if using private HuggingFace repositories.

**Memory issues with large files:**
Adjust `MAX_AUDIO_FILE_SIZE` and ensure sufficient system memory.

**Redis connection errors:**
Check Redis is running and `REDIS_HOST`/`REDIS_PORT` are correct.

### Logs

Logs are written to stdout by default. Set `LOG_FILE` to write to a file.

```bash
LOG_LEVEL=DEBUG python run_services.py --port=4000
```

## License

MIT License - see [LICENSE](LICENSE) file.
