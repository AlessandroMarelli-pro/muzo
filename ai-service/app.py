"""
Muzo AI Service - Flask Application

This module provides the main Flask application for the Muzo AI service,
handling audio analysis, fingerprinting, and genre classification.
"""

import os

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
from src.api.bpm_detection import BPMDetectionResource
from src.api.discogs_embedding import DiscogsEmbeddingResource
from src.api.health import HealthResource
from src.api.simple_analysis import SimpleAnalysisResource

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


def configure_logging(app):
    """Configure application logging."""
    log_level = app.config.get("LOG_LEVEL", "INFO")

    # Remove default loguru handler
    logger.remove()

    # Add console handler
    logger.add(
        sink=lambda msg: print(msg, end=""),
        level=log_level,
        colorize=True,
        # format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>",
        format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>",
    )

    # Add file handler if log file is configured
    log_file = app.config.get("LOG_FILE")
    if log_file:
        logger.add(
            sink=log_file,
            level=log_level,
            format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{function}:{line} - {message}",
            rotation="10 MB",
            retention="7 days",
        )


def initialize_services(app):
    """Initialize application services based on configuration flags."""
    logger.info("Services initialized successfully")


def register_resources(api, app):
    """Register API resources based on configuration flags."""
    # Health check endpoint
    api.add_resource(HealthResource, "/health")

    # Simple analysis endpoints (if enabled)
    if os.getenv("ENABLE_SIMPLE_ANALYSIS") == "true":
        api.add_resource(SimpleAnalysisResource, "/audio/analyze/simple")
        api.add_resource(
            BatchSimpleAnalysisResource, "/audio/analyze/batch"
        )
        logger.info("✅ Simple analysis endpoints registered")
    else:
        logger.info("🚫 Simple analysis endpoints disabled by configuration")

    # BPM detection endpoints (always enabled)
    api.add_resource(BPMDetectionResource, "/audio/bpm/detect")
    api.add_resource(DiscogsEmbeddingResource, "/audio/embedding/discogs")
    logger.info("✅ BPM detection endpoints registered")

    # Audio enhancement (super-resolution) endpoint
    if os.getenv("ENABLE_AUDIO_ENHANCEMENT", "true") == "true":
        api.add_resource(AudioEnhancementResource, "/audio/enhance")
        logger.info("✅ Audio enhancement endpoint registered")
    else:
        logger.info("🚫 Audio enhancement endpoint disabled by configuration")

    logger.info("API resources registered successfully")


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
                }
            )

        # Add BPM detection endpoint (always available)
        endpoints.update(
            {
                "audio_bpm_detect": "/api/v1/audio/bpm/detect",
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
