# syntax=docker/dockerfile:1
#
# CPU-only counterpart to essentia-gpu.Dockerfile -- see that file's header
# comments for the full essentia-libs build-stage rationale (FFmpeg 5.0+
# requirement, etc.). The two Dockerfiles are kept separate rather than
# parameterized by a build ARG so each runtime stage stays simple to read, at
# the cost of some duplication in the build stage.
#
# NOTE: this CPU image still links Essentia against the ika-rwth-aachen
# `libtensorflow_cc` community C++ build (below). essentia-gpu.Dockerfile has
# since been switched to Essentia's documented `setup_from_python.sh` + TF pip
# wheel approach to fix the GPU "malloc(): invalid size (unsorted)" heap-
# corruption crash. This CPU image is left on the old approach for now because
# it *works* -- once the GPU image is verified in production, align this one to
# the same TF-wheel approach in a follow-up (see essentia-gpu.Dockerfile).
#
# Why CPU has been production instead of GPU: the GPU runtime (nvidia T4 via HF
# Inference Endpoints) hit a reproducible "malloc(): invalid size (unsorted)"
# glibc heap-corruption crash on the first GPU inference call through Essentia's
# TensorflowPredictEffnetDiscogs. The CPU path runs the exact same code and
# works correctly. See essentia-gpu.Dockerfile and git history.

FROM ubuntu:22.04 AS essentia-libs
ENV DEBIAN_FRONTEND=noninteractive

# No libavcodec-dev/libavformat-dev/etc here: those are the distro's stock
# FFmpeg 4.4 dev headers, which is exactly the version essentia's master
# branch is incompatible with -- FFmpeg is built from source below instead,
# into /usr/local, ahead of any system FFmpeg on the pkg-config/linker search
# path.
#
# python3.11 explicitly (not the "python3" package, which is 3.10 on 22.04's
# default archive) -- must match the runtime stage's python3.11 exactly,
# since Essentia's Python bindings compile a CPython extension module tied
# to a specific interpreter ABI. 22.04's own universe archive already
# carries a python3.11 package (3.11.0~rc1), same as what the runtime stage
# installs.
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    build-essential \
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
# a more general-purpose FFmpeg build would enable. FFmpeg's built-in
# decoders already cover MP3/AAC/FLAC/etc.
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

# CPU-only variant of the community-built TensorFlow C library (same source
# as essentia-gpu.Dockerfile, just the non-GPU .deb) -- no CUDA/cuDNN
# runtime needed anywhere in this image.
ARG TENSORFLOW_VERSION=2.13.0
RUN wget -q https://github.com/ika-rwth-aachen/libtensorflow_cc/releases/download/v${TENSORFLOW_VERSION}/libtensorflow-cc_${TENSORFLOW_VERSION}_amd64.deb && \
    dpkg -i libtensorflow-cc_${TENSORFLOW_VERSION}_amd64.deb && \
    rm -f libtensorflow-cc_${TENSORFLOW_VERSION}_amd64.deb && \
    ln -sf /usr/local/lib/libtensorflow_cc.so /usr/local/lib/libtensorflow.so && \
    mkdir -p /usr/local/lib/pkgconfig && \
    printf '%s\n' \
      'prefix=/usr/local' \
      'includedir=${prefix}/include/tensorflow' \
      'libdir=${prefix}/lib' \
      '' \
      'Name: TensorFlow' \
      'Description: TensorFlow C library' \
      'Version: '"${TENSORFLOW_VERSION}" \
      'Libs: -L${libdir} -ltensorflow -ltensorflow_framework' \
      'Cflags: -I${includedir}' \
      > /usr/local/lib/pkgconfig/tensorflow.pc && \
    ldconfig

RUN python3 -m pip install --no-cache-dir numpy pyyaml

ARG ESSENTIA_COMMIT=master
RUN git clone --depth 1 https://github.com/MTG/essentia.git /opt/essentia && \
    cd /opt/essentia && \
    git fetch --depth 1 origin ${ESSENTIA_COMMIT} && \
    git checkout ${ESSENTIA_COMMIT}

WORKDIR /opt/essentia
RUN python3 waf configure --with-tensorflow --with-python && \
    python3 waf && \
    python3 waf install

# ---- runtime -----------------------------------------------------------
# Plain ubuntu:22.04 -- no CUDA/cuDNN layers needed since this image never
# touches a GPU. Matches essentia-libs' base OS (glibc 2.35) for the same
# ABI-safety reason documented in essentia-gpu.Dockerfile.
FROM ubuntu:22.04 AS runtime
ENV DEBIAN_FRONTEND=noninteractive

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

