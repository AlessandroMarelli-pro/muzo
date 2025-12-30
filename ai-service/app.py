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
from src.api.bpm_detection import BPMDetectionResource
from src.api.health import HealthResource
from src.api.openai_metadata import OpenAIMetadataResource
from src.api.simple_analysis import SimpleAnalysisResource

# Conditionally import hierarchical classification resources
if os.getenv("ENABLE_HIERARCHICAL_CLASSIFICATION", "true") == "true":
    from src.api.hierarchical_classification import (
        HierarchicalBatchClassificationResource,
        HierarchicalClassificationResource,
        HierarchicalExampleResource,
        HierarchicalGenresResource,
        HierarchicalHealthCheckResource,
        HierarchicalPerformanceResource,
        HierarchicalSystemStatusResource,
        initialize_service,
    )

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
    print("app", os.getenv("ENABLE_HIERARCHICAL_CLASSIFICATION"))
    # Initialize hierarchical classification service if enabled
    if os.getenv("ENABLE_HIERARCHICAL_CLASSIFICATION") == "true":
        try:
            import asyncio

            logger.info(
                "🔄 Initializing hierarchical classification service on startup"
            )
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            hierarchical_service = loop.run_until_complete(initialize_service())
            app.hierarchical_classifier = hierarchical_service
            logger.info("✅ Hierarchical classification service initialized on startup")
        except Exception as e:
            logger.warning(
                f"⚠️ Failed to initialize hierarchical classification service on startup: {e}"
            )
            logger.warning("Service will be initialized on first request")
            app.hierarchical_classifier = None
    else:
        logger.info("🚫 Hierarchical classification service disabled by configuration")
        app.hierarchical_classifier = None

    logger.info("Services initialized successfully")


def register_resources(api, app):
    """Register API resources based on configuration flags."""
    # Health check endpoint
    api.add_resource(HealthResource, "/health")

    # Simple analysis endpoints (if enabled)
    if os.getenv("ENABLE_SIMPLE_ANALYSIS") == "true":
        api.add_resource(SimpleAnalysisResource, "/audio/analyze/simple")
        logger.info("✅ Simple analysis endpoints registered")
    else:
        logger.info("🚫 Simple analysis endpoints disabled by configuration")

    # BPM detection endpoints (always enabled)
    api.add_resource(BPMDetectionResource, "/audio/bpm/detect")
    logger.info("✅ BPM detection endpoints registered")

    # OpenAI metadata extraction endpoints (always enabled if API key is set)
    api.add_resource(OpenAIMetadataResource, "/audio/metadata/openai")
    logger.info("✅ OpenAI metadata extraction endpoints registered")

    # Hierarchical classification endpoints (if enabled and imported)
    if os.getenv("ENABLE_HIERARCHICAL_CLASSIFICATION") == "true":
        try:
            from src.api.hierarchical_classification import (
                HierarchicalBatchClassificationResource,
                HierarchicalClassificationResource,
                HierarchicalExampleResource,
                HierarchicalGenresResource,
                HierarchicalHealthCheckResource,
                HierarchicalPerformanceResource,
                HierarchicalSystemStatusResource,
            )

            api.add_resource(
                HierarchicalClassificationResource, "/audio/analyze/classification"
            )
            api.add_resource(
                HierarchicalBatchClassificationResource, "/audio/hierarchical/batch"
            )
            api.add_resource(
                HierarchicalSystemStatusResource, "/audio/hierarchical/status"
            )
            api.add_resource(HierarchicalGenresResource, "/audio/hierarchical/genres")
            api.add_resource(
                HierarchicalPerformanceResource, "/audio/hierarchical/performance"
            )
            api.add_resource(
                HierarchicalHealthCheckResource, "/audio/hierarchical/health"
            )
            api.add_resource(HierarchicalExampleResource, "/audio/hierarchical/example")
            logger.info("✅ Hierarchical classification endpoints registered")
        except NameError:
            logger.error(
                "❌ Hierarchical classification resources not imported - check configuration"
            )
    else:
        logger.info(
            "🚫 Hierarchical classification endpoints disabled by configuration"
        )

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

        # Add OpenAI metadata extraction endpoint (always available)
        endpoints.update(
            {
                "audio_metadata_openai": "/api/v1/audio/metadata/openai",
            }
        )

        # Add hierarchical classification endpoints if enabled
        if os.getenv("ENABLE_HIERARCHICAL_CLASSIFICATION") == "true":
            endpoints.update(
                {
                    "audio_hierarchical": "/api/v1/audio/analyze/classification",
                    "audio_hierarchical_batch": "/api/v1/audio/hierarchical/batch",
                    "audio_hierarchical_status": "/api/v1/audio/hierarchical/status",
                    "audio_hierarchical_genres": "/api/v1/audio/hierarchical/genres",
                    "audio_hierarchical_performance": "/api/v1/audio/hierarchical/performance",
                    "audio_hierarchical_health": "/api/v1/audio/hierarchical/health",
                    "audio_hierarchical_example": "/api/v1/audio/hierarchical/example",
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
                    "hierarchical_classification_enabled": os.getenv(
                        "ENABLE_HIERARCHICAL_CLASSIFICATION"
                    )
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
                "hierarchical_classification_enabled": os.getenv(
                    "ENABLE_HIERARCHICAL_CLASSIFICATION"
                )
                == "true",
            },
        }

        # Add hierarchical service status if enabled
        if os.getenv("ENABLE_HIERARCHICAL_CLASSIFICATION") == "true":
            try:
                from src.api.hierarchical_classification import (
                    get_service_instance,
                    is_service_ready,
                )

                service = get_service_instance()
                status["hierarchical_service_ready"] = is_service_ready()
                status["hierarchical_service_available"] = service is not None

                if service:
                    try:
                        import asyncio

                        health = asyncio.run(service.health_check())
                        status["hierarchical_service_health"] = health
                    except Exception as e:
                        status["hierarchical_service_health"] = {"error": str(e)}
            except ImportError:
                status["hierarchical_service_error"] = (
                    "Hierarchical classification module not imported"
                )
        else:
            status["hierarchical_service_enabled"] = False

        return jsonify(status)

    return app


def shutdown_handler():
    """Handle application shutdown gracefully."""
    logger.info("🔄 Shutting down Muzo AI Service...")

    # Clean up hierarchical classification service if enabled
    if os.getenv("ENABLE_HIERARCHICAL_CLASSIFICATION") == "true":
        try:
            from src.api.hierarchical_classification import get_service_instance

            service = get_service_instance()
            if service:
                logger.info("🔄 Shutting down hierarchical classification service...")
                import asyncio

                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                loop.run_until_complete(service.shutdown())
                logger.info("✅ Hierarchical classification service shutdown complete")
        except ImportError:
            logger.info(
                "ℹ️ Hierarchical classification service not imported - skipping shutdown"
            )
        except Exception as e:
            logger.warning(
                f"⚠️ Error during hierarchical classification service shutdown: {e}"
            )


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
