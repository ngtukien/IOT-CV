@echo off
rem Bat toan bo du an: SITL (WSL) -> MQTT (Docker, neu co) -> Backend -> Frontend -> mo trinh duyet.
rem Chay lai nhieu lan van an toan: moi lan deu tat ban cu truoc.
rem Tat het: dung-tat-ca.bat
setlocal
cd /d "%~dp0"

set "MAVLINK_ENDPOINT=tcp:127.0.0.1:5760"
set "WEB_URL=http://localhost:5173"

echo [1/5] Tat ban cu (cong 8000, 5173, SITL)...
call "%~dp0dung-tat-ca.bat" /quiet

echo [2/5] Bat SITL trong WSL...
wsl -d Ubuntu --exec bash -lc "cd /mnt/d/Coding/IOT-CV && export COLUMNS=200 && bash scripts/sitl/sitl-headless.sh start" 2>nul
if errorlevel 1 (
  echo LOI: khong bat duoc SITL. Xem log: ~/.cache/iot-cv-sitl/headless/out.log trong WSL.
  pause
  exit /b 1
)

echo [3/5] MQTT broker (mosquitto)...
where docker >nul 2>nul
if errorlevel 1 (
  echo   Bo qua: khong co Docker. Phan IoT/MQTT se khong chay, phan con lai van chay.
) else (
  docker info >nul 2>nul
  if errorlevel 1 (
    echo   Bo qua: Docker Desktop chua bat.
  ) else (
    docker compose up -d mosquitto
  )
)

echo [4/5] Backend (cua so rieng, MAVLINK_ENDPOINT=%MAVLINK_ENDPOINT%)...
start "IOT-CV Backend" /min cmd /k "uv run uvicorn backend.app:app --host 127.0.0.1 --port 8000"

echo [5/5] Frontend (cua so rieng)...
start "IOT-CV Frontend" /min /d "%~dp0frontend" cmd /k pnpm dev

echo Doi backend noi duoc SITL...
set /a TRIES=0
:wait
set /a TRIES+=1
powershell -NoProfile -Command "Start-Sleep 2"
powershell -NoProfile -Command "try { $s = Invoke-RestMethod http://127.0.0.1:8000/api/system -TimeoutSec 2; if ($s.link_alive) { exit 0 } else { exit 1 } } catch { exit 1 }"
if not errorlevel 1 goto ready
if %TRIES% geq 30 (
  echo CANH BAO: sau 60 s backend van chua noi duoc SITL. Xem cua so "IOT-CV Backend".
  goto open
)
goto wait

:ready
echo OK: backend da noi SITL.

:open
start "" "%WEB_URL%"
echo.
echo   SITL     tcp:127.0.0.1:5760   (Mission Planner dung cong 5762)
echo   Backend  http://127.0.0.1:8000
echo   Web      %WEB_URL%
echo   Tat het: dung-tat-ca.bat
echo.
pause
