"""
Music identification service using Acoustid API and MusicBrainz.

This service provides comprehensive music identification capabilities by combining
acoustic fingerprinting (Acoustid) with metadata lookup (MusicBrainz).
"""

import os
import threading
import time
from collections import deque
from dataclasses import dataclass
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple

try:
    import acoustid
except ImportError:
    acoustid = None
    print(
        "Warning: pyacoustid not installed. Acoustic fingerprinting will not be available."
    )

try:
    import musicbrainzngs
except ImportError:
    musicbrainzngs = None
    print(
        "Warning: musicbrainzngs not installed. MusicBrainz integration will not be available."
    )

try:
    from loguru import logger
except ImportError:
    import logging

    logger = logging.getLogger(__name__)

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


class IdentificationStatus(Enum):
    """Status of music identification process."""

    SUCCESS = "success"
    NO_MATCH = "no_match"
    ERROR = "error"
    RATE_LIMITED = "rate_limited"
    INVALID_AUDIO = "invalid_audio"


@dataclass
class IdentificationResult:
    """Result of music identification."""

    status: IdentificationStatus
    confidence: float
    recording_id: Optional[str] = None
    title: Optional[str] = None
    artist: Optional[str] = None
    album: Optional[str] = None
    year: Optional[int] = None
    duration: Optional[float] = None
    genres: Optional[List[str]] = None
    error_message: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class RateLimiter:
    """Thread-safe rate limiter for API calls."""

    def __init__(self, max_calls: int, time_window: float):
        """
        Initialize rate limiter.

        Args:
            max_calls: Maximum number of calls allowed
            time_window: Time window in seconds
        """
        self.max_calls = max_calls
        self.time_window = time_window
        self.calls = deque()
        self.lock = threading.Lock()

    def acquire(self) -> bool:
        """
        Acquire permission to make a call.

        Returns:
            True if call is allowed, False if rate limited
        """
        with self.lock:
            now = time.time()

            # Remove old calls outside the time window
            while self.calls and self.calls[0] <= now - self.time_window:
                self.calls.popleft()

            # Check if we can make another call
            if len(self.calls) < self.max_calls:
                self.calls.append(now)
                return True

            return False

    def wait_time(self) -> float:
        """
        Get the time to wait before next call is allowed.

        Returns:
            Time in seconds to wait
        """
        with self.lock:
            if len(self.calls) < self.max_calls:
                return 0.0

            oldest_call = self.calls[0]
            return max(0.0, oldest_call + self.time_window - time.time())


