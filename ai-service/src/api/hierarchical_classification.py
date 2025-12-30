"""
Hierarchical Music Classification API Endpoints

Flask-RESTful endpoints for the world-class hierarchical music classification system.
Provides both genre and subgenre classification with 82.38% genre accuracy.

Endpoints:
- POST /api/v1/audio/hierarchical - Single file classification
- POST /api/v1/audio/hierarchical/batch - Batch file classification
- GET /api/v1/audio/hierarchical/status - System status and health
- GET /api/v1/audio/hierarchical/genres - Available genres and subgenres
- GET /api/v1/audio/hierarchical/performance - Performance statistics

Ready for production deployment with the Muzo AI service.
"""

import asyncio
import json
import os
import tempfile
import time
from typing import Optional

from flask import request
from flask_restful import Resource
from loguru import logger

from ..services.hierarchical_music_classifier import (
    CNN_AVAILABLE,
    HierarchicalMusicClassificationService,
    get_hierarchical_classification_service,
)

# Global service instance
_service_instance: Optional[HierarchicalMusicClassificationService] = None
_service_initialized = False


def is_service_ready() -> bool:
    """Check if the hierarchical classification service is ready."""
    return _service_initialized and _service_instance is not None


def get_service_instance() -> Optional[HierarchicalMusicClassificationService]:
    """Get the current service instance (synchronous)."""
    return _service_instance


async def initialize_service() -> HierarchicalMusicClassificationService:
    """Initialize the hierarchical classification service on startup."""
    global _service_instance, _service_initialized

    if _service_initialized and _service_instance is not None:
        return _service_instance

    logger.info("🚀 Initializing hierarchical classification service on startup...")

    if not CNN_AVAILABLE:
        raise RuntimeError(
            "Hierarchical classification service unavailable. CNN modules not installed."
        )

    try:
        # Use HuggingFace by default, fallback to local models if configured
        use_huggingface = os.getenv("USE_HUGGINGFACE_MODELS", "true").lower() == "true"

        if use_huggingface:
            # Use HuggingFace models
            hf_repo_id_genre = os.getenv(
                "HF_REPO_ID_GENRE", "CosmicSurfer/muzo-genre-classifier"
            )
            hf_repo_id_specialists = os.getenv(
                "HF_REPO_ID_SPECIALISTS", "CosmicSurfer/muzo-subgenre-specialists"
            )

            _service_instance = await get_hierarchical_classification_service(
                use_huggingface=True,
                hf_repo_id_genre=hf_repo_id_genre,
                hf_repo_id_specialists=hf_repo_id_specialists,
            )
        else:
            # Use local models
            genre_model_path = os.getenv(
                "HIERARCHICAL_GENRE_MODEL_PATH",
                "models/final_optimized_7genres/final_optimized_7genres-v1.0.pth",
            )
            specialists_dir = os.getenv(
                "HIERARCHICAL_SPECIALISTS_DIR", "models/subgenre_specialists"
            )

            _service_instance = await get_hierarchical_classification_service(
                genre_model_path=genre_model_path,
                specialists_dir=specialists_dir,
                use_huggingface=False,
            )

        # Initialize the service
        await _service_instance.initialize()
        _service_initialized = True

        logger.info(
            "✅ Hierarchical classification service initialized successfully on startup"
        )
        return _service_instance

    except Exception as e:
        logger.error(
            f"❌ Failed to initialize hierarchical classification service on startup: {e}"
        )
        raise RuntimeError(f"Service initialization failed: {str(e)}")


async def get_service() -> HierarchicalMusicClassificationService:
    """Get the hierarchical classification service instance."""
    global _service_instance, _service_initialized

    if _service_initialized and _service_instance is not None:
        return _service_instance

    # If not initialized, initialize now
    return await initialize_service()


