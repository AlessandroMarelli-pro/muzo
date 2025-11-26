"""
Configuration settings for the Muzo AI Service.
"""

import os
from pathlib import Path


class Config:
    """Base configuration class."""

    # Flask configuration
    SECRET_KEY = os.environ.get("SECRET_KEY") or "dev-secret-key-change-in-production"
    DEBUG = os.environ.get("FLASK_DEBUG", "False").lower() == "true"

    # CORS configuration
    CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "*").split(",")

    # Logging configuration
    LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO")
    LOG_FILE = os.environ.get("LOG_FILE")

    # Audio processing configuration
    MAX_AUDIO_FILE_SIZE = int(
        os.environ.get("MAX_AUDIO_FILE_SIZE", 100 * 1024 * 1024)
    )  # 100MB
    SUPPORTED_AUDIO_FORMATS = ["wav", "mp3", "flac", "m4a", "aac", "ogg"]
    TEMP_AUDIO_DIR = os.environ.get("TEMP_AUDIO_DIR", "/tmp/muzo_audio")

    # Model configuration
    MODEL_DIR = os.environ.get("MODEL_DIR", "src/models")
    GENRE_CLASSIFIER_MODEL = os.environ.get("GENRE_CLASSIFIER_MODEL", "music-v1.0.pkl")
    SUBGENRE_CLASSIFIER_MODEL = os.environ.get(
        "SUBGENRE_CLASSIFIER_MODEL", "music-v1.0.pkl"
    )

    # Audio analysis configuration
    SAMPLE_RATE = int(os.environ.get("SAMPLE_RATE", 44100))
    HOP_LENGTH = int(os.environ.get("HOP_LENGTH", 512))
    N_MELS = int(os.environ.get("N_MELS", 128))
    N_MFCC = int(os.environ.get("N_MFCC", 13))

    # API configuration
    API_TIMEOUT = int(os.environ.get("API_TIMEOUT", 30))  # seconds
    MAX_CONCURRENT_REQUESTS = int(os.environ.get("MAX_CONCURRENT_REQUESTS", 10))

    # Service configuration
    ENABLE_SIMPLE_ANALYSIS = (
        os.environ.get("ENABLE_SIMPLE_ANALYSIS", "true").lower() == "true"
    )
    ENABLE_HIERARCHICAL_CLASSIFICATION = (
        os.environ.get("ENABLE_HIERARCHICAL_CLASSIFICATION", "true").lower() == "true"
    )

    # Cache configuration
    CACHE_TYPE = os.environ.get("CACHE_TYPE", "simple")
    CACHE_DEFAULT_TIMEOUT = int(
        os.environ.get("CACHE_DEFAULT_TIMEOUT", 300)
    )  # 5 minutes

    # Redis configuration
    REDIS_HOST = os.environ.get("REDIS_HOST", "localhost")
    REDIS_PORT = int(os.environ.get("REDIS_PORT", "6379"))
    REDIS_PASSWORD = os.environ.get("REDIS_PASSWORD")
    REDIS_DB = int(os.environ.get("REDIS_DB", "0"))

    # Discogs cache TTL settings
    DISCOGS_CACHE_TTL = int(os.environ.get("DISCOGS_CACHE_TTL", "3600"))  # 1 hour
    ARTIST_CACHE_TTL = int(os.environ.get("ARTIST_CACHE_TTL", "7200"))  # 2 hours

    # Multiple API Keys Settings
    DISCOGS_API_KEYS = (
        os.environ.get("DISCOGS_API_KEYS", "").split(",")
        if os.environ.get("DISCOGS_API_KEYS")
        else []
    )
    DISCOGS_CIRCUIT_BREAKER_ENABLED = (
        os.environ.get("DISCOGS_CIRCUIT_BREAKER_ENABLED", "true").lower() == "true"
    )
    DISCOGS_FAILURE_THRESHOLD = int(os.environ.get("DISCOGS_FAILURE_THRESHOLD", "5"))
    DISCOGS_RECOVERY_TIMEOUT = int(
        os.environ.get("DISCOGS_RECOVERY_TIMEOUT", "300")
    )  # 5 minutes

    # Performance monitoring configuration
    PERFORMANCE_MONITORING = (
        os.environ.get("PERFORMANCE_MONITORING", "true").lower() == "true"
    )
    SLOW_OPERATION_THRESHOLD = float(os.environ.get("SLOW_OPERATION_THRESHOLD", "1.0"))

    @staticmethod
    def init_app(app):
        """Initialize application with configuration."""
        # Create necessary directories
        Path(Config.TEMP_AUDIO_DIR).mkdir(parents=True, exist_ok=True)
        Path(Config.MODEL_DIR).mkdir(parents=True, exist_ok=True)


class DevelopmentConfig(Config):
    """Development configuration."""

    DEBUG = True
    LOG_LEVEL = "DEBUG"
    CORS_ORIGINS = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
    ]


class ProductionConfig(Config):
    """Production configuration."""

    DEBUG = False
    LOG_LEVEL = "INFO"
    CORS_ORIGINS = (
        os.environ.get("CORS_ORIGINS", "").split(",")
        if os.environ.get("CORS_ORIGINS")
        else ["*"]
    )


class TestingConfig(Config):
    """Testing configuration."""

    TESTING = True
    DEBUG = True
    LOG_LEVEL = "DEBUG"
    TEMP_AUDIO_DIR = "/tmp/muzo_audio_test"
    MODEL_DIR = "test_models"


# Configuration mapping
config = {
    "development": DevelopmentConfig,
    "production": ProductionConfig,
    "testing": TestingConfig,
    "default": DevelopmentConfig,
}
