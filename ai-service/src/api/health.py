"""
Health check API endpoint for the Muzo AI Service.
"""

from flask_restful import Resource
from loguru import logger


class HealthResource(Resource):
    """Health check endpoint."""

    def get(self):
        """
        Get service health status.

        Returns:
            dict: Health status information
        """
        try:
            # Basic health check
            health_status = {
                "status": "healthy",
                "service": "Muzo AI Service",
                "version": "1.0.0",
                "timestamp": None,
                "components": {
                    "api": "healthy",
                    "audio_processor": "healthy",
                    "fingerprinting_service": "healthy",
                    "genre_classifier": "healthy",
                },
            }

            # Import datetime here to avoid circular imports
            from datetime import datetime

            health_status["timestamp"] = datetime.utcnow().isoformat()

            logger.info("Health check requested - service is healthy")
            return health_status, 200

        except Exception as e:
            logger.error(f"Health check failed: {e}")
            return {
                "status": "unhealthy",
                "service": "Muzo AI Service",
                "version": "1.0.0",
                "error": str(e),
                "timestamp": None,
            }, 503
