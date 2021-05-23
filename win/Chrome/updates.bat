net stop gupdate
net stop gupdatem
net stop GoogleChromeElevationService

sc config gupdate start= disabled
sc config gupdatem start= disabled
sc config GoogleChromeElevationService start= disabled

SCHTASKS /Change /TN "GoogleUpdateTaskMachineCore" /DISABLE
SCHTASKS /Change /TN "GoogleUpdateTaskMachineUA" /DISABLE