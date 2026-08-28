import numpy as np
from loguru import logger

from src.services.essentia_model_manager import EssentiaModelManager
from src.utils.performance_optimizer import monitor_performance

# DEAM's classifier head runs on MSD-MusiCNN's 200-dim embedding, NOT the
# discogs-effnet embedding used everywhere else in this pipeline -- confirmed via
# both models' .json metadata (DEAM input shape [200], node "model/Placeholder";
# MusiCNN embedding output node "model/dense/BiasAdd", shape [1, 200]). MusiCNN's
# own expected sample rate (per its metadata) is 16kHz, same as discogs-effnet, so
# the already-resampled 16kHz audio used for the discogs embedding can be reused --
# no separate resample step needed (unlike TempoCNN's 11025Hz requirement).
MUSICNN_SAMPLE_RATE = 16000

MUSICNN_URL = "https://essentia.upf.edu/models/feature-extractors/musicnn/msd-musicnn-1.pb"
MUSICNN_EMBEDDING_OUTPUT = "model/dense/BiasAdd"

DEAM_URL = "https://essentia.upf.edu/models/classification-heads/deam/deam-msd-musicnn-2.pb"


class DeamExtractor:
    """
    Estimates valence/arousal using Essentia's DEAM arousal-valence regression
    model, transfer-learned on top of MSD-MusiCNN's embedding.

    Chosen over the other two arousal-valence options in Essentia's model zoo
    (emoMusic, MuSe) after comparing each model's published Pearson correlation
    metrics: DEAM has the best arousal correlation (0.773) -- the dimension this
    pipeline actually needs alongside valence -- while MuSe's much larger training
    set (41021 songs) turned out to be essentially uncorrelated (~0.1-0.13) and was
    ruled out.

    Two models chained: TensorflowPredictMusiCNN produces the 200-dim embedding
    (internally handles mel-spectrogram framing from raw audio, same idiom as
    TensorflowPredictEffnetDiscogs for discogs-effnet), then TensorflowPredict2D
    runs the DEAM regression head on that embedding. Both are loaded once (lazily,
    class-level) and reused across calls.

    Output is (valence, arousal) in range [1, 9] -- rescaled to [0, 1] by `extract`
    to match the rest of this pipeline's probability-shaped fields.
    """

    _musicnn_model = None
    _deam_model = None

    def __init__(self):
        self.model_manager = EssentiaModelManager()

    def _get_musicnn_model(self):
        if DeamExtractor._musicnn_model is None:
            from essentia.standard import TensorflowPredictMusiCNN

            model_path = self.model_manager.download_pb(MUSICNN_URL)
            logger.info("Loading MSD-MusiCNN model into memory")
            DeamExtractor._musicnn_model = TensorflowPredictMusiCNN(
                graphFilename=model_path, output=MUSICNN_EMBEDDING_OUTPUT
            )
        return DeamExtractor._musicnn_model

    def _get_deam_model(self):
        if DeamExtractor._deam_model is None:
            from essentia.standard import TensorflowPredict2D

            model_path = self.model_manager.download_pb(DEAM_URL)
            logger.info("Loading DEAM arousal-valence model into memory")
            DeamExtractor._deam_model = TensorflowPredict2D(
                graphFilename=model_path,
                input="model/Placeholder",
                output="model/Identity",
            )
        return DeamExtractor._deam_model

    @monitor_performance("deam_extraction")
    def extract(self, audio_16k: np.ndarray) -> dict:
        """
        Estimate valence/arousal from audio already at MusiCNN's expected 16kHz
        rate.

        Returns {"valence": float, "arousal": float} rescaled from DEAM's native
        [1, 9] range to [0, 1] (so it composes with the rest of this pipeline's
        0-1 probability-shaped fields), or {} on failure.
        """
        try:
            musicnn = self._get_musicnn_model()
            deam = self._get_deam_model()

            embeddings = np.array(musicnn(audio_16k.astype(np.float32)))
            # Mean-pool across patches, same pattern as the discogs-effnet embedding.
            embedding = np.mean(embeddings, axis=0).reshape(1, -1)

            out = np.array(deam(embedding))[0]
            valence_raw, arousal_raw = float(out[0]), float(out[1])

            def rescale(x: float) -> float:
                # DEAM's native output range is [1, 9] (per its .json metadata).
                return min(1.0, max(0.0, (x - 1.0) / 8.0))

            return {"valence": rescale(valence_raw), "arousal": rescale(arousal_raw)}
        except Exception as e:
            logger.error(f"DEAM extraction failed: {e}")
            return {}

    def extract_from_audio(self, y: np.ndarray, sr: int) -> dict:
        """
        Resample audio to MusiCNN's expected 16kHz rate and estimate valence/
        arousal. Never raises -- returns {} on any failure.
        """
        try:
            import librosa

            audio_16k = (
                librosa.resample(y, orig_sr=sr, target_sr=MUSICNN_SAMPLE_RATE)
                if sr != MUSICNN_SAMPLE_RATE
                else y
            )
            return self.extract(np.asarray(audio_16k))
        except Exception as e:
            logger.error(f"DEAM extraction failed: {e}")
            return {}
