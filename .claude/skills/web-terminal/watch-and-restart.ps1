# Web Terminal 监控重启脚本
# 功能：检测代码变化并自动重启

$serverPath = "D:\tools\mycc\.claude\skills\web-terminal\scripts\server.mjs"
$port = 7681
$checkInterval = 3  # 每 3 秒检查一次

Write-Host "=== Web Terminal 监控模式 ===" -ForegroundColor Cyan
Write-Host "监控文件: $serverPath"
Write-Host "检查间隔: $checkInterval 秒"
Write-Host "按 Ctrl+C 停止监控"
Write-Host ""

# 获取当前文件修改时间
function Get-FileHash {
    $file = Get-Item $serverPath -ErrorAction SilentlyContinue
    if ($file) {
        return $file.LastWriteTime
    }
    return [DateTime]::MinValue
}

# 检查并重启服务
function Restart-Service {
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] 检测到代码变化，正在重启..." -ForegroundColor Yellow

    # 杀掉占用端口的进程
    $process = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue |
               Select-Object -ExpandProperty OwningProcess |
               Select-Object -First 1

    if ($process) {
        Write-Host "  停止进程 PID: $process"
        Stop-Process -Id $process -Force
        Start-Sleep -Seconds 2
    }

    # 启动新服务
    Write-Host "  启动新服务..." -ForegroundColor Green
    $env:WEB_TERMINAL_TOKEN = "KJ7HI0"

    # 启动服务（后台）
    $processInfo = New-Object System.Diagnostics.ProcessStartInfo
    $processInfo.FileName = "node"
    $processInfo.Arguments = $serverPath
    $processInfo.UseShellExecute = $false
    $processInfo.RedirectStandardOutput = $false
    $processInfo.RedirectStandardError = $false
    $processInfo.CreateNoWindow = $false

    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $processInfo
    $process.Start() | Out-Null

    Write-Host "  服务已启动 (PID: $($process.Id))" -ForegroundColor Green
    Write-Host ""
}

# 首次启动
Write-Host "[$(Get-Date -Format 'HH:mm:ss')] 首次启动服务..." -ForegroundColor Green
Restart-Service

$lastHash = Get-FileHash

# 监控循环
Write-Host "[$(Get-Date -Format 'HH:mm:ss')] 开始监控..." -ForegroundColor Cyan
Write-Host ""

try {
    while ($true) {
        Start-Sleep -Seconds $checkInterval

        $currentHash = Get-FileHash

        if ($currentHash -ne $lastHash) {
            $lastHash = $currentHash
            Restart-Service
        }
    }
}
catch [System.Management.Automation.PipelineStoppedException] {
    # 用户按 Ctrl+C
    Write-Host ""
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] 监控已停止" -ForegroundColor Yellow

    # 清理：停止服务
    $process = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue |
               Select-Object -ExpandProperty OwningProcess |
               Select-Object -First 1
    if ($process) {
        Write-Host "正在停止服务 (PID: $process)..."
        Stop-Process -Id $process -Force
    }
}
catch {
    Write-Host "错误: $_" -ForegroundColor Red
}
