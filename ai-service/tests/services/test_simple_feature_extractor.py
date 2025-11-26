"""
API tests for SimpleAnalysisResource post method.

This module tests the POST endpoint functionality of the SimpleAnalysisResource
using a real audio file to ensure proper processing and response format.
"""

import json

from src.services.simple_audio_loader import SimpleAudioLoader
from src.services.simple_feature_extractor import SimpleFeatureExtractor


class TestSimpleFeatureExtractor:
    audio_loader = SimpleAudioLoader()
    """Test SimpleFeatureExtractor class."""

    def test_extract_basic_features(self, test_audio_files):
        """Test extract_basic_features method directly."""

        audio_file = test_audio_files[0]

        # Load audio sample for feature extraction (limit to 60 seconds to avoid memory issues)
        y_h, sr = self.audio_loader.load_audio_sample(
            audio_file["filename"],
            sample_duration=audio_file["harmonic_metadata"]["duration"],
            skip_intro=audio_file["harmonic_metadata"]["start_time"],
        )
        y_p, sr = self.audio_loader.load_audio_sample(
            audio_file["filename"],
            sample_duration=audio_file["percussive_metadata"]["duration"],
            skip_intro=audio_file["percussive_metadata"]["start_time"],
        )
        y_bpm, sr = self.audio_loader.load_audio_sample(
            audio_file["filename"],
            sample_duration=audio_file["bpm_metadata"]["duration"],
            skip_intro=audio_file["bpm_metadata"]["start_time"],
        )
        features = SimpleFeatureExtractor().extract_basic_features(
            y_h, y_p, y_bpm, audio_file["bpm_metadata"], sr, audio_file["filename"]
        )

        features_data = features["features"]

        # features {'features': {'musical_features': {'valence': 0.579, 'mood_calculation': {'mode_factor': 0.3, 'mode_confidence': 0.4657960114418008, 'mode_weight': 0.06986940171627011, 'tempo_factor': 0.523, 'energy_factor': 0.731677194556608, 'brightness_factor': 0.46601025390625, 'harmonic_factor': 0.8506930470466614, 'spectral_balance': 0.5676293762106366, 'beat_strength': 0.584, 'syncopation': 0.867075976548886}, 'valence_mood': 'positive', 'arousal': 0.601, 'arousal_mood': 'energetic', 'danceability': 0.754, 'danceability_feeling': 'highly-danceable', 'danceability_calculation': {'rhythm_stability': 0.8, 'bass_presence': 1.0, 'tempo_regularity': 0.7867087322310683, 'tempo_appropriateness': 0.9, 'energy_factor': 0.731677194556608, 'syncopation': 0.867075976548886, 'beat_strength': 0.584}, 'acousticness': 0.0, 'instrumentalness': 1.0, 'speechiness': 0.067, 'liveness': 0.666, 'energy_comment': 'Subdued energy profile - warm and mellow character', 'energy_keywords': ['subdued', 'warm', 'mellow', 'gentle', 'soft'], 'tempo': 122.3, 'key': 'G major', 'camelot_key': '9B'}, 'spectral_features': {'spectral_centroids': {'mean': 3063.056396484375, 'std': 1062.0592041015625, 'median': 3095.420166015625, 'min': 269.8067932128906, 'max': 4669.2001953125, 'p25': 2181.2626953125, 'p75': 3644.19287109375}, 'spectral_bandwidths': {'mean': 181100.09375, 'std': 54613.078125, 'median': 157860.0, 'min': 28998.255859375, 'max': 283387.3125, 'p25': 122054.859375, 'p75': 197977.15625}, 'spectral_spreads': {'mean': 3313.806640625, 'std': 618.0330810546875, 'median': 3383.49755859375, 'min': 985.8890991210938, 'max': 4332.2236328125, 'p25': 3076.7666015625, 'p75': 3549.647705078125}, 'spectral_flatnesses': {'mean': 0.05225743353366852, 'std': 0.01851702854037285, 'median': 0.05063846334815025, 'min': 0.0025843505281955004, 'max': 0.09506034851074219, 'p25': 0.03715762495994568, 'p75': 0.06015115976333618}, 'spectral_rolloffs': {'mean': 6334.6044921875, 'std': 1957.433837890625, 'median': 6773.4375, 'min': 82.03125, 'max': 8132.8125, 'p25': 5578.125, 'p75': 7160.15625}, 'zero_crossing_rate': {'mean': 0.033497899770736694, 'std': 0.02934836782515049, 'median': 0.02685546875, 'max': 0.1455078125, 'min': 0.0009765625, 'p25': 0.01123046875, 'p75': 0.0458984375}, 'rms': {'mean': 0.10282821208238602, 'std': 0.05236225575208664, 'median': 0.10114243626594543, 'max': 0.2245831936597824, 'min': 0.007597688119858503, 'p25': 0.05783608555793762, 'p75': 0.151434987783432}, 'energy_by_band': [3.3160994052886963, 0.2589952051639557, 0.02179202251136303], 'energy_ratios': [0.9219360362648027, 0.07200538454294586, 0.006058579192251414], 'mfcc_mean': [19.004013061523438, -1.1897451877593994, -0.015458380803465843, -0.7644794583320618, -0.35542213916778564, -0.2126329094171524, -0.2561054229736328, -0.2558879554271698, -0.13668113946914673, -0.18688534200191498, -0.07961376756429672, -0.12351533770561218, -0.11412735283374786]}, 'rhythm_fingerprint': {'beat_count': 0, 'zcr_mean': 0.033497899770736694, 'zcr_std': 0.02934836782515049, 'rhythm_density': 0}, 'melodic_fingerprint': {'chroma': {'mean': [0.5402919054031372, 0.43712687492370605, 0.4328685998916626, 0.46904024481773376, 0.54231196641922, 0.6172174215316772, 0.6509765386581421, 0.6160802245140076, 0.581602156162262, 0.6784427165985107, 0.6781572699546814, 0.5481587052345276], 'std': [0.2582840919494629, 0.23967956006526947, 0.27899810671806335, 0.25915151834487915, 0.26912742853164673, 0.29134446382522583, 0.310529500246048, 0.29363736510276794, 0.24536050856113434, 0.252210795879364, 0.2620457112789154, 0.20395059883594513], 'max': [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0], 'overall_mean': 0.5660228729248047, 'overall_std': 0.27783191204071045, 'dominant_pitch': 9}, 'tonnetz': {'mean': [1.1563721234651914, 1.111311298345795, 1.0904707036230776, 1.1575092770061106, 1.0489488380469432, 1.220754655062139], 'std': [0.3651892650079122, 0.37030664680752334, 0.34299387750415233, 0.35074355516531114, 0.39986618730810114, 0.4100173747531999], 'max': [1.9845554828643799, 1.9596142768859863, 1.8038439750671387, 1.954599380493164, 1.9627933502197266, 1.9984619617462158], 'overall_mean': 1.1308944825915428, 'overall_std': 0.3780053457575689}}}}
        assert "musical_features" in features_data
        assert "spectral_features" in features_data
        assert "rhythm_fingerprint" in features_data
        assert "melodic_fingerprint" in features_data
        musical_features = features_data["musical_features"]
        assert "tempo" in musical_features
        assert "key" in musical_features
        assert "camelot_key" in musical_features
        assert "valence" in musical_features
        assert "danceability" in musical_features
        assert "acousticness" in musical_features
        assert "instrumentalness" in musical_features
        assert "speechiness" in musical_features
        assert "liveness" in musical_features
        assert "energy_comment" in musical_features
        assert "energy_keywords" in musical_features

        spectral_features = features_data["spectral_features"]
        for spectral_feature in [
            "spectral_centroids",
            "spectral_rolloffs",
            "spectral_bandwidths",
            "spectral_spreads",
            "spectral_flatnesses",
            "zero_crossing_rate",
            "rms",
        ]:
            assert spectral_feature in spectral_features
            for key in ["mean", "std", "median", "min", "max", "p25", "p75"]:
                assert key in spectral_features[spectral_feature]

        assert "energy_by_band" in spectral_features
        assert len(spectral_features["energy_by_band"]) == 3
        assert "energy_ratios" in spectral_features
        assert len(spectral_features["energy_ratios"]) == 3
        assert "mfcc_mean" in spectral_features
        assert len(spectral_features["mfcc_mean"]) == 13
        rhythm_fingerprint = features_data["rhythm_fingerprint"]
        assert "zcr_mean" in rhythm_fingerprint
        assert "zcr_std" in rhythm_fingerprint
        melodic_fingerprint = features_data["melodic_fingerprint"]
        assert "chroma" in melodic_fingerprint
        assert len(melodic_fingerprint["chroma"]["mean"]) == 12
        assert len(melodic_fingerprint["chroma"]["std"]) == 12
        assert len(melodic_fingerprint["chroma"]["max"]) == 12
        assert "overall_mean" in melodic_fingerprint["chroma"]
        assert "overall_std" in melodic_fingerprint["chroma"]
        assert "dominant_pitch" in melodic_fingerprint["chroma"]
        assert "tonnetz" in melodic_fingerprint
        assert len(melodic_fingerprint["tonnetz"]["mean"]) == 6
        assert len(melodic_fingerprint["tonnetz"]["std"]) == 6
        assert len(melodic_fingerprint["tonnetz"]["max"]) == 6
        assert "overall_mean" in melodic_fingerprint["tonnetz"]
        assert "overall_std" in melodic_fingerprint["tonnetz"]
