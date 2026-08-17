"""
Audio Enhancement Service

Dispatches audio super-resolution jobs to a Hugging Face Jobs GPU instance
running UniverSR (https://github.com/woongzip1/UniverSR). Local inference is
not viable here since this host has no CUDA GPU, so enhancement is delegated
to a short-lived remote T4 job: upload input -> run job -> download output.
"""

import os
import subprocess
import tempfile
import uuid
from typing import Optional

from loguru import logger

BUCKET_REPO = os.getenv("UNIVERSR_BUCKET_REPO", "CosmicSurfer/muzo-enhance-scratch")
# a10g-large (24GB VRAM, same as l4x1 but generally faster compute) over
# t4-small (16GB, OOM'd at 30s chunks): quicker inference and more VRAM
# headroom for larger chunks, at a higher $/min offset by shorter duration.
JOB_FLAVOR = os.getenv("UNIVERSR_JOB_FLAVOR", "a10g-large")
# Stereo tracks are enhanced one channel at a time (see universr_enhance.py),
# roughly doubling GPU time vs. mono. A 4:39 mono track measured ~12min
# end-to-end; budget well above 2x that for stereo full-length tracks.
JOB_TIMEOUT = os.getenv("UNIVERSR_JOB_TIMEOUT", "30m")
# 10s was tuned to avoid OOM on a 16GB T4. l4x1 has 24GB (1.5x headroom);
# 15s is a conservative first bump to test before pushing further.
JOB_CHUNK_SECONDS = os.getenv("UNIVERSR_JOB_CHUNK_SECONDS", "15")
JOB_SCRIPT_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "hf_jobs",
    "universr_enhance.py",
)
BUCKET_MOUNT = "/scratch"


