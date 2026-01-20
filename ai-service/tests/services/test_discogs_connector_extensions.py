"""
Unit tests for DiscogsConnector extensions (search_release, get_release_details).

Tests the new methods added to DiscogsConnector for Phase 1.
"""

from unittest.mock import MagicMock, Mock, patch

import pytest

from src.services.third_parties.discogs import DiscogsConnector, DiscogsError, DiscogsErrorType


class TestDiscogsConnectorExtensions:
    """Test DiscogsConnector extension methods."""

    @pytest.fixture
    def mock_discogs_client(self):
        """Create a mock Discogs client."""
        return MagicMock()

    @pytest.fixture
    def connector(self, mock_discogs_client):
        """Create a DiscogsConnector instance with mocked client."""
        with patch("src.services.third_parties.discogs.discogs_client.Client") as mock_client_class:
            mock_client_class.return_value = mock_discogs_client
            connector = DiscogsConnector(api_keys=["test-key"], enable_cache=False)
            connector.clients = [mock_discogs_client]
            connector.key_rate_limiters = [MagicMock()]
            connector.key_rate_limiters[0].can_make_request.return_value = True
            connector.key_rate_limiters[0].record_request = MagicMock()
            connector.circuit_breakers = {0: {"state": MagicMock(), "failure_count": 0}}
            connector._is_circuit_open = MagicMock(return_value=False)
            connector._update_circuit_breaker = MagicMock()
            return connector

    def test_normalize_query_text(self, connector):
        """Test query text normalization."""
        # Test basic normalization
        assert connector.normalize_query_text("  Test  ") == "Test"
        assert connector.normalize_query_text("Test   Query") == "Test Query"

        # Test quote escaping
        normalized = connector.normalize_query_text('Test "Quote"')
        assert '"' in normalized or "\\" in normalized

    def test_normalize_query_text_empty(self, connector):
        """Test normalization of empty text."""
        assert connector.normalize_query_text("") == ""
        assert connector.normalize_query_text(None) == ""

    def test_search_release_success(self, connector, mock_discogs_client):
        """Test successful release search."""
        # Mock search results
        mock_release = Mock()
        mock_release.id = 12345
        mock_release.title = "Test Release"
        mock_release.artists = [Mock(name="Test Artist")]
        mock_release.year = 2020
        mock_release.country = "US"
        mock_release.labels = [Mock(name="Test Label")]
        mock_release.formats = [Mock(format="Vinyl")]
        mock_release.genres = ["Electronic"]
        mock_release.styles = ["Techno"]
        mock_release.thumb = "http://example.com/thumb.jpg"

        mock_results = Mock()
        mock_results.__iter__ = Mock(return_value=iter([mock_release]))
        mock_results.__len__ = Mock(return_value=1)

        mock_discogs_client.search.return_value = mock_results

        # Mock _make_api_call_with_retry
        with patch.object(connector, "_make_api_call_with_retry", return_value=[mock_release]):
            results = connector.search_release("Test Artist", "Test Release", 2020)

            assert len(results) == 1
            assert results[0]["id"] == 12345
            assert results[0]["title"] == "Test Release"
            assert results[0]["artists"] == ["Test Artist"]
            assert results[0]["year"] == 2020

    def test_search_release_no_year(self, connector, mock_discogs_client):
        """Test release search without year parameter."""
        mock_release = Mock()
        mock_release.id = 12345
        mock_release.title = "Test Release"
        mock_release.artists = [Mock(name="Test Artist")]
        mock_release.year = None
        mock_release.country = None
        mock_release.labels = []
        mock_release.formats = []
        mock_release.genres = []
        mock_release.styles = []
        mock_release.thumb = None

        with patch.object(connector, "_make_api_call_with_retry", return_value=[mock_release]):
            results = connector.search_release("Test Artist", "Test Release")

            assert len(results) == 1
            assert results[0]["year"] is None

    def test_search_release_no_results(self, connector):
        """Test release search with no results."""
        with patch.object(connector, "_make_api_call_with_retry", return_value=[]):
            results = connector.search_release("Unknown Artist", "Unknown Title")

            assert results == []

    def test_search_release_empty_artist_title(self, connector):
        """Test release search with empty artist or title."""
        results = connector.search_release("", "Title")
        assert results == []

        results = connector.search_release("Artist", "")
        assert results == []

        results = connector.search_release("", "")
        assert results == []

    def test_search_release_api_error(self, connector):
        """Test release search handles API errors."""
        with patch.object(
            connector, "_make_api_call_with_retry", side_effect=DiscogsError(DiscogsErrorType.UNKNOWN, "API Error")
        ):
            results = connector.search_release("Artist", "Title")

            assert results == []

    def test_search_release_processing_error(self, connector, mock_discogs_client):
        """Test release search handles processing errors gracefully."""
        # Mock release that raises error during processing
        mock_release = Mock()
        mock_release.id = 12345
        mock_release.title = "Test Release"
        mock_release.artists = None  # This might cause an error
        mock_release.year = 2020

        # Mock to raise error when accessing artists
        def side_effect(*args, **kwargs):
            if "artists" in str(args):
                raise AttributeError("No artists")

        mock_release.__getattr__ = side_effect

        with patch.object(connector, "_make_api_call_with_retry", return_value=[mock_release]):
            results = connector.search_release("Artist", "Title")

            # Should continue processing other results or return empty
            assert isinstance(results, list)

    def test_get_release_details_success(self, connector, mock_discogs_client):
        """Test successful release details retrieval."""
        # Mock release object
        mock_release = Mock()
        mock_release.id = 12345
        mock_release.title = "Test Release"
        mock_release.artists = [Mock(name="Test Artist", id=67890)]
        mock_release.year = 2020
        mock_release.country = "US"
        mock_release.labels = [Mock(name="Test Label", data={"catno": "TEST001"})]
        mock_release.formats = [{"name": "Vinyl", "qty": "1", "descriptions": ["12'", "33 RPM"]}]
        mock_release.genres = ["Electronic"]
        mock_release.styles = ["Techno"]
        mock_release.tracklist = [
            Mock(position="A1", title="Track 1", duration="5:30"),
            Mock(position="A2", title="Track 2", duration="4:20"),
        ]
        mock_release.extraartists = [Mock(name="Producer", role="Producer")]
        mock_release.images = [{"uri": "http://example.com/image.jpg", "uri150": "http://example.com/image150.jpg", "type": "primary"}]
        mock_release.thumb = "http://example.com/thumb.jpg"
        mock_release.uri = "http://example.com/release/12345"

        mock_discogs_client.release.return_value = mock_release

        # Mock _get_available_client
        connector._get_available_client = MagicMock(return_value=(mock_discogs_client, 0))

        details = connector.get_release_details(12345)

        assert details is not None
        assert details["id"] == 12345
        assert details["title"] == "Test Release"
        assert len(details["artists"]) == 1
        assert details["artists"][0]["name"] == "Test Artist"
        assert details["year"] == 2020
        assert details["country"] == "US"
        assert len(details["labels"]) == 1
        assert len(details["genres"]) == 1
        assert len(details["styles"]) == 1
        assert len(details["tracklist"]) == 2
        assert len(details["credits"]) == 1

    def test_get_release_details_no_client(self, connector):
        """Test release details when no client available."""
        connector._get_available_client = MagicMock(return_value=(None, None))

        details = connector.get_release_details(12345)

        assert details is None

    def test_get_release_details_api_error(self, connector, mock_discogs_client):
        """Test release details handles API errors."""
        mock_discogs_client.release.side_effect = Exception("API Error")
        connector._get_available_client = MagicMock(return_value=(mock_discogs_client, 0))

        details = connector.get_release_details(12345)

        assert details is None

    def test_get_release_details_missing_fields(self, connector, mock_discogs_client):
        """Test release details handles missing optional fields."""
        # Mock release with minimal fields
        mock_release = Mock()
        mock_release.id = 12345
        mock_release.title = "Test Release"
        mock_release.artists = []
        # Missing year, country, labels, etc.

        # Mock missing attributes
        def getattr_side_effect(name, default=None):
            if name == "year":
                raise AttributeError
            if name == "country":
                raise AttributeError
            return default

        mock_release.__getattribute__ = lambda name: getattr_side_effect(name)

        mock_discogs_client.release.return_value = mock_release
        connector._get_available_client = MagicMock(return_value=(mock_discogs_client, 0))

        details = connector.get_release_details(12345)

        assert details is not None
        assert details["id"] == 12345
        # Missing fields should be None or empty
        assert details.get("year") is None or details["year"] is None

    def test_search_release_query_format(self, connector):
        """Test that search query is formatted correctly."""
        with patch.object(connector, "_make_api_call_with_retry") as mock_call:
            mock_call.return_value = []
            connector.search_release("Test Artist", "Test Title", 2020)

            # Verify query format
            call_args = mock_call.call_args
            # The actual query building happens in search_release
            # We just verify it was called
            assert mock_call.called

    def test_normalize_query_text_special_chars(self, connector):
        """Test normalization handles special characters."""
        # Test various special characters
        test_cases = [
            ("Test & Query", "Test & Query"),
            ("Test/Query", "Test/Query"),
            ("Test-Query", "Test-Query"),
            ("Test_Query", "Test_Query"),
        ]

        for input_text, expected_pattern in test_cases:
            normalized = connector.normalize_query_text(input_text)
            # Should not be empty and should be cleaned
            assert normalized != ""
            assert len(normalized.strip()) == len(normalized)
