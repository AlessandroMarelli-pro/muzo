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
  "success": true,
  "segment_index": 6,
  "classification": {
    "genre": "Electronic",
    "subgenre": "Downtempo",
    "confidence": {
      "genre": 1.0,
      "subgenre": 1.0,
      "combined": 1.0,
      "original_genre": 0.8808,
      "original_subgenre": 0.9833,
      "original_combined": 0.8661,
      "discogs_boost": 1.2
    }
  },
  "processing_time": 0,
  "aggregation_method": "best_confidence",
  "segment_count": 7,
  "model_name": "Hierarchical Music Classification (Segmented)",
  "file_path": "Africa Caribe - Undeniable Love (Joaquin Joe Claussell Remix).opus",
  "segmentation": {
    "used": true,
    "segment_count": 7,
    "segment_duration": 60.0,
    "aggregation_method": "best_confidence"
  },
  "musicbrainz_validation": {
    "enabled": true,
    "used": false,
    "genres_found": [],
    "genre_match": false,
    "boost_factor": 1.0,
    "confidence_improvement": {
      "genre": 0.0,
      "subgenre": 0.0,
      "combined": 0.0
    },
    "message": "MusicBrainz identification attempted but no genres found"
  },
  "discogs_validation": {
    "enabled": true,
    "used": true,
    "genres_found": [
      "Electronic",
      "Latin",
      "Funk / Soul",
      "Folk, World, & Country"
    ],
    "subgenres_found": ["Salsa", "Afro-Cuban", "Latin", "Deep House"],
    "genre_match": true,
    "boost_factor": 1.2,
    "confidence_improvement": {
      "genre": 0.1192,
      "subgenre": 0.0167,
      "combined": 0.1339
    }
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
  "status": "success",
  "message": "Simple audio analysis completed successfully",
  "processing_time": 4.242,
  "processing_mode": "simple",
  "file_info": {
    "filename": "Africa Caribe - Undeniable Love (Joaquin Joe Claussell Remix).opus",
    "filepath": "/var/folders/zv/2rc8q3ks52l1ggf5f0mnj02h0000gn/T/tmpg0mw7mxj.opus",
    "file_extension": ".opus",
    "mime_type": "audio/opus",
    "file_size_bytes": 7591095,
    "file_size_mb": 7.24,
    "created_at": "2025-11-27T16:23:08Z",
    "modified_at": "2025-11-27T16:23:08Z",
    "accessed_at": "2025-11-27T16:23:08Z"
  },
  "audio_technical": {
    "sample_rate": 48000,
    "duration_seconds": 412.45,
    "format": "professional",
    "bitrate": 1536000,
    "channels": 2,
    "samples": 19797768,
    "bit_depth": 16,
    "subtype": "OPUS"
  },
  "features": {
    "musical_features": {
      "valence": 0.69,
      "mood_calculation": {
        "mode_factor": 0.8,
        "mode_confidence": 0.4708665407090357,
        "mode_weight": 0.07062998110635535,
        "tempo_factor": 0.23799999999999996,
        "energy_factor": 0.748416583402466,
        "brightness_factor": 0.6124877263849432,
        "harmonic_factor": 0.9173569572823388,
        "spectral_balance": 0.6954190096892251,
        "beat_strength": 0.31,
        "syncopation": 0.2364286333322525
      },
      "valence_mood": "positive",
      "arousal": 0.354,
      "arousal_mood": "calm",
      "danceability": 0.676,
      "danceability_feeling": "danceable",
      "danceability_calculation": {
        "rhythm_stability": 0.9,
        "bass_presence": 1.0,
        "tempo_regularity": 0.8181818181818181,
        "tempo_appropriateness": 0.6,
        "energy_factor": 0.748416583402466,
        "syncopation": 0.2364286333322525,
        "beat_strength": 0.31
      },
      "acousticness": 0.0,
      "instrumentalness": 1.0,
      "speechiness": 0.119,
      "liveness": 0.652,
      "energy_comment": "Subdued energy profile - warm and mellow character",
      "energy_keywords": ["subdued", "warm", "mellow", "gentle", "soft"],
      "mode": "major",
      "tempo": 93.8,
      "key": "C# minor",
      "camelot_key": "12A"
    },
    "spectral_features": {
      "spectral_centroids": {
        "mean": 3868.6824951171875,
        "std": 1363.1805419921875,
        "median": 3441.5208740234375,
        "min": 1272.1326904296875,
        "max": 8370.9794921875,
        "p25": 2607.79931640625,
        "p75": 4435.405029296875
      },
      "spectral_bandwidths": {
        "mean": 249972.5625,
        "std": 76435.09765625,
        "median": 211411.1015625,
        "min": 90438.5390625,
        "max": 532406.9375,
        "p25": 166935.1875,
        "p75": 257735.9609375
      },
      "spectral_spreads": {
        "mean": 4059.260009765625,
        "std": 843.0368347167969,
        "median": 3919.531005859375,
        "min": 2174.283447265625,
        "max": 5841.31884765625,
        "p25": 3307.7532958984375,
        "p75": 4490.657958984375
      },
      "spectral_flatnesses": {
        "mean": 0.028925064951181412,
        "std": 0.018939148634672165,
        "median": 0.018508490175008774,
        "min": 0.0058946190401911736,
        "max": 0.14738427102565765,
        "p25": 0.012554221786558628,
        "p75": 0.03520125150680542
      },
      "spectral_rolloffs": {
        "mean": 8404.680908203125,
        "std": 2831.6414794921875,
        "median": 7406.25,
        "min": 3316.40625,
        "max": 14566.40625,
        "p25": 5771.484375,
        "p75": 9802.734375
      },
      "zero_crossing_rate": {
        "mean": 0.059461575001478195,
        "std": 0.04104382544755936,
        "median": 0.05029296875,
        "max": 0.30029296875,
        "min": 0.0048828125,
        "p25": 0.03076171875,
        "p75": 0.07470703125
      },
      "rms": {
        "mean": 0.11432615667581558,
        "std": 0.03938266262412071,
        "median": 0.11744292080402374,
        "max": 0.27098163962364197,
        "min": 0.02890861965715885,
        "p25": 0.08917905390262604,
        "p75": 0.13277533650398254
      },
      "energy_by_band": [
        4.113207817077637, 1.0872679948806763, 0.07833020389080048
      ],
      "energy_ratios": [
        0.7791928335172994, 0.2059685450869491, 0.014838621395751516
      ],
      "mfcc_mean": [
        -90.50965881347656, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
        0.0, 0.0
      ]
    },
    "rhythm_fingerprint": {
      "zcr_mean": 0.059461575001478195,
      "zcr_std": 0.04104382544755936
    },
    "melodic_fingerprint": {
      "chroma": {
        "mean": [
          0.39908432960510254, 0.5070831775665283, 0.4544825255870819,
          0.5675026774406433, 0.5325510501861572, 0.3732791841030121,
          0.5833886861801147, 0.3669030964374542, 0.3316928744316101,
          0.2885010540485382, 0.3499932289123535, 0.4049339294433594
        ],
        "std": [
          0.2755342125892639, 0.28623729944229126, 0.2743847668170929,
          0.3472200334072113, 0.29665592312812805, 0.20066606998443604,
          0.37163791060447693, 0.2653034031391144, 0.2922033965587616,
          0.24854440987110138, 0.2635386884212494, 0.3031368851661682
        ],
        "max": [
          1.0, 1.0, 1.0, 1.0, 1.0, 0.9931464195251465, 1.0, 1.0, 1.0,
          0.9456905126571655, 1.0, 1.0
        ],
        "overall_mean": 0.42994967103004456,
        "overall_std": 0.3032238781452179,
        "dominant_pitch": 6
      },
      "tonnetz": {
        "mean": [
          0.7659874398221251, 0.7429835781294812, 0.9374850301973281,
          0.7723634930227392, 0.8213856321509166, 0.8210521012544632
        ],
        "std": [
          0.41308633369896586, 0.39536146404265443, 0.4922902950460686,
          0.4032951947018317, 0.3755239050441068, 0.39458603475217435
        ],
        "max": [
          1.969618797302246, 1.755218744277954, 1.96305513381958,
          1.8124998807907104, 1.9431769847869873, 1.7506017684936523
        ],
        "overall_mean": 0.8102095457628423,
        "overall_std": 0.41892975963093815
      }
    }
  },
  "fingerprint": {
    "file_hash": "3d1ab492360bbfd3a707d61fcb27c261",
    "audio_hash": "760c3185252948d2145fb4c368d147bd",
    "method": "simple_md5"
  },
  "id3_tags": {
    "title": "Africa Caribe - Undeniable Love (Joaquin Joe Claussell Remix)",
    "artist": "Fania Records",
    "date": "20110429",
    "year": "20110429",
    "bitrate": "",
    "filename_parsed": false
  },
  "album_art": null
}
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
