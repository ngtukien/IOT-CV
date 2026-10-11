@echo off
rem Tat Backend (8000), Frontend (5173), SITL. Mosquitto de nguyen (nhe, restart: unless-stopped).
rem Tham so /quiet: khong dung lai cho nhan phim (chay-tat-ca.bat goi kieu nay).
setlocal

powershell -NoProfile -Command "foreach ($p in 8000,5173) { Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue } }"
taskkill /fi "WINDOWTITLE eq IOT-CV Backend*" /t /f >nul 2>nul
taskkill /fi "WINDOWTITLE eq IOT-CV Frontend*" /t /f >nul 2>nul

rem Dung sitl-headless.sh stop, KHONG pkill -f (se giet luon shell dang chay lenh).
wsl -d Ubuntu --exec bash -lc "cd /mnt/d/Coding/IOT-CV && export COLUMNS=200 && bash scripts/sitl/sitl-headless.sh stop && bash scripts/sitl/sitl-headless.sh status" 2>nul

if /i not "%~1"=="/quiet" (
  echo Da tat Backend, Frontend, SITL.
  pause
)
