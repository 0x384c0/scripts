FROM nvidia/cuda:12.6.0-cudnn-runtime-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    CC=/usr/bin/gcc \
    CXX=/usr/bin/g++ \
    TRITON_CACHE_DIR=/venv/.triton-cache

# deadsnakes gives stable Python 3.11.x; the Ubuntu 22.04 universe repo
# only has 3.11.0rc1, which segfaults with compiled extensions (kornia_rs etc.)
RUN apt-get update && apt-get install -y software-properties-common \
    && add-apt-repository ppa:deadsnakes/ppa \
    && apt-get update && apt-get install -y \
    python3.11 \
    python3.11-dev \
    python3.11-venv \
    build-essential \
    wget \
    git \
    ffmpeg \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

RUN update-alternatives --install /usr/bin/python python /usr/bin/python3.11 1 \
    && update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.11 1

RUN wget -qO /tmp/get-pip.py https://bootstrap.pypa.io/get-pip.py \
    && python /tmp/get-pip.py \
    && rm /tmp/get-pip.py \
    && pip install --upgrade pip

# PyTorch with CUDA 12.6 — installed separately before the rest so it
# uses the CUDA wheel index rather than the CPU-only PyPI build
RUN pip install --no-cache-dir \
    torch torchvision torchaudio \
    --index-url https://download.pytorch.org/whl/cu126

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