class AudioEnhancementService:
    """Dispatches enhancement work to a Hugging Face Jobs GPU instance."""

    def enhance(self, input_path: str, output_path: str) -> dict:
        job_key = str(uuid.uuid4())
        remote_input = f"{job_key}/input.wav"
        remote_output = f"{job_key}/output.wav"

        self._upload(input_path, remote_input)
        job_id = self._submit_job(remote_input, remote_output)
        logger.info(f"Submitted UniverSR job {job_id} (key={job_key})")

        # `hf jobs wait` just polls job status over HTTP -- a transient
        # network error here (e.g. connection reset) does not mean the job
        # itself failed. Retrying the poll is safe and avoids discarding a
        # GPU job that already completed successfully. Only bucket scratch
        # for a job we're confident truly failed gets cleaned up; if we
        # can't even confirm that, leave it in place rather than risk
        # deleting a completed job's only output before it's downloaded.
        self._wait_with_retry(job_id)
        try:
            self._download(remote_output, output_path)
        except Exception:
            logger.error(
                f"Enhancement job {job_id} succeeded but downloading the "
                f"result failed; leaving hf://buckets/{BUCKET_REPO}/{job_key} "
                f"in place for manual recovery instead of deleting it."
            )
            raise

        self._cleanup(job_key)
        return {"output_path": output_path, "output_sample_rate": 48000}

    def _wait_with_retry(self, job_id: str, max_attempts: int = 3) -> None:
        last_error: Optional[Exception] = None
        for attempt in range(1, max_attempts + 1):
            try:
                self._wait(job_id)
                return
            except Exception as e:
                last_error = e
                logger.warning(
                    f"`hf jobs wait` attempt {attempt}/{max_attempts} for {job_id} "
                    f"failed (likely a transient network error, not a job failure): {e}"
                )
        raise RuntimeError(
            f"Could not confirm completion of job {job_id} after {max_attempts} attempts"
        ) from last_error

    def _upload(self, local_path: str, remote_path: str) -> None:
        self._run(
            ["hf", "buckets", "cp", local_path, f"hf://buckets/{BUCKET_REPO}/{remote_path}"]
        )

    def _submit_job(self, remote_input: str, remote_output: str) -> str:
        cmd = [
            "hf",
            "jobs",
            "uv",
            "run",
            JOB_SCRIPT_PATH,
            "--flavor",
            JOB_FLAVOR,
            "-v",
            f"hf://buckets/{BUCKET_REPO}:{BUCKET_MOUNT}",
            "--timeout",
            JOB_TIMEOUT,
            "-d",
        ]

        # Authenticate the job container's HF Hub requests (model download)
        # so it isn't rate-limited as an anonymous client. Sourced from the
        # CLI's own login (`hf auth token`), not the .env HF_TOKEN -- that
        # one lacks bucket-write scope (see _run) and shouldn't be assumed
        # to have model-read scope either.
        hf_token = self._get_hf_token()
        if hf_token:
            cmd += ["--secrets", f"HF_TOKEN={hf_token}"]

        cmd += [
            "--",
            "--input-path",
            f"{BUCKET_MOUNT}/{remote_input}",
            "--output-path",
            f"{BUCKET_MOUNT}/{remote_output}",
            "--chunk-seconds",
            JOB_CHUNK_SECONDS,
        ]

        result = self._run(cmd)
        return self._parse_job_id(result.stdout)

    @staticmethod
    def _get_hf_token() -> Optional[str]:
        try:
            result = subprocess.run(
                ["hf", "auth", "token"], capture_output=True, text=True, check=True
            )
            # `hf auth token` prints an informational "Hint: ..." line before
            # the token itself, so take the last non-empty line rather than
            # the whole stdout blob.
            lines = [line.strip() for line in result.stdout.splitlines() if line.strip()]
            return lines[-1] if lines else None
        except (subprocess.CalledProcessError, FileNotFoundError) as e:
            logger.warning(f"Could not resolve HF token for job auth, proceeding unauthenticated: {e}")
            return None

    def _wait(self, job_id: str) -> None:
        self._run(["hf", "jobs", "wait", job_id])

    def _download(self, remote_path: str, local_path: str) -> None:
        self._run(
            ["hf", "buckets", "cp", f"hf://buckets/{BUCKET_REPO}/{remote_path}", local_path]
        )

    def _cleanup(self, job_key: str) -> None:
        try:
            self._run(
                ["hf", "buckets", "remove", f"hf://buckets/{BUCKET_REPO}/{job_key}", "--recursive", "--yes"]
            )
        except Exception as e:
            logger.warning(f"Failed to clean up bucket scratch for {job_key}: {e}")

    @staticmethod
    def _parse_job_id(stdout: str) -> str:
        for line in stdout.splitlines():
            if line.startswith("id="):
                return line.split()[0].removeprefix("id=")
        raise RuntimeError(f"Could not parse job id from `hf jobs` output: {stdout!r}")

    @staticmethod
    def _run(cmd: list[str]) -> subprocess.CompletedProcess:
        # ai-service's .env sets HF_TOKEN for HF model downloads
        # (huggingface_model_manager.py), but that token doesn't have bucket
        # write scope. Strip it here so the `hf` CLI falls back to its own
        # stored login (`hf auth login`) instead of the weaker env token.
        env = {k: v for k, v in os.environ.items() if k != "HF_TOKEN"}
        redacted = AudioEnhancementService._redact(cmd)
        logger.debug(f"Running: {' '.join(redacted)}")
        result = subprocess.run(cmd, capture_output=True, text=True, env=env)
        if result.returncode != 0:
            raise RuntimeError(
                f"Command failed ({result.returncode}): {' '.join(redacted)}\n{result.stderr}"
            )
        return result

    @staticmethod
    def _redact(cmd: list[str]) -> list[str]:
        redacted = list(cmd)
        for i, arg in enumerate(redacted):
            if arg.startswith("HF_TOKEN="):
                redacted[i] = "HF_TOKEN=***"
        return redacted


_service_instance: Optional[AudioEnhancementService] = None


def get_service_instance() -> AudioEnhancementService:
    global _service_instance
    if _service_instance is None:
        _service_instance = AudioEnhancementService()
    return _service_instance


def is_service_ready() -> bool:
    return True
