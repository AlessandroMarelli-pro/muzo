"""
Regression harness for EnhancedAdaptiveBPMDetector flakiness.

Unlike test_bpm_detection.py's single aggregate-ratio assertion (which cannot
catch a single-track regression), this module asserts per-track correctness
and explicitly measures offset stability: how much the reported BPM changes
when the analysis start offset shifts by a second or two. That sensitivity,
not randomness, is the actual source of "flaky" BPM in production, since the
upstream segment scorer (SimpleAudioLoader.smart_audio_sample_loading) picks
the start offset from content-dependent scoring that can shift between runs.
"""

import pytest

from src.services.enhanced_adaptive_bpm_detector import EnhancedAdaptiveBPMDetector

# Tracks known (as of the pre-fix baseline) to disagree with ground truth even
# at the tuned offset. Kept as an explicit list so a fix that repairs them
# shows up as a visible test change instead of silently raising the bar.
KNOWN_FAILING_TRACKS = {
    "Alexander Cherdron - Caribbean",
    "OCB - Corporate Sound",
}

OFFSET_SWEEP = (-2, -1, 0, 1, 2)
EXACT_TOLERANCE_BPM = 3.0
STABILITY_TOLERANCE_BPM = 3.0


def _is_octave_match(bpm: float, truth: float, tolerance: float = EXACT_TOLERANCE_BPM) -> str:
    """Classify bpm against truth. Returns 'exact', 'half', 'double', or 'wrong'."""
    if abs(bpm - truth) < tolerance:
        return "exact"
    if abs(bpm * 2 - truth) < tolerance:
        return "half"  # detected half of the true tempo
    if abs(bpm / 2 - truth) < tolerance:
        return "double"  # detected double the true tempo
    return "wrong"


def _short_name(filename: str) -> str:
    import os

    return os.path.splitext(os.path.basename(filename))[0]


class TestBpmPerTrackAccuracy:
    """Per-track assertions so a single regression fails CI, unlike the ratio test."""

    bpm_detector = EnhancedAdaptiveBPMDetector()

    def test_each_track_is_correct_or_known_failing(self, test_audio_files):
        regressions = []
        for track in test_audio_files:
            name = _short_name(track["filename"])
            bpm, _, _ = self.bpm_detector.detect_bpm_from_file(
                track["filename"], track["bpm_metadata"]
            )
            classification = _is_octave_match(bpm, track["tempo"])
            is_known_failure = any(k in name for k in KNOWN_FAILING_TRACKS)

            if classification == "wrong" and not is_known_failure:
                regressions.append(
                    f"{name}: truth={track['tempo']}, got={bpm} (not a known failure)"
                )
            if classification != "wrong" and is_known_failure:
                # A previously-failing track now passes: not a bug, but flag it
                # so KNOWN_FAILING_TRACKS gets updated instead of silently
                # masking future regressions on the same track.
                regressions.append(
                    f"{name}: now classified '{classification}' (truth={track['tempo']}, "
                    f"got={bpm}) but is listed in KNOWN_FAILING_TRACKS -- remove it"
                )

        assert not regressions, "Per-track accuracy regressions:\n" + "\n".join(regressions)


