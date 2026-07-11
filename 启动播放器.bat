@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Bili-Randomizer Launcher

echo ========================================
echo        Bili-Randomizer Launcher
echo ========================================
echo Project: %CD%
echo.

node -v >nul 2>&1
if errorlevel 1 goto no_node

call npm -v >nul 2>&1
if errorlevel 1 goto no_npm

if not exist "package.json" goto no_package

if exist "node_modules" goto skip_install
echo [INFO] Installing dependencies...
call npm install
if errorlevel 1 goto install_failed
:skip_install

if exist "dist\server.cjs" goto skip_build
echo [INFO] Building application...
call npm run build
if errorlevel 1 goto build_failed
:skip_build

echo [INFO] Starting application...
echo [INFO] URL: http://localhost:3000
echo [INFO] Keep this window open. Press Ctrl+C to stop.
echo.

start "" cmd /c "ping 127.0.0.1 -n 3 >nul && start http://localhost:3000"
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
echo [ERROR] npm was not found. Reinstall Node.js.
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