class HierarchicalClassificationResource(Resource):
    """Hierarchical music classification endpoint."""

    def __init__(self):
        """Initialize the hierarchical classification resource."""
        pass

    def post(self):
        """
        Classify a single audio file using hierarchical classification.

        Returns both genre and subgenre predictions with confidence scores.

        **Parameters:**
        - audio_file: Audio file to classify
        - include_details: Include detailed prediction information (default: false)
        - use_segments: Split long audio into segments for better accuracy (default: true)
        - segment_duration: Duration of each segment in seconds (default: 90.0)
        - aggregation_method: Method to aggregate segment results (default: majority_vote)
        - force_segmentation: Force segmentation even for short files (default: false)
        - skip_intro_outro: Skip first and last segments (default: false)
        - use_musicbrainz_validation: Use MusicBrainz for genre validation (default: true)

        **Expected Performance:**
        - Genre Accuracy: 82.38%
        - Processing Time: 2-3 seconds
        - Supported Formats: .flac, .mp3, .wav, .m4a, .aac, .ogg, .opus
        """
        try:
            # Check if file is present in request
            if "audio_file" not in request.files:
                return {
                    "error": "No audio file provided",
                    "message": "Please provide an audio file in the request",
                }, 400

            audio_file = request.files["audio_file"]

            if audio_file.filename == "":
                return {
                    "error": "No file selected",
                    "message": "Please select a valid audio file",
                }, 400

            # Get parameters
            include_details = (
                request.form.get("include_details", "false").lower() == "true"
            )
            use_segments = request.form.get("use_segments", "true").lower() == "true"
            segment_duration = float(request.form.get("segment_duration", "60.0"))
            aggregation_method = request.form.get(
                "aggregation_method", "best_confidence"
            )
            force_segmentation = (
                request.form.get("force_segmentation", "true").lower() == "true"
            )
            skip_intro_outro = (
                request.form.get("skip_intro_outro", "false").lower() == "true"
            )
            use_musicbrainz_validation = (
                request.form.get("use_musicbrainz_validation", "true").lower() == "true"
            )

            # Validate file type
            if not self._is_valid_audio_file(audio_file.filename):
                return {
                    "error": "Invalid file type",
                    "message": "Please provide a valid audio file (.mp3, .wav, .flac, .m4a, .aac, .ogg, .opus)",
                }, 400

            logger.info(
                f"🎵 Hierarchical classification request: {audio_file.filename}"
            )

            # Save uploaded file temporarily using original filename
            temp_file_path = os.path.join(tempfile.gettempdir(), audio_file.filename)
            audio_file.save(temp_file_path)

            try:
                # Check if service is ready
                if not is_service_ready():
                    return {
                        "error": "Service not initialized",
                        "message": "Hierarchical classification service is not available",
                    }, 503

                # Get service and classify
                service = get_service_instance()

                result = asyncio.run(
                    service.classify_audio(
                        temp_file_path,
                        include_details=include_details,
                        use_segments=use_segments,
                        segment_duration=segment_duration,
                        aggregation_method=aggregation_method,
                        force_segmentation=force_segmentation,
                        skip_intro_outro=skip_intro_outro,
                        use_musicbrainz_validation=use_musicbrainz_validation,
                    )
                )

                # Update file path to original filename for response
                result["file_path"] = audio_file.filename

                logger.info(f"✅ Classification complete for {audio_file.filename}")
                print(json.dumps(result, indent=4))
                return result, 200
            except Exception as e:
                logger.error(f"❌ Classification failed: {e}")

            finally:
                # Clean up temporary file
                if os.path.exists(temp_file_path):
                    os.unlink(temp_file_path)

        except Exception as e:
            logger.error(f"❌ Classification failed: {e}")
            return {
                "error": "Classification failed",
                "message": str(e),
                "status": "error",
            }, 500

    def _is_valid_audio_file(self, filename):
        """
        Check if the uploaded file is a valid audio file.

        Args:
            filename (str): Name of the uploaded file

        Returns:
            bool: True if valid audio file, False otherwise
        """
        if not filename:
            return False

        # Get file extension
        file_ext = os.path.splitext(filename)[1].lower().lstrip(".")

        # Valid audio extensions
        valid_extensions = ["mp3", "wav", "flac", "m4a", "aac", "ogg", "opus"]

        return file_ext in valid_extensions


