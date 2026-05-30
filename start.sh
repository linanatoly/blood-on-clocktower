#!/bin/bash

echo "================================================"
echo "  Blood on the Clocktower - Server Launcher"
echo "================================================"
echo ""

# Switch to script directory
cd "$(dirname "$0")"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js not found. Please install Node.js first."
    echo "Download: https://nodejs.org/"
    read -p "Press Enter to exit..."
    exit 1
fi

# Check dependencies
if [ ! -d "node_modules" ]; then
    echo "[INFO] Installing dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        echo "[ERROR] Failed to install dependencies."
        read -p "Press Enter to exit..."
        exit 1
    fi
fi

# Start server in background
echo "[INFO] Starting server..."
node server.js &
SERVER_PID=$!

# Wait for server to be ready
echo "[INFO] Waiting for server to be ready..."
for i in $(seq 1 30); do
    if curl -s http://localhost:8080/api/status > /dev/null 2>&1; then
        break
    fi
    sleep 1
done

# Open browser
if command -v open &> /dev/null; then
    open "http://localhost:8080/launcher.html"
elif command -v xdg-open &> /dev/null; then
    xdg-open "http://localhost:8080/launcher.html"
fi

echo ""
echo "================================================"
echo "  Server is running!"
echo "  Launcher opened in browser."
echo "================================================"
echo ""
echo -e "\033[33m!!! 关闭此窗口会导致服务停止和游戏数据消失，请在确认结束游戏后关闭 !!!\033[0m"
echo ""
echo "  Press Ctrl+C to stop the server."

# Wait for server process (keeps script alive, Ctrl+C kills both)
wait $SERVER_PID
