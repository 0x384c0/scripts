#!/bin/bash
set -e

if [ ! -f "/app/main.py" ]; then
    echo "[entrypoint] ComfyUI not found at /app — cloning from GitHub..."
    git clone --depth=1 https://github.com/comfyanonymous/ComfyUI.git /tmp/comfyui_clone
    cp -a /tmp/comfyui_clone/. /app/
    rm -rf /tmp/comfyui_clone
    echo "[entrypoint] ComfyUI cloned successfully."
fi

exec "$@"
