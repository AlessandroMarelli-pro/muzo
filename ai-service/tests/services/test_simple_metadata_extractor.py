"""
API tests for SimpleAnalysisResource post method.

This module tests the POST endpoint functionality of the SimpleAnalysisResource
using a real audio file to ensure proper processing and response format.
"""

import json
import os
from unittest.mock import patch

from src.services.simple_metadata_extractor import SimpleMetadataExtractor


class TestAudioMoodAnalyzer:
    def test_get_brightness_factor(self, test_audio_metadata_files):
        """
        Test get brightness factor method.
        """

        for test_audio_file in test_audio_metadata_files:
            original_filename = os.path.basename(test_audio_file)
            metadata = SimpleMetadataExtractor().extract_id3_tags(
                test_audio_file, original_filename
            )
            print(metadata)

    def test_m4a_file_metadata_extraction(self, test_audio_metadata_files):
        """
        Test M4A file metadata extraction.
        """
        test_audio_file = (
            "/Users/alessandro/Music/Youtube/Music/Sea Power & Change - Mango.m4a"
        )
        original_filename = os.path.basename(
            "/Users/alessandro/Music/Youtube/Music/Sea Power & Change - Mango.m4a"
        )
        metadata = SimpleMetadataExtractor().extract_id3_tags(
            test_audio_file, original_filename
        )
        print(metadata)
        image = SimpleMetadataExtractor().extract_embedded_image(test_audio_file)
        assert image is not None


class TestDefaultId3TagsFallback:
    """
    Regression tests for the default_id3_tags fallback path (extract_id3_tags,
    when mutagen can't read the file at all -- File(file_path) returns None, or
    reading raises). Two bugs lived here:

    1. `if id3_tags.get("title") == "":` never caught a genuinely-missing title
       key (the tag-mapping loop only ever sets id3_tags[name] when a non-empty
       value was found, so a file with no title tag has no "title" key at all --
       id3_tags.get("title") is None, and None == "" is False). The filename
       fallback silently never fired for exactly the files that needed it most:
       ones with no ID3 tags whatsoever.
    2. `id3_tags = self.default_id3_tags` aliased the shared class-level dict
       instead of copying it, so the very next line's mutation
       (id3_tags["title"] = ...) wrote into the one dict every future request
       falls back to -- one file's title/artist could leak into another's
       under concurrent batch workers (analyze_audio_batch's ThreadPoolExecutor).
    """

    def test_missing_title_falls_back_to_filename(self):
        with patch("src.services.simple_metadata_extractor.File", return_value=None):
            result = SimpleMetadataExtractor().extract_id3_tags(
                "/fake/path.mp3", "Apache - Chok There (Bombay Mix Dub)"
            )
        assert result["id3_tags"]["title"] == "apache - chok there (bombay mix dub)"

    def test_consecutive_calls_do_not_share_state(self):
        extractor = SimpleMetadataExtractor()
        with patch("src.services.simple_metadata_extractor.File", return_value=None):
            first = extractor.extract_id3_tags("/fake/a.mp3", "First Song")
            second = extractor.extract_id3_tags("/fake/b.mp3", "Second Song")

        assert first["id3_tags"]["title"] == "first song"
        assert second["id3_tags"]["title"] == "second song"
        assert first["id3_tags"] is not second["id3_tags"]

    def test_class_level_default_is_never_mutated(self):
        pristine = dict(SimpleMetadataExtractor.default_id3_tags)
        with patch("src.services.simple_metadata_extractor.File", return_value=None):
            SimpleMetadataExtractor().extract_id3_tags("/fake/c.mp3", "Some Song")
        assert SimpleMetadataExtractor.default_id3_tags == pristine
