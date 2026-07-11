@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Bili-Randomizer Launcher

echo ========================================
echo        Bili-Randomizer Launcher
echo ========================================
echo Project: %CD%
echo.

where node.exe >nul 2>nul
if errorlevel 1 goto no_node

where npm.cmd >nul 2>nul
if errorlevel 1 goto no_npm

if not exist "package.json" goto no_package

if not exist "node_modules\" (
    echo [INFO] Installing dependencies...
    call npm.cmd install
    if errorlevel 1 goto install_failed
)

if not exist "dist\server.cjs" (
    echo [INFO] Building application...
    call npm.cmd run build
    if errorlevel 1 goto build_failed
)

echo [INFO] Starting application...
echo [INFO] URL: http://localhost:3000
echo [INFO] Keep this window open. Press Ctrl+C to stop.
echo.

start "" /b powershell.exe -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 2; Start-Process 'http://localhost:3000'"
node "dist\server.cjs"
if errorlevel 1 goto start_failed

echo.
echo [INFO] Application stopped.
pause
exit /b 0

:no_node
echo [ERROR] Node.js was not found.
echo Install Node.js LTS from: https://nodejs.org/
goto failed

:no_npm
echo [ERROR] npm.cmd was not found. Reinstall Node.js.
goto failed

:no_package
echo [ERROR] package.json was not found in this directory.
goto failed

:install_failed
echo [ERROR] npm install failed.
goto failed

:build_failed
echo [ERROR] npm run build failed.
goto failed

:start_failed
echo [ERROR] Application failed to start.
echo Port 3000 may already be in use.
goto failed

:failed
echo.
echo Review the error above.
pause
exit /b 1
