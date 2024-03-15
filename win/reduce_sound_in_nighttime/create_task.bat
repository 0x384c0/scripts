@echo off

set "taskName=ReduceSoundInNighttime"
set "scriptPath=%~dp0reduce_sound_in_nighttime.ps1"
set "userLogonTrigger=UserLogon"
set "repeatInterval=30"

schtasks /Create /TN "%taskName%" /TR "powershell.exe -WindowStyle hidden -ExecutionPolicy Bypass -File \"%scriptPath%\"" /SC ONLOGON /RU System /RL HIGHEST /F

control schedtasks

pause