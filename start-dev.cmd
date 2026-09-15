@echo off
chcp 65001 >nul
setlocal

cd /d "%~dp0"

set "PROJECT_ROOT=%~dp0"
set "GO_EXE=%~dp0..\..\tools\go1.25.12\go\bin\go.exe"
set "BUN_EXE=%USERPROFILE%\.bun\bin\bun.exe"
set "GOTOOLCHAIN=local"
set "GOPROXY=https://goproxy.cn,direct"
set "API_BASE_URL=http://127.0.0.1:8080"
if not defined DRAMA_FFPROBE_PATH if exist "D:\work\剪映\tools\ffmpeg-9.0.1-essentials_build\bin\ffprobe.exe" set "DRAMA_FFPROBE_PATH=D:\work\剪映\tools\ffmpeg-9.0.1-essentials_build\bin\ffprobe.exe"

if not exist "%GO_EXE%" (
    echo [ERROR] Go was not found at:
    echo         %GO_EXE%
    pause
    exit /b 1
)

if not exist "%BUN_EXE%" (
    echo [ERROR] Bun was not found at:
    echo         %BUN_EXE%
    pause
    exit /b 1
)

call :is_port_listening 8080
if errorlevel 1 (
    echo Starting backend on http://127.0.0.1:8080 ...
    start "Infinite Canvas Backend" /D "%PROJECT_ROOT%" "%GO_EXE%" run .
) else (
    echo Backend is already listening on port 8080.
)

call :is_port_listening 3000
if errorlevel 1 (
    echo Starting frontend on http://127.0.0.1:3000 ...
    start "Infinite Canvas Frontend" /D "%PROJECT_ROOT%web" "%BUN_EXE%" run dev
) else (
    echo Frontend is already listening on port 3000.
)

ping 127.0.0.1 -n 3 >nul
if /I "%~1"=="--no-browser" goto startup_complete
start "" "http://127.0.0.1:3000"

:startup_complete
echo Infinite Canvas startup completed.
exit /b 0

:is_port_listening
powershell.exe -NoProfile -Command "if (Get-NetTCPConnection -State Listen -LocalPort %1 -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }"
exit /b %errorlevel%