class TestBpmOffsetStability:
    """
    The core flakiness metric: does a +/-2s shift in analysis start offset
    change the reported BPM? Upstream segment scoring can select a slightly
    different start_time between runs (ties, near-ties, re-scoring after a
    file change), so the detector must be robust to small offset changes.
    """

    bpm_detector = EnhancedAdaptiveBPMDetector()

    def _bpm_at_offsets(self, filename: str, bpm_metadata: dict):
        base_start = bpm_metadata["start_time"]
        results = {}
        for delta in OFFSET_SWEEP:
            metadata = dict(bpm_metadata)
            metadata["start_time"] = max(0, base_start + delta)
            bpm, strength, _ = self.bpm_detector.detect_bpm_from_file(filename, metadata)
            results[delta] = bpm
        return results

    def test_offset_sweep_agrees_within_tolerance(self, test_audio_files):
        """
        Strict signal: the exact reported BPM should not move under a small
        offset shift. This is what a user actually sees, so octave flips
        count as instability here even though normalize_bpm would consider
        them the "same" tempo class -- reporting 165 one run and 83 the next
        is a materially different displayed answer.
        """
        unstable = []
        for track in test_audio_files:
            name = _short_name(track["filename"])
            offsets = self._bpm_at_offsets(track["filename"], track["bpm_metadata"])
            values = list(offsets.values())
            spread = max(values) - min(values)
            if spread > STABILITY_TOLERANCE_BPM:
                unstable.append(f"{name}: spread={spread:.1f} BPM, values={offsets}")

        assert not unstable, (
            f"{len(unstable)}/{len(test_audio_files)} tracks unstable under "
            f"+/-{max(OFFSET_SWEEP)}s offset shift:\n" + "\n".join(unstable)
        )

    def test_offset_sweep_octave_class_is_stable(self, test_audio_files):
        """
        Looser signal: even allowing for octave ambiguity (a legitimate,
        musically-known hard problem), the *folded* BPM should still agree
        across a small offset shift. A failure here means the underlying
        tempo estimate itself is unstable, not just its octave presentation.
        """
        unstable = []
        for track in test_audio_files:
            name = _short_name(track["filename"])
            offsets = self._bpm_at_offsets(track["filename"], track["bpm_metadata"])
            folded = {
                delta: self.bpm_detector.normalize_bpm(bpm)
                for delta, bpm in offsets.items()
            }
            values = list(folded.values())
            spread = max(values) - min(values)
            if spread > STABILITY_TOLERANCE_BPM:
                unstable.append(f"{name}: folded_spread={spread:.1f} BPM, folded={folded}")

        assert not unstable, (
            f"{len(unstable)}/{len(test_audio_files)} tracks octave-unstable "
            f"under +/-{max(OFFSET_SWEEP)}s offset shift:\n" + "\n".join(unstable)
        )

    def test_offset_sweep_does_not_flip_correctness(self, test_audio_files):
        """
        Weaker than exact-agreement: even if the BPM value itself moves a bit,
        it should not cross from correct to incorrect (or vice versa) as the
        offset shifts. A flip here means an octave jump or branch switch.
        """
        flips = []
        for track in test_audio_files:
            name = _short_name(track["filename"])
            if any(k in name for k in KNOWN_FAILING_TRACKS):
                continue  # already known wrong; flipping among wrong values isn't a new bug
            offsets = self._bpm_at_offsets(track["filename"], track["bpm_metadata"])
            classifications = {
                delta: _is_octave_match(bpm, track["tempo"]) for delta, bpm in offsets.items()
            }
            correctness = {delta: (c != "wrong") for delta, c in classifications.items()}
            if len(set(correctness.values())) > 1:
                flips.append(f"{name}: truth={track['tempo']}, per-offset={offsets}")

        assert not flips, "Correctness flips under small offset shifts:\n" + "\n".join(flips)


class TestBpmChunkAgreement:
    """
    Measures how much the 5 chunks within a single detect_bpm_from_file call
    disagree with each other. High spread means aggregation is essentially
    picking one arbitrary chunk rather than finding real consensus.
    """

    bpm_detector = EnhancedAdaptiveBPMDetector()

    # Generous ceiling: this is a diagnostic regression guard, not a tight
    # bound. Ratchet down as aggregation/hop-length fixes land.
    MAX_ACCEPTABLE_MEDIAN_SPREAD_BPM = 20.0

    def test_chunk_spread_is_bounded(self, test_audio_files):
        import statistics

        spreads = []
        for track in test_audio_files:
            _, _, chunk_results = self.bpm_detector.detect_bpm_from_file(
                track["filename"], track["bpm_metadata"]
            )
            # Fold to the canonical octave before measuring spread: an octave
            # doubling on one chunk (e.g. 82.7 vs 165.4) is exactly what
            # clustering is designed to reconcile, and it does -- the final
            # aggregated BPM is correct in those cases. Measuring raw,
            # unfolded spread would penalize a working octave-fold as if it
            # were disagreement.
            folded_bpms = [
                self.bpm_detector.normalize_bpm(r["bpm"]) for r in chunk_results
            ]
            if len(folded_bpms) >= 2:
                spreads.append(max(folded_bpms) - min(folded_bpms))

        assert spreads, "No tracks produced multiple chunks"
        median_spread = statistics.median(spreads)
        assert median_spread <= self.MAX_ACCEPTABLE_MEDIAN_SPREAD_BPM, (
            f"Median folded chunk spread {median_spread:.1f} BPM exceeds "
            f"{self.MAX_ACCEPTABLE_MEDIAN_SPREAD_BPM} BPM ceiling. All spreads: {spreads}"
        )
