"""
Unit tests for ArtistTitleExtractor service.

Tests artist/title extraction from various sources with mocked dependencies.
"""

from unittest.mock import MagicMock, Mock, patch

import pytest

from src.services.artist_title_extractor import ArtistTitleExtractor


class TestArtistTitleExtractor:
    """Test ArtistTitleExtractor class."""

    def test_extract_from_id3_tags(self):
        """Test extraction from ID3 tags (highest priority)."""
        extractor = ArtistTitleExtractor()

        id3_tags = {
            "artist": "Test Artist",
            "title": "Test Title",
        }

        result = extractor.extract_and_normalize(
            "filename.mp3", file_path="/path/to/file.mp3", id3_tags=id3_tags
        )

        assert result["artist"] == "test artist"
        assert result["title"] == "test title"
        assert result["confidence"] == 0.95
        assert result["source"] == "id3"

    def test_extract_from_llm_filename_cleaning(self):
        """Test extraction using LLM filename cleaning."""
        # Mock LLM extractor
        mock_llm_extractor = MagicMock()
        mock_llm_extractor._is_available.return_value = True

        # Mock the simplified LLM call
        mock_response = Mock()
        mock_response.parsed = {
            "artist": "LLM Artist",
            "title": "LLM Title",
            "mix": "LLM Mix",
        }

        with patch.object(
            ArtistTitleExtractor,
            "_make_gemini_simplified_call",
            return_value={"artist": "LLM Artist", "title": "LLM Title", "mix": "LLM Mix"},
        ):
            extractor = ArtistTitleExtractor(llm_extractor=mock_llm_extractor)
            result = extractor.extract_and_normalize("LLM Artist - LLM Title (LLM Mix).mp3")

            assert result["artist"] == "llm artist"
            assert result["title"] == "llm title"
            assert result["mix"] == "llm mix"
            assert result["confidence"] == 0.85
            assert result["source"] == "llm_filename_cleaning"

    def test_extract_from_filename_parsing(self):
        """Test extraction from filename parsing."""
        extractor = ArtistTitleExtractor()

        # Mock filename parser
        with patch.object(
            extractor.filename_parser,
            "parse_filename_for_metadata",
            return_value={"artist": "Parsed Artist", "title": "Parsed Title", "subtitle": "Remix"},
        ):
            result = extractor.extract_and_normalize("Parsed Artist - Parsed Title (Remix).mp3")

            assert result["artist"] == "parsed artist"
            assert result["title"] == "parsed title"
            assert result["confidence"] == 0.75
            assert result["source"] == "filename_parsing"

    def test_extract_fallback(self):
        """Test fallback extraction when all methods fail."""
        extractor = ArtistTitleExtractor()

        # Mock all methods to fail
        with patch.object(
            extractor.filename_parser, "parse_filename_for_metadata", return_value={}
        ):
            result = extractor.extract_and_normalize("Unknown Filename.mp3")

            assert result["artist"] == "unknown filename"
            assert result["title"] == "unknown filename"
            assert result["confidence"] == 0.3
            assert result["source"] == "fallback"

    def test_normalize_artist_title(self):
        """Test artist/title normalization."""
        extractor = ArtistTitleExtractor()

        normalized = extractor._normalize_artist_title("  TEST ARTIST  ", "  Test Title  ")

        assert normalized["artist"] == "test artist"
        assert normalized["title"] == "test title"
        assert "mix" not in normalized or normalized.get("mix") is None

    def test_normalize_with_mix(self):
        """Test normalization includes mix when provided."""
        extractor = ArtistTitleExtractor()

        normalized = extractor._normalize_artist_title("Artist", "Title")
        normalized["mix"] = "remix"

        assert normalized["artist"] == "artist"
        assert normalized["title"] == "title"
        assert normalized["mix"] == "remix"

    def test_apply_cleanup(self):
        """Test text cleanup function."""
        extractor = ArtistTitleExtractor()

        # Test various cleanup scenarios
        assert extractor._apply_cleanup("  TEST  ") == "test"
        assert extractor._apply_cleanup("Test-Title") == "test-title"
        assert extractor._apply_cleanup("Test_Title") == "test_title"

    def test_smart_title_case(self):
        """Test smart title case conversion."""
        extractor = ArtistTitleExtractor()

        # Test title case
        assert extractor._smart_title_case("test title") == "Test Title"
        assert extractor._smart_title_case("TEST TITLE") == "Test Title"
        assert extractor._smart_title_case("test-title") == "Test-Title"

    def test_extract_with_file_path(self):
        """Test extraction when file_path is provided."""
        extractor = ArtistTitleExtractor()

        # Mock ID3 extraction
        mock_id3_result = {
            "id3_tags": {
                "artist": "File Artist",
                "title": "File Title",
            }
        }

        with patch.object(
            extractor.id3_extractor,
            "extract_id3_tags",
            return_value=mock_id3_result,
        ):
            result = extractor.extract_and_normalize(
                "filename.mp3", file_path="/path/to/file.mp3"
            )

            assert result["artist"] == "file artist"
            assert result["title"] == "file title"
            assert result["source"] == "id3"

    def test_extract_id3_tags_failure(self):
        """Test graceful handling when ID3 extraction fails."""
        extractor = ArtistTitleExtractor()

        # Mock ID3 extraction to fail
        with patch.object(
            extractor.id3_extractor,
            "extract_id3_tags",
            side_effect=Exception("ID3 extraction failed"),
        ):
            # Should fall back to filename parsing
            with patch.object(
                extractor.filename_parser,
                "parse_filename_for_metadata",
                return_value={"artist": "Fallback Artist", "title": "Fallback Title"},
            ):
                result = extractor.extract_and_normalize(
                    "Fallback Artist - Fallback Title.mp3", file_path="/path/to/file.mp3"
                )

                assert result["artist"] == "fallback artist"
                assert result["title"] == "fallback title"
                assert result["source"] == "filename_parsing"

    def test_llm_extractor_unavailable(self):
        """Test behavior when LLM extractor is unavailable."""
        mock_llm_extractor = MagicMock()
        mock_llm_extractor._is_available.return_value = False

        extractor = ArtistTitleExtractor(llm_extractor=mock_llm_extractor)

        # Should skip LLM and use filename parsing
        with patch.object(
            extractor.filename_parser,
            "parse_filename_for_metadata",
            return_value={"artist": "Parsed Artist", "title": "Parsed Title"},
        ):
            result = extractor.extract_and_normalize("Parsed Artist - Parsed Title.mp3")

            assert result["source"] == "filename_parsing"
            assert result["confidence"] == 0.75

    def test_llm_extraction_failure(self):
        """Test graceful handling when LLM extraction fails."""
        mock_llm_extractor = MagicMock()
        mock_llm_extractor._is_available.return_value = True

        extractor = ArtistTitleExtractor(llm_extractor=mock_llm_extractor)

        # Mock LLM call to fail
        with patch.object(
            ArtistTitleExtractor,
            "_extract_artist_title_with_llm",
            side_effect=Exception("LLM failed"),
        ):
            # Should fall back to filename parsing
            with patch.object(
                extractor.filename_parser,
                "parse_filename_for_metadata",
                return_value={"artist": "Parsed Artist", "title": "Parsed Title"},
            ):
                result = extractor.extract_and_normalize("Parsed Artist - Parsed Title.mp3")

                assert result["source"] == "filename_parsing"
