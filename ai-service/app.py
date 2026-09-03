"""
Muzo AI Service - Flask Application

This module provides the main Flask application for the Muzo AI service,
handling audio analysis, fingerprinting, and genre classification.
"""

import logging
import os

# MUST be first: pins native thread counts via env vars that TF / BLAS / torch
# read once at import time. See the module docstring.
import src.config.threads  # noqa: F401

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_restful import Api, Resource
from loguru import logger

# Load environment variables
load_dotenv()

# Import API resources
from src.api.audio_enhancement import AudioEnhancementResource
from src.api.batch_simple_analysis import BatchSimpleAnalysisResource
from src.api.discogs_embedding import DiscogsEmbeddingResource
from src.api.health import HealthResource
from src.api.simple_analysis import SimpleAnalysisResource
from src.api.verify_lossless import VerifyLosslessResource

# Import configuration
from src.config.settings import Config

# Import performance monitoring
from src.utils.performance_optimizer import (
    get_performance_recommendations,
    performance_monitor,
)


def create_app(config_class=Config):
    """
    Create and configure the Flask application.

    Args:
        config_class: Configuration class to use

    Returns:
        Flask: Configured Flask application
    """
    app = Flask(__name__)
    app.config.from_object(config_class)

    # Initialize CORS
    CORS(app, origins=app.config.get("CORS_ORIGINS", ["*"]))

    # Initialize API
    api = Api(app, prefix="/api/v1")

    # Configure logging
    configure_logging(app)

    # Initialize services
    # initialize_services(app)

    # Register API resources
    register_resources(api, app)

    # Register error handlers
    register_error_handlers(app)

    return app


class _InterceptHandler(logging.Handler):
    """Route stdlib `logging` records into loguru so third-party libraries
    (skey, werkzeug, absl, trainers.*, ...) obey the same LOG_LEVEL and sinks
    as the app instead of printing their own `INFO:root:` lines to stderr."""

    def emit(self, record: logging.LogRecord) -> None:
        try:
            level = logger.level(record.levelname).name
        except ValueError:
            level = record.levelno
        # Walk back to the frame where the log call was issued.
        frame, depth = logging.currentframe(), 2
        while frame and frame.f_code.co_filename == logging.__file__:
            frame = frame.f_back
            depth += 1
        logger.opt(depth=depth, exception=record.exc_info).bind(
            stdlib=record.name
        ).log(level, record.getMessage())


# Third-party stdlib loggers that are chatty at INFO and carry nothing an
# operator needs in the normal stream.
_NOISY_STDLIB_LOGGERS = (
    "skey",
    "trainers",
    "trainers.filename_parser",
    "trainers.filename_parser.hybrid_parser",
    "absl",
    "tensorflow",
    "h5py",
    "numba",
    "matplotlib",
    "musicbrainzngs",
    "pylast",
    "httpx",
    "httpcore",
    "urllib3",
)


class _NoHealthCheckFilter(logging.Filter):
    """Drop werkzeug access-log lines for the health probe -- it fires
    constantly (HF platform liveness) and drowns the real request lines."""

    def filter(self, record: logging.LogRecord) -> bool:
        msg = record.getMessage()
        return "/api/v1/health" not in msg and "/api/v1/service-status" not in msg


