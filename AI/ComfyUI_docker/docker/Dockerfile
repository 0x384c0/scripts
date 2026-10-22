FROM nvidia/cuda:13.0.2-cudnn-runtime-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    CC=/usr/bin/gcc \
    CXX=/usr/bin/g++ \
    TRITON_CACHE_DIR=/venv/.triton-cache

RUN apt-get update && apt-get install -y \
    build-essential \
    wget \
    git \
    ffmpeg \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Stable Python 3.11.x from python-build-standalone (via uv). The Ubuntu 22.04 universe repo
# only has 3.11.0rc1, which segfaults with compiled extensions (kornia_rs etc.), and the
# deadsnakes PPA on Launchpad is frequently unavailable (503) and breaks the build.
# Symlinked to /usr/bin/python3.11 so the persistent /venv (home = /usr/bin) keeps working.
COPY --from=ghcr.io/astral-sh/uv:0.12.22 /uv /usr/local/bin/uv
ENV UV_PYTHON_INSTALL_DIR=/opt/python
RUN uv python install 3.11 \
    && PY=$(readlink -f "$(uv python find --managed-python 3.11)") \
    && ln -sf "$PY" /usr/bin/python3.11 \
    && ln -sf /usr/bin/python3.11 /usr/bin/python3 \
    && ln -sf /usr/bin/python3.11 /usr/bin/python \
    && rm -f "$(dirname "$PY")/../lib/python3.11/EXTERNALLY-MANAGED" \
    && python -m ensurepip \
    && python -m pip install --upgrade pip \
    && ln -sf "$(dirname "$PY")/pip3.11" /usr/local/bin/pip

# PyTorch with CUDA 13.0 — RTX 50xx (sm_120) native, and comfy-kitchen only enables its optimized
# int8/nvfp4 CUDA kernels on cu130+. Installed separately before the rest so it
# uses the CUDA wheel index rather than the CPU-only PyPI build
RUN pip install --no-cache-dir \
    torch torchvision torchaudio \
    --index-url https://download.pytorch.org/whl/cu130

# 1. Get requirements.txt — local copy if ComfyUI is cloned, GitHub otherwise
RUN --mount=type=bind,source=.,target=/context \
    if [ -f /context/ComfyUI/requirements.txt ]; then \
        echo "[build] Using local ComfyUI/requirements.txt" \
        && cp /context/ComfyUI/requirements.txt /tmp/comfyui-requirements.txt; \
    else \
        echo "[build] ComfyUI not cloned — fetching requirements.txt from GitHub" \
        && wget -qO /tmp/comfyui-requirements.txt \
            https://raw.githubusercontent.com/comfyanonymous/ComfyUI/master/requirements.txt; \
    fi

# 2. Install deps, skipping torch (already installed with CUDA) and display-only libs
RUN grep -vE "^(torchvision|torchaudio|torch)(\s|$)" /tmp/comfyui-requirements.txt \
    | grep -vE "^(PyOpenGL|glfw)(\s|$)" \
    | grep -v "^#" \
    | grep -v "^\s*$" \
    | pip install --no-cache-dir -r /dev/stdin

WORKDIR /app

COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 8188

ENTRYPOINT ["/entrypoint.sh"]
CMD ["python", "main.py", "--listen", "0.0.0.0", "--port", "8188"]
