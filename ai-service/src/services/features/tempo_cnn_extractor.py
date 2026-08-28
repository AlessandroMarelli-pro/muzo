import numpy as np
from loguru import logger

from src.services.essentia_model_manager import EssentiaModelManager
from src.utils.performance_optimizer import monitor_performance

# TempoCNN needs a different sample rate than the discogs-effnet family (16kHz) --
# confirmed via essentia.standard.TempoCNN's own input documentation.
TEMPO_CNN_SAMPLE_RATE = 11025

TEMPO_CNN_URL = "https://essentia.upf.edu/models/tempo/tempocnn/deeptemp-k16-3.pb"


class TempoCnnExtractor:
    """
    Estimates tempo (BPM) using Essentia's TempoCNN (deeptemp-k16) model.

    Unlike the discogs-effnet classifier heads, this is not a TensorflowPredict2D
    head on a shared embedding -- it's a dedicated algorithm
    (essentia.standard.TempoCNN) that internally windows the input into patches,
    runs its own TF graph, and aggregates patch-wise tempo estimates into a single
    globalTempo + per-window confidence. Comparison-only against the existing
    hand-computed tempo column; not used for anything else yet.
    """

    _model = None

    def __init__(self):
        self.model_manager = EssentiaModelManager()

    def _get_model(self):
        if TempoCnnExtractor._model is None:
            from essentia.standard import TempoCNN

            model_path = self.model_manager.download_pb(TEMPO_CNN_URL)
            logger.info("Loading TempoCNN model into memory")
            TempoCnnExtractor._model = TempoCNN(graphFilename=model_path)
        return TempoCnnExtractor._model

    @monitor_performance("tempo_cnn_extraction")
    def extract(self, audio_11025hz: np.ndarray) -> dict:
        """
        Estimate tempo from audio already at TempoCNN's expected 11025 Hz rate.

        Returns {"tempo": float, "confidence": float} (confidence is the mean of
        the per-window local tempo probabilities), or {} on failure.
        """
        try:
            model = self._get_model()
            global_tempo, _local_tempo, local_probs = model(audio_11025hz.astype(np.float32))
            confidence = float(np.mean(local_probs)) if len(local_probs) else 0.0
            return {"tempo": float(global_tempo), "confidence": confidence}
        except Exception as e:
            logger.error(f"TempoCNN extraction failed: {e}")
            return {}

    def extract_from_audio(self, y: np.ndarray, sr: int) -> dict:
        """
        Resample audio to TempoCNN's expected 11025 Hz rate and estimate tempo.
        Never raises -- returns {} on any failure.
        """
        try:
            import librosa

            audio_11025hz = (
                librosa.resample(y, orig_sr=sr, target_sr=TEMPO_CNN_SAMPLE_RATE)
                if sr != TEMPO_CNN_SAMPLE_RATE
                else y
            )
            return self.extract(np.asarray(audio_11025hz))
        except Exception as e:
            logger.error(f"TempoCNN extraction failed: {e}")
            return {}
