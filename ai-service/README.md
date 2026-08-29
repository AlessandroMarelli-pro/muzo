# Muzo AI Service

AI-powered audio analysis and classification service for the Muzo project. Built with Flask and Python, this service provides comprehensive audio analysis capabilities including BPM detection, genre classification, key detection, mood analysis, and audio fingerprinting -- backed by Essentia's discogs-effnet embedding and its family of classifier heads (danceability, mood, voice/instrumental, genre, instruments, mood/theme tags) plus dedicated TempoCNN and DEAM arousal-valence models.

## Features

### 🎵 Audio Analysis

- **Tempo Detection**: Essentia TempoCNN (deeptemp-k16)
- **Key Detection**: Musical key and scale identification (major/minor)
- **Mood Analysis**: Valence/arousal via the DEAM arousal-valence regression model; danceability via the discogs-effnet `danceable` classifier
- **Genre/Tags**: `genre_discogs400`, `mtg_jamendo_moodtheme`, `mtg_jamendo_instrument` classifier heads on the discogs-effnet embedding

### 🔍 Audio Fingerprinting & Metadata

- **Feature Extraction**: MFCC, spectral, rhythm, and melodic features
- **Metadata Extraction**: ID3 tags, file properties, and technical details

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

Use `run_services.py` to start the service:

```bash
python run_services.py --port=4000

# With debug mode
python run_services.py --debug --port=4000
```

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

### Simple Analysis

Enable with `--simple-only` or full mode.

```bash
curl -X POST -F "audio_file=@track.mp3" http://localhost:4000/api/v1/audio/analyze/simple
```

**Response:**

The response is a generic feature envelope: every model-derived value is a
`{"value", "confidence", "source"}` entry under `features` (adding a new model
never requires a new top-level key), a value is `null` -- never a neutral
placeholder like `0.5`/`0.0`/`"Unknown"` -- when its source model didn't produce
one, and `warnings` names exactly which model(s) contributed nothing and why
(`"disabled"` / `"failed"` / `"empty"`).

```json
{
  "status": "success",
  "message": "Simple audio analysis completed successfully",
  "processing_time": 4.242,
  "processing_mode": "simple",
  "schema_version": 2,
  "track": {
    "filename": "Africa Caribe - Undeniable Love (Joaquin Joe Claussell Remix).opus",
    "extension": ".opus",
    "mime_type": "audio/opus",
    "size_bytes": 7591095,
    "size_mb": 7.24
  },
  "audio": {
    "sample_rate": 48000,
    "duration_s": 412.45,
    "format": "professional",
    "bitrate": 1536000,
    "channels": 2,
    "samples": 19797768,
    "bit_depth": 16,
    "subtype": "OPUS"
  },
  "tags": {
    "title": "Africa Caribe - Undeniable Love (Joaquin Joe Claussell Remix)",
    "artist": "Fania Records",
    "date": "20110429",
    "year": "20110429",
    "bitrate": "",
    "filename_parsed": false
  },
  "features": {
    "tempo": { "value": 93.8, "confidence": 0.82, "source": "tempo_cnn" },
    "key": { "value": "C# minor", "confidence": null, "source": "skey" },
    "camelot_key": { "value": "12A", "confidence": null, "source": "skey" },
    "mode": { "value": "minor", "confidence": null, "source": "skey" },
    "valence": { "value": 0.69, "confidence": null, "source": "deam" },
    "arousal": { "value": 0.354, "confidence": null, "source": "deam" },
    "danceability": { "value": 0.676, "confidence": null, "source": "discogs_effnet" },
    "instrumentalness": { "value": 1.0, "confidence": null, "source": "discogs_effnet" },
    "mood_happy": { "value": 0.55, "confidence": null, "source": "discogs_effnet" },
    "voice": { "value": 0.0, "confidence": null, "source": "discogs_effnet" }
  },
  "labels": {
    "valence_mood": "positive",
    "arousal_mood": "calm",
    "danceability_feeling": "danceable"
  },
  "classifications": {
    "genre_styles": [
      { "genre": "Electronic", "style": "Deep House", "confidence": 0.62 },
      { "genre": "Funk / Soul", "style": "Disco", "confidence": 0.18 }
    ],
    "genres": [
      { "genre": "Electronic", "confidence": 0.62 },
      { "genre": "Funk / Soul", "confidence": 0.18 }
    ],
    "styles": [
      { "style": "Deep House", "genre": "Electronic", "confidence": 0.62 },
      { "style": "Disco", "genre": "Funk / Soul", "confidence": 0.18 }
    ],
    "instruments": [],
    "tags": []
  },
  "embedding": { "vector": [0.1, 0.2], "dim": 1280, "source": "discogs_effnet" },
  "warnings": [],
  "album_art": null
}
```

