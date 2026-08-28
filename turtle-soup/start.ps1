# 海龟汤在线推理 - 一键启动
# 流程:构建前端 → 启动后端(3000)→ cloudflared 快速隧道 → 打印公网地址
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "===== 海龟汤在线推理 启动器 =====" -ForegroundColor Cyan

# 1. 依赖检查
if (-not (Test-Path "node_modules")) {
    Write-Host "[错误] 缺少依赖,请先运行: npm install" -ForegroundColor Red
    exit 1
}

# 2. cloudflared 检查
if (-not (Get-Command cloudflared -ErrorAction SilentlyContinue)) {
    Write-Host "[错误] 未找到 cloudflared,请先安装:" -ForegroundColor Red
    Write-Host "    下载: https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.msi" -ForegroundColor Yellow
    exit 1
}

# 3. 构建前端
Write-Host "[1/3] 构建前端..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "[错误] 前端构建失败" -ForegroundColor Red
    exit 1
}

# 4. 启动后端
Write-Host "[2/3] 启动后端服务(端口 3000)..."
$server = Start-Process node -ArgumentList "server/index.js" -PassThru -WindowStyle Hidden
Start-Sleep 2
if ($server.HasExited) {
    Write-Host "[错误] 后端启动失败" -ForegroundColor Red
    exit 1
}
Write-Host "    后端已启动 (PID $($server.Id))" -ForegroundColor Green

# 5. 启动 cloudflared 快速隧道
Write-Host "[3/3] 启动 cloudflared 隧道..."
$tunnelLog = Join-Path $PSScriptRoot ".cloudflared-tunnel.log"
$cloudflared = Start-Process cloudflared -ArgumentList "tunnel", "--url", "http://localhost:3000", "--no-autoupdate" -PassThru -WindowStyle Hidden -RedirectStandardOutput $tunnelLog -RedirectStandardError $tunnelLog

$publicUrl = ""
for ($i = 0; $i -lt 15 -and -not $publicUrl; $i++) {
    Start-Sleep 1
    try {
        $publicUrl = (Select-String -Path $tunnelLog -Pattern "https://[a-z0-9-]+\.trycloudflare\.com" -ErrorAction SilentlyContinue | Select-Object -Last 1).Matches.Value
    } catch { }
}

Write-Host ""
Write-Host "================================" -ForegroundColor Cyan
if ($publicUrl) {
    Write-Host "  公网地址(分享给朋友): $publicUrl" -ForegroundColor Green
} else {
    Write-Host "  无法自动获取公网地址,请查看 $tunnelLog" -ForegroundColor Yellow
}
Write-Host "  本地地址: http://127.0.0.1:3000" -ForegroundColor Cyan
Write-Host "  (快速隧道地址重启后变化,固定地址需绑定域名: cloudflared tunnel login)" -ForegroundColor DarkGray
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "按 Ctrl+C 退出(将停止后端与 cloudflared)" -ForegroundColor DarkGray

try {
    Wait-Process -Id $server.Id
} finally {
    Stop-Process -Id $cloudflared.Id -ErrorAction SilentlyContinue
    Stop-Process -Id $server.Id -ErrorAction SilentlyContinue
    Remove-Item $tunnelLog -ErrorAction SilentlyContinue
    Write-Host ""
    Write-Host "已停止服务" -ForegroundColor Gray
}
