from loguru import logger
from src.services.essentia_model_manager import EssentiaModelManager

# Binary classifier heads: each takes the 1280-dim discogs-effnet embedding and outputs
# a 2-class softmax. Node names and class order confirmed by inspecting the real graphs
# and their .json metadata sidecars (not just documentation).
BINARY_HEADS = {
    "danceability": {
        "url": "https://essentia.upf.edu/models/classification-heads/danceability/danceability-discogs-effnet-1.pb",
        "input": "model/Placeholder",
        "output": "model/Softmax",
        "classes": ["danceable", "not_danceable"],
        "positive_class": "danceable",
        # Result dict key differs from the head name (danceability -> danceable) for
        # backwards-compat with the field already stored on AudioFingerprint.
        "result_key": "danceable",
    },
    "mood_aggressive": {
        "url": "https://essentia.upf.edu/models/classification-heads/mood_aggressive/mood_aggressive-discogs-effnet-1.pb",
        "input": "model/Placeholder",
        "output": "model/Softmax",
        "classes": ["aggressive", "not_aggressive"],
        "positive_class": "aggressive",
    },
    "mood_happy": {
        "url": "https://essentia.upf.edu/models/classification-heads/mood_happy/mood_happy-discogs-effnet-1.pb",
        "input": "model/Placeholder",
        "output": "model/Softmax",
        "classes": ["happy", "non_happy"],
        "positive_class": "happy",
    },
    "mood_party": {
        "url": "https://essentia.upf.edu/models/classification-heads/mood_party/mood_party-discogs-effnet-1.pb",
        "input": "model/Placeholder",
        "output": "model/Softmax",
        "classes": ["non_party", "party"],
        "positive_class": "party",
    },
    "mood_relaxed": {
        "url": "https://essentia.upf.edu/models/classification-heads/mood_relaxed/mood_relaxed-discogs-effnet-1.pb",
        "input": "model/Placeholder",
        "output": "model/Softmax",
        "classes": ["non_relaxed", "relaxed"],
        "positive_class": "relaxed",
    },
    "mood_sad": {
        "url": "https://essentia.upf.edu/models/classification-heads/mood_sad/mood_sad-discogs-effnet-1.pb",
        "input": "model/Placeholder",
        "output": "model/Softmax",
        "classes": ["non_sad", "sad"],
        "positive_class": "sad",
    },
    "voice_instrumental": {
        "url": "https://essentia.upf.edu/models/classification-heads/voice_instrumental/voice_instrumental-discogs-effnet-1.pb",
        "input": "model/Placeholder",
        "output": "model/Softmax",
        "classes": ["instrumental", "voice"],
        "positive_class": "voice",
        "result_key": "voice",
    },
}

# Multi-label sigmoid heads: each takes the embedding and outputs one independent
# probability per class (not mutually exclusive, unlike the binary heads above).
# `split_label` -- genre_discogs400's classes are "Genre---Style" strings that get
# split into {genre, style, confidence}; the others are flat names -> {<result_key>,
# confidence}.
# `fallback_top_n_when_empty` -- when nothing clears `min_confidence`, return this
# many highest-scoring classes anyway (ignoring the threshold) instead of an empty
# list. 0/absent keeps the strict behaviour.
MULTI_LABEL_HEADS = {
    "genres": {
        "url": "https://essentia.upf.edu/models/classification-heads/genre_discogs400/genre_discogs400-discogs-effnet-1.pb",
        "json_url": "https://essentia.upf.edu/models/classification-heads/genre_discogs400/genre_discogs400-discogs-effnet-1.json",
        "input": "serving_default_model_Placeholder",
        "output": "PartitionedCall",
        "min_confidence": 0.10,
        "top_n": 5,
        "split_label": True,
        "fallback_top_n_when_empty": 2,
    },
    "instruments": {
        "url": "https://essentia.upf.edu/models/classification-heads/mtg_jamendo_instrument/mtg_jamendo_instrument-discogs-effnet-1.pb",
        "json_url": "https://essentia.upf.edu/models/classification-heads/mtg_jamendo_instrument/mtg_jamendo_instrument-discogs-effnet-1.json",
        "input": "model/Placeholder",
        "output": "model/Sigmoid",
        "min_confidence": 0.10,
        "top_n": 5,
        "split_label": False,
        "result_key": "instrument",
        "fallback_top_n_when_empty": 0,
    },
    "tags": {
        "url": "https://essentia.upf.edu/models/classification-heads/mtg_jamendo_moodtheme/mtg_jamendo_moodtheme-discogs-effnet-1.pb",
        "json_url": "https://essentia.upf.edu/models/classification-heads/mtg_jamendo_moodtheme/mtg_jamendo_moodtheme-discogs-effnet-1.json",
        "input": "model/Placeholder",
        "output": "model/Sigmoid",
        "min_confidence": 0.10,
        "top_n": 5,
        "split_label": False,
        "result_key": "tag",
        "fallback_top_n_when_empty": 0,
    },
}


