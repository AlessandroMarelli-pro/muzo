"""
Tests for OpenAIMetadataExtractor service.

This module tests the OpenAI metadata extraction functionality,
including successful extraction, error handling, and schema validation.
"""

import json
from unittest.mock import MagicMock, Mock, patch

import pytest

from src.services.openai_metadata_extractor import OpenAIMetadataExtractor


class TestOpenAIMetadataExtractor:
    """Test OpenAIMetadataExtractor class."""

    def test_extract_metadata_from_filename_success(self):
        """Test successful metadata extraction from filename."""
        # Mock OpenAI response
        mock_response = Mock()
        mock_response.choices = [
            Mock(
                message=Mock(
                    content=json.dumps(
                        {
                            "artist": "Georgie Red",
                            "title": "Help the Man",
                            "mix": "Save Ya Mix",
                            "year": 1985,
                            "country": "UK",
                            "label": "Unknown",
                            "format": "Vinyl, 12\"",
                            "genre": ["Electronic", "Disco", "Funk"],
                            "style": ["Electro", "Boogie", "Dance"],
                            "duration": "7:15",
                            "credits": {
                                "producer": "Woolfe Bang",
                                "writers": ["George Kochbek", "Phill Earl Edwards"],
                                "vocals": "Phill Earl Edwards",
                            },
                            "description": "Extended 12-inch club mix typical of mid-1980s electro-disco releases.",
                            "availability": {
                                "streaming": ["Spotify", "YouTube"],
                                "physical": ["12-inch vinyl"],
                            },
                            "tags": ["1980s", "club mix", "electro funk", "rare disco"],
                        }
                    )
                )
            )
        ]

        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = mock_response

        # Create extractor with mocked client
        extractor = OpenAIMetadataExtractor(api_key="test-key")
        extractor.client = mock_client

        # Test extraction
        filename = "Georgie Red - Help the Man (Save Ya Mix) [1985].mp3"
        result = extractor.extract_metadata_from_filename(filename)

        # Verify OpenAI was called correctly
        mock_client.chat.completions.create.assert_called_once()
        call_args = mock_client.chat.completions.create.call_args
        assert call_args.kwargs["model"] == "gpt-4o-mini"
        assert call_args.kwargs["temperature"] == 0.1
        assert call_args.kwargs["response_format"] == {"type": "json_object"}

        # Verify response structure
        assert result["artist"] == "Georgie Red"
        assert result["title"] == "Help the Man"
        assert result["mix"] == "Save Ya Mix"
        assert result["year"] == "1985"  # Should be converted to string
        assert result["country"] == "UK"
        assert result["label"] == "Unknown"
        assert result["format"] == "Vinyl, 12\""
        assert isinstance(result["genre"], list)
        assert len(result["genre"]) == 3
        assert "Electronic" in result["genre"]
        assert isinstance(result["style"], list)
        assert len(result["style"]) == 3
        assert result["duration"] == "7:15"
        assert result["credits"]["producer"] == "Woolfe Bang"
        assert len(result["credits"]["writers"]) == 2
        assert isinstance(result["tags"], list)
        assert len(result["tags"]) == 4

    def test_extract_metadata_from_filename_without_extension(self):
        """Test metadata extraction when filename has no extension."""
        mock_response = Mock()
        mock_response.choices = [
            Mock(
                message=Mock(
                    content=json.dumps(
                        {
                            "artist": "Test Artist",
                            "title": "Test Title",
                            "genre": ["Pop"],
                            "style": ["Contemporary"],
                            "tags": ["test"],
                        }
                    )
                )
            )
        ]

        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = mock_response

        extractor = OpenAIMetadataExtractor(api_key="test-key")
        extractor.client = mock_client

        filename = "Test Artist - Test Title"
        result = extractor.extract_metadata_from_filename(filename)

        # Verify the prompt was sent without extension
        call_args = mock_client.chat.completions.create.call_args
        user_message = call_args.kwargs["messages"][1]["content"]
        assert "Test Artist - Test Title" in user_message
        assert ".mp3" not in user_message

        assert result["artist"] == "Test Artist"
        assert result["title"] == "Test Title"

    def test_extract_metadata_with_minimal_data(self):
        """Test metadata extraction with minimal required fields."""
        mock_response = Mock()
        mock_response.choices = [
            Mock(
                message=Mock(
                    content=json.dumps(
                        {
                            "artist": "Unknown Artist",
                            "title": "Unknown Title",
                            "genre": [],
                            "style": [],
                            "tags": [],
                        }
                    )
                )
            )
        ]

        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = mock_response

        extractor = OpenAIMetadataExtractor(api_key="test-key")
        extractor.client = mock_client

        result = extractor.extract_metadata_from_filename("unknown.mp3")

        assert result["artist"] == "Unknown Artist"
        assert result["title"] == "Unknown Title"
        assert result["genre"] == []
        assert result["style"] == []
        assert result["tags"] == []

    def test_extract_metadata_without_api_key(self):
        """Test metadata extraction when API key is not configured."""
        extractor = OpenAIMetadataExtractor(api_key=None)
        # Simulate no API key by setting client to None
        extractor.client = None

        result = extractor.extract_metadata_from_filename("test.mp3")

        # Should return empty metadata structure
        assert result["artist"] == ""
        assert result["title"] == ""
        assert result["genre"] == []
        assert result["style"] == []
        assert result["tags"] == []
        assert result["mix"] is None
        assert result["year"] is None

    def test_extract_metadata_api_error(self):
        """Test metadata extraction when API call fails."""
        mock_client = MagicMock()
        mock_client.chat.completions.create.side_effect = Exception("API Error")

        extractor = OpenAIMetadataExtractor(api_key="test-key")
        extractor.client = mock_client

        result = extractor.extract_metadata_from_filename("test.mp3")

        # Should return empty metadata on error
        assert result["artist"] == ""
        assert result["title"] == ""
        assert result["genre"] == []

    def test_extract_metadata_invalid_json_response(self):
        """Test metadata extraction when API returns invalid JSON."""
        mock_response = Mock()
        mock_response.choices = [Mock(message=Mock(content="Invalid JSON response"))]

        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = mock_response

        extractor = OpenAIMetadataExtractor(api_key="test-key")
        extractor.client = mock_client

        result = extractor.extract_metadata_from_filename("test.mp3")

        # Should return empty metadata on JSON parse error
        assert result["artist"] == ""
        assert result["title"] == ""
        assert result["genre"] == []

    def test_extract_metadata_empty_response(self):
        """Test metadata extraction when API returns empty response."""
        mock_response = Mock()
        mock_response.choices = [Mock(message=Mock(content=None))]

        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = mock_response

        extractor = OpenAIMetadataExtractor(api_key="test-key")
        extractor.client = mock_client

        result = extractor.extract_metadata_from_filename("test.mp3")

        # Should return empty metadata
        assert result["artist"] == ""
        assert result["title"] == ""
        assert result["genre"] == []

    def test_normalize_metadata_with_string_year(self):
        """Test that year is properly normalized when it's already a string."""
        mock_response = Mock()
        mock_response.choices = [
            Mock(
                message=Mock(
                    content=json.dumps(
                        {
                            "artist": "Artist",
                            "title": "Title",
                            "year": "1985",
                            "genre": ["Pop"],
                            "style": ["Contemporary"],
                            "tags": ["test"],
                        }
                    )
                )
            )
        ]

        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = mock_response

        extractor = OpenAIMetadataExtractor(api_key="test-key")
        extractor.client = mock_client

        result = extractor.extract_metadata_from_filename("test.mp3")

        assert result["year"] == "1985"

    def test_normalize_metadata_with_integer_year(self):
        """Test that year is converted to string when it's an integer."""
        mock_response = Mock()
        mock_response.choices = [
            Mock(
                message=Mock(
                    content=json.dumps(
                        {
                            "artist": "Artist",
                            "title": "Title",
                            "year": 1985,
                            "genre": ["Pop"],
                            "style": ["Contemporary"],
                            "tags": ["test"],
                        }
                    )
                )
            )
        ]

        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = mock_response

        extractor = OpenAIMetadataExtractor(api_key="test-key")
        extractor.client = mock_client

        result = extractor.extract_metadata_from_filename("test.mp3")

        assert result["year"] == "1985"
        assert isinstance(result["year"], str)

    def test_normalize_metadata_with_non_list_genre(self):
        """Test that genre is converted to list when it's not already a list."""
        mock_response = Mock()
        mock_response.choices = [
            Mock(
                message=Mock(
                    content=json.dumps(
                        {
                            "artist": "Artist",
                            "title": "Title",
                            "genre": "Pop",  # String instead of list
                            "style": ["Contemporary"],
                            "tags": ["test"],
                        }
                    )
                )
            )
        ]

        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = mock_response

        extractor = OpenAIMetadataExtractor(api_key="test-key")
        extractor.client = mock_client

        result = extractor.extract_metadata_from_filename("test.mp3")

        assert isinstance(result["genre"], list)
        assert result["genre"] == ["Pop"]

    def test_normalize_metadata_with_non_list_style(self):
        """Test that style is converted to list when it's not already a list."""
        mock_response = Mock()
        mock_response.choices = [
            Mock(
                message=Mock(
                    content=json.dumps(
                        {
                            "artist": "Artist",
                            "title": "Title",
                            "genre": ["Pop"],
                            "style": "Rock",  # String instead of list
                            "tags": ["test"],
                        }
                    )
                )
            )
        ]

        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = mock_response

        extractor = OpenAIMetadataExtractor(api_key="test-key")
        extractor.client = mock_client

        result = extractor.extract_metadata_from_filename("test.mp3")

        assert isinstance(result["style"], list)
        assert result["style"] == ["Rock"]

    def test_normalize_metadata_with_non_list_tags(self):
        """Test that tags is converted to list when it's not already a list."""
        mock_response = Mock()
        mock_response.choices = [
            Mock(
                message=Mock(
                    content=json.dumps(
                        {
                            "artist": "Artist",
                            "title": "Title",
                            "genre": ["Pop"],
                            "style": ["Rock"],
                            "tags": "test",  # String instead of list
                        }
                    )
                )
            )
        ]

        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = mock_response

        extractor = OpenAIMetadataExtractor(api_key="test-key")
        extractor.client = mock_client

        result = extractor.extract_metadata_from_filename("test.mp3")

        assert isinstance(result["tags"], list)
        assert result["tags"] == ["test"]

    def test_get_empty_metadata(self):
        """Test that _get_empty_metadata returns correct structure."""
        extractor = OpenAIMetadataExtractor(api_key="test-key")
        empty_metadata = extractor._get_empty_metadata()

        assert empty_metadata["artist"] == ""
        assert empty_metadata["title"] == ""
        assert empty_metadata["mix"] is None
        assert empty_metadata["year"] is None
        assert empty_metadata["country"] is None
        assert empty_metadata["label"] is None
        assert empty_metadata["format"] is None
        assert empty_metadata["genre"] == []
        assert empty_metadata["style"] == []
        assert empty_metadata["duration"] is None
        assert empty_metadata["credits"] is None
        assert empty_metadata["description"] is None
        assert empty_metadata["availability"] is None
        assert empty_metadata["tags"] == []

    def test_is_available_with_api_key(self):
        """Test _is_available returns True when API key is configured."""
        extractor = OpenAIMetadataExtractor(api_key="test-key")
        assert extractor._is_available() is True

    def test_is_available_without_api_key(self):
        """Test _is_available returns False when API key is not configured."""
        extractor = OpenAIMetadataExtractor(api_key=None)
        extractor.client = None
        assert extractor._is_available() is False

    def test_system_instructions_in_prompt(self):
        """Test that system instructions are included in the API call."""
        mock_response = Mock()
        mock_response.choices = [
            Mock(
                message=Mock(
                    content=json.dumps(
                        {
                            "artist": "Artist",
                            "title": "Title",
                            "genre": ["Pop"],
                            "style": ["Contemporary"],
                            "tags": ["test"],
                        }
                    )
                )
            )
        ]

        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = mock_response

        extractor = OpenAIMetadataExtractor(api_key="test-key")
        extractor.client = mock_client

        extractor.extract_metadata_from_filename("test.mp3")

        # Verify system message contains instructions
        call_args = mock_client.chat.completions.create.call_args
        messages = call_args.kwargs["messages"]
        system_message = messages[0]["content"]

        assert "You are a music metadata agent" in system_message
        assert "MUST return ONLY a JSON object" in system_message
        assert "No markdown, no explanations" in system_message

