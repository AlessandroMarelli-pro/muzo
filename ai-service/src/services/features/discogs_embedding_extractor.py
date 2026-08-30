import numpy as np
from loguru import logger

from src.services.essentia_model_manager import EssentiaModelManager
from src.utils.performance_optimizer import monitor_performance

EMBEDDING_SAMPLE_RATE = 16000


class DiscogsEmbeddingExtractor:
    """
    Extracts a 1280-dim audio embedding using Essentia's discogs-effnet model.

    The model is loaded once (lazily, on first use) and reused across tracks --
    loading the TensorFlow graph per track would dominate processing time.
    """

    _model = None

    def __init__(self):
        self.model_manager = EssentiaModelManager()

    def _get_model(self):
        if DiscogsEmbeddingExtractor._model is None:
            from essentia.standard import TensorflowPredictEffnetDiscogs

            model_path = self.model_manager.download_discogs_effnet()
            logger.debug("Loading discogs-effnet model into memory")
            DiscogsEmbeddingExtractor._model = TensorflowPredictEffnetDiscogs(
                graphFilename=model_path, output="PartitionedCall:1"
            )
        return DiscogsEmbeddingExtractor._model

    @monitor_performance("discogs_embedding_extraction")
    def extract(self, audio_16k: np.ndarray) -> list:
        """
        Extract the discogs-effnet embedding.

        Args:
            audio_16k: mono audio samples at 16kHz (Essentia's expected input
                rate for this model), as float32 in [-1, 1].

        Returns:
            list[float] of length 1280 (mean-pooled across patches), or an
            empty list if extraction fails.
        """
        try:
            model = self._get_model()
            activations = model(audio_16k.astype(np.float32))
            embedding = np.mean(activations, axis=0)
            return embedding.tolist()
        except Exception as e:
            logger.error(f"Discogs embedding extraction failed: {e}")
            return []

    def extract_from_audio(self, y: np.ndarray, sr: int) -> list:
        """
        Resample audio to the model's expected 16kHz input rate and extract the
        embedding. TensorflowPredictEffnetDiscogs internally windows the input
        into ~1s patches and this class mean-pools across them (see `extract`),
        so this works correctly for any length -- Essentia's own docs recommend
        feeding the whole track (`MonoLoader >> TensorflowPredictEffnetDiscogs`)
        rather than a short excerpt, for a more representative embedding.
        Never raises -- returns an empty list on any failure so a broken/
        unavailable model doesn't fail the caller.
        """
        try:
            import librosa

            audio_16k = (
                librosa.resample(y, orig_sr=sr, target_sr=EMBEDDING_SAMPLE_RATE)
                if sr != EMBEDDING_SAMPLE_RATE
                else y
            )
            return self.extract(np.asarray(audio_16k))
        except Exception as e:
            logger.error(f"Discogs embedding generation failed: {e}")
            return []

    def extract_from_harmonic_sample(self, y_harmonic: np.ndarray, sr: int) -> list:
        """Deprecated alias for `extract_from_audio` -- kept for callers still
        passing a pre-trimmed harmonic sample rather than the full track."""
        return self.extract_from_audio(y_harmonic, sr)
