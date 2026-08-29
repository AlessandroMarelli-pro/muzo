"""
Unit tests for SimpleFeatureExtractor.

extract_basic_features() derives interpreted musical features from model outputs
computed upstream in SimpleAnalysisService (discogs_classifiers/discogs_tempo/
discogs_deam/discogs_skey) -- these tests stub those with representative values
rather than running the full discogs-effnet/TempoCNN/DEAM/S-KEY pipelines.
"""

from src.services.simple_feature_extractor import SimpleFeatureExtractor


class TestSimpleFeatureExtractor:
    """Test SimpleFeatureExtractor class."""

    def test_extract_basic_features(self):
        """All source models present -> every value and label populated."""
        discogs_classifiers = {
            "danceable": 0.75,
            "mood_happy": 0.6,
            "mood_sad": 0.1,
            "mood_relaxed": 0.5,
            "mood_aggressive": 0.1,
            "mood_party": 0.3,
            "voice": 0.0,
        }
        discogs_tempo = {"tempo": 122.3, "confidence": 0.8}
        discogs_deam = {"valence": 0.58, "arousal": 0.6}
        discogs_skey = {"key": "C# minor", "tonic": "C#", "mode": "minor"}

        result = SimpleFeatureExtractor().extract_basic_features(
            "irrelevant.mp3",
            discogs_classifiers,
            discogs_tempo,
            discogs_deam,
            discogs_skey,
        )

        assert "musical" in result
        assert "labels" in result

        musical = result["musical"]
        assert musical["tempo"] == 122.3
        assert musical["tempo_confidence"] == 0.8
        assert musical["key"] == "C# minor"
        assert musical["camelot_key"] == "12A"
        assert musical["mode"] == "minor"
        assert musical["valence"] == 0.58
        assert musical["arousal"] == 0.6
        assert musical["danceability"] == 0.75
        assert musical["instrumentalness"] == 1.0  # 1 - voice(0.0)

        labels = result["labels"]
        # valence 0.58 falls in [0.40, 0.60) -> "neutral"; arousal 0.6 and
        # danceability 0.75 both hit their tier's ">=" threshold exactly.
        assert labels["valence_mood"] == "neutral"
        assert labels["arousal_mood"] == "energetic"
        assert labels["danceability_feeling"] == "highly-danceable"

        # Retired heuristics stay gone -- no spectral/rhythm/melodic fingerprints,
        # no acousticness/speechiness/liveness, no neutral-filled tempo_source/key.
        assert "spectral_features" not in musical
        assert "rhythm_fingerprint" not in musical
        assert "melodic_fingerprint" not in musical
        assert "acousticness" not in musical
        assert "speechiness" not in musical
        assert "liveness" not in musical

    def test_disabled_models_yield_none_not_fallback(self):
        """
        All source models disabled (empty dicts, as generate_*() returns when
        DISCOGS_CLASSIFIERS_ENABLED is false) -> every derived value is None, never
        a neutral placeholder like valence=0.5, tempo=0.0, or key="Unknown".
        """
        result = SimpleFeatureExtractor().extract_basic_features(
            "irrelevant.mp3", {}, {}, {}, {}
        )

        musical = result["musical"]
        assert musical["tempo"] is None
        assert musical["tempo_confidence"] is None
        assert musical["key"] is None
        assert musical["camelot_key"] is None
        assert musical["mode"] is None
        assert musical["valence"] is None
        assert musical["arousal"] is None
        assert musical["danceability"] is None
        assert musical["instrumentalness"] is None

        labels = result["labels"]
        assert labels["valence_mood"] is None
        assert labels["arousal_mood"] is None
        assert labels["danceability_feeling"] is None

    def test_partial_model_availability(self):
        """Only some source models produced values -> only those fields populate;
        the rest stay None rather than being backfilled from a default."""
        discogs_tempo = {"tempo": 128.0, "confidence": 0.5}
        # classifiers/deam/skey all empty (disabled/failed/empty)
        result = SimpleFeatureExtractor().extract_basic_features(
            "irrelevant.mp3", {}, discogs_tempo, {}, {}
        )

        musical = result["musical"]
        assert musical["tempo"] == 128.0
        assert musical["valence"] is None
        assert musical["danceability"] is None
        assert musical["key"] is None

    def test_unknown_key_not_in_camelot_wheel_yields_none(self):
        """A key string S-KEY produced but that isn't in the camelot lookup table
        maps to None, not the old 'Unknown' string placeholder."""
        discogs_skey = {"key": "Not A Real Key", "tonic": "X", "mode": "major"}
        result = SimpleFeatureExtractor().extract_basic_features(
            "irrelevant.mp3", {}, {}, {}, discogs_skey
        )
        assert result["musical"]["camelot_key"] is None
        assert result["musical"]["key"] == "Not a real key"
