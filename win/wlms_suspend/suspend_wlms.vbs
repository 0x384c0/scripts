Set oShell = CreateObject ("Wscript.Shell") 
Dim strArgs
strArgs = "cmd /c d:\Applications\Distr\System\windows\suspend_wlms.bat"
oShell.Run strArgs, 0, false