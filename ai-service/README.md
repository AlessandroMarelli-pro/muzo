# Muzo AI Service

AI-powered audio analysis and classification service for the Muzo project.

## Features

- **BPM Detection**: Adaptive FFT-based tempo detection
- **Hierarchical Music Classification**: Multi-level genre classification using HuggingFace models
- **Simple Audio Analysis**: Feature extraction, fingerprinting, and metadata extraction
- **Key Detection**: Musical key and scale identification
- **Mood Analysis**: Audio mood and danceability analysis

## Quick Start

```bash
# Create and activate virtual environment
python -m venv .venv
source .venv/bin/activate  # or `source activate.sh`

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
```

| Mode            | Flag                  | Use Case                                                     |
| --------------- | --------------------- | ------------------------------------------------------------ |
| Simple Analysis | `--simple-only`       | audioFlux-based feature extraction, fingerprinting, metadata |
| Hierarchical    | `--hierarchical-only` | CNN-based genre classification using HuggingFace models      |
| Full            | (no flag)             | All features enabled                                         |

Additional options: `--host`, `--debug`

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

### Hierarchical Classification (Optional)

Enable with `ENABLE_HIERARCHICAL_CLASSIFICATION=true`

| Endpoint                               | Description                |
| -------------------------------------- | -------------------------- |
| `/api/v1/audio/analyze/classification` | Single file classification |
| `/api/v1/audio/hierarchical/batch`     | Batch classification       |
| `/api/v1/audio/hierarchical/status`    | Service status             |
| `/api/v1/audio/hierarchical/genres`    | Available genres           |
| `/api/v1/audio/hierarchical/health`    | Health check               |

### Simple Analysis (Optional)

Enable with `ENABLE_SIMPLE_ANALYSIS=true`

```bash
curl -X POST -F "audio_file=@track.mp3" http://localhost:4000/api/v1/audio/analyze/simple
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
| `LOG_LEVEL`    | `INFO`              | Logging level                   |
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
| `SAMPLE_RATE`         | `44100`           | Audio sample rate              |
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
| `CACHE_TYPE`            | `simple`    | Cache type               |
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

- **Genre Classifier**: `CosmicSurfer/muzo-genre-classifier` → `genre_classifier.pth`
- **Subgenre Specialists**: `CosmicSurfer/muzo-subgenre-specialists` → `{genre}_specialist.pth`

## Project Structure

```
ai-service/
├── app.py                      # Flask application entry point
├── requirements.txt            # Python dependencies
├── src/
│   ├── api/                    # API endpoints
│   │   ├── bpm_detection.py
│   │   ├── health.py
│   │   ├── hierarchical_classification.py
│   │   └── simple_analysis.py
│   ├── services/               # Business logic
│   │   ├── enhanced_adaptive_bpm_detector.py
│   │   ├── fft_bpm_detector.py
│   │   ├── hierarchical_music_classifier.py
│   │   ├── huggingface_model_manager.py
│   │   ├── simple_*.py         # Simple analysis services
│   │   └── features/           # Audio feature extractors
│   ├── config/                 # Configuration
│   └── utils/                  # Utilities
├── models/                     # Trained models
├── tests/                      # Test suite
└── trainers/                   # Model training scripts
```

## Development

### Running Tests

```bash
pytest tests/
```

### Code Quality

```bash
black src/
flake8 src/
mypy src/
```

## Dependencies

- **Flask**: Web framework with Flask-RESTful
- **librosa**: Audio analysis
- **transformers**: HuggingFace models for classification
- **scikit-learn**: ML utilities
- **numpy/pandas**: Data processing
- **loguru**: Logging

## License

MIT License - see [LICENSE](LICENSE) file.
