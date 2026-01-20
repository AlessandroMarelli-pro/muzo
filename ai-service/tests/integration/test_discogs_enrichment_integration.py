"""
Integration tests for Discogs + LLM metadata enrichment workflow.

Tests the full workflow with real files and various scenarios.
"""

import os
from unittest.mock import MagicMock, patch

import pytest
from src.services.gemini_metadata_extractor import GeminiMetadataExtractor
from src.services.third_parties.discogs import DiscogsError, DiscogsErrorType


@pytest.mark.integration
class TestDiscogsEnrichmentIntegration:
    """Integration tests for Discogs enrichment workflow."""

    @pytest.fixture
    def sample_files(self):
        """Sample audio files for testing."""
        files = [
            "/Users/alessandro/Music/tidal/Tracks/T-Fire - Say A Prayer.flac",
            "/Users/alessandro/Music/Youtube/Music/T-Fire - Say A Prayer [Nigeria] Soul (1979).opus",
        ]
        # Filter to only existing files
        return [f for f in files if os.path.exists(f)]

    @pytest.fixture
    def extractor(self):
        """Create a GeminiMetadataExtractor instance."""
        return GeminiMetadataExtractor()

    def test_discogs_success_path(self, extractor, sample_files):
        """Test successful Discogs enrichment path."""
        if not sample_files:
            pytest.skip("Sample files not available")

        if not extractor._is_available():
            pytest.skip("Gemini API not available")

        # Use first available file
        file_path = sample_files[0]
        filename = os.path.basename(file_path)

        # Extract metadata
        result = extractor.extract_metadata_from_filename(filename, file_path)

        # Verify result structure
        assert result is not None
        assert "artist" in result
        assert "title" in result
        assert "genre" in result
        assert "style" in result

        # If Discogs was used, verify enrichment
        if extractor.config.use_discogs and extractor.discogs_enrichment:
            # Should have enriched metadata
            assert result.get("artist") != ""
            assert result.get("title") != ""

    def test_discogs_no_results_fallback(self, extractor):
        """Test fallback to LLM when Discogs returns no results."""
        if not extractor._is_available():
            pytest.skip("Gemini API not available")

        # Mock Discogs to return no results
        if extractor.discogs_enrichment:
            original_search = extractor.discogs_enrichment._search_discogs

            def mock_no_results(*args, **kwargs):
                return []

            extractor.discogs_enrichment._search_discogs = mock_no_results

            # Try extraction
            result = extractor.extract_metadata_from_filename(
                "Unknown Artist - Unknown Title [2024].mp3"
            )

            # Should fallback to LLM or simple extraction
            assert result is not None
            assert "artist" in result
            assert "title" in result

            # Restore original method
            extractor.discogs_enrichment._search_discogs = original_search

    def test_discogs_low_confidence_fallback(self, extractor):
        """Test fallback when Discogs match has low confidence."""
        if not extractor._is_available():
            pytest.skip("Gemini API not available")

        # Mock Discogs to return low confidence match
        if extractor.discogs_enrichment:
            original_select = extractor.discogs_enrichment._select_best_match

            def mock_low_confidence(*args, **kwargs):
                return None  # Low confidence, no match selected

            extractor.discogs_enrichment._select_best_match = mock_low_confidence

            # Try extraction
            result = extractor.extract_metadata_from_filename("Test Artist - Test Title.mp3")

            # Should fallback to LLM
            assert result is not None
            assert "artist" in result
            assert "title" in result

            # Restore original method
            extractor.discogs_enrichment._select_best_match = original_select

    def test_discogs_api_error_fallback(self, extractor):
        """Test fallback when Discogs API returns error."""
        if not extractor._is_available():
            pytest.skip("Gemini API not available")

        # Mock Discogs to raise error
        if extractor.discogs_enrichment:
            original_enrich = extractor.discogs_enrichment.enrich_metadata

            def mock_error(*args, **kwargs):
                raise DiscogsError(DiscogsErrorType.SERVER_ERROR, "API Error")

            extractor.discogs_enrichment.enrich_metadata = mock_error

            # Try extraction
            result = extractor.extract_metadata_from_filename("Test Artist - Test Title.mp3")

            # Should fallback to LLM
            assert result is not None
            assert "artist" in result
            assert "title" in result

            # Restore original method
            extractor.discogs_enrichment.enrich_metadata = original_enrich

    def test_cache_hit_path(self, extractor, sample_files):
        """Test cache hit path."""
        if not sample_files:
            pytest.skip("Sample files not available")

        if not extractor._is_available():
            pytest.skip("Gemini API not available")

        if not extractor.metadata_cache or not extractor.metadata_cache.is_available():
            pytest.skip("Metadata cache not available")

        file_path = sample_files[0]
        filename = os.path.basename(file_path)

        # First extraction (cache miss)
        result1 = extractor.extract_metadata_from_filename(filename, file_path)
        assert result1 is not None

        # Second extraction (should be cache hit)
        result2 = extractor.extract_metadata_from_filename(filename, file_path)
        assert result2 is not None

        # Results should be identical (from cache)
        assert result1["artist"] == result2["artist"]
        assert result1["title"] == result2["title"]

    def test_all_services_unavailable(self, extractor):
        """Test fallback to simple extraction when all services unavailable."""
        # Disable all services
        original_discogs = extractor.discogs_enrichment
        original_llm_available = extractor._is_available

        extractor.discogs_enrichment = None
        extractor._is_available = lambda: False

        # Try extraction
        result = extractor.extract_metadata_from_filename("Test Artist - Test Title.mp3")

        # Should use simple extraction
        assert result is not None
        assert "artist" in result
        assert "title" in result

        # Restore
        extractor.discogs_enrichment = original_discogs
        extractor._is_available = original_llm_available

    def test_multi_stage_workflow(self, extractor, sample_files):
        """Test complete multi-stage workflow."""
        if not sample_files:
            pytest.skip("Sample files not available")

        if not extractor._is_available():
            pytest.skip("Gemini API not available")

        file_path = sample_files[0]
        filename = os.path.basename(file_path)

        # Extract metadata
        result = extractor.extract_metadata_from_filename(filename, file_path)

        # Verify all stages completed
        assert result is not None
        assert result.get("artist") != ""
        assert result.get("title") != ""

        # Verify metadata structure
        assert isinstance(result.get("genre"), list)
        assert isinstance(result.get("style"), list)

    def test_different_modes(self, sample_files):
        """Test extraction in different modes."""
        if not sample_files:
            pytest.skip("Sample files not available")

        file_path = sample_files[0]
        filename = os.path.basename(file_path)

        # Test fast mode
        with patch.dict(os.environ, {"METADATA_MODE": "fast"}):
            extractor_fast = GeminiMetadataExtractor()
            if extractor_fast._is_available():
                result_fast = extractor_fast.extract_metadata_from_filename(filename, file_path)
                assert result_fast is not None

        # Test balanced mode
        with patch.dict(os.environ, {"METADATA_MODE": "balanced"}):
            extractor_balanced = GeminiMetadataExtractor()
            if extractor_balanced._is_available():
                result_balanced = extractor_balanced.extract_metadata_from_filename(
                    filename, file_path
                )
                assert result_balanced is not None

        # Test accurate mode
        with patch.dict(os.environ, {"METADATA_MODE": "accurate"}):
            extractor_accurate = GeminiMetadataExtractor()
            if extractor_accurate._is_available():
                result_accurate = extractor_accurate.extract_metadata_from_filename(
                    filename, file_path
                )
                assert result_accurate is not None

    def test_artist_title_extraction_stage(self, extractor, sample_files):
        """Test Stage 1: Artist/Title extraction."""
        if not sample_files:
            pytest.skip("Sample files not available")

        file_path = sample_files[0]
        filename = os.path.basename(file_path)

        # Extract artist/title
        artist_title = extractor.artist_title_extractor.extract_and_normalize(
            filename, file_path
        )

        assert artist_title is not None
        assert "artist" in artist_title
        assert "title" in artist_title
        assert "confidence" in artist_title
        assert "source" in artist_title
        assert artist_title["confidence"] > 0

    def test_discogs_enrichment_stage(self, extractor):
        """Test Stage 2: Discogs enrichment."""
        if not extractor._is_available():
            pytest.skip("Gemini API not available")

        if not extractor.discogs_enrichment:
            pytest.skip("Discogs enrichment not enabled")

        # Test with known artist/title
        result = extractor.discogs_enrichment.enrich_metadata(
            "T-Fire", "Say A Prayer", None, None
        )

        # May or may not find results, but should not error
        # If result exists, verify structure
        if result:
            assert "artist" in result
            assert "title" in result
            assert "genre" in result
            assert "style" in result
