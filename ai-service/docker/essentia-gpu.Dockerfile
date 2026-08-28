# syntax=docker/dockerfile:1
#
# Builds essentia-tensorflow's Python bindings for Linux/amd64 + GPU, since no
# Linux wheel has been published to PyPI since Python 3.7 (verified against
# PyPI's package index directly) and the official mtgupf/essentia-tensorflow
# Docker image is a dead 2020 Python 3.6 build.
#
# The essentia-libs stage below is adapted from lagmoellertim/essentia-docker
# (github.com/lagmoellertim/essentia-docker, MIT licensed), which builds
# FFmpeg + Essentia's C++ core + the TensorFlow C library. Their published
# image pins FFmpeg 4.4.4, but Essentia's master branch requires FFmpeg 5.0+
# (see github.com/MTG/essentia commit 1153d55928, "Fix FFmpeg 5.x
# compatibility issues" -- confirmed against a real build here:
# AVChannelLayout/ch_layout aren't declared with 4.4.4's headers). So their
# build steps are inlined here with a newer FFMPEG_VERSION instead of FROM-ing
# their image directly.
#
# Base OS here MUST match the runtime stage's base OS (both ubuntu:22.04 /
# glibc 2.35), not just its CUDA version. This stage's .so files (Essentia's
# C++ core, its Python extension module, and the TensorFlow C library) are
# copied wholesale into the runtime stage and loaded into the same process as
# the runtime's own libc -- if the two stages' glibc/libstdc++ ABI versions
# differ, a malloc()'d-in-one/free()'d-in-another mismatch is possible.
# Confirmed via a real deployment: using debian:bookworm-slim (glibc 2.36)
# here against a runtime base of ubuntu:22.04 (glibc 2.35) built and ran fine
# through model *loading*, then crashed with "malloc(): invalid size
# (unsorted)" -- a glibc heap-corruption abort, uncatchable from Python --
# on the very first GPU inference call.
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

ARG TENSORFLOW_VERSION=2.13.0
RUN wget -q https://github.com/ika-rwth-aachen/libtensorflow_cc/releases/download/v${TENSORFLOW_VERSION}/libtensorflow-cc_${TENSORFLOW_VERSION}-gpu_amd64.deb && \
    dpkg -i libtensorflow-cc_${TENSORFLOW_VERSION}-gpu_amd64.deb && \
    rm -f libtensorflow-cc_${TENSORFLOW_VERSION}-gpu_amd64.deb && \
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

# pip for python3.11 was already bootstrapped via get-pip.py above (not the
# python3-pip apt package -- on 22.04 that pulls in python3.10 as a
# dependency instead of targeting the deadsnakes 3.11 we actually want).
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
# nvidia/cuda for the GPU runtime libraries the TensorFlow C library needs;
# Essentia's own build (C++ core + Python bindings) comes from essentia-libs
# above, which now uses the same ubuntu:22.04 base (glibc 2.35) as here --
# see the essentia-libs stage header comment for why that match matters.
# TensorFlow 2.13 (the newest libtensorflow_cc GPU build available -- see
# essentia-libs above) was only tested against CUDA 11.8 + cuDNN 8.6
# (tensorflow.org/install/source#gpu). It dlopen()s CUDA libraries by exact
# SONAME at runtime (libcudart.so.11, not .so.12), so a CUDA 12.x base looks
# fine at a glance -- libcudart.so.12 exists -- but TF can't find what it's
# actually looking for and silently falls back to CPU. Confirmed via a real
# deployment: "Cannot dlopen some GPU libraries... Skipping registering GPU
# devices" despite running on an actual GPU instance.
FROM nvidia/cuda:11.8.0-cudnn8-runtime-ubuntu22.04 AS runtime
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
# dist-packages dir (confirmed on the prior debian-based build stage) or a
# python3.11-specific one now that the build stage was switched to
# ubuntu:22.04 + deadsnakes -- list every plausible path so python3.11 finds
# it regardless of which one waf actually used.
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
RUN grep -v '^essentia-tensorflow' requirements.txt > requirements.docker.txt && \
    python3.11 -m pip install --no-cache-dir cython==3.0.1 "numpy>=1.26.0" && \
    python3.11 -m pip install --no-cache-dir -r requirements.docker.txt

COPY . .

EXPOSE 4000
CMD ["python3.11", "app.py"]
