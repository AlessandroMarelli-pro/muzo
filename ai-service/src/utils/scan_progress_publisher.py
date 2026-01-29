"""
Redis publisher for scan progress events.

This module provides functionality to publish scan progress events to Redis
for real-time progress tracking across microservices.
"""

import json
import os
from typing import Dict, Optional

import redis
from loguru import logger

from src.config.redis_config import redis_config


class ScanProgressPublisher:
    """Publisher for scan progress events to Redis."""

    def __init__(self):
        """Initialize the scan progress publisher."""
        self.redis_client: Optional[redis.Redis] = None
        self.channel_prefix = os.getenv("REDIS_SCAN_CHANNEL_PREFIX", "scan:session")
        self.update_interval = int(os.getenv("SCAN_PROGRESS_UPDATE_INTERVAL", "0"))
        self._last_sent_progress: Dict[str, int] = {}  # Track last sent progress per track

    def _get_redis_client(self) -> redis.Redis:
        """Get or create Redis client."""
        if self.redis_client is None:
            try:
                self.redis_client = redis_config.get_client()
            except Exception as e:
                logger.error(f"Failed to connect to Redis: {e}")
                raise
        return self.redis_client

    def _should_publish_progress(self, track_id: str, current_progress: int) -> bool:
        """
        Determine if progress should be published based on update interval.

        Args:
            track_id: Unique identifier for the track
            current_progress: Current progress percentage (0-100)

        Returns:
            True if progress should be published, False otherwise
        """
        if self.update_interval == 0:
            # Publish all events
            return True

        last_sent = self._last_sent_progress.get(track_id, -1)
        if current_progress - last_sent >= self.update_interval:
            self._last_sent_progress[track_id] = current_progress
            return True

        return False

    def publish_event(
        self, session_id: str, event_type: str, data: Dict, **kwargs
    ) -> None:
        """
        Publish a scan progress event to Redis.

        Args:
            session_id: Scan session ID
            event_type: Type of event (e.g., 'batch.processing', 'track.processing')
            data: Event data dictionary
            **kwargs: Additional event fields (batchIndex, trackIndex, etc.)
        """
        try:
            redis_client = self._get_redis_client()
            channel = f"{self.channel_prefix}:{session_id}:events"

            event = {
                "type": event_type,
                "sessionId": session_id,
                "timestamp": kwargs.get("timestamp") or self._get_timestamp(),
                **{k: v for k, v in kwargs.items() if k != "timestamp"},
                "data": data,
            }

            message = json.dumps(event)
            redis_client.publish(channel, message)
            logger.debug(f"Published event {event_type} for session {session_id}")
        except Exception as e:
            logger.error(f"Failed to publish event for session {session_id}: {e}")
            # Don't raise - event publishing shouldn't break the scan

    def publish_error(
        self,
        session_id: str,
        error_code: str,
        error_message: str,
        severity: str = "error",
        **kwargs
    ) -> None:
        """
        Publish an error event to Redis.

        Args:
            session_id: Scan session ID
            error_code: Error code
            error_message: Error message
            severity: Error severity ('warning', 'error', 'critical')
            **kwargs: Additional error fields (batchIndex, trackIndex, details, etc.)
        """
        try:
            redis_client = self._get_redis_client()
            channel = f"{self.channel_prefix}:{session_id}:errors"

            error_event = {
                "type": "error",
                "sessionId": session_id,
                "timestamp": self._get_timestamp(),
                "severity": severity,
                "source": "ai-service",
                **{k: v for k, v in kwargs.items() if k not in ["error"]},
                "error": {
                    "code": error_code,
                    "message": error_message,
                    "details": kwargs.get("details"),
                },
            }

            message = json.dumps(error_event)
            redis_client.publish(channel, message)
            logger.warning(
                f"Published error {error_code} for session {session_id}: {error_message}"
            )
        except Exception as e:
            logger.error(f"Failed to publish error for session {session_id}: {e}")
            # Don't raise - error publishing shouldn't break the scan

    def publish_track_progress(
        self,
        session_id: str,
        batch_index: int,
        track_index: int,
        total_tracks: int,
        file_name: str,
        progress: int,
        library_id: Optional[str] = None,
    ) -> None:
        """
        Publish track processing progress event.

        Args:
            session_id: Scan session ID
            batch_index: Current batch index
            track_index: Current track index in batch
            total_tracks: Total tracks in batch
            file_name: Name of the file being processed
            progress: Progress percentage (0-100)
            library_id: Optional library ID
        """
        track_id = f"{session_id}:{batch_index}:{track_index}"
        if not self._should_publish_progress(track_id, progress):
            return

        self.publish_event(
            session_id,
            "audio.analysis",
            {
                "trackIndex": track_index,
                "progress": progress,
                "fileName": file_name,
            },
            batchIndex=batch_index,
            libraryId=library_id,
        )

    def _get_timestamp(self) -> str:
        """Get current timestamp in ISO format."""
        from datetime import datetime

        return datetime.utcnow().isoformat() + "Z"
