# Web Terminal 重启脚本
# 杀掉占用 7681 端口的进程并重新启动

$port = 7681
$process = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue |
           Select-Object -ExpandProperty OwningProcess |
           Select-Object -First 1

if ($process) {
    Write-Host "正在停止进程 PID: $process"
    Stop-Process -Id $process -Force
    Start-Sleep -Seconds 2
}

$env:WEB_TERMINAL_TOKEN = "KJ7HI0"
Write-Host "正在启动 Web Terminal..."
node "D:\tools\mycc\.claude\skills\web-terminal\scripts\server.mjs"