class HierarchicalBatchClassificationResource(Resource):
    """Hierarchical batch music classification endpoint."""

    def __init__(self):
        """Initialize the hierarchical batch classification resource."""
        pass

    def post(self):
        """
        Classify multiple audio files in parallel using hierarchical classification.

        Processes files concurrently for optimal performance.

        **Parameters:**
        - audio_files: Array of audio file paths
        - include_details: Include detailed prediction information (default: false)
        - use_musicbrainz_validation: Use MusicBrainz for genre validation (default: true)

        **Note:** File paths must be accessible to the server.
        """
        try:
            # Get JSON data from request
            data = request.get_json()

            if not data:
                return {
                    "error": "No JSON data provided",
                    "message": "Please provide JSON data with audio_files array",
                }, 400

            audio_files = data.get("audio_files", [])
            include_details = data.get("include_details", False)
            use_musicbrainz_validation = data.get("use_musicbrainz_validation", True)

            if len(audio_files) == 0:
                return {
                    "error": "No audio files provided",
                    "message": "Please provide at least one audio file path",
                }, 400

            if len(audio_files) > 50:  # Reasonable limit
                return {
                    "error": "Too many files",
                    "message": "Maximum 50 files per batch request",
                }, 400

            logger.info(
                f"🎵 Batch hierarchical classification: {len(audio_files)} files"
            )

            # Check if service is ready
            if not is_service_ready():
                return {
                    "error": "Service not initialized",
                    "message": "Hierarchical classification service is not available",
                }, 503

            # Get service and perform batch classification
            service = get_service_instance()

            result = asyncio.run(
                service.classify_batch(
                    audio_files,
                    include_details=include_details,
                    use_musicbrainz_validation=use_musicbrainz_validation,
                )
            )

            logger.info(
                f"✅ Batch classification complete: {result['successful_classifications']}/{result['total_files']} successful"
            )

            return result, 200

        except Exception as e:
            logger.error(f"❌ Batch classification failed: {e}")
            return {
                "error": "Batch classification failed",
                "message": str(e),
                "status": "error",
            }, 500


class HierarchicalSystemStatusResource(Resource):
    """Hierarchical system status endpoint."""

    def __init__(self):
        """Initialize the hierarchical system status resource."""
        pass

    def get(self):
        """
        Get detailed status information about the hierarchical classification system.

        Includes system health, performance metrics, and configuration details.
        """
        try:
            # Check if service is ready
            if not is_service_ready():
                return {
                    "error": "Service not initialized",
                    "message": "Hierarchical classification service is not available",
                }, 503

            # Get service and system status
            service = get_service_instance()

            status = service.get_system_status()

            # Perform health check
            health = asyncio.run(service.health_check())
            status["healthy"] = health["healthy"]
            status["health_checks"] = health["checks"]

            return status, 200

        except Exception as e:
            logger.error(f"❌ Failed to get system status: {e}")
            return {
                "error": "Failed to get system status",
                "message": str(e),
                "status": "error",
            }, 500


class HierarchicalGenresResource(Resource):
    """Hierarchical genres and subgenres endpoint."""

    def __init__(self):
        """Initialize the hierarchical genres resource."""
        pass

    def get(self):
        """
        Get the mapping of available genres to their subgenres.

        Shows which genres have trained specialist models and their supported subgenres.
        """
        try:
            # Check if service is ready
            if not is_service_ready():
                return {
                    "error": "Service not initialized",
                    "message": "Hierarchical classification service is not available",
                }, 503

            # Get service and mapping
            service = get_service_instance()

            mapping = service.get_available_genres_and_subgenres()

            # Calculate statistics
            total_genres = len(mapping)
            genres_with_specialists = len([g for g, s in mapping.items() if len(s) > 0])
            total_subgenres = sum(len(subgenres) for subgenres in mapping.values())

            return {
                "success": True,
                "statistics": {
                    "total_genres": total_genres,
                    "genres_with_specialists": genres_with_specialists,
                    "total_subgenres": total_subgenres,
                    "coverage_percentage": round(
                        (genres_with_specialists / total_genres) * 100, 1
                    )
                    if total_genres > 0
                    else 0,
                },
                "genre_subgenre_mapping": mapping,
                "timestamp": time.time(),
            }, 200

        except Exception as e:
            logger.error(f"❌ Failed to get genres and subgenres: {e}")
            return {
                "error": "Failed to get genres and subgenres",
                "message": str(e),
                "status": "error",
            }, 500


class HierarchicalPerformanceResource(Resource):
    """Hierarchical performance statistics endpoint."""

    def __init__(self):
        """Initialize the hierarchical performance resource."""
        pass

    def get(self):
        """
        Get performance statistics for the hierarchical classification system.

        Includes prediction counts, timing metrics, and system utilization.
        """
        try:
            # Check if service is ready
            if not is_service_ready():
                return {
                    "error": "Service not initialized",
                    "message": "Hierarchical classification service is not available",
                }, 503

            # Get service and performance stats
            service = get_service_instance()

            stats = service.get_performance_stats()

            return {
                "success": True,
                "performance_statistics": stats,
                "system_specifications": {
                    "expected_genre_accuracy": "82.38%",
                    "expected_subgenre_accuracy": "70-85% per specialist",
                    "expected_processing_time": "2-3 seconds per file",
                    "supported_formats": [
                        ".flac",
                        ".mp3",
                        ".wav",
                        ".m4a",
                        ".aac",
                        ".ogg",
                        ".opus",
                    ],
                    "concurrent_processing": True,
                },
                "timestamp": time.time(),
            }, 200

        except Exception as e:
            logger.error(f"❌ Failed to get performance statistics: {e}")
            return {
                "error": "Failed to get performance statistics",
                "message": str(e),
                "status": "error",
            }, 500


