"""
API tests for SimpleAnalysisResource post method.

This module tests the POST endpoint functionality of the SimpleAnalysisResource
using a real audio file to ensure proper processing and response format.
"""

from src.services.simple_feature_extractor import SimpleFeatureExtractor


class TestSimpleFeatureExtractor:
    """Test SimpleFeatureExtractor class."""

    def test_extract_basic_features(self, test_audio_files):
        """Test extract_basic_features method directly."""

        audio_file = test_audio_files[0]

        # discogs_classifiers/discogs_tempo/discogs_deam/discogs_skey are computed
        # upstream in SimpleAnalysisService (see simple_analysis.py) and passed in;
        # a plain unit test of extract_basic_features stubs them with representative
        # values rather than running the full discogs-effnet/TempoCNN/DEAM/S-KEY
        # pipelines. extract_basic_features no longer takes any raw audio samples --
        # tempo/key/mood/danceability all come from the discogs_*/ai_* args instead
        # of the retired audioFlux shared-feature extraction.
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
        features = SimpleFeatureExtractor().extract_basic_features(
            audio_file["filename"],
            discogs_classifiers,
            discogs_tempo,
            discogs_deam,
            discogs_skey,
        )

        features_data = features["features"]

        # {'features': {'musical_features': {'valence': 0.58, 'valence_mood': 'positive',
        # 'arousal': 0.6, 'arousal_mood': 'energetic', 'danceability': 0.75,
        # 'danceability_feeling': 'danceable', 'instrumentalness': 1.0, 'mode': 'minor',
        # 'tempo': 122.3, 'camelot_key': '12A'}}}
        # spectral_features/rhythm_fingerprint/melodic_fingerprint (raw audioFlux
        # output, no discogs-effnet analog) and tempo_source/key (redundant with
        # discogs_tempo/discogs_skey) were dropped from the response per explicit
        # decision to shrink the /audio/analyze/simple response shape.
        assert "musical_features" in features_data
        assert "spectral_features" not in features_data
        assert "rhythm_fingerprint" not in features_data
        assert "melodic_fingerprint" not in features_data

        musical_features = features_data["musical_features"]
        assert "tempo" in musical_features
        assert "camelot_key" in musical_features
        assert "key" not in musical_features
        assert "tempo_source" not in musical_features
        assert "valence" in musical_features
        assert "valence_mood" in musical_features
        assert "arousal" in musical_features
        assert "arousal_mood" in musical_features
        assert "danceability" in musical_features
        assert "danceability_feeling" in musical_features
        assert "mode" in musical_features
        # acousticness/speechiness/liveness were retired along with the hand-computed
        # heuristics that produced them (no discogs-effnet equivalent, per explicit
        # decision -- see the ai-service cleanup plan). instrumentalness now comes
        # from the voice/instrumental classifier (1 - voice probability) instead.
        assert "instrumentalness" in musical_features
        assert "energy_comment" not in musical_features
        assert "energy_keywords" not in musical_features
