# syntax=docker/dockerfile:1
#
# Builds essentia-tensorflow's Python bindings for Linux/amd64 + GPU, since no
# Linux wheel has been published to PyPI since Python 3.7 (verified against
# PyPI's package index directly) and the official mtgupf/essentia-tensorflow
# Docker image is a dead 2020 Python 3.6 build.
#
# The essentia-libs stage below is adapted from lagmoellertim/essentia-docker
# (github.com/lagmoellertim/essentia-docker, MIT licensed), which builds
# FFmpeg + Essentia's C++ core (the TF dependency is handled differently here --
# see the TensorFlow provisioning section below). Their published image pins
# FFmpeg 4.4.4, but Essentia's master branch requires FFmpeg 5.0+
# (see github.com/MTG/essentia commit 1153d55928, "Fix FFmpeg 5.x
# compatibility issues" -- confirmed against a real build here:
# AVChannelLayout/ch_layout aren't declared with 4.4.4's headers). So their
# build steps are inlined here with a newer FFMPEG_VERSION instead of FROM-ing
# their image directly.
#
# ---------------------------------------------------------------------------
# TensorFlow provisioning -- the fix for the GPU malloc crash
# ---------------------------------------------------------------------------
# History: this image previously linked Essentia against `libtensorflow_cc`
# 2.13 from the ika-rwth-aachen community project -- a third-party C++ build --
# then symlinked `libtensorflow_cc.so` -> `libtensorflow.so` and hand-wrote a
# `tensorflow.pc` so `waf configure --with-tensorflow` would link it as if it
# were the C API. Every GPU deploy then crashed with "malloc(): invalid size
# (unsorted)" (a fatal glibc heap-corruption abort, uncatchable from Python) on
# the first GPU inference call through TensorflowPredictEffnetDiscogs, right
# after "MLIR V1 optimization pass is not enabled". Four fixes (CUDA 11.8
# downgrade, glibc/ABI stage match, oneDNN+XLA disable, and finally a CPU-only
# fallback image) never resolved it.
#
# This build now follows Essentia's OWN documented approach
# (essentia.upf.edu/machine_learning.html): `pip install tensorflow`, then
# `src/3rdparty/tensorflow/setup_from_python.sh` (`--mode python`), which links
# Essentia against the exact `.so` files shipped inside the TF Python wheel
# (`libtensorflow_framework.so.2` + `_pywrap_tensorflow_internal.so`). Essentia
# explicitly recommends this over BOTH the official libtensorflow C API and the
# C++ library -- setup_tensorflow.py's own comments warn that the C-API path
# ("--mode libtensorflow") hits protobuf `undefined symbol` conflicts when
# Essentia and TF are used from the same process.
#
# TF version: 2.14.1. Constraints that pick it:
#   - Essentia's tested set is 2.5 / 2.8 / 2.12, but 2.12's wheel pins
#     numpy <1.24, colliding with the rest of ai-service (requirements.txt:
#     `numpy>=1.26.0`, needed by scipy>=1.11 / librosa / the torch models).
#   - essentia's own src/3rdparty/tensorflow/setup_tensorflow.py has a naive
#     `minor_version >= 15` check (meant for TF *1.15*) that ALSO fires for TF
#     2.15+, making it look for libs under a nonexistent `tensorflow_core/`
#     dir. So the usable ceiling is TF 2.14.
#   - TF 2.14.1 allows `numpy>=1.23.5,<2.0` (compatible with numpy 1.26) and
#     its wheel targets CUDA 11.8 / cuDNN 8.7 -- the runtime base below.
# The discogs-effnet .pb was exported with TF 2.8; it is a frozen graph and
# loads fine on 2.14. This is also the version the known-good MeteorBurn
# essentia-GPU compile guide uses.
#
# Base OS here MUST still match the runtime stage's base OS (both ubuntu:22.04 /
# glibc 2.35), not just its CUDA version. This stage's .so files (Essentia's
# C++ core and its Python extension module) are copied wholesale into the
# runtime stage and loaded into the same process as the runtime's own libc --
# if the two stages' glibc/libstdc++ ABI versions differ, a
# malloc()'d-in-one/free()'d-in-another mismatch is possible. Confirmed via a
# real deployment: debian:bookworm-slim (glibc 2.36) here against a runtime
# base of ubuntu:22.04 (glibc 2.35) built and ran fine through model *loading*,
# then crashed with "malloc(): invalid size (unsorted)" on the first GPU
# inference call.
FROM ubuntu:22.04 AS essentia-libs
ENV DEBIAN_FRONTEND=noninteractive

