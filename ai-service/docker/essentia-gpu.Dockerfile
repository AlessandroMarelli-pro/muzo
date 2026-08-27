# syntax=docker/dockerfile:1
#
# Builds essentia-tensorflow's Python bindings for Linux/amd64 + GPU, since no
# Linux wheel has been published to PyPI since Python 3.7 (verified against
# PyPI's package index directly) and the official mtgupf/essentia-tensorflow
# Docker image is a dead 2020 Python 3.6 build.
#
# Reuses lagmoellertim/essentia:latest-tensorflow-gpu (actively maintained,
# updated 2025) for the slow part -- FFmpeg + the TensorFlow C library --
# then builds just Essentia's Python bindings (waf) against those libs with a
# modern Python.

FROM lagmoellertim/essentia:latest-tensorflow-gpu AS essentia-libs

FROM nvidia/cuda:12.2.2-cudnn8-runtime-ubuntu22.04 AS build
ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.11 python3.11-dev python3-pip \
    build-essential pkg-config git ca-certificates \
    libeigen3-dev libyaml-dev libfftw3-dev \
    libavcodec-dev libavformat-dev libavutil-dev libswresample-dev \
    libsamplerate0-dev libtag1-dev libchromaprint-dev \
    && rm -rf /var/lib/apt/lists/*

COPY --from=essentia-libs /usr/local/lib /usr/local/lib
COPY --from=essentia-libs /usr/local/include /usr/local/include
COPY --from=essentia-libs /usr/local/lib/pkgconfig /usr/local/lib/pkgconfig
RUN ldconfig

# The base image's tensorflow.pc has a broken Cflags (-I/usr/include, which
# doesn't exist) -- the real headers are nested under
# /usr/local/include/tensorflow/tensorflow/c/c_api.h. Regenerate it correctly
# so essentia's waf configure can find the tensorflow pkg-config package.
RUN printf '%s\n' \
    'prefix=/usr/local' \
    'includedir=${prefix}/include/tensorflow' \
    'libdir=${prefix}/lib' \
    '' \
    'Name: TensorFlow' \
    'Description: TensorFlow C library' \
    'Version: 2.13.0' \
    'Libs: -L${libdir} -ltensorflow -ltensorflow_framework' \
    'Cflags: -I${includedir}' \
    > /usr/local/lib/pkgconfig/tensorflow.pc

RUN python3.11 -m pip install --no-cache-dir numpy pyyaml

ARG ESSENTIA_COMMIT=master
WORKDIR /opt
RUN git clone --depth 1 https://github.com/MTG/essentia.git essentia && \
    cd essentia && \
    git fetch --depth 1 origin ${ESSENTIA_COMMIT} && git checkout ${ESSENTIA_COMMIT}

WORKDIR /opt/essentia
ENV PKG_CONFIG_PATH=/usr/local/lib/pkgconfig
# Links against the already-built libessentia.so/libtensorflow.so from the
# base image instead of recompiling the C++ core -- only the Python
# extension module is actually built here.
RUN python3.11 waf configure --with-tensorflow --python=python3.11 && \
    python3.11 waf && \
    python3.11 waf install

# ---- runtime -----------------------------------------------------------
FROM nvidia/cuda:12.2.2-cudnn8-runtime-ubuntu22.04 AS runtime
ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.11 python3-pip \
    ffmpeg libsndfile1 libchromaprint-tools \
    libtag1v5 libsamplerate0 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /usr/local/lib /usr/local/lib
COPY --from=build /usr/local/include /usr/local/include
COPY --from=build /usr/local/lib/python3.11/dist-packages /usr/local/lib/python3.11/dist-packages
RUN ldconfig

RUN python3.11 -c "import essentia; import essentia.standard as es; print('essentia', essentia.__version__, 'OK'); print('TensorflowPredictEffnetDiscogs:', hasattr(es, 'TensorflowPredictEffnetDiscogs'))"
