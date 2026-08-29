"""
Unit tests for the AnalysisResponseBuilder / feature() / build_classifications()
envelope helpers in src/services/analysis_response.py.
"""

import pytest

from src.services.analysis_response import (
    SCHEMA_VERSION,
    AnalysisResponseBuilder,
    build_classifications,
    feature,
)


class TestFeature:
    def test_none_value_returns_none(self):
        assert feature(None, "deam") is None

    def test_present_value_returns_entry(self):
        result = feature(0.69, "deam", confidence=0.9)
        assert result == {"value": 0.69, "confidence": 0.9, "source": "deam"}

    def test_confidence_defaults_to_none(self):
        result = feature(124.0, "tempo_cnn")
        assert result == {"value": 124.0, "confidence": None, "source": "tempo_cnn"}

    def test_falsy_but_not_none_value_is_kept(self):
        # 0.0 / False / "" are real values, not "missing" -- only None means missing.
        assert feature(0.0, "deam") == {"value": 0.0, "confidence": None, "source": "deam"}


class TestBuildClassifications:
    def test_empty_input_returns_empty_lists(self):
        result = build_classifications({})
        assert result == {
            "genre_styles": [],
            "genres": [],
            "styles": [],
            "instruments": [],
            "tags": [],
        }

    def test_none_input_returns_empty_lists(self):
        result = build_classifications(None)
        assert result["genre_styles"] == []
        assert result["genres"] == []
        assert result["styles"] == []

    def test_genre_styles_passed_through(self):
        genres = [
            {"genre": "Electronic", "style": "Deep House", "confidence": 0.62},
            {"genre": "Funk / Soul", "style": "Disco", "confidence": 0.18},
        ]
        result = build_classifications({"genres": genres})
        assert result["genre_styles"] == genres

    def test_styles_carry_their_genre(self):
        genres = [
            {"genre": "Electronic", "style": "Deep House", "confidence": 0.62},
            {"genre": "Funk / Soul", "style": "Disco", "confidence": 0.18},
        ]
        result = build_classifications({"genres": genres})
        assert result["styles"] == [
            {"style": "Deep House", "genre": "Electronic", "confidence": 0.62},
            {"style": "Disco", "genre": "Funk / Soul", "confidence": 0.18},
        ]

    def test_genres_collapse_by_max_confidence_not_sum(self):
        genres = [
            {"genre": "Electronic", "style": "Deep House", "confidence": 0.62},
            {"genre": "Electronic", "style": "Techno", "confidence": 0.40},
            {"genre": "Funk / Soul", "style": "Disco", "confidence": 0.18},
        ]
        result = build_classifications({"genres": genres})
        assert result["genres"] == [
            {"genre": "Electronic", "confidence": 0.62},
            {"genre": "Funk / Soul", "confidence": 0.18},
        ]

    def test_genres_ranked_descending(self):
        genres = [
            {"genre": "Jazz", "style": "Bebop", "confidence": 0.20},
            {"genre": "Rock", "style": "Prog Rock", "confidence": 0.80},
        ]
        result = build_classifications({"genres": genres})
        assert [g["genre"] for g in result["genres"]] == ["Rock", "Jazz"]

    def test_instruments_and_tags_passed_through(self):
        instruments = [{"instrument": "guitar", "confidence": 0.5}]
        tags = [{"tag": "energetic", "confidence": 0.3}]
        result = build_classifications({"instruments": instruments, "tags": tags})
        assert result["instruments"] == instruments
        assert result["tags"] == tags


class TestAnalysisResponseBuilder:
    def test_no_warnings_by_default(self):
        builder = AnalysisResponseBuilder()
        assert builder.warnings == []

    def test_add_warning_accumulates(self):
        builder = AnalysisResponseBuilder()
        builder.add_warning("deam", "failed", "boom")
        builder.add_warning("skey", "disabled")
        assert builder.warnings == [
            {"model": "deam", "reason": "failed", "detail": "boom"},
            {"model": "skey", "reason": "disabled", "detail": None},
        ]

    def test_add_warning_rejects_invalid_reason(self):
        builder = AnalysisResponseBuilder()
        with pytest.raises(ValueError):
            builder.add_warning("deam", "not_a_real_reason")

    def test_build_success_shape(self):
        builder = AnalysisResponseBuilder()
        builder.add_warning("skey", "disabled")
        result = builder.build(
            status="success",
            message="ok",
            processing_time=1.23,
            track={"filename": "x.mp3"},
            audio={"sample_rate": 44100},
            tags={"artist": "a"},
            features={"tempo": {"value": 120.0, "confidence": None, "source": "tempo_cnn"}},
            labels={"valence_mood": "positive"},
            classifications={"genre_styles": [], "genres": [], "styles": [], "instruments": [], "tags": []},
            embedding={"vector": [0.1], "dim": 1, "source": "discogs_effnet"},
        )
        assert result["status"] == "success"
        assert result["schema_version"] == SCHEMA_VERSION
        assert result["processing_mode"] == "simple"
        assert result["warnings"] == [{"model": "skey", "reason": "disabled", "detail": None}]
        assert result["track"] == {"filename": "x.mp3"}
        assert result["features"]["tempo"]["value"] == 120.0

    def test_build_error_has_matching_top_level_keys(self):
        builder = AnalysisResponseBuilder()
        builder.add_warning("deam", "failed", "crashed")
        result = builder.build_error(message="boom", processing_time=0.5)
        success_result = builder.build(
            status="success",
            message="ok",
            processing_time=0.5,
            track={},
            audio={},
            tags={},
            features={},
            labels={},
            classifications={},
            embedding=None,
        )
        assert set(result.keys()) == set(success_result.keys())
        assert result["status"] == "error"
        assert result["audio"] is None
        assert result["tags"] is None
        assert result["embedding"] is None
        assert result["features"] == {}
        assert result["classifications"]["genres"] == []

    def test_two_builders_do_not_share_warnings(self):
        # Regression guard: warnings must be per-instance, not a class-level list.
        a = AnalysisResponseBuilder()
        b = AnalysisResponseBuilder()
        a.add_warning("deam", "failed", "x")
        assert b.warnings == []