# No libavcodec-dev/libavformat-dev/etc here: those are the distro's stock
# FFmpeg 4.4 dev headers, which is exactly the version essentia's master
# branch is incompatible with (see header comment) -- FFmpeg is built from
# source below instead, into /usr/local, ahead of any system FFmpeg on the
# pkg-config/linker search path.
#
# python3.11 explicitly (not the "python3" package, which is 3.10 on
# 22.04's default archive) -- must match the runtime stage's python3.11
# exactly, since Essentia's Python bindings compile a CPython extension
# module tied to a specific interpreter ABI. 22.04's own universe archive
# already carries a python3.11 package (3.11.0~rc1), same as what the
# runtime stage installs -- no need for deadsnakes.
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    build-essential \
    pkg-config \
    libeigen3-dev \
    libyaml-dev \
    libfftw3-dev \
    libsamplerate0-dev \
    libtag1-dev \
    libchromaprint-dev \
    python3.11 \
    python3.11-dev \
    git \
    ca-certificates \
    wget \
    curl \
    nasm yasm \
    zlib1g-dev \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/* \
    && update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.11 1 \
    && curl -sS https://bootstrap.pypa.io/get-pip.py | python3.11

# Essentia's AudioLoader only decodes audio -- it never encodes H.264/VP9/
# etc. -- so this skips the external encoder libs (libx264/libvpx/...) that
# the reference essentia-docker project's Dockerfile enables for its more
# general-purpose FFmpeg build. FFmpeg's built-in decoders already cover
# MP3/AAC/FLAC/etc. Avoids a class of "missing .so" runtime errors from
# encoder libs the runtime stage doesn't install (confirmed via CI:
# libx264.so.164 missing after fixing the same issue for fftw3f/yaml/
# chromaprint).
ARG FFMPEG_VERSION=7.1.1
WORKDIR /opt
RUN curl -LO https://ffmpeg.org/releases/ffmpeg-${FFMPEG_VERSION}.tar.xz && \
    tar xJf ffmpeg-${FFMPEG_VERSION}.tar.xz && \
    cd ffmpeg-${FFMPEG_VERSION} && \
    ./configure --prefix=/usr/local \
    --enable-gpl \
    --enable-pic \
    --enable-shared \
    --disable-static \
    --disable-doc \
    --disable-programs && \
    make -j$(nproc) && \
    make install && \
    cd /opt && \
    rm -rf ffmpeg-${FFMPEG_VERSION}*
RUN ldconfig

# TF 2.14.1 (see header comment for why not 2.12 or 2.15). Its cp311
# manylinux2014 x86_64 wheel is GPU-capable for CUDA 11.8 / cuDNN 8.7, matching
# the runtime base. Must be installed for the SAME python3.11 that builds
# Essentia's bindings below -- setup_from_python.sh links against this exact
# wheel's .so files, and the runtime stage installs the identical version so
# the ABI matches. numpy is left for the tensorflow wheel to pin
# (>=1.23.5,<2.0); the runtime stage then resolves it up to
# `numpy>=1.26.0,<2.0` for the app stack. pip was bootstrapped via get-pip.py
# above (not the python3-pip apt package -- on 22.04 that pulls in python3.10).
ARG TENSORFLOW_VERSION=2.14.1
RUN python3 -m pip install --no-cache-dir "tensorflow==${TENSORFLOW_VERSION}" pyyaml

ARG ESSENTIA_COMMIT=master
RUN git clone --depth 1 https://github.com/MTG/essentia.git /opt/essentia && \
    cd /opt/essentia && \
    git fetch --depth 1 origin ${ESSENTIA_COMMIT} && \
    git checkout ${ESSENTIA_COMMIT}

# Essentia's documented TF setup: symlinks libtensorflow_framework.so.2 +
# _pywrap_tensorflow_internal.so out of the installed TF wheel into
# /usr/local/lib, copies the C headers to /usr/local/include/tensorflow/c, and
# writes /usr/local/lib/pkgconfig/tensorflow.pc -- everything `waf configure
# --with-tensorflow` needs. Its shebang hardcodes `python3`, which
# update-alternatives has already pointed at python3.11 above.
WORKDIR /opt/essentia
RUN sh src/3rdparty/tensorflow/setup_from_python.sh

# PKG_CONFIG_PATH so `waf configure` finds the tensorflow.pc that
# setup_from_python.sh just wrote to /usr/local/lib/pkgconfig (FFmpeg 7.1.1 also
# installed its .pc files there).
ENV PKG_CONFIG_PATH=/usr/local/lib/pkgconfig
RUN python3 waf configure --with-tensorflow --with-python && \
    python3 waf && \
    python3 waf install

# ---- runtime -----------------------------------------------------------
# nvidia/cuda for the CUDA/cuDNN runtime libraries the TensorFlow wheel needs;
# Essentia's own build (C++ core + Python bindings) comes from essentia-libs
# above, which uses the same ubuntu:22.04 base (glibc 2.35) as here -- see the
# essentia-libs stage header comment for why that match matters (both this
# nvidia/cuda tag and essentia-libs' plain ubuntu:22.04 are glibc 2.35).
# TensorFlow 2.14 targets CUDA 11.8 + cuDNN 8.7 (tensorflow.org/install/
# source#gpu) -- this is the 11.8.0-cudnn8 tag. TF dlopen()s CUDA libraries by
# exact SONAME at runtime (libcudart.so.11); the tensorflow[and-cuda] extra
# installed below also bundles them as pip packages, so this is belt-and-braces.
FROM nvidia/cuda:11.8.0-cudnn8-runtime-ubuntu22.04 AS runtime
ENV DEBIAN_FRONTEND=noninteractive
ARG TENSORFLOW_VERSION=2.14.1

# Carried over from the GPU-crash investigation (commit cf812be): disable
# TensorFlow's oneDNN CPU-op optimizations and XLA/MLIR auto-clustering. The
# suspected root cause -- linking Essentia against a third-party libtensorflow_cc
# C++ build instead of the TF wheel's own .so files -- has now been fixed (see
# essentia-libs stage), so these are very likely no longer needed. Kept in place
# for the FIRST GPU deploy on the new TF setup as a safety margin; drop them in a
# follow-up commit once a clean GPU run without them is confirmed. Losing these
# optimizations on this small frozen graph is not a meaningful perf cost.
ENV TF_ENABLE_ONEDNN_OPTS=0
ENV TF_XLA_FLAGS=--tf_xla_auto_jit=0
# Essentia otherwise reserves ALL GPU memory on the first predictor init
# (MTG/essentia#1432); grow on demand instead. Harmless on a dedicated endpoint.
ENV TF_FORCE_GPU_ALLOW_GROWTH=true

# Runtime .so packages for every essentia dependency confirmed by its own
# waf configure checks (eigen3 is header-only, no runtime package needed).
# python3.11-dev is needed later for madmom, which compiles Cython/C
# extensions from source at pip-install time (no prebuilt wheel exists for
# any platform) and needs Python.h.
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.11 python3.11-dev python3-pip \
    ffmpeg libsndfile1 libchromaprint-tools libchromaprint1 \
    libtag1v5 libsamplerate0 libyaml-0-2 libfftw3-single3 \
    && rm -rf /var/lib/apt/lists/*

# Essentia's C++ core + Python extension module. NOT the TF libraries -- those
# are only symlinks into the build stage's site-packages here; the runtime gets
# its own TF wheel below and re-links against it.
COPY --from=essentia-libs /usr/local/lib /usr/local/lib
COPY --from=essentia-libs /usr/local/include /usr/local/include
# essentia's setup_from_python.sh needs the TF wheel present for the SAME
# python3.11 that will import essentia at runtime -- the wheel ships the
# libtensorflow_framework.so.2 / _pywrap_tensorflow_internal.so that essentia's
# _essentia.so was linked against in the build stage. update-alternatives points
# `python3` at python3.11 so the script (hardcoded `PYTHON=python3`) finds it.
COPY --from=essentia-libs /opt/essentia/src/3rdparty/tensorflow /opt/essentia-tf-setup
# tensorflow[and-cuda]: bundle the CUDA 11.8 / cuDNN 8.7 / cuBLAS / cuFFT /
# cuPTI / NCCL runtime libs as pip packages rather than relying on exactly what
# the nvidia/cuda:11.8.0-cudnn8-runtime base ships (cuPTI in particular is not
# always present in -runtime). Same TENSORFLOW_VERSION as the build stage so
# essentia's _essentia.so links against the identical
# libtensorflow_framework.so.2 ABI.
RUN update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.11 1 && \
    python3.11 -m pip install --no-cache-dir "tensorflow[and-cuda]==${TENSORFLOW_VERSION}" && \
    (cd /opt/essentia-tf-setup && sh setup_from_python.sh) && \
    rm -rf /opt/essentia-tf-setup && \
    ldconfig

# waf install's Python destination is derived from the build stage's own
# python3-config/distutils and may land under a version-agnostic
# dist-packages dir (confirmed on the prior debian-based build stage) or a
# python3.11-specific one now that the build stage was switched to
# ubuntu:22.04 + deadsnakes -- list every plausible path so python3.11 finds
# it regardless of which one waf actually used.
ENV PYTHONPATH=/usr/local/lib/python3/dist-packages:/usr/local/lib/python3.11/dist-packages:/usr/local/lib/python3.11/site-packages

# essentia's pure-Python layer (essentia/common.py) needs numpy and six at
# import time. numpy is already present (pinned to <2.0 by the tensorflow
# wheel installed just above -- do NOT let a bare `pip install numpy` bump it
# to 2.x here, that breaks TF 2.14's compiled extensions); only `six` is new.
RUN python3.11 -m pip install --no-cache-dir six "numpy>=1.26.0,<2.0"

# Import essentia AND tensorflow in one interpreter -- this is the combination
# that `setup_from_python.sh --mode python` is meant to make safe (the C-API
# path would fail here with a protobuf `undefined symbol`). A clean import +
# TensorflowPredictEffnetDiscogs present is the build-time signal; the real GPU
# inference smoke test runs on a CUDA host (see this file's git history / PR).
RUN python3.11 -c "import essentia, essentia.standard as es; import tensorflow as tf; print('essentia', essentia.__version__, '/ tf', tf.__version__, 'OK'); print('TensorflowPredictEffnetDiscogs:', hasattr(es, 'TensorflowPredictEffnetDiscogs'))"

# The rest of ai-service's dependencies. build-essential/cython/numpy are
# needed first since madmom has no prebuilt wheel for any platform (source
# tarball only) and its setup.py imports numpy/cython at build time.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
# essentia-tensorflow is already built from source above (see essentia-libs);
# pip would otherwise try and fail to fetch it from PyPI (no Linux wheel).
#
# --no-build-isolation for madmom specifically: madmom's setup.py does
# `import Cython` at build time (no prebuilt wheel exists for any platform),
# but pip's default PEP 517 build isolation builds each package in its own
# throwaway env that does NOT see the cython/numpy already installed on the
# line above -- confirmed via CI, "ModuleNotFoundError: No module named
# 'Cython'" despite cython==3.0.1 being installed and reported as already
# satisfied immediately beforehand. --no-build-isolation makes madmom's
# build see the outer environment (where cython/numpy already are) instead.
# Also strip the bare `numpy` line: the tensorflow 2.14 wheel already pins it
# to >=1.23.5,<2.0 and an unbounded `numpy>=1.26.0` here lets pip bump it to
# 2.x, which breaks `import tensorflow`. A constrained `numpy>=1.26.0,<2.0` is
# reinstalled explicitly instead.
RUN grep -vE '^(essentia-tensorflow|numpy)' requirements.txt > requirements.docker.txt && \
    python3.11 -m pip install --no-cache-dir cython==3.0.1 "numpy>=1.26.0,<2.0" && \
    grep -v '^madmom' requirements.docker.txt > requirements.nomadmom.txt && \
    python3.11 -m pip install --no-cache-dir -r requirements.nomadmom.txt "numpy>=1.26.0,<2.0" && \
    python3.11 -m pip install --no-cache-dir --no-build-isolation "$(grep '^madmom' requirements.docker.txt)" && \
    python3.11 -c "import tensorflow as tf, numpy; print('tf', tf.__version__, 'numpy', numpy.__version__)"

# Includes models/essentia_cache (see essentia-cpu.Dockerfile) so the image
# ships with the essentia .pb files -- no download on first request. Plain git
# blobs (not LFS), so a normal checkout has them.
COPY . .

# Fail early if a .pb file is truncated / a stale git-LFS pointer stub, rather
# than at runtime with "Invalid GraphDef". See essentia-cpu.Dockerfile.
RUN set -e; \
    for pb in models/essentia_cache/*.pb; do \
      sz=$(wc -c < "$pb"); \
      if [ "$sz" -lt 10000 ]; then \
        echo "ERROR: $pb is ${sz}B -- truncated or a stale git-LFS pointer stub." >&2; \
        echo "Update your checkout (the .pb files are plain git blobs now)." >&2; \
        exit 1; \
      fi; \
    done; \
    echo "essentia model cache OK ($(ls models/essentia_cache/*.pb | wc -l) graphs)"

EXPOSE 4000

# Per-worker native thread cap + TF log level. TF_ENABLE_ONEDNN_OPTS /
# TF_XLA_FLAGS / TF_FORCE_GPU_ALLOW_GROWTH are already set above. ANALYSIS_THREADS
# is read by src/config/threads.py; override via `--env` at deploy time.
ENV ANALYSIS_THREADS=4 \
    OMP_NUM_THREADS=4 \
    TF_NUM_INTRAOP_THREADS=4 \
    TF_NUM_INTEROP_THREADS=1 \
    TF_CPP_MIN_LOG_LEVEL=2

# See essentia-cpu.Dockerfile for the rationale. Note: on GPU, raising
# WEB_CONCURRENCY means multiple processes sharing one GPU -- size it against
# GPU memory, not just host RAM.
CMD ["python3.11", "-m", "gunicorn", "-c", "gunicorn.conf.py", "wsgi:app"]