class DiscogsClassifiersExtractor:
    """
    Runs Essentia's discogs-effnet classifier heads (danceability, moods,
    voice/instrumental, instruments, genre_discogs400, mtg_jamendo_moodtheme) on an
    already-computed 1280-dim discogs-effnet embedding.

    Every model here is a small TensorflowPredict2D head taking the embedding as
    input -- no audio decode or base-model inference needed, so running all of them
    is nearly free once the embedding itself has been computed. Models are loaded
    once (lazily, class-level) and reused across calls, same pattern as
    DiscogsEmbeddingExtractor.
    """

    _binary_models: dict = {}
    _multi_label_models: dict = {}
    _multi_label_classes: dict = {}

    def __init__(self):
        self.model_manager = EssentiaModelManager()

    def _get_binary_model(self, head_name: str):
        if head_name not in DiscogsClassifiersExtractor._binary_models:
            from essentia.standard import TensorflowPredict2D

            config = BINARY_HEADS[head_name]
            model_path = self.model_manager.download_pb(config["url"])
            logger.info(f"Loading {head_name} classifier head into memory")
            DiscogsClassifiersExtractor._binary_models[head_name] = TensorflowPredict2D(
                graphFilename=model_path,
                input=config["input"],
                output=config["output"],
            )
        return DiscogsClassifiersExtractor._binary_models[head_name]

    def _get_multi_label_model(self, head_name: str):
        if head_name not in DiscogsClassifiersExtractor._multi_label_models:
            from essentia.standard import TensorflowPredict2D

            config = MULTI_LABEL_HEADS[head_name]
            model_path = self.model_manager.download_pb(config["url"])
            metadata = self.model_manager.download_json_metadata(config["json_url"])
            DiscogsClassifiersExtractor._multi_label_classes[head_name] = metadata[
                "classes"
            ]
            logger.info(f"Loading {head_name} classifier head into memory")
            DiscogsClassifiersExtractor._multi_label_models[head_name] = (
                TensorflowPredict2D(
                    graphFilename=model_path,
                    input=config["input"],
                    output=config["output"],
                )
            )
        return DiscogsClassifiersExtractor._multi_label_models[head_name]

    def predict_binary(self, head_name: str, embedding: list) -> float:
        """
        Run one binary classifier head. Returns the positive class's probability
        (e.g. "danceable" for the danceability head), or None on failure.
        """
        try:
            import numpy as np

            config = BINARY_HEADS[head_name]
            model = self._get_binary_model(head_name)
            emb_arr = np.array(embedding, dtype=np.float32).reshape(1, -1)
            out = np.array(model(emb_arr))[0]
            positive_idx = config["classes"].index(config["positive_class"])
            return float(out[positive_idx])
        except Exception as e:
            logger.error(f"Discogs classifier '{head_name}' prediction failed: {e}")
            return None

    def predict_multi_label_top_n(self, head_name: str, embedding: list) -> list:
        """
        Run one multi-label sigmoid head, return the top N predictions above its
        configured confidence threshold. Each result is either
        {"genre": ..., "style": ..., "confidence": ...} (split_label heads) or
        {<result_key>: ..., "confidence": ...} (flat heads). Returns an empty list
        on failure or if nothing clears the threshold -- unless the head sets
        `fallback_top_n_when_empty` > 0, in which case that many highest-scoring
        classes are returned regardless of `min_confidence`.
        """
        try:
            import numpy as np

            config = MULTI_LABEL_HEADS[head_name]
            model = self._get_multi_label_model(head_name)
            classes = DiscogsClassifiersExtractor._multi_label_classes[head_name]
            emb_arr = np.array(embedding, dtype=np.float32).reshape(1, -1)
            out = np.array(model(emb_arr))[0]

            all_scored = sorted(
                ((classes[i], float(out[i])) for i in range(len(classes))),
                key=lambda x: x[1],
                reverse=True,
            )
            scored = [s for s in all_scored if s[1] > config["min_confidence"]]

            if scored:
                top = scored[: config["top_n"]]
            else:
                fallback_n = config.get("fallback_top_n_when_empty", 0)
                if not fallback_n:
                    return []
                top = all_scored[:fallback_n]
                logger.info(
                    f"Discogs classifier '{head_name}': nothing cleared "
                    f"min_confidence={config['min_confidence']}, falling back to "
                    f"top {len(top)} (best confidence {top[0][1]:.3f})"
                )

            results = []
            for label, confidence in top:
                if config["split_label"]:
                    genre, _, style = label.partition("---")
                    results.append(
                        {"genre": genre, "style": style, "confidence": confidence}
                    )
                else:
                    results.append(
                        {config["result_key"]: label, "confidence": confidence}
                    )
            return results
        except Exception as e:
            logger.error(f"Discogs classifier '{head_name}' prediction failed: {e}")
            return []

    def predict_all(self, embedding: list) -> dict:
        """
        Run every classifier head on the given embedding.

        Returns a dict with keys: danceable, mood_aggressive, mood_happy, mood_party,
        mood_relaxed, mood_sad, voice (float 0-1 or None), and genres/instruments/tags
        (lists, possibly empty). Never raises -- individual head failures degrade to
        None/[] rather than failing the whole call.
        """
        if not embedding:
            return {}

        result = {}
        for head_name, config in BINARY_HEADS.items():
            key = config.get("result_key", head_name)
            result[key] = self.predict_binary(head_name, embedding)
        for head_name in MULTI_LABEL_HEADS:
            result[head_name] = self.predict_multi_label_top_n(head_name, embedding)
        return result
