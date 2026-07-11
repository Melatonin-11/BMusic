@echo off
cd /d "%~dp0"
title Bili-Randomizer Launcher

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed!
    echo Please download and install Node.js from https://nodejs.org/
    pause
    exit /b
)

if not exist node_modules (
    echo [INFO] Installing dependencies (npm install)...
    call npm install
)

if not exist dist (
    echo [INFO] Building application (npm run build)...
    call npm run build
)

echo [INFO] Starting browser...
start "" /min cmd /c "timeout /t 2 >nul && start http://localhost:3000"

echo [INFO] Starting Bili-Randomizer...
node dist/server.cjs
pause
