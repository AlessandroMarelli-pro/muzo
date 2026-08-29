"""
Accuracy regression test for TempoCnnExtractor, replacing the retired
EnhancedAdaptiveBPMDetector's test_bpm_detection.py (deleted along with the
detector itself -- see the ai-service cleanup plan). TempoCNN is a single
opaque model call (no chunking/octave-folding/offset-sensitivity API like the
old heuristic detector had), so this only asserts aggregate accuracy against
ground truth, matching test_bpm_detection.py's original assertion style
rather than reproducing its now-inapplicable per-chunk/offset-stability tests.

Mirrors the real pipeline's usage (SimpleAnalysisService.generate_tempo_cnn):
TempoCNN needs the full track, not a short excerpt, to get a reliable
majority-vote result -- confirmed earlier this session that a 10s excerpt
produces unreliable/zero tempo due to tied votes.
"""

from src.services.features.tempo_cnn_extractor import TempoCnnExtractor
from src.services.simple_audio_loader import SimpleAudioLoader


class TestTempoCnn:
    audio_loader = SimpleAudioLoader()
    tempo_cnn_extractor = TempoCnnExtractor()

    def test_tempo_accuracy(self, test_audio_files):
        """
        Run TempoCNN against each fixture's full track and compare against its
        ground-truth `tempo`, allowing for octave (half/double) matches since
        that's a legitimate, musically-known ambiguity -- same tolerance
        pattern as the retired detector's tests used.
        """
        results = []
        correct = []
        incorrect = []

        for track in test_audio_files:
            y, sr = self.audio_loader.load_audio_sample(
                track["filename"], sample_duration=None
            )
            result = self.tempo_cnn_extractor.extract_from_audio(y, sr)
            bpm = result.get("tempo", 0.0)
            truth = track["tempo"]

            entry = {"filename": track["filename"], "tempo": bpm, "expected": truth}
            results.append(entry)

            if abs(bpm - truth) < 3 or abs(bpm / 2 - truth) < 3 or abs(bpm * 2 - truth) < 3:
                correct.append(entry)
            else:
                incorrect.append(entry)

        print(results)
        print("incorrect:", incorrect)

        # Loose sanity bound, not a strict accuracy benchmark -- catches a
        # broken pipeline (wrong sample rate, model failing to load) without
        # being a tight assertion on model accuracy itself.
        assert len(correct) / len(results) > 0.7, (
            "More than 70% of TempoCNN results should be correct (exact or octave match)"
        )