COPY --from=essentia-libs /usr/local/lib /usr/local/lib
COPY --from=essentia-libs /usr/local/include /usr/local/include
RUN ldconfig

# waf install's Python destination is derived from the build stage's own
# python3-config/distutils and may land under a version-agnostic
# dist-packages dir or a python3.11-specific one -- list every plausible
# path so python3.11 finds it regardless of which one waf actually used.
ENV PYTHONPATH=/usr/local/lib/python3/dist-packages:/usr/local/lib/python3.11/dist-packages:/usr/local/lib/python3.11/site-packages

# essentia's pure-Python layer (essentia/common.py) needs numpy and six at
# import time; the essentia-libs build stage's pip install doesn't carry
# over since only /usr/local/lib+include are copied, not that stage's
# separate Python's site-packages.
RUN python3.11 -m pip install --no-cache-dir numpy six

RUN python3.11 -c "import essentia; import essentia.standard as es; print('essentia', essentia.__version__, 'OK'); print('TensorflowPredictEffnetDiscogs:', hasattr(es, 'TensorflowPredictEffnetDiscogs'))"

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
# line above -- confirmed via CI (see essentia-gpu.Dockerfile history),
# "ModuleNotFoundError: No module named 'Cython'" despite cython==3.0.1
# being installed and reported as already satisfied immediately beforehand.
RUN grep -v '^essentia-tensorflow' requirements.txt > requirements.docker.txt && \
    python3.11 -m pip install --no-cache-dir cython==3.0.1 "numpy>=1.26.0" && \
    grep -v '^madmom' requirements.docker.txt > requirements.nomadmom.txt && \
    python3.11 -m pip install --no-cache-dir -r requirements.nomadmom.txt && \
    python3.11 -m pip install --no-cache-dir --no-build-isolation "$(grep '^madmom' requirements.docker.txt)"

# Includes models/essentia_cache (kept out of .dockerignore) so the image ships
# with the ~35 MB of essentia .pb model files -- no download from
# essentia.upf.edu on a fresh replica's first request. These are plain git blobs
# (not LFS -- see .gitattributes), so a normal checkout has the real files.
COPY . .

# Fail the build early (not at runtime with a cryptic "Invalid GraphDef") if the
# .pb files are truncated / placeholder stubs -- e.g. an old checkout that still
# has git-LFS pointer files (~130 bytes) from before the LFS->plain migration.
# The smallest real graph (deam-msd-musicnn) is ~82KB.
RUN set -e; \
    for pb in models/essentia_cache/*.pb; do \
      sz=$(wc -c < "$pb"); \
      if [ "$sz" -lt 10000 ]; then \
        echo "ERROR: $pb is ${sz}B -- truncated or a stale git-LFS pointer stub, not the real model." >&2; \
        echo "Update your checkout (the .pb files are plain git blobs now)." >&2; \
        exit 1; \
      fi; \
    done; \
    echo "essentia model cache OK ($(ls models/essentia_cache/*.pb | wc -l) graphs)"

EXPOSE 4000

# Native-stack thread + TF-logging defaults. src/config/threads.py (imported
# first by app.py / wsgi.py) also sets these via os.environ.setdefault, but
# having them in the environment covers `python3.11 app.py` and any import path
# that pulls in TF before that module. ANALYSIS_THREADS=8 = the full intel-spr
# x4 vCPU count: one gunicorn worker runs one analysis at a time (analysis lock,
# see gunicorn.conf.py), so it gets the whole box. Override via `--env`.
ENV ANALYSIS_THREADS=8 \
    OMP_NUM_THREADS=8 \
    TF_NUM_INTRAOP_THREADS=8 \
    TF_NUM_INTEROP_THREADS=1 \
    TF_CPP_MIN_LOG_LEVEL=2 \
    TF_ENABLE_ONEDNN_OPTS=0

# Run under gunicorn (multiple worker processes) rather than `python app.py`'s
# single-threaded Werkzeug dev server, so one HF endpoint replica can serve
# concurrent batch-analysis requests. Worker count / timeout knobs live in
# gunicorn.conf.py (WEB_CONCURRENCY env). `python3.11 app.py` still works for
# local dev.
CMD ["python3.11", "-m", "gunicorn", "-c", "gunicorn.conf.py", "wsgi:app"]
