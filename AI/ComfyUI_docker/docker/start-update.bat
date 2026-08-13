@echo off
cd /d "%~dp0"
set COMFYUI_UPDATE=1
IF EXIST G:\AI\comfy\ (
    echo G: drive found, mounting extra volumes...
    docker compose -f docker-compose.yml -f docker-compose.gdrive.yml up -d
) ELSE (
    echo G: drive not found, starting without extra mounts...
    docker compose up -d
)
