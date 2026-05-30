@echo off
chcp 65001 >nul

echo ================================================
echo   Blood on the Clocktower - Server Launcher
echo ================================================
echo.

:: Check Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found. Please install Node.js first.
    echo Download: https://nodejs.org/
    pause
    exit /b 1
)

:: Check dependencies
if not exist "node_modules" (
    echo [INFO] Installing dependencies...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install dependencies.
        pause
        exit /b 1
    )
)

:: Start server in background (same window)
echo [INFO] Starting server...
start /b node server.js

:: Wait for server to be ready
echo [INFO] Waiting for server to be ready...
powershell -NoProfile -Command "$ok=$false; for($i=0;$i -lt 30;$i++){try{$r=Invoke-WebRequest -Uri 'http://localhost:8080/api/status' -UseBasicParsing -TimeoutSec 2;if($r.StatusCode -eq 200){$ok=$true;break}}catch{};Start-Sleep -Seconds 1}; if($ok){exit 0}else{exit 1}"
if %errorlevel% neq 0 (
    echo [WARN] Server may not be ready yet, opening browser anyway...
    timeout /t 2 /nobreak >nul
)

:: Open browser
echo [INFO] Opening launcher page...
start "" http://localhost:8080/launcher.html

echo.
echo ================================================
echo   Server is running!
echo   Launcher opened in browser.
echo ================================================
echo.
powershell -NoProfile -Command "Write-Host '!!! 关闭此窗口会导致服务停止和游戏数据消失，请在确认结束游戏后关闭 !!!' -ForegroundColor Yellow"
echo.
pause
