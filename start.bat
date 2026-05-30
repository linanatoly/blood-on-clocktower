@echo off
chcp 65001 >nul

echo ================================================
echo   Blood on the Clocktower - Server Launcher
echo ================================================
echo.

:: 优先使用免安装的 server.exe
if exist "server.exe" (
    echo [INFO] 使用免安装模式启动 (server.exe^)...
    start /b server.exe
    goto :wait_start
)

:: 检查 Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] 未找到 Node.js，且 server.exe 不存在。
    echo 请安装 Node.js：https://nodejs.org/
    echo 或从 Release 页面下载 server.exe
    pause
    exit /b 1
)

:: 检查依赖
if not exist "node_modules" (
    echo [INFO] 正在安装依赖...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] 依赖安装失败。
        pause
        exit /b 1
    )
)

:: 使用 Node.js 启动
echo [INFO] 使用 Node.js 启动...
start /b node server.js

:wait_start
:: 等待服务就绪
echo [INFO] 等待服务启动...
powershell -NoProfile -Command "$ok=$false; for($i=0;$i -lt 30;$i++){try{$r=Invoke-WebRequest -Uri 'http://localhost:8080/api/status' -UseBasicParsing -TimeoutSec 2;if($r.StatusCode -eq 200){$ok=$true;break}}catch{};Start-Sleep -Seconds 1}; if($ok){exit 0}else{exit 1}"
if %errorlevel% neq 0 (
    echo [WARN] 服务可能尚未就绪，仍尝试打开浏览器...
    timeout /t 2 /nobreak >nul
)

:: 打开浏览器
echo [INFO] 打开启动器页面...
start "" http://localhost:8080/launcher.html

echo.
echo ================================================
echo   服务已启动！
echo   启动器已自动打开，如未打开请访问：
echo   http://localhost:8080/launcher.html
echo ================================================
echo.
powershell -NoProfile -Command "Write-Host '!!! 关闭此窗口会导致服务停止和游戏数据消失，请在确认结束游戏后关闭 !!!' -ForegroundColor Yellow"
echo.
pause
