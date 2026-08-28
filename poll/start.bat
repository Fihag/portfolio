@echo off
chcp 65001 >nul
setlocal
title Poll API - 多账户轮询代理
cd /d "%~dp0"

echo.
echo  ============================================
echo    Poll API  多账户轮询代理  一键启动
echo  ============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
    echo  [!] 未检测到 Node.js, 请先安装: https://nodejs.org
    echo      安装后重新运行本脚本即可。
    pause
    exit /b 1
)

echo  [i] 正在启动服务...
echo  [i] 管理界面: http://127.0.0.1:7891/admin
echo  [i] 按 Ctrl+C 停止
echo.
start "" "http://127.0.0.1:7891/admin"

node server.js

echo.
echo  [i] 服务已退出。
pause
endlocal
