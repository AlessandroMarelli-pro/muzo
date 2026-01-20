"""
Unit tests for DiscogsEnrichmentService.

Tests Discogs + LLM enrichment workflow with mocked dependencies.
"""

import json
from unittest.mock import MagicMock, Mock, patch

import pytest

from src.config.metadata_config import MetadataConfig, MetadataMode
from src.services.discogs_enrichment_service import DiscogsEnrichmentService
from src.services.third_parties.discogs import DiscogsConnector, DiscogsError, DiscogsErrorType


class TestDiscogsEnrichmentService:
    """Test DiscogsEnrichmentService class."""

    @pytest.fixture
    def mock_discogs_connector(self):
        """Create a mock DiscogsConnector."""
        return MagicMock(spec=DiscogsConnector)

    @pytest.fixture
    def mock_gemini_client(self):
        """Create a mock Gemini client."""
        return MagicMock()

    @pytest.fixture
    def mock_config(self):
        """Create a mock MetadataConfig."""
        config = MagicMock(spec=MetadataConfig)
        config.mode = MetadataMode.BALANCED
        config.use_discogs = True
        config.discogs_use_llm_selection = True
        config.discogs_max_results = 10
        config.discogs_min_confidence = 0.7
        return config

    @pytest.fixture
    def service(self, mock_discogs_connector, mock_gemini_client, mock_config):
        """Create a DiscogsEnrichmentService instance."""
        return DiscogsEnrichmentService(
            discogs_connector=mock_discogs_connector,
            gemini_client=mock_gemini_client,
            config=mock_config,
        )

    def test_enrich_metadata_success(self, service, mock_discogs_connector, mock_gemini_client):
        """Test successful metadata enrichment workflow."""
        # Mock query building
        mock_gemini_client.models.generate_content.return_value.parsed = {
            "queries": ['artist:"Test Artist" AND release_title:"Test Title"']
        }

        # Mock Discogs search
        mock_discogs_connector.search_release.return_value = [
            {
                "id": 12345,
                "title": "Test Title",
                "artists": ["Test Artist"],
                "year": 2020,
                "genres": ["Electronic"],
                "styles": ["Techno"],
            }
        ]

        # Mock result selection
        mock_gemini_client.models.generate_content.return_value.parsed = {
            "selected_index": 0,
            "confidence": 0.9,
            "reasoning": "Perfect match",
        }

        # Mock release details
        mock_discogs_connector.get_release_details.return_value = {
            "id": 12345,
            "title": "Test Title",
            "artists": [{"name": "Test Artist"}],
            "year": 2020,
            "genres": ["Electronic"],
            "styles": ["Techno"],
            "country": "US",
            "labels": [{"name": "Test Label"}],
        }

        # Mock schema mapping
        mock_gemini_client.models.generate_content.return_value.parsed = {
            "artist": "Test Artist",
            "title": "Test Title",
            "genre": ["Electronic"],
            "style": ["Techno"],
            "year": 2020,
            "country": "US",
            "label": "Test Label",
            "audioFeatures": {"bpm": 130, "key": "C Minor"},
            "context": {"background": "Test background"},
            "description": "Test description",
            "tags": ["test"],
        }

        result = service.enrich_metadata("Test Artist", "Test Title")

        assert result is not None
        assert result["artist"] == "Test Artist"
        assert result["title"] == "Test Title"
        assert result["genre"] == ["Electronic"]

    def test_enrich_metadata_no_queries(self, service, mock_gemini_client):
        """Test enrichment when no queries are generated."""
        # Mock query building to return empty list
        with patch.object(service, "_build_queries", return_value=[]):
            result = service.enrich_metadata("Artist", "Title")

            assert result is None

    def test_enrich_metadata_no_discogs_results(self, service, mock_discogs_connector):
        """Test enrichment when Discogs returns no results."""
        # Mock query building
        with patch.object(service, "_build_queries", return_value=['artist:"Artist" AND release_title:"Title"']):
            # Mock Discogs search to return empty
            mock_discogs_connector.search_release.return_value = []

            result = service.enrich_metadata("Artist", "Title")

            assert result is None

    def test_enrich_metadata_low_confidence(self, service, mock_discogs_connector, mock_gemini_client):
        """Test enrichment when best match has low confidence."""
        # Mock query building
        with patch.object(service, "_build_queries", return_value=['artist:"Artist" AND release_title:"Title"']):
            # Mock Discogs search
            mock_discogs_connector.search_release.return_value = [
                {"id": 12345, "title": "Title", "artists": ["Artist"]}
            ]

            # Mock result selection with low confidence
            mock_gemini_client.models.generate_content.return_value.parsed = {
                "selected_index": 0,
                "confidence": 0.5,  # Below threshold
            }

            result = service.enrich_metadata("Artist", "Title")

            assert result is None

    def test_build_queries_fast_mode(self, service, mock_config):
        """Test query building in fast mode (no LLM)."""
        mock_config.mode = MetadataMode.FAST

        queries = service._build_queries("Artist", "Title", None, None)

        assert len(queries) == 1
        assert 'artist:"Artist"' in queries[0]
        assert 'release_title:"Title"' in queries[0]

    def test_build_queries_balanced_mode(self, service, mock_gemini_client, mock_config):
        """Test query building in balanced mode (LLM generates 2 queries)."""
        mock_config.mode = MetadataMode.BALANCED

        # Mock LLM response
        mock_gemini_client.models.generate_content.return_value.parsed = {
            "queries": [
                'artist:"Artist" AND release_title:"Title"',
                'artist:"Artist" AND release_title:"Title" AND year:2020',
            ]
        }

        queries = service._build_queries("Artist", "Title", None, None)

        assert len(queries) <= 2

    def test_build_queries_accurate_mode(self, service, mock_gemini_client, mock_config):
        """Test query building in accurate mode (LLM generates 3 queries)."""
        mock_config.mode = MetadataMode.ACCURATE

        # Mock LLM response
        mock_gemini_client.models.generate_content.return_value.parsed = {
            "queries": [
                'artist:"Artist" AND release_title:"Title"',
                'artist:"Artist" AND release_title:"Title" AND year:2020',
                'artist:"Artist" AND release_title:"Title" AND label:"Label"',
            ]
        }

        queries = service._build_queries("Artist", "Title", None, None)

        assert len(queries) <= 3

    def test_build_queries_llm_failure(self, service, mock_gemini_client):
        """Test query building falls back to simple query when LLM fails."""
        # Mock LLM to fail
        mock_gemini_client.models.generate_content.side_effect = Exception("LLM error")

        queries = service._build_queries("Artist", "Title", None, None)

        assert len(queries) == 1
        assert 'artist:"Artist"' in queries[0]

    def test_search_discogs_success(self, service, mock_discogs_connector):
        """Test Discogs search with successful results."""
        mock_discogs_connector.search_release.return_value = [
            {"id": 1, "title": "Title 1", "artists": ["Artist"]},
            {"id": 2, "title": "Title 2", "artists": ["Artist"]},
        ]

        queries = ['artist:"Artist" AND release_title:"Title"']
        results = service._search_discogs(queries)

        assert len(results) == 2
        mock_discogs_connector.search_release.assert_called_once()

    def test_search_discogs_deduplication(self, service, mock_discogs_connector):
        """Test Discogs search removes duplicate results."""
        mock_discogs_connector.search_release.return_value = [
            {"id": 1, "title": "Title", "artists": ["Artist"]},
            {"id": 1, "title": "Title", "artists": ["Artist"]},  # Duplicate
        ]

        queries = ['artist:"Artist" AND release_title:"Title"']
        results = service._search_discogs(queries)

        assert len(results) == 1

    def test_search_discogs_error(self, service, mock_discogs_connector):
        """Test Discogs search handles errors gracefully."""
        mock_discogs_connector.search_release.side_effect = DiscogsError(
            DiscogsErrorType.UNKNOWN, "API Error"
        )

        queries = ['artist:"Artist" AND release_title:"Title"']
        results = service._search_discogs(queries)

        assert results == []

    def test_select_best_match_llm_selection(self, service, mock_gemini_client):
        """Test LLM-based result selection."""
        results = [
            {"id": 1, "title": "Title 1", "artists": ["Artist"]},
            {"id": 2, "title": "Title 2", "artists": ["Artist"]},
        ]

        # Mock LLM selection
        mock_gemini_client.models.generate_content.return_value.parsed = {
            "selected_index": 0,
            "confidence": 0.9,
            "reasoning": "Best match",
        }

        match = service._select_best_match(results, "Artist", "Title", None)

        assert match is not None
        assert match["id"] == 1

    def test_select_best_match_simple_matching(self, service, mock_config):
        """Test simple string matching for result selection."""
        mock_config.mode = MetadataMode.FAST
        mock_config.discogs_use_llm_selection = False

        results = [
            {"id": 1, "title": "Title", "artists": ["Artist"]},
            {"id": 2, "title": "Other Title", "artists": ["Other Artist"]},
        ]

        match = service._select_best_match(results, "Artist", "Title", None)

        assert match is not None
        assert match["id"] == 1

    def test_select_best_match_below_threshold(self, service, mock_gemini_client, mock_config):
        """Test result selection filters by confidence threshold."""
        results = [{"id": 1, "title": "Title", "artists": ["Artist"]}]

        # Mock LLM selection with low confidence
        mock_gemini_client.models.generate_content.return_value.parsed = {
            "selected_index": 0,
            "confidence": 0.5,  # Below 0.7 threshold
        }

        match = service._select_best_match(results, "Artist", "Title", None)

        assert match is None

    def test_get_release_details_success(self, service, mock_discogs_connector):
        """Test getting release details."""
        mock_discogs_connector.get_release_details.return_value = {
            "id": 12345,
            "title": "Title",
            "artists": [{"name": "Artist"}],
            "genres": ["Electronic"],
        }

        release_match = {"id": 12345}
        details = service._get_release_details(release_match)

        assert details is not None
        assert details["id"] == 12345
        mock_discogs_connector.get_release_details.assert_called_once_with(12345)

    def test_get_release_details_failure(self, service, mock_discogs_connector):
        """Test getting release details handles errors."""
        mock_discogs_connector.get_release_details.return_value = None

        release_match = {"id": 12345}
        details = service._get_release_details(release_match)

        assert details is None

    def test_map_to_schema_llm_mapping(self, service, mock_gemini_client):
        """Test LLM-based schema mapping."""
        release_data = {
            "id": 12345,
            "title": "Title",
            "artists": [{"name": "Artist"}],
            "genres": ["Electronic"],
            "styles": ["Techno"],
        }

        # Mock LLM mapping
        mock_gemini_client.models.generate_content.return_value.parsed = {
            "artist": "Artist",
            "title": "Title",
            "genre": ["Electronic"],
            "style": ["Techno"],
            "audioFeatures": {"bpm": 130},
        }

        metadata = service._map_to_schema(release_data, "Artist", "Title", None)

        assert metadata is not None
        assert metadata["artist"] == "Artist"
        assert metadata["genre"] == ["Electronic"]

    def test_map_to_schema_direct_mapping(self, service, mock_config):
        """Test direct mapping without LLM."""
        mock_config.mode = MetadataMode.FAST
        service.gemini_client = None

        release_data = {
            "id": 12345,
            "title": "Title",
            "artists": [{"name": "Artist"}],
            "genres": ["Electronic"],
            "styles": ["Techno"],
            "year": 2020,
            "country": "US",
            "labels": [{"name": "Label"}],
        }

        metadata = service._map_to_schema(release_data, "Artist", "Title", None)

        assert metadata is not None
        assert metadata["artist"] == "Artist"
        assert metadata["genre"] == ["Electronic"]
        assert metadata["audioFeatures"] is None  # Cannot infer without LLM

    def test_make_gemini_call_success(self, service, mock_gemini_client):
        """Test successful Gemini API call."""
        mock_response = Mock()
        mock_response.parsed = {"result": "success"}

        mock_gemini_client.models.generate_content.return_value = mock_response

        result = service._make_gemini_call("test prompt", {}, "test")

        assert result == {"result": "success"}

    def test_make_gemini_call_failure(self, service, mock_gemini_client):
        """Test Gemini API call handles errors."""
        mock_gemini_client.models.generate_content.side_effect = Exception("API error")

        result = service._make_gemini_call("test prompt", {}, "test")

        assert result is None

    def test_make_gemini_call_no_client(self, service):
        """Test Gemini call returns None when client unavailable."""
        service.gemini_client = None

        result = service._make_gemini_call("test prompt", {}, "test")

        assert result is None