def configure_logging(app):
    """Configure application logging."""
    log_level = app.config.get("LOG_LEVEL", "INFO")

    # Remove default loguru handler
    logger.remove()

    # --- Bridge stdlib logging -> loguru ---------------------------------
    # Reset the root logger: strip any handlers a third-party import installed
    # (skey / trainers call logging.basicConfig at import), then funnel
    # everything through the intercept handler at our level.
    # App code logs through loguru; stdlib `logging` is used only by third-party
    # libraries here, so the root logger sits at WARNING -- their INFO chatter
    # (skey's `INFO:root:Loading checkpoint`, numba, matplotlib, ...) is dropped,
    # while warnings and errors still surface via the intercept handler.
    root = logging.getLogger()
    for h in list(root.handlers):
        root.removeHandler(h)
    root.addHandler(_InterceptHandler())
    root.setLevel(logging.WARNING)

    for name in _NOISY_STDLIB_LOGGERS:
        logging.getLogger(name).setLevel(logging.WARNING)

    # werkzeug's request log is useful, but not the constant health probe.
    werkzeug_logger = logging.getLogger("werkzeug")
    werkzeug_logger.setLevel(logging.INFO)
    werkzeug_logger.addFilter(_NoHealthCheckFilter())

    # Process-trace records (logged via src/utils/trace.py) carry extra["trace"]
    # and already embed a "[file]" tag in the message, so they get a stripped
    # format with no {function}:{line} noise. Everything else keeps the detailed
    # format.
    def _console_format(record):
        if record["extra"].get("trace"):
            return (
                "<green>{time:YYYY-MM-DD HH:mm:ss}</green> | "
                "<level>{message}</level>\n"
            )
        if record["extra"].get("stdlib"):
            return (
                "<green>{time:YYYY-MM-DD HH:mm:ss}</green> | "
                "<dim>{extra[stdlib]}</dim> - <level>{message}</level>\n"
            )
        return (
            "<green>{time:YYYY-MM-DD HH:mm:ss}</green> | "
            "<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>\n"
        )

    def _file_format(record):
        if record["extra"].get("trace"):
            return "{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {message}\n"
        if record["extra"].get("stdlib"):
            return (
                "{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | "
                "{extra[stdlib]} - {message}\n"
            )
        return (
            "{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | "
            "{name}:{function}:{line} - {message}\n"
        )

    # Add console handler
    logger.add(
        sink=lambda msg: print(msg, end=""),
        level=log_level,
        colorize=True,
        format=_console_format,
    )

    # Add file handler if log file is configured
    log_file = app.config.get("LOG_FILE")
    if log_file:
        logger.add(
            sink=log_file,
            level=log_level,
            format=_file_format,
            rotation="10 MB",
            retention="7 days",
        )


def initialize_services(app):
    """Initialize application services based on configuration flags."""
    logger.debug("Services initialized successfully")


def register_resources(api, app):
    """Register API resources based on configuration flags."""
    # Health check endpoint
    api.add_resource(HealthResource, "/health")

    # Simple analysis endpoints (if enabled)
    if os.getenv("ENABLE_SIMPLE_ANALYSIS") == "true":
        api.add_resource(SimpleAnalysisResource, "/audio/analyze/simple")
        api.add_resource(BatchSimpleAnalysisResource, "/audio/analyze/batch")
        logger.debug("✅ Simple analysis endpoints registered")
    else:
        logger.debug("🚫 Simple analysis endpoints disabled by configuration")

    # Discogs-effnet embedding endpoint (always enabled)
    api.add_resource(DiscogsEmbeddingResource, "/audio/embedding/discogs")
    logger.debug("✅ Discogs embedding endpoint registered")

    # Audio enhancement (super-resolution) endpoint
    if os.getenv("ENABLE_AUDIO_ENHANCEMENT", "true") == "true":
        api.add_resource(AudioEnhancementResource, "/audio/enhance")
        logger.debug("✅ Audio enhancement endpoint registered")
    else:
        logger.debug("🚫 Audio enhancement endpoint disabled by configuration")

    # Fake-lossless verification (always enabled; cheap, no model load)
    api.add_resource(VerifyLosslessResource, "/audio/verify-lossless")
    logger.debug("✅ Verify-lossless endpoint registered")

    logger.debug("API resources registered successfully")


def register_error_handlers(app):
    """Register error handlers."""

    @app.errorhandler(400)
    def bad_request(error):
        return jsonify(
            {
                "error": "Bad Request",
                "message": "The request was invalid or cannot be served",
                "status_code": 400,
            }
        ), 400

    @app.errorhandler(404)
    def not_found(error):
        return jsonify(
            {
                "error": "Not Found",
                "message": "The requested resource was not found",
                "status_code": 404,
            }
        ), 404

    @app.errorhandler(405)
    def method_not_allowed(error):
        return jsonify(
            {
                "error": "Method Not Allowed",
                "message": "The method is not allowed for the requested URL",
                "status_code": 405,
            }
        ), 405

    @app.errorhandler(500)
    def internal_error(error):
        logger.error(f"Internal server error: {error}")
        return jsonify(
            {
                "error": "Internal Server Error",
                "message": "An internal server error occurred",
                "status_code": 500,
            }
        ), 500

    @app.errorhandler(Exception)
    def handle_exception(error):
        logger.error(f"Unhandled exception: {error}")
        return jsonify(
            {
                "error": "Internal Server Error",
                "message": "An unexpected error occurred",
                "status_code": 500,
            }
        ), 500


