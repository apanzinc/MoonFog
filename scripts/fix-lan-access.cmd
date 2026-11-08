@echo off
setlocal
rem MoonFog dev server: allow inbound TCP 8132 on all firewall profiles
rem (ZeroTier adapter is classified as "Public", while the node.exe rule only covers "Private")

set "LOG=%~dp0fix-lan-access.log"
echo [%date% %time%] start, admin-check >> "%LOG%"

net session >nul 2>&1
if not "%errorlevel%"=="0" (
  echo [%date% %time%] not elevated, requesting elevation >> "%LOG%"
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

echo [%date% %time%] elevated ok >> "%LOG%"
netsh advfirewall firewall delete rule name="MoonFogDev8132" >> "%LOG%" 2>&1
netsh advfirewall firewall add rule name="MoonFogDev8132" dir=in action=allow protocol=TCP localport=8132 profile=any enable=yes >> "%LOG%" 2>&1
echo [%date% %time%] netsh exit=%errorlevel% >> "%LOG%"
netsh advfirewall firewall show rule name="MoonFogDev8132" >> "%LOG%" 2>&1
echo [%date% %time%] done >> "%LOG%"
exit /b
