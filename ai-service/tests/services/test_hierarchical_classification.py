"""
API tests for SimpleAnalysisResource post method.

This module tests the POST endpoint functionality of the SimpleAnalysisResource
using a real audio file to ensure proper processing and response format.
"""

import asyncio
import json
from typing import Optional

import pytest
from src.services.hierarchical_music_classifier import (
    HierarchicalMusicClassificationService,
    get_hierarchical_classification_service,
)
from src.services.simple_audio_loader import SimpleAudioLoader

pytest_plugins = ("pytest_asyncio",)


class TestHierarchicalClassification:
    audio_loader = SimpleAudioLoader()

    @pytest.mark.asyncio
    async def test_hierarchical_classification(self):
        """
        Test hierarchical classification method.
        """

        file = "/Users/alessandro/Music/Youtube/chicco/Speedy J - Pepper (The Hot Mix) (1994).mp3"
        service = HierarchicalMusicClassificationService(
            use_huggingface=True,
            enable_musicbrainz_integration=False,
            use_discogs_integration=False,
        )
        await service.initialize()
        result = await service.classify_audio(
            file,
            use_musicbrainz_validation=False,
        )
        assert result["success"] is True
        classification = result["classification"]
        aggregation_method = result["aggregation_method"]
        assert aggregation_method == "majority_vote"
        assert classification["genre"] == "Dance_EDM"
        assert classification["subgenre"] == "Acid Trance"
        assert classification["confidence"]["genre"] > 0.5
        assert classification["confidence"]["subgenre"] > 0.5
        assert classification["confidence"]["combined"] > 0.5
        assert result["discogs_validation"]["enabled"] is False
        assert result["discogs_validation"]["used"] is False
        assert result["discogs_validation"]["message"] == "Discogs validation disabled"
        assert result["musicbrainz_validation"]["enabled"] is False
        assert result["musicbrainz_validation"]["used"] is False
        assert (
            result["musicbrainz_validation"]["message"]
            == "MusicBrainz validation disabled"
        )
        print(json.dumps(result, indent=4))

    @pytest.mark.asyncio
    async def test_hierarchical_classifications(self, test_audio_files):
        """
        Test hierarchical classification method.
        """

        service = HierarchicalMusicClassificationService(
            use_huggingface=True,
            enable_musicbrainz_integration=False,
            use_discogs_integration=False,
        )
        await service.initialize()
        classifications = []
        bad_results = []
        for file in test_audio_files:
            result = await service.classify_audio(
                file["filename"],
                use_musicbrainz_validation=False,
                segment_duration=60,
                aggregation_method="best_confidence",
                force_segmentation=True,
            )
            assert result["success"] is True
            classification = result["classification"]
            genre = classification["genre"]
            subgenre = classification["subgenre"]
            classification_result = {
                **file,
                "subgenre": subgenre,
                "genre": genre,
                "classification": result["classification"],
            }
            classifications.append(classification_result)

            if result["classification"]["genre"] != file["genre"]:
                bad_results.append(classification_result)
            else:
                assert result["success"] is True
                if result["classification"]["subgenre"] != file["subgenre"]:
                    bad_results.append(classification_result)
                # assert result["classification"]["genre"] == file["genre"]
                # assert result["classification"]["subgenre"] == file["subgenre"]
        print(json.dumps(classifications, indent=4))
        print(json.dumps(bad_results, indent=4))
        # assert len(bad_results) == 0
