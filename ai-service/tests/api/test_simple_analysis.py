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

from src.api.simple_analysis import SimpleAnalysisResource


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
        assert data["track"]["filename"] == filename, "Filename should match"
        assert data["track"]["original_filename"] == filename, (
            "original_filename should be the exact upload filename, unmodified"
        )

        assert data.get("processing_mode") == "simple", (
            "Should use simple processing mode"
        )
        assert "schema_version" in data

        # Verify required top-level sections of the generic feature envelope are
        # present. The old flat file_info/audio_technical/id3_tags/discogs_* keys
        # and the fingerprint dict were retired -- see the ai-service response
        # redesign plan.
        required_fields = ["features", "labels", "classifications", "track", "audio", "tags"]
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"
            assert isinstance(data[field], dict), (
                f"Field {field} should be a dictionary"
            )
        assert isinstance(data["warnings"], list)

        # Each populated `features` entry follows the {value, confidence, source}
        # shape -- no bare numbers/strings at the top level anymore.
        for name, entry in data["features"].items():
            assert set(entry.keys()) == {"value", "confidence", "source"}, name
            assert entry["value"] is not None, name

        # has_image=true tells the endpoint the client already has album art, so
        # it skips fetching and never sets this key at all (see simple_analysis.py).
        assert "album_art" not in data, (
            "album_art should be absent when has_image=true"
        )

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
            assert data["track"]["filename"] == test_audio_file["filename"], (
                "Filename should match"
            )

            features = data["features"]
            labels = data["labels"]

            tempo_entry = features.get("tempo")
            if tempo_entry is not None:
                tempo = tempo_entry["value"]
                if (
                    abs(tempo - test_audio_file["tempo"]) < 3
                    or abs(tempo / 2 - test_audio_file["tempo"]) < 3
                ):
                    bpm_ok_count += 1

            # valence_mood/arousal_mood/danceability_feeling are present but no
            # longer asserted for exact ground-truth match: the fixture's
            # ground-truth values predate the switch to DEAM (valence/arousal)
            # and the discogs-effnet danceable classifier (danceability), which
            # source these from a materially different model than what the
            # fixture was originally captured against -- same reasoning as
            # test_key_detection.py's loose accuracy bound after the S-KEY
            # switch.
            assert "valence_mood" in labels
            assert "arousal_mood" in labels
            assert "danceability_feeling" in labels
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
            assert data["track"]["filename"] == test_audio_file["filename"], (
                "Filename should match"
            )

            features = data["features"]
            print(features)
