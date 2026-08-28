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

FROM debian:bookworm-slim AS essentia-libs
ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    build-essential \
    libeigen3-dev \
    libyaml-dev \
    libfftw3-dev \
    libavcodec-dev \
    libavformat-dev \
    libavutil-dev \
    libswresample-dev \
    libsamplerate0-dev \
    libtag1-dev \
    libchromaprint-dev \
    python3 \
    python3-dev \
    git \
    ca-certificates \
    wget \
    curl \
    nasm yasm \
    libx264-dev \
    libx265-dev \
    libvpx-dev \
    libmp3lame-dev \
    libopus-dev \
    libvorbis-dev \
    libass-dev \
    libfreetype6-dev \
    zlib1g-dev \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

ARG FFMPEG_VERSION=7.1.1
WORKDIR /opt
RUN curl -LO https://ffmpeg.org/releases/ffmpeg-${FFMPEG_VERSION}.tar.xz && \
    tar xJf ffmpeg-${FFMPEG_VERSION}.tar.xz && \
    cd ffmpeg-${FFMPEG_VERSION} && \
    ./configure --prefix=/usr/local \
    --enable-gpl \
    --enable-nonfree \
    --enable-pic \
    --enable-shared \
    --disable-static \
    --enable-libx264 \
    --enable-libmp3lame \
    --enable-libopus \
    --enable-libvpx && \
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

RUN apt-get update && apt-get install -y --no-install-recommends python3-pip \
    && rm -rf /var/lib/apt/lists/*
# Debian 12 marks the system Python as externally-managed (PEP 668); this is
# a throwaway build stage, not a host system, so --break-system-packages is
# fine here.
RUN python3 -m pip install --no-cache-dir --break-system-packages numpy pyyaml

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
# above, which used debian:bookworm-slim's default Python 3 (3.11).
FROM nvidia/cuda:12.2.2-cudnn8-runtime-ubuntu22.04 AS runtime
ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.11 python3-pip \
    ffmpeg libsndfile1 libchromaprint-tools \
    libtag1v5 libsamplerate0 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=essentia-libs /usr/local/lib /usr/local/lib
COPY --from=essentia-libs /usr/local/include /usr/local/include
COPY --from=essentia-libs /usr/local/lib/python3.11/dist-packages /usr/local/lib/python3.11/dist-packages
RUN ldconfig

RUN python3.11 -c "import essentia; import essentia.standard as es; print('essentia', essentia.__version__, 'OK'); print('TensorflowPredictEffnetDiscogs:', hasattr(es, 'TensorflowPredictEffnetDiscogs'))"
