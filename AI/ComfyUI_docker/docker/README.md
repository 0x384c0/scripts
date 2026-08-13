# ComfyUI Docker (GPU)

Runs ComfyUI in a Docker container with host GPU access.  
The `ComfyUI/` directory is mounted from the host — models, custom nodes, and outputs stay on disk and are never baked into the image.

## Layout

```
SD/
├── .dockerignore          ← excludes venv/models/output from build context
├── ComfyUI/               ← https://github.com/comfyanonymous/ComfyUI (mounted at /app)
└── docker/
    ├── Dockerfile         ← Ubuntu 22.04 + CUDA 12.6 + Python 3.11 (deadsnakes)
    ├── docker-compose.yml
    └── README.md
```

## Prerequisites

| Requirement | Notes |
|---|---|
| Docker Desktop ≥ 3.1 | WSL2 backend (Windows 11 default) |
| NVIDIA driver ≥ 470 | Includes WSL2 CUDA support — no Container Toolkit needed on Windows |
| ~8 GB free disk | ~6 GB image (PyTorch + CUDA libs) |

## Usage

All commands run from the `docker/` directory.

**Build** (first time, ~10–15 min):
```
docker compose build
```

**Start** (background):
```
docker compose up -d
```

Open **http://localhost:8188**

**Stop:**
```
docker compose down
```

**View logs:**
```
docker compose logs -f
```

**Verify GPU inside container:**
```
docker exec comfyui python -c "import torch; print(torch.cuda.get_device_name(0))"
```

## Rebuild after ComfyUI updates

If `ComfyUI/requirements.txt` changes, rebuild the image:
```
docker compose build
docker compose up -d
```

If only Python files changed (no new dependencies), just restart — the code is on the host and picked up immediately:
```
docker compose restart
```

**Update on boot** (git pull ComfyUI + upgrade its pip packages, torch excluded, into the persistent venv before launching):
```
docker compose up -d              # normal start
COMFYUI_UPDATE=1 docker compose up -d   # update then start
```
Or on Windows, run `start-update.bat` instead of `start.bat`.

## Extra startup flags

Edit the `command:` list in `docker-compose.yml` to add or remove flags:
```yaml
command:
  - python
  - main.py
  - --listen
  - "0.0.0.0"
  - --port
  - "8188"
  - --preview-method
  - auto
  - --lowvram
  - --disable-smart-memory
  - --use-pytorch-cross-attention
```

Useful flags:
- `--lowvram` — aggressive VRAM offloading, slower but fits on small GPUs
- `--disable-smart-memory` — always offload models when not in use
- `--use-pytorch-cross-attention` — pure PyTorch attention, no extra deps
- `--preview-method auto` — enables live generation previews
- `--force-fp16` — halves VRAM use, small quality tradeoff
- `--cpu` — run without GPU (slow, for debugging)
- `--cuda-device 1` — pick a specific GPU if you have multiple

## Auto-clone

If `ComfyUI/` is missing or empty when the container starts, the entrypoint script automatically clones the latest ComfyUI from GitHub into the mounted directory:

```
[entrypoint] ComfyUI not found at /app — cloning from GitHub...
[entrypoint] ComfyUI cloned successfully.
```

The clone is a shallow `--depth=1` fetch (fast, no full git history). After cloning, the next `docker compose build` will pick up the new `requirements.txt`.

## Notes

- `PyOpenGL` and `glfw` are **not** installed — they require a display and are not needed for the headless server.
- The `ComfyUI/venv/` on the host is ignored; Python and all dependencies live inside the image.
- Python 3.11 is installed from the **deadsnakes PPA** (stable release). Ubuntu 22.04's built-in `python3.11` package is `3.11.0rc1` and causes segfaults with compiled extensions.
