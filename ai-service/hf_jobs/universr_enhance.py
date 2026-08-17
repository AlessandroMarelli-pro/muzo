# /// script
# requires-python = ">=3.10"
# dependencies = [
#   "torch",
#   "torchaudio",
#   "soundfile",
#   "universr @ git+https://github.com/woongzip1/UniverSR.git@v0.1.2",
# ]
# ///
"""
Standalone job dispatched via `hf jobs uv run`. Runs UniverSR audio
super-resolution on a single file and writes the 48kHz result back out.

Chunked processing follows UniverSR's own reference GUI implementation
(universr_app.py in the UniverSR repo): enhance() runs on the whole
waveform in one pass with no internal chunking, which the project's own
changelog notes can crash on long audio on a 16GB T4. Chunks are sliced
at 48kHz, downsampled to the target input_sr per chunk, enhanced, then
concatenated -- no crossfade, matching the upstream reference exactly.

Audio I/O forces the `soundfile` backend rather than torchaudio's default
`torchcodec`/FFmpeg backend: the minimal HF Jobs container image lacks the
system FFmpeg shared libraries torchcodec needs, but soundfile bundles
libsndfile in its wheel so it works without extra system packages.
"""
import argparse
import os

os.environ.setdefault("PYTORCH_CUDA_ALLOC_CONF", "expandable_segments:True")

import soundfile as sf
import torch
import torchaudio
import torchaudio.transforms as TAT
from universr import UniverSR

# UniverSR's own enhance() calls torchaudio.load()/save() internally for
# str-path inputs and torchaudio.save() for output. Monkeypatch both to
# route through soundfile instead of torchaudio's default torchcodec/FFmpeg
# backend, which isn't available in this minimal container image.


def _load_via_soundfile(path, *args, **kwargs):
    data, sr = sf.read(path, dtype="float32", always_2d=True)
    return torch.from_numpy(data.T), sr


def _save_via_soundfile(path, src, sample_rate, *args, **kwargs):
    sf.write(path, src.T.cpu().numpy(), sample_rate)


torchaudio.load = _load_via_soundfile
torchaudio.save = _save_via_soundfile

SUPPORTED_INPUT_SRS = [8000, 12000, 16000, 24000]
TARGET_SR = 48000
# A single 30s chunk at input_sr=24000 was observed to OOM on a 16GB T4
# (>13GB allocated, failing to grow by another ~4GB) -- the flow-matching
# ODE solver holds multiple full-resolution complex-STFT tensors across its
# integration steps. 10s keeps peak memory well under budget even at the
# highest supported input_sr bucket.
DEFAULT_CHUNK_SECONDS = 10


def resolve_input_sr(actual_sr: int) -> int:
    return min(SUPPORTED_INPUT_SRS, key=lambda sr: abs(sr - actual_sr))


def load_multichannel(path: str) -> tuple[torch.Tensor, int]:
    """Loads audio preserving its original channel count (e.g. stereo)."""
    wav, sr = torchaudio.load(path)
    return wav, sr


def enhance_mono_chunked(
    model: UniverSR,
    wav48: torch.Tensor,
    input_sr: int,
    chunk_seconds: int,
    ode_method: str,
    ode_steps: int,
    guidance_scale: float,
) -> torch.Tensor:
    """Enhances a single-channel (1, T) waveform, chunked to fit T4 VRAM."""
    total_samples = wav48.shape[-1]
    chunk_len = chunk_seconds * TARGET_SR
    n_chunks = max(1, -(-total_samples // chunk_len))  # ceil div

    if n_chunks == 1:
        return model.enhance(
            wav48,
            input_sr=input_sr,
            ode_method=ode_method,
            ode_steps=ode_steps,
            guidance_scale=guidance_scale,
        ).cpu()

    to_lr = TAT.Resample(TARGET_SR, input_sr)
    parts = []
    for ci in range(n_chunks):
        start = ci * chunk_len
        end = min(start + chunk_len, total_samples)
        seg_48k = wav48[:, start:end]
        seg_lr = to_lr(seg_48k)
        enhanced = model.enhance(
            seg_lr,
            input_sr=input_sr,
            ode_method=ode_method,
            ode_steps=ode_steps,
            guidance_scale=guidance_scale,
        ).cpu()
        parts.append(enhanced)
        if torch.cuda.is_available():
            torch.cuda.empty_cache()

    return torch.cat(parts, dim=-1).clamp(-1, 1)


def enhance_multichannel(
    model: UniverSR,
    wav48: torch.Tensor,
    input_sr: int,
    chunk_seconds: int,
    ode_method: str,
    ode_steps: int,
    guidance_scale: float,
) -> torch.Tensor:
    """
    UniverSR has no stereo-aware path -- it only accepts (1, T) mono tensors.
    Preserve stereo (or any multi-channel) width by enhancing each channel
    independently and stacking the results back together, rather than
    downmixing to mono before enhancement (which permanently discards
    stereo imaging).
    """
    num_channels = wav48.shape[0]
    if num_channels == 1:
        return enhance_mono_chunked(
            model, wav48, input_sr, chunk_seconds, ode_method, ode_steps, guidance_scale
        )

    channels = []
    for ch in range(num_channels):
        print(f"Enhancing channel {ch + 1}/{num_channels}")
        channel_wav = wav48[ch : ch + 1, :]
        enhanced = enhance_mono_chunked(
            model, channel_wav, input_sr, chunk_seconds, ode_method, ode_steps, guidance_scale
        )
        channels.append(enhanced)

    # Per-channel outputs can differ by a sample or two due to independent
    # resampling roundtrips; trim to the shortest before stacking.
    min_len = min(c.shape[-1] for c in channels)
    channels = [c[..., :min_len] for c in channels]
    return torch.cat(channels, dim=0)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input-path", required=True)
    parser.add_argument("--output-path", required=True)
    parser.add_argument("--model-repo", default="woongzip1/universr-audio")
    parser.add_argument("--ode-method", default="midpoint", choices=["euler", "midpoint", "rk4"])
    parser.add_argument("--ode-steps", type=int, default=4)
    parser.add_argument("--guidance-scale", type=float, default=1.5)
    parser.add_argument("--chunk-seconds", type=int, default=DEFAULT_CHUNK_SECONDS)
    args = parser.parse_args()

    wav, sr = load_multichannel(args.input_path)
    input_sr = resolve_input_sr(sr)

    wav48 = (
        wav
        if sr == TARGET_SR
        else TAT.Resample(sr, TARGET_SR)(wav)
    )

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Loading UniverSR '{args.model_repo}' on device={device}")
    model = UniverSR.from_pretrained(args.model_repo, device=device)

    print(
        f"Enhancing: native_sr={sr}Hz resolved_input_sr={input_sr}Hz "
        f"channels={wav48.shape[0]} duration={wav48.shape[-1] / TARGET_SR:.1f}s "
        f"chunk_seconds={args.chunk_seconds}"
    )
    output = enhance_multichannel(
        model,
        wav48,
        input_sr=input_sr,
        chunk_seconds=args.chunk_seconds,
        ode_method=args.ode_method,
        ode_steps=args.ode_steps,
        guidance_scale=args.guidance_scale,
    )

    torchaudio.save(args.output_path, output, TARGET_SR)
    print(f"Saved enhanced output to {args.output_path}")


if __name__ == "__main__":
    main()
