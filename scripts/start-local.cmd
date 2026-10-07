@echo off
setlocal
set "ACTION=%~1"
if "%ACTION%"=="" set "ACTION=Start"
pwsh.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-local.ps1" -Action "%ACTION%"
if errorlevel 1 (
  echo 朝堂本地启动失败，请查看上面的错误信息。
  pause
)
endlocal
