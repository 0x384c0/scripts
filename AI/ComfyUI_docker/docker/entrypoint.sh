#!/bin/bash
set -e

if [ ! -f "/app/main.py" ]; then
    echo "[entrypoint] ComfyUI not found at /app — cloning from GitHub..."
    git clone --depth=1 https://github.com/comfyanonymous/ComfyUI.git /tmp/comfyui_clone
    cp -a /tmp/comfyui_clone/. /app/
    rm -rf /tmp/comfyui_clone
    echo "[entrypoint] ComfyUI cloned successfully."
fi

# Persistent venv mounted from ./docker/venv/ on the host.
# --system-site-packages makes torch and image-level packages available.
# Custom node pip installs land here and survive container recreation.
if [ ! -f "/venv/bin/activate" ]; then
    echo "[entrypoint] Creating persistent venv at /venv..."
    python -m venv --system-site-packages /venv
fi

source /venv/bin/activate

EXTRA_ARGS=()
[ -n "$COMFYUI_INPUT_DIR" ]  && EXTRA_ARGS+=(--input-directory  "$COMFYUI_INPUT_DIR")
[ -n "$COMFYUI_OUTPUT_DIR" ] && EXTRA_ARGS+=(--output-directory "$COMFYUI_OUTPUT_DIR")

exec "$@" "${EXTRA_ARGS[@]}"
