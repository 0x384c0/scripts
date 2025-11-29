@echo off
rem Check if an argument was provided
if "%~1"=="" (
    echo Usage: %~nx0 IP_ADDRESS
    exit /b
)

set HOST=%~1

:CHECK
ping -n 1 %HOST% | find "TTL=" >nul
if errorlevel 1 (
    echo Host %HOST% not responding...
    powershell -command "Add-Type -AssemblyName PresentationFramework;[System.Windows.MessageBox]::Show('%HOST% is not responding')"
) else (
    echo Stream %HOST% working. Exiting script.
    exit /b
)