`warnings` is empty when every model ran successfully. When
`DISCOGS_CLASSIFIERS_ENABLED=false`, or a model call fails or returns nothing, the
fields it would have populated are simply absent from `features` (never present
with a fallback value), and an entry like this appears instead:

```json
{ "model": "deam", "reason": "failed", "detail": "..." }
```

## Configuration

### Environment Variables

#### Core Settings

| Variable       | Default             | Description                                 |
| -------------- | ------------------- | ------------------------------------------- |
| `FLASK_HOST`   | `0.0.0.0`           | Host address                                |
| `FLASK_PORT`   | `4000`              | Port number                                 |
| `FLASK_DEBUG`  | `False`             | Debug mode                                  |
| `SECRET_KEY`   | `dev-secret-key...` | Flask secret key                            |
| `LOG_LEVEL`    | `INFO`              | Logging level (DEBUG, INFO, WARNING, ERROR) |
| `LOG_FILE`     | -                   | Optional log file path                      |
| `CORS_ORIGINS` | `*`                 | Comma-separated allowed origins             |

#### Service Toggles

| Variable                             | Default | Description                                     |
| ------------------------------------ | ------- | ----------------------------------------------- |
| `ENABLE_SIMPLE_ANALYSIS`             | `true`  | Enable simple analysis endpoints                |
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

| Variable                | Default     | Description                |
| ----------------------- | ----------- | -------------------------- |
| `CACHE_TYPE`            | `simple`    | Cache type (simple, redis) |
| `CACHE_DEFAULT_TIMEOUT` | `300`       | Cache timeout in seconds   |
| `REDIS_HOST`            | `localhost` | Redis host                 |
| `REDIS_PORT`            | `6379`      | Redis port                 |
| `REDIS_PASSWORD`        | -           | Redis password             |
| `REDIS_DB`              | `0`         | Redis database number      |

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

| Model                | Repository                               | File                     |
| -------------------- | ---------------------------------------- | ------------------------ |
| Genre Classifier     | `CosmicSurfer/muzo-genre-classifier`     | `genre_classifier.pth`   |
| Subgenre Specialists | `CosmicSurfer/muzo-subgenre-specialists` | `{genre}_specialist.pth` |

## Project Structure

```
ai-service/
├── app.py                      # Flask application entry point
├── run_services.py             # Service runner
├── requirements.txt            # Python dependencies
├── LICENSE                     # MIT License
├── src/
│   ├── api/                    # API endpoints (Flask-RESTful resources)
│   │   ├── bpm_detection.py
│   │   ├── health.py
│   │   └── simple_analysis.py
│   ├── services/               # Business logic and audio processing
│   │   ├── huggingface_model_manager.py
│   │   ├── essentia_model_manager.py
│   │   ├── simple_audio_loader.py
│   │   ├── simple_feature_extractor.py
│   │   ├── simple_fingerprint_generator.py
│   │   ├── simple_metadata_extractor.py
│   │   ├── simple_technical_analyzer.py
│   │   ├── simple_filename_parser.py
│   │   ├── simple_analysis.py
│   │   └── features/           # Audio feature extractors
│   │       ├── discogs_embedding_extractor.py   # discogs-effnet 1280-dim embedding
│   │       ├── discogs_classifiers_extractor.py # danceability/mood/voice/genre/instrument/tag heads
│   │       ├── tempo_cnn_extractor.py           # TempoCNN tempo estimation
│   │       ├── deam_extractor.py                # DEAM valence/arousal regression
│   │       ├── key_detector.py
│   │       └── shared_features.py
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
├── models/                     # Trained models and HuggingFace/Essentia cache
├── tests/                      # Test suite
└── trainers/                   # Model training scripts (e.g. filename parser)
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