class AcoustidService:
    """Service for acoustic fingerprinting using Acoustid API."""

    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize Acoustid service.

        Args:
            api_key: Acoustid API key (if None, will try to get from environment)
        """
        self.api_key = api_key or os.getenv("ACOUSTID_API_KEY")
        if not self.api_key:
            logger.warning("No Acoustid API key provided. Some features may not work.")

        # Rate limiter: 3 calls per second as per Acoustid documentation
        self.rate_limiter = RateLimiter(max_calls=3, time_window=1.0)

        # Configure requests session with retry strategy
        self.session = requests.Session()
        retry_strategy = Retry(
            total=3,
            backoff_factor=1,
            status_forcelist=[429, 500, 502, 503, 504],
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        self.session.mount("http://", adapter)
        self.session.mount("https://", adapter)

        logger.info("AcoustidService initialized")

    def generate_fingerprint(self, audio_path: str) -> Optional[Tuple[float, str]]:
        """
        Generate acoustic fingerprint for audio file.

        Args:
            audio_path: Path to audio file

        Returns:
            Tuple of (duration, fingerprint) or None if failed
        """
        if acoustid is None:
            logger.error("pyacoustid not available. Cannot generate fingerprint.")
            return None

        try:
            logger.debug(f"Generating fingerprint for: {audio_path}")

            # Use pyacoustid to generate fingerprint
            duration, fingerprint = acoustid.fingerprint_file(audio_path)

            logger.debug(f"Generated fingerprint: duration={duration}s")
            return duration, fingerprint

        except acoustid.FingerprintGenerationError as e:
            logger.error(f"Fingerprint generation failed for {audio_path}: {e}")
            return None
        except Exception as e:
            logger.error(
                f"Unexpected error generating fingerprint for {audio_path}: {e}"
            )
            return None

    def lookup_fingerprint(
        self, fingerprint: str, duration: float
    ) -> Optional[List[Dict[str, Any]]]:
        """
        Look up fingerprint in Acoustid database.

        Args:
            fingerprint: Acoustic fingerprint
            duration: Duration in seconds

        Returns:
            List of match results or None if failed
        """
        if acoustid is None:
            logger.error("pyacoustid not available. Cannot lookup fingerprint.")
            return None

        if not self.api_key:
            logger.error("No API key available for Acoustid lookup")
            return None

        # Wait for rate limiter
        if not self.rate_limiter.acquire():
            wait_time = self.rate_limiter.wait_time()
            logger.warning(f"Rate limited. Waiting {wait_time:.2f} seconds")
            time.sleep(wait_time)
            if not self.rate_limiter.acquire():
                logger.error("Still rate limited after waiting")
                return None

        try:
            logger.debug(f"Looking up fingerprint with duration {duration}s")

            # Look up fingerprint
            results = acoustid.lookup(
                self.api_key,
                fingerprint,
                duration,
                meta=["recordings", "tracks", "releases"],
            )

            logger.debug(f"Found {len(results.get('results', []))} potential matches")
            return results.get("results", [])

        except acoustid.WebServiceError as e:
            logger.error(f"Acoustid web service error: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error during fingerprint lookup: {e}")
            return None


class MusicBrainzService:
    """Service for MusicBrainz metadata lookup."""

    def __init__(self, user_agent: str = "MuzoMusicIdentification/1.0"):
        """
        Initialize MusicBrainz service.

        Args:
            user_agent: User agent string for API requests
        """
        self.user_agent = user_agent

        # Configure musicbrainzngs if available
        if musicbrainzngs is not None:
            musicbrainzngs.set_useragent(
                "MuzoMusicIdentification", "1.0", "https://github.com/your-repo/muzo"
            )
        else:
            logger.warning(
                "musicbrainzngs not available. MusicBrainz features will be limited."
            )

        # Rate limiter: 1 call per second as per MusicBrainz guidelines
        self.rate_limiter = RateLimiter(max_calls=1, time_window=1.0)

        logger.info("MusicBrainzService initialized")

    def get_recording_details(self, recording_id: str) -> Optional[Dict[str, Any]]:
        """
        Get detailed recording information from MusicBrainz.

        Args:
            recording_id: MusicBrainz recording ID

        Returns:
            Recording details or None if failed
        """
        if musicbrainzngs is None:
            logger.error("musicbrainzngs not available. Cannot get recording details.")
            return None

        # Wait for rate limiter
        if not self.rate_limiter.acquire():
            wait_time = self.rate_limiter.wait_time()
            logger.warning(f"Rate limited. Waiting {wait_time:.2f} seconds")
            time.sleep(wait_time)
            if not self.rate_limiter.acquire():
                logger.error("Still rate limited after waiting")
                return None

        try:
            logger.debug(f"Getting recording details for ID: {recording_id}")

            # Get recording with additional includes
            recording = musicbrainzngs.get_recording_by_id(
                recording_id, includes=["artists", "releases", "tags", "ratings"]
            )

            return recording.get("recording", {})

        except musicbrainzngs.WebServiceError as e:
            logger.error(f"MusicBrainz web service error: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error getting recording details: {e}")
            return None

    def search_recording(
        self, query: str, limit: int = 5
    ) -> Optional[List[Dict[str, Any]]]:
        """
        Search for recordings in MusicBrainz.

        Args:
            query: Search query
            limit: Maximum number of results

        Returns:
            List of recording results or None if failed
        """
        if musicbrainzngs is None:
            logger.error("musicbrainzngs not available. Cannot search recordings.")
            return None

        # Wait for rate limiter
        if not self.rate_limiter.acquire():
            wait_time = self.rate_limiter.wait_time()
            logger.warning(f"Rate limited. Waiting {wait_time:.2f} seconds")
            time.sleep(wait_time)
            if not self.rate_limiter.acquire():
                logger.error("Still rate limited after waiting")
                return None

        try:
            logger.debug(f"Searching MusicBrainz for: {query}")

            # Search recordings
            results = musicbrainzngs.search_recordings(query=query, limit=limit)

            return results.get("recording-list", [])

        except musicbrainzngs.WebServiceError as e:
            logger.error(f"MusicBrainz search error: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error during MusicBrainz search: {e}")
            return None


class MusicIdentificationService:
    """Main service for music identification using Acoustid and MusicBrainz."""

    def __init__(self, acoustid_api_key: Optional[str] = None):
        """
        Initialize music identification service.

        Args:
            acoustid_api_key: Acoustid API key
        """
        self.acoustid_service = AcoustidService(acoustid_api_key)
        self.musicbrainz_service = MusicBrainzService()

        logger.info("MusicIdentificationService initialized")

    def identify_music(self, audio_path: str) -> IdentificationResult:
        """
        Identify music from audio file using acoustic fingerprinting.

        Args:
            audio_path: Path to audio file

        Returns:
            IdentificationResult with match information
        """
        logger.info(f"Starting music identification for: {audio_path}")

        if not self.acoustid_service.api_key:
            return IdentificationResult(
                status=IdentificationStatus.ERROR,
                confidence=0.0,
                error_message="No Acoustid API key available",
            )

        try:
            # Use the simple acoustid.match() function
            logger.debug(f"Using acoustid.match() for: {audio_path}")

            # Get matches using the simple API
            matches = []
            for score, recording_id, title, artist in acoustid.match(
                self.acoustid_service.api_key, audio_path
            ):
                matches.append(
                    {
                        "score": score,
                        "recording_id": recording_id,
                        "title": title,
                        "artist": artist,
                    }
                )
                logger.debug(f"Match: {score:.2f} - {title} by {artist}")

            if not matches:
                return IdentificationResult(
                    status=IdentificationStatus.NO_MATCH,
                    confidence=0.0,
                    error_message="No matches found in Acoustid database",
                )

            # Get the best match (highest score)
            best_match = max(matches, key=lambda x: x["score"])

            # Get detailed metadata from MusicBrainz if we have a recording ID
            if best_match["recording_id"]:
                detailed_metadata = self.musicbrainz_service.get_recording_details(
                    best_match["recording_id"]
                )
                if detailed_metadata:
                    # Extract genres from MusicBrainz metadata
                    genres = []
                    if "tag-list" in detailed_metadata:
                        genres = [tag["name"] for tag in detailed_metadata["tag-list"]]

                    best_match["genres"] = genres
                    best_match["detailed_metadata"] = detailed_metadata

            # Create result
            result = self._create_identification_result(best_match)
            logger.info(
                f"Successfully identified music: {result.title} by {result.artist}"
            )

            return result

        except acoustid.FingerprintGenerationError as e:
            logger.error(f"Fingerprint generation failed: {e}")
            return IdentificationResult(
                status=IdentificationStatus.INVALID_AUDIO,
                confidence=0.0,
                error_message=f"Failed to generate acoustic fingerprint: {e}",
            )
        except acoustid.WebServiceError as e:
            logger.error(f"Acoustid web service error: {e}")
            return IdentificationResult(
                status=IdentificationStatus.ERROR,
                confidence=0.0,
                error_message=f"Acoustid service error: {e}",
            )
        except Exception as e:
            logger.error(f"Unexpected error during music identification: {e}")
            return IdentificationResult(
                status=IdentificationStatus.ERROR, confidence=0.0, error_message=str(e)
            )

    def _create_identification_result(
        self, match_data: Dict[str, Any]
    ) -> IdentificationResult:
        """
        Create IdentificationResult from match data.

        Args:
            match_data: Match data from acoustid.match()

        Returns:
            IdentificationResult
        """
        # Extract genres from the match data
        genres = match_data.get("genres", [])

        # Extract additional metadata if available
        detailed_metadata = match_data.get("detailed_metadata", {})

        # Extract album and year from detailed metadata
        album = None
        year = None
        if detailed_metadata:
            # Try to get album from releases
            releases = detailed_metadata.get("release-list", [])
            if releases:
                album = releases[0].get("title")
                year = self._extract_year(releases[0].get("date"))

        return IdentificationResult(
            status=IdentificationStatus.SUCCESS,
            confidence=match_data.get("score", 0.0),
            recording_id=match_data.get("recording_id"),
            title=match_data.get("title"),
            artist=match_data.get("artist"),
            album=album,
            year=year,
            duration=None,  # Not provided by acoustid.match()
            genres=genres if genres else None,
            metadata=match_data,
        )

    def _extract_year(self, date_string: Optional[str]) -> Optional[int]:
        """
        Extract year from date string.

        Args:
            date_string: Date string (e.g., "2023-01-15")

        Returns:
            Year as integer or None
        """
        if not date_string:
            return None

        try:
            # Extract year from date string
            year_str = date_string.split("-")[0]
            return int(year_str)
        except (ValueError, IndexError):
            return None

    def search_by_metadata(
        self, title: str, artist: str = None
    ) -> List[IdentificationResult]:
        """
        Search for music by metadata using MusicBrainz.

        Args:
            title: Song title
            artist: Artist name (optional)

        Returns:
            List of IdentificationResult objects
        """
        logger.info(f"Searching by metadata: {title} by {artist}")

        # Build search query
        query_parts = [f'title:"{title}"']
        if artist:
            query_parts.append(f'artist:"{artist}"')

        query = " AND ".join(query_parts)

        try:
            # Search MusicBrainz
            results = self.musicbrainz_service.search_recording(query, limit=10)
            if not results:
                return []

            # Convert to IdentificationResult objects
            identification_results = []
            for recording in results:
                result = IdentificationResult(
                    status=IdentificationStatus.SUCCESS,
                    confidence=0.8,  # Default confidence for metadata search
                    recording_id=recording.get("id"),
                    title=recording.get("title"),
                    artist=self._extract_artist_name(recording),
                    metadata=recording,
                )
                identification_results.append(result)

            return identification_results

        except Exception as e:
            logger.error(f"Error during metadata search: {e}")
            return []

    def _extract_artist_name(self, recording: Dict[str, Any]) -> Optional[str]:
        """
        Extract artist name from recording data.

        Args:
            recording: Recording data from MusicBrainz

        Returns:
            Artist name or None
        """
        artist_credit = recording.get("artist-credit", [])
        if artist_credit:
            artist_names = []
            for credit in artist_credit:
                if isinstance(credit, dict) and "name" in credit:
                    artist_names.append(credit["name"])
                elif isinstance(credit, str):
                    artist_names.append(credit)

            if artist_names:
                return ", ".join(artist_names)

        return None


# Convenience functions for easy usage
def identify_audio_file(
    audio_path: str, api_key: Optional[str] = None
) -> IdentificationResult:
    """
    Convenience function to identify audio file.

    Args:
        audio_path: Path to audio file
        api_key: Acoustid API key (optional)

    Returns:
        IdentificationResult
    """
    service = MusicIdentificationService(api_key)
    return service.identify_music(audio_path)


def search_music_by_title(
    title: str, artist: str = None, api_key: Optional[str] = None
) -> List[IdentificationResult]:
    """
    Convenience function to search music by title and artist.

    Args:
        title: Song title
        artist: Artist name (optional)
        api_key: Acoustid API key (optional)

    Returns:
        List of IdentificationResult objects
    """
    service = MusicIdentificationService(api_key)
    return service.search_by_metadata(title, artist)