class HierarchicalHealthCheckResource(Resource):
    """Hierarchical health check endpoint."""

    def __init__(self):
        """Initialize the hierarchical health check resource."""
        pass

    def post(self):
        """
        Perform a comprehensive health check of the hierarchical classification system.

        Checks system initialization, model files, and overall system health.
        """
        try:
            # Check if service is ready
            if not is_service_ready():
                return {
                    "healthy": False,
                    "error": "Service not initialized",
                    "timestamp": time.time(),
                    "service": "Hierarchical Music Classification",
                    "version": "1.0",
                }, 503

            # Get service and perform health check
            service = get_service_instance()

            health = asyncio.run(service.health_check())

            status_code = 200 if health["healthy"] else 503

            return {
                "healthy": health["healthy"],
                "checks": health["checks"],
                "timestamp": health["timestamp"],
                "service": "Hierarchical Music Classification",
                "version": "1.0",
            }, status_code

        except Exception as e:
            logger.error(f"❌ Health check failed: {e}")
            return {
                "healthy": False,
                "error": str(e),
                "timestamp": time.time(),
                "service": "Hierarchical Music Classification",
                "version": "1.0",
            }, 503


class HierarchicalExampleResource(Resource):
    """Hierarchical example usage endpoint."""

    def __init__(self):
        """Initialize the hierarchical example resource."""
        pass

    def get(self):
        """
        Get example usage patterns for the hierarchical classification API.

        Useful for testing and integration guidance.
        """
        return {
            "service": "Hierarchical Music Classification",
            "version": "1.0",
            "description": "World-class music genre and subgenre classification with 82.38% accuracy",
            "examples": {
                "single_file_classification": {
                    "method": "POST",
                    "endpoint": "/api/v1/audio/analyze/classification",
                    "description": "Upload and classify a single audio file",
                    "curl_example": """curl -X POST "http://localhost:4000/api/v1/audio/analyze/classification" \\
 -H "Content-Type: multipart/form-data" \\
 -F "audio_file=@song.flac" \\
 -F "include_details=false" \\
 -F "use_segments=true" \\
 -F "segment_duration=90.0" \\
 -F "aggregation_method=majority_vote" \\
 -F "force_segmentation=false" \\
 -F "skip_intro_outro=false" \\
 -F "use_musicbrainz_validation=true\"""",
                },
                "batch_classification": {
                    "method": "POST",
                    "endpoint": "/api/v1/audio/hierarchical/batch",
                    "description": "Classify multiple files by file paths",
                    "json_example": {
                        "audio_files": [
                            "/path/to/song1.flac",
                            "/path/to/song2.mp3",
                            "/path/to/song3.wav",
                        ],
                        "include_details": False,
                        "use_musicbrainz_validation": True,
                    },
                },
                "system_status": {
                    "method": "GET",
                    "endpoint": "/api/v1/audio/hierarchical/status",
                    "description": "Get system status and health information",
                },
                "available_genres": {
                    "method": "GET",
                    "endpoint": "/api/v1/audio/hierarchical/genres",
                    "description": "Get list of supported genres and subgenres",
                },
            },
            "expected_response": {
                "success": True,
                "file_path": "song.flac",
                "classification": {
                    "genre": "Alternative",
                    "subgenre": "Grunge",
                    "confidence": {
                        "genre": 0.8912,
                        "subgenre": 0.7634,
                        "combined": 0.6804,
                    },
                },
                "musicbrainz_validation": {
                    "enabled": True,
                    "used": True,
                    "genres_found": ["alternative rock", "grunge"],
                    "genre_match": True,
                    "boost_factor": 1.2,
                    "confidence_improvement": {
                        "genre": 0.1782,
                        "subgenre": 0.1527,
                        "combined": 0.1361,
                    },
                },
                "processing_time": 2.34,
                "timestamp": 1695123456.789,
            },
        }, 200
