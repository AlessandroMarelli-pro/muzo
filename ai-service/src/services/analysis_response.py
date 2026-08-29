"""
Generic response envelope for the simple-analysis pipeline.

Replaces the old flat merge of file_info/audio_technical/features/discogs_*/id3_tags
(one top-level key per model, values duplicated between the raw model dict and the
derived `features.musical_features`) with a schema where:

  - every model-derived value is a {"value", "confidence", "source"} entry under
    `features`, so adding a new model never requires a new top-level key;
  - a value that is unavailable (model disabled, model failed, or the model ran but
    produced nothing) is `None` -- never a neutral placeholder like 0.5 valence,
    0.0 tempo, or "Unknown" key. A consumer can trust that a non-null value is real;
  - `warnings` names exactly which model produced nothing and why (`"disabled"` /
    `"failed"` / `"empty"`), a distinction the old {}-for-everything return erased.

This module is pure -- no I/O, no model calls -- so it's fully unit-testable on its
own.
"""

from typing import Any, Dict, List, Optional

SCHEMA_VERSION = 2

# Valid `reason` values for a warning -- see AnalysisResponseBuilder.add_warning.
WARNING_REASONS = ("disabled", "failed", "empty")


def feature(
    value: Any, source: str, confidence: Optional[float] = None
) -> Optional[Dict[str, Any]]:
    """
    Build one `features.*` entry, or None when there's nothing to report.

    Centralises the "missing means null" rule: every call site passes whatever it
    has, including None, and this decides whether that becomes an entry at all.
    """
    if value is None:
        return None
    return {"value": value, "confidence": confidence, "source": source}


def build_classifications(discogs_classifiers: Optional[dict]) -> Dict[str, list]:
    """
    Turn DiscogsClassifiersExtractor.predict_all()'s `genres` list (each item
    already {"genre", "style", "confidence"} from splitting genre_discogs400's
    "Genre---Style" classes -- see discogs_classifiers_extractor.py's
    predict_multi_label_top_n) into three views over the same predictions:

      - genre_styles: the raw pairs, passed through as-is (already ranked by
        confidence, upstream).
      - genres: collapsed per distinct genre, keeping the MAX confidence of that
        genre's pairs -- not summed. Each class score is an independent sigmoid
        probability, not a member of a distribution, so summing two styles under
        the same genre is not meaningful and can exceed 1.0.
      - styles: one entry per pair, {"style", "genre", "confidence"}, so a style
        always carries the genre it belongs to and can be mapped back without
        re-parsing the "Genre---Style" label.

    instruments/tags are passed through unchanged (already flat lists of
    {<key>, "confidence"}).

    Returns {} keys as empty lists when there's nothing to classify (no embedding,
    classifiers disabled, or extraction failed) -- never omits the keys.
    """
    discogs_classifiers = discogs_classifiers or {}
    genre_styles = discogs_classifiers.get("genres") or []

    genres_by_name: Dict[str, float] = {}
    for pair in genre_styles:
        genre_name = pair.get("genre")
        conf = pair.get("confidence")
        if genre_name is None or conf is None:
            continue
        if genre_name not in genres_by_name or conf > genres_by_name[genre_name]:
            genres_by_name[genre_name] = conf

    genres = [
        {"genre": g, "confidence": c}
        for g, c in sorted(genres_by_name.items(), key=lambda x: x[1], reverse=True)
    ]

    styles = [
        {"style": pair.get("style"), "genre": pair.get("genre"), "confidence": pair.get("confidence")}
        for pair in genre_styles
    ]

    return {
        "genre_styles": genre_styles,
        "genres": genres,
        "styles": styles,
        "instruments": discogs_classifiers.get("instruments") or [],
        "tags": discogs_classifiers.get("tags") or [],
    }


class AnalysisResponseBuilder:
    """
    Accumulates per-model warnings during one analysis run and assembles the final
    envelope. One instance per analyze_audio()/_analyze_single_file_in_batch() call
    -- not shared or reused across requests.
    """

    def __init__(self):
        self._warnings: List[Dict[str, Optional[str]]] = []

    def add_warning(
        self, model: str, reason: str, detail: Optional[str] = None
    ) -> None:
        if reason not in WARNING_REASONS:
            raise ValueError(f"Invalid warning reason: {reason!r}")
        self._warnings.append({"model": model, "reason": reason, "detail": detail})

    @property
    def warnings(self) -> List[Dict[str, Optional[str]]]:
        return self._warnings

    def build(
        self,
        status: str,
        message: str,
        processing_time: float,
        track: dict,
        audio: Optional[dict],
        tags: Optional[dict],
        features: Dict[str, Any],
        labels: Dict[str, Any],
        classifications: Dict[str, list],
        embedding: Optional[dict],
        processing_mode: str = "simple",
    ) -> Dict[str, Any]:
        return {
            "status": status,
            "message": message,
            "processing_time": processing_time,
            "processing_mode": processing_mode,
            "schema_version": SCHEMA_VERSION,
            "track": track,
            "audio": audio,
            "tags": tags,
            "features": features,
            "labels": labels,
            "classifications": classifications,
            "embedding": embedding,
            "warnings": list(self._warnings),
        }

    def build_error(
        self,
        message: str,
        processing_time: float,
        processing_mode: str = "simple",
        track: Optional[dict] = None,
    ) -> Dict[str, Any]:
        """
        Error envelope -- same top-level shape as a success response (status,
        message, processing_time, processing_mode, schema_version, warnings) but
        with every content section null/empty, so callers can rely on the same
        keys existing either way.
        """
        return {
            "status": "error",
            "message": message,
            "processing_time": processing_time,
            "processing_mode": processing_mode,
            "schema_version": SCHEMA_VERSION,
            "track": track,
            "audio": None,
            "tags": None,
            "features": {},
            "labels": {},
            "classifications": {
                "genre_styles": [],
                "genres": [],
                "styles": [],
                "instruments": [],
                "tags": [],
            },
            "embedding": None,
            "warnings": list(self._warnings),
        }
