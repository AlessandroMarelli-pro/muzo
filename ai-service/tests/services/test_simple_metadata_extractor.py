"""
API tests for SimpleAnalysisResource post method.

This module tests the POST endpoint functionality of the SimpleAnalysisResource
using a real audio file to ensure proper processing and response format.
"""

import json
import os
from unittest.mock import MagicMock, patch

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


class TestSplitCleanedFilename:
    """_split_cleaned_filename must not promote a vinyl side marker to artist."""

    def _extractor(self):
        return SimpleMetadataExtractor(filename_parser=None)

    def test_side_marker_is_not_the_artist(self):
        result = self._extractor()._split_cleaned_filename(
            "A - Circulation - Purple (Mix 1)"
        )
        assert result["artist"] == "Circulation"
        assert result["title"] == "Purple (Mix 1)"

    def test_side_marker_without_artist_leaves_artist_empty(self):
        # Must not fall through to the parser, which would restore "A4".
        result = self._extractor()._split_cleaned_filename("A4 - Hypnotised")
        assert result["artist"] == ""
        assert result["title"] == "Hypnotised"

    def test_short_real_artist_is_preserved(self):
        result = self._extractor()._split_cleaned_filename("Sade - Smooth Operator")
        assert result["artist"] == "Sade"
        assert result["title"] == "Smooth Operator"

    def test_trailing_year_still_extracted(self):
        result = self._extractor()._split_cleaned_filename("Artist - Title (1979)")
        assert result["title"] == "Title"
        assert result["year"] == "1979"

    def test_catalog_and_genre_junk_stripped(self):
        result = self._extractor()._split_cleaned_filename(
            "Up To Date - Shadows (House) [BV3013]"
        )
        assert result["artist"] == "Up To Date"
        assert result["title"] == "Shadows"


class TestYouTubeArtistCorrection:
    """The YouTube branch overwrote a real ID3 artist with a side marker."""

    def _tags_for(self, tmp_path, title, artist):
        path = tmp_path / "youtube" / "track.opus"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(b"fake audio")

        audio = MagicMock()
        audio.__bool__ = lambda self: True
        audio.info = MagicMock(bitrate=128000)

        extractor = SimpleMetadataExtractor(filename_parser=None)
        tag_values = {"title": title, "artist": artist, "purl": "https://youtube.com/x"}
        extractor.safe_get_tag_value = lambda af, key: tag_values.get(key)
        extractor.safe_string_conversion = lambda v: str(v)
        extractor.extract_embedded_image = lambda *a, **k: None

        with patch("src.services.simple_metadata_extractor.File", return_value=audio):
            return extractor.extract_id3_tags(str(path), "track.opus")["id3_tags"]

    def test_side_marker_does_not_replace_the_real_artist(self, tmp_path):
        tags = self._tags_for(
            tmp_path, "A - Circulation - Purple (Mix 1)", "SecretSquizza"
        )
        assert tags["artist"] == "circulation"
        assert tags["artist"] != "a"
        assert tags["title"] == "purple (mix 1)"

    def test_marker_only_title_keeps_existing_artist(self, tmp_path):
        # "A4 - Hypnotised" has no artist to offer, so the ID3 artist stands
        # untouched (only the replacement path lowercases).
        tags = self._tags_for(tmp_path, "A4 - Hypnotised", "Real Artist")
        assert tags["artist"] == "Real Artist"
        assert tags["title"] == "hypnotised"
