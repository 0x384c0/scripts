net stop wuauserv
sc config wuauserv start= disabled

echo Windows Update Medic Service
sc stop WaasMedicSvc
REG ADD HKLM\SYSTEM\CurrentControlSet\Services\WaasMedicSvc /v Start /f /t REG_DWORD /d 4
echo.

echo Orchestrator
sc stop UsoSvc
REG ADD HKLM\SYSTEM\CurrentControlSet\Services\UsoSvc /v Start /f /t REG_DWORD /d 4
echo.

echo Auto update Policy
reg add HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate\AU /v NoAutoUpdate /d 1 /t REG_DWORD /f

pause