def create_app_with_routes(config_class=Config):
    """Create Flask app with all routes."""
    app = create_app(config_class)

    # Flag to ensure startup only runs once
    app._startup_initialized = False
    logger.info("🚀 Starting up Muzo AI Service...")

    initialize_services(app)

    @app.route("/")
    def index():
        """Root endpoint with API information."""
        endpoints = {
            "health": "/api/v1/health",
            "service_status": "/api/v1/service-status",
            "performance": "/api/v1/performance",
        }

        # Add simple analysis endpoints if enabled
        if os.getenv("ENABLE_SIMPLE_ANALYSIS") == "true":
            endpoints.update(
                {
                    "audio_analyze_simple": "/api/v1/audio/analyze/simple",
                    "audio_analyze_batch": "/api/v1/audio/analyze/batch",
                }
            )

        # Add Discogs-effnet embedding endpoint (always available)
        endpoints.update(
            {
                "audio_embedding_discogs": "/api/v1/audio/embedding/discogs",
            }
        )

        return jsonify(
            {
                "service": "Muzo AI Service",
                "version": "1.0.0",
                "description": "AI-powered audio analysis and classification service",
                "configuration": {
                    "simple_analysis_enabled": os.getenv("ENABLE_SIMPLE_ANALYSIS")
                    == "true",
                },
                "endpoints": endpoints,
                "documentation": "/api/v1/docs",
            }
        )

    @app.route("/api/v1/performance")
    def performance_metrics():
        """Performance monitoring endpoint."""
        if not Config.PERFORMANCE_MONITORING:
            return jsonify({"error": "Performance monitoring is disabled"}), 403

        summary = performance_monitor.get_performance_summary()
        recommendations = get_performance_recommendations()

        return jsonify(
            {
                "performance_summary": summary,
                "recommendations": recommendations,
                "monitoring_enabled": Config.PERFORMANCE_MONITORING,
                "slow_operation_threshold": Config.SLOW_OPERATION_THRESHOLD,
            }
        )

    @app.route("/api/v1/service-status")
    def service_status():
        """Service status endpoint showing initialization state."""
        status = {
            "service": "Muzo AI Service",
            "version": "1.0.0",
            "startup_initialized": app._startup_initialized,
            "configuration": {
                "simple_analysis_enabled": os.getenv("ENABLE_SIMPLE_ANALYSIS")
                == "true",
            },
        }

        return jsonify(status)

    return app


def shutdown_handler():
    """Handle application shutdown gracefully."""
    logger.info("🔄 Shutting down Muzo AI Service...")


# Create the application instance
# app = create_app_with_routes()

# Register shutdown handler for graceful shutdown
import atexit
import signal
import sys

atexit.register(shutdown_handler)


# Handle SIGTERM and SIGINT signals for graceful shutdown
def signal_handler(signum, frame):
    logger.info(f"Received signal {signum}, shutting down gracefully...")
    shutdown_handler()
    sys.exit(0)


signal.signal(signal.SIGTERM, signal_handler)
signal.signal(signal.SIGINT, signal_handler)


if __name__ == "__main__":
    # Get configuration from environment
    host = os.getenv("FLASK_HOST", "0.0.0.0")
    port = int(os.getenv("FLASK_PORT", 4000))
    debug = os.getenv("FLASK_DEBUG", "False").lower() == "true"

    logger.info(f"Starting Muzo AI Service on {host}:{port}")
    logger.info(f"Debug mode: {debug}")

    create_app_with_routes().run(host=host, port=port, debug=debug)
