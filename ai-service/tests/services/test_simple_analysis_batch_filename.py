"""
Regression tests for track.original_filename in the batch analysis path.

Bug: audio-scan-scheduler-consumer.adapter.ts (backend) joins ai-service batch
results back to DB tracks by filename equality. But analyze_audio_batch cleans
filenames via the Gemini filename cleaner *before* passing them into
_analyze_single_file_in_batch, which stamps the *cleaned* name into
track.filename (e.g. "014. Some Track.flac" -> "Some Track"). Any consumer
joining on track.filename against the raw upload name will silently fail to
match whenever cleaning changed anything -- which was happening for most files.

Fix: track.original_filename always carries the exact upload filename, never
rewritten by cleaning, so a stable join key exists independent of filename's
role as a display value.
"""

from unittest.mock import MagicMock, patch

from src.services.simple_analysis import SimpleAnalysisService


def _make_service_with_stub_models():
    """A SimpleAnalysisService with every model extractor stubbed to return
    empty/no-op results, so tests run fast and don't touch real models."""
    service = SimpleAnalysisService.__new__(SimpleAnalysisService)
    service.filename_parser = MagicMock()
    service.audio_loader = MagicMock()
    service.audio_loader.load_audio_sample.return_value = ([0.0] * 100, 16000)
    service.metadata_extractor = MagicMock()
    service.technical_analyzer = MagicMock()
    service.feature_extractor = MagicMock()
    service.feature_extractor.extract_basic_features.return_value = {
        "musical": {},
        "labels": {},
    }
    service.embedding_extractor = MagicMock()
    service.embedding_extractor.extract_from_audio.return_value = []
    service.classifiers_extractor = MagicMock()
    service.classifiers_extractor.predict_all.return_value = {}
    service.tempo_cnn_extractor = MagicMock()
    service.tempo_cnn_extractor.extract_from_audio.return_value = {}
    service.deam_extractor = MagicMock()
    service.deam_extractor.extract_from_audio.return_value = {}
    service.skey_extractor = MagicMock()
    service.skey_extractor.extract_from_audio.return_value = {}
    service.ai_extractor = None  # filename cleaning unavailable in these tests
    service.analysis_count = 0
    service.gc_interval = 10
    service.batch_audio_workers = 1
    return service


class TestBatchOriginalFilename:
    def test_single_file_in_batch_preserves_raw_filename(self, tmp_path):
        service = _make_service_with_stub_models()
        audio_path = tmp_path / "track.mp3"
        audio_path.write_bytes(b"fake audio")

        service.metadata_extractor.extract_file_metadata.return_value = {
            "file_info": {
                "filename": "cleaned name",
                "file_extension": ".mp3",
                "mime_type": "audio/mpeg",
                "file_size_bytes": 10,
                "file_size_mb": 0.01,
            }
        }
        service.technical_analyzer.extract_audio_technical.return_value = {
            "audio_technical": {
                "sample_rate": 44100,
                "duration_seconds": 1.0,
                "format": "cd quality",
                "bitrate": 320000,
                "channels": 2,
                "samples": 100,
                "bit_depth": 16,
                "subtype": "MPEG",
            }
        }
        service.metadata_extractor.extract_id3_tags.return_value = {"id3_tags": {}}

        file_result, ok = service._analyze_single_file_in_batch(
            0,
            str(audio_path),
            "cleaned name",  # already-cleaned display name (simulating the LLM step)
            1,
            10.0,
            30.0,
            None,
            None,
            raw_filename="014. Original Upload Name.mp3",
        )

        assert ok is True
        assert file_result["track"]["filename"] == "cleaned name"
        assert (
            file_result["track"]["original_filename"]
            == "014. Original Upload Name.mp3"
        )

    def test_raw_filename_defaults_to_original_filename_when_not_cleaned(
        self, tmp_path
    ):
        """When the caller doesn't pass raw_filename (e.g. cleaning was skipped
        upstream), original_filename falls back to original_filename itself --
        still correct since nothing rewrote it in that case."""
        service = _make_service_with_stub_models()
        audio_path = tmp_path / "track.mp3"
        audio_path.write_bytes(b"fake audio")

        service.metadata_extractor.extract_file_metadata.return_value = {
            "file_info": {
                "filename": "Some Track.mp3",
                "file_extension": ".mp3",
                "mime_type": "audio/mpeg",
                "file_size_bytes": 10,
                "file_size_mb": 0.01,
            }
        }
        service.technical_analyzer.extract_audio_technical.return_value = {
            "audio_technical": {
                "sample_rate": 44100,
                "duration_seconds": 1.0,
                "format": "cd quality",
                "bitrate": 320000,
                "channels": 2,
                "samples": 100,
                "bit_depth": 16,
                "subtype": "MPEG",
            }
        }
        service.metadata_extractor.extract_id3_tags.return_value = {"id3_tags": {}}

        file_result, ok = service._analyze_single_file_in_batch(
            0,
            str(audio_path),
            "Some Track.mp3",
            1,
            10.0,
            30.0,
            None,
            None,
            # raw_filename omitted
        )

        assert ok is True
        assert file_result["track"]["original_filename"] == "Some Track.mp3"

    def test_error_path_still_reports_original_filename(self, tmp_path):
        service = _make_service_with_stub_models()
        # Point at a file that doesn't exist to force the except branch.
        missing_path = str(tmp_path / "does-not-exist.mp3")
        service.metadata_extractor.extract_file_metadata.side_effect = OSError(
            "No such file"
        )

        file_result, ok = service._analyze_single_file_in_batch(
            0,
            missing_path,
            "cleaned name",
            1,
            10.0,
            30.0,
            None,
            None,
            raw_filename="014. Original Upload Name.mp3",
        )

        assert ok is False
        assert file_result["status"] == "error"
        assert (
            file_result["track"]["original_filename"]
            == "014. Original Upload Name.mp3"
        )
