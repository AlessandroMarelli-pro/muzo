"""
API tests for SimpleAnalysisResource post method.

This module tests the POST endpoint functionality of the SimpleAnalysisResource
using a real audio file to ensure proper processing and response format.
"""

import json
import os

import pytest
from flask import Flask
from flask_restful import Api

# from src.api.hierarchical_classification import initialize_service
from src.api.simple_analysis import SimpleAnalysisResource
from tabulate import tabulate


class TestSimpleAnalysisAPI:
    """API tests for SimpleAnalysisResource POST method."""

    @pytest.fixture
    def app(self):
        """Create Flask app for testing."""
        app = Flask(__name__)
        app.config["TESTING"] = True
        api = Api(app)
        api.add_resource(SimpleAnalysisResource, "/analyze/simple")
        return app

    @pytest.fixture
    def client(self, app):
        """Create test client."""
        return app.test_client()

    @pytest.fixture
    def test_audio_file(self):
        """Path to the test audio file."""
        return "/Users/alessandro/Music/Youtube/Fiesta/🔴 Geoff Bastow - White Lightning 🇬🇧  1976 UK Jazz Funk.mp3"

    @pytest.fixture(autouse=True)
    def setup_hierarchical_service(self):
        """Initialize hierarchical classification service for tests."""
        # Skip hierarchical service initialization for audioFlux tests to avoid threading conflicts
        # asyncio.run(initialize_service())
        yield
        # Cleanup after test if needed
        pass

    def test_post_method_success_with_image(self, client, test_audio_file):
        """Test successful POST request with audio file."""
        # Verify test file exists
        assert os.path.exists(test_audio_file), (
            f"Test audio file not found: {test_audio_file}"
        )
        filename = os.path.basename(test_audio_file)
        # Prepare the request
        with open(test_audio_file, "rb") as audio_file:
            response = client.post(
                "/analyze/simple",
                data={"audio_file": (audio_file, filename), "has_image": "true"},
                content_type="multipart/form-data",
            )

        # Verify response status
        assert response.status_code == 200, (
            f"Expected 200, got {response.status_code}: {response.get_json()}"
        )

        # Parse response data
        data = response.get_json()

        # Verify response structure
        assert isinstance(data, dict), "Response should be a dictionary"
        assert data.get("status") == "success", (
            f"Expected success status, got: {data.get('status')}"
        )
        assert data["file_info"]["filename"] == filename, "Filename should match"

        assert data.get("processing_mode") == "simple", (
            "Should use simple processing mode"
        )

        # Verify required fields are present
        required_fields = [
            "features",
            "fingerprint",
            "file_info",
            "audio_technical",
            "id3_tags",
        ]
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"
            assert isinstance(data[field], dict), (
                f"Field {field} should be a dictionary"
            )
        assert "album_art" not in data, "Album art should be present"

    def test_post_method_success_without_image(self, client, test_audio_file):
        """Test successful POST request with audio file."""
        # Verify test file exists
        assert os.path.exists(test_audio_file), (
            f"Test audio file not found: {test_audio_file}"
        )
        filename = os.path.basename(test_audio_file)
        # Prepare the request
        with open(test_audio_file, "rb") as audio_file:
            response = client.post(
                "/analyze/simple",
                data={"audio_file": (audio_file, filename), "has_image": "false"},
                content_type="multipart/form-data",
            )

        # Verify response status
        assert response.status_code == 200, (
            f"Expected 200, got {response.status_code}: {response.get_json()}"
        )

        # Parse response data
        data = response.get_json()
        assert "album_art" in data, "Album art should be present"

    def test_multiple_files(self, client, test_audio_files):
        """Test multiple files POST request."""
        # Verify test files exist
        for test_audio_file in test_audio_files:
            assert os.path.exists(test_audio_file["filename"]), (
                f"Test audio file not found: {test_audio_file['filename']}"
            )
        # Prepare the request
        bpm_ok_count = 0
        for test_audio_file in test_audio_files:
            with open(test_audio_file["filename"], "rb") as audio_file:
                response = client.post(
                    "/analyze/simple",
                    data={
                        "audio_file": (audio_file, test_audio_file["filename"]),
                        "has_image": "true",
                    },
                    content_type="multipart/form-data",
                )
            assert response.status_code == 200, (
                f"Expected 200, got {response.status_code}: {response.get_json()}"
            )
            data = response.get_json()
            assert data.get("status") == "success", (
                f"Expected success status, got: {data.get('status')}"
            )
            assert data["file_info"]["filename"] == test_audio_file["filename"], (
                "Filename should match"
            )

            features = data["features"]
            musical_features = features["musical_features"]

            if (
                abs(musical_features["tempo"] - test_audio_file["tempo"]) < 3
                or abs(musical_features["tempo"] / 2 - test_audio_file["tempo"]) < 3
            ):
                bpm_ok_count += 1

            assert (
                musical_features["valence_mood"] == test_audio_file["valence_mood"]
            ), "Valence mood should match"
            assert (
                musical_features["arousal_mood"] == test_audio_file["arousal_mood"]
            ), "Arousal mood should match"
            assert (
                musical_features["danceability_feeling"]
                == test_audio_file["danceability_feeling"]
            ), "Danceability feeling should match"

            assert (
                musical_features["danceability_calculation"]["beat_strength"]
                == test_audio_file["beat_strength"]
            ), "Beat strength should match"
        assert bpm_ok_count / len(test_audio_files) > 0.9, (
            "More than 90% of BPMs should be correct"
        )

    def test_control_files(self, client, test_low_danceability_files):
        """Test multiple files POST request."""
        # Verify test files exist
        for test_audio_file in test_low_danceability_files:
            assert os.path.exists(test_audio_file["filename"]), (
                f"Test audio file not found: {test_audio_file['filename']}"
            )
        # Prepare the request
        bpm_ok_count = 0
        for test_audio_file in test_low_danceability_files:
            with open(test_audio_file["filename"], "rb") as audio_file:
                response = client.post(
                    "/analyze/simple",
                    data={
                        "audio_file": (audio_file, test_audio_file["filename"]),
                        "has_image": "true",
                    },
                    content_type="multipart/form-data",
                )
            assert response.status_code == 200, (
                f"Expected 200, got {response.status_code}: {response.get_json()}"
            )
            data = response.get_json()
            assert data.get("status") == "success", (
                f"Expected success status, got: {data.get('status')}"
            )
            assert data["file_info"]["filename"] == test_audio_file["filename"], (
                "Filename should match"
            )

            features = data["features"]
            musical_features = features["musical_features"]
            print(musical_features)
