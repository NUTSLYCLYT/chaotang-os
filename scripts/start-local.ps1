[CmdletBinding()]
param(
    [ValidateSet("Start", "Stop", "Status")]
    [string]$Action = "Start",
    [ValidateRange(1024, 65535)]
    [int]$BackendPort = 8000,
    [ValidateRange(1024, 65535)]
    [int]$FrontendPort = 3000,
    [string]$PythonExecutable = "",
    [switch]$Build
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

if ($BackendPort -eq $FrontendPort) { throw "BackendPort and FrontendPort must be different" }

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$backendRoot = Join-Path $repoRoot "backend"
$frontendRoot = Join-Path $repoRoot "frontend"
$stateRoot = Join-Path $env:LOCALAPPDATA "ChaotangOS"
$statePath = Join-Path $stateRoot "local-runtime.json"
$logRoot = Join-Path $stateRoot "logs"

function Write-JsonFile {
    param([string]$Path, [object]$Value)
    $parent = Split-Path -Parent $Path
    [System.IO.Directory]::CreateDirectory($parent) | Out-Null
    $Value | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $Path -Encoding UTF8
}

function Read-State {
    if (-not (Test-Path -LiteralPath $statePath -PathType Leaf)) { return $null }
    try { return Get-Content -Raw -LiteralPath $statePath | ConvertFrom-Json }
    catch { throw "local runtime state is invalid: $statePath" }
}

function Get-ProcessIfAlive {
    param([object]$PidValue)
    if ($null -eq $PidValue) { return $null }
    try { return Get-Process -Id ([int]$PidValue) -ErrorAction Stop }
    catch { return $null }
}

function Stop-ProcessTree {
    param([object]$PidValue)
    $process = Get-ProcessIfAlive $PidValue
    if ($null -eq $process) { return }
    $taskkill = Join-Path $env:SystemRoot "System32\taskkill.exe"
    & $taskkill /PID $process.Id /T /F | Out-Null
}

function Get-UsablePython {
    $candidates = @()
    if ($PythonExecutable) { $candidates += $PythonExecutable }
    $candidates += (Join-Path $backendRoot ".venv\Scripts\python.exe")
    $candidates += (Join-Path $repoRoot ".venv\Scripts\python.exe")
    $pathCommand = Get-Command python.exe -ErrorAction SilentlyContinue
    if ($null -ne $pathCommand) { $candidates += $pathCommand.Source }
    foreach ($candidate in ($candidates | Where-Object { $_ } | Select-Object -Unique)) {
        if (-not (Test-Path -LiteralPath $candidate -PathType Leaf)) { continue }
        $versionText = & $candidate --version 2>&1
        if ($LASTEXITCODE -ne 0) { continue }
        if ($versionText -match "Python\s+(?<major>\d+)\.(?<minor>\d+)") {
            $version = [version]::new([int]$Matches.major, [int]$Matches.minor)
            if ($version -ge [version]::new(3, 11)) { return (Resolve-Path $candidate).Path }
        }
    }
    throw "找不到 Python >= 3.11。请先按 README 安装 backend/.venv，或传入 -PythonExecutable。"
}

function Get-NpmCommand {
    $npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
    if ($null -eq $npm) { $npm = Get-Command npm -ErrorAction SilentlyContinue }
    if ($null -eq $npm) { throw "找不到 npm。请安装 Node.js >= 22，并重新打开终端。" }
    return $npm.Source
}

function Invoke-NpmBuild {
    $npm = Get-NpmCommand
    $psi = [System.Diagnostics.ProcessStartInfo]::new()
    $psi.FileName = $npm
    $psi.Arguments = "run build"
    $psi.WorkingDirectory = $frontendRoot
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $buildProcess = [System.Diagnostics.Process]::new()
    $buildProcess.StartInfo = $psi
    if (-not $buildProcess.Start()) { throw "无法启动 frontend build" }
    $stdout = $buildProcess.StandardOutput.ReadToEndAsync()
    $stderr = $buildProcess.StandardError.ReadToEndAsync()
    $buildProcess.WaitForExit()
    if ($buildProcess.ExitCode -ne 0) {
        throw "frontend build 失败：$($stderr.GetAwaiter().GetResult())"
    }
}

function Sync-StandaloneDirectory {
    param(
        [Parameter(Mandatory = $true)][string]$Source,
        [Parameter(Mandatory = $true)][string]$Destination
    )
    if (-not (Test-Path -LiteralPath $Source -PathType Container)) {
        throw "standalone 资源源目录不存在：$Source"
    }
    if (Test-Path -LiteralPath $Destination) {
        Remove-Item -LiteralPath $Destination -Recurse -Force
    }
    [System.IO.Directory]::CreateDirectory($Destination) | Out-Null
    Get-ChildItem -LiteralPath $Source -Force | ForEach-Object {
        Copy-Item -LiteralPath $_.FullName -Destination $Destination -Recurse -Force
    }
}

function Ensure-StandaloneAssets {
    $standaloneRoot = Join-Path $frontendRoot ".next\standalone"
    if (-not (Test-Path -LiteralPath $standaloneRoot -PathType Container)) {
        throw "未找到 standalone 输出目录：$standaloneRoot。请使用 -Build 重新构建前端。"
    }
    Sync-StandaloneDirectory (Join-Path $frontendRoot ".next\static") (Join-Path $standaloneRoot ".next\static")
    $publicRoot = Join-Path $frontendRoot "public"
    if (Test-Path -LiteralPath $publicRoot -PathType Container) {
        Sync-StandaloneDirectory $publicRoot (Join-Path $standaloneRoot "public")
    }
}

function Start-ManagedProcess {
    param(
        [string]$Name,
        [string]$FileName,
        [string]$Arguments,
        [string]$WorkingDirectory,
        [hashtable]$Environment
    )
    [System.IO.Directory]::CreateDirectory($logRoot) | Out-Null
    $stdoutPath = Join-Path $logRoot "$Name.stdout.log"
    $stderrPath = Join-Path $logRoot "$Name.stderr.log"
    $psi = [System.Diagnostics.ProcessStartInfo]::new()
    $psi.FileName = $FileName
    $psi.Arguments = $Arguments
    $psi.WorkingDirectory = $WorkingDirectory
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    foreach ($key in $Environment.Keys) { $psi.Environment[$key] = [string]$Environment[$key] }
    $process = [System.Diagnostics.Process]::new()
    $process.StartInfo = $psi
    if (-not $process.Start()) { throw "无法启动 $Name" }
    $process.BeginOutputReadLine()
    $process.BeginErrorReadLine()
    Register-ObjectEvent -InputObject $process -EventName OutputDataReceived -Action {
        if ($null -ne $EventArgs.Data) { Add-Content -LiteralPath $using:stdoutPath -Value $EventArgs.Data -Encoding UTF8 }
    } | Out-Null
    Register-ObjectEvent -InputObject $process -EventName ErrorDataReceived -Action {
        if ($null -ne $EventArgs.Data) { Add-Content -LiteralPath $using:stderrPath -Value $EventArgs.Data -Encoding UTF8 }
    } | Out-Null
    return [ordered]@{ name = $Name; pid = $process.Id; stdout = $stdoutPath; stderr = $stderrPath }
}

function Wait-Http {
    param([string]$Url, [int]$TimeoutSeconds = 30)
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    $lastError = ""
    while ((Get-Date) -lt $deadline) {
        try {
            $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 3
            if ($response.StatusCode -eq 200) { return $response.StatusCode }
        }
        catch { $lastError = $_.Exception.Message }
        Start-Sleep -Milliseconds 250
    }
    throw "等待服务就绪超时：$Url；最近错误：$lastError"
}

function Get-StatusObject {
    $state = Read-State
    if ($null -eq $state) { return [ordered]@{ status = "STOPPED"; statePath = $statePath } }
    $backend = Get-ProcessIfAlive $state.backend.pid
    $frontend = Get-ProcessIfAlive $state.frontend.pid
    return [ordered]@{
        status = if ($null -ne $backend -and $null -ne $frontend) { "RUNNING" } else { "STALE" }
        statePath = $statePath
        backendPid = $state.backend.pid
        frontendPid = $state.frontend.pid
        backendPort = $state.backendPort
        frontendPort = $state.frontendPort
        frontendMode = $state.frontendMode
        logs = $state.logs
        startedAt = $state.startedAt
    }
}

if ($Action -eq "Status") { Get-StatusObject | ConvertTo-Json -Depth 8; exit 0 }

if ($Action -eq "Stop") {
    $state = Read-State
    if ($null -eq $state) { Write-Output "朝堂本地运行时未启动。"; exit 0 }
    Stop-ProcessTree $state.frontend.pid
    Stop-ProcessTree $state.backend.pid
    Remove-Item -LiteralPath $statePath -Force -ErrorAction SilentlyContinue
    Write-Output "朝堂本地运行时已停止。"
    exit 0
}

$existing = Read-State
if ($null -ne $existing) {
    $status = Get-StatusObject
    if ($status.status -eq "RUNNING") { throw "朝堂已在运行：$($status.frontendPort)；请先执行 -Action Status 或 -Action Stop。" }
    Remove-Item -LiteralPath $statePath -Force -ErrorAction SilentlyContinue
}

$python = Get-UsablePython
$npm = Get-NpmCommand
if (-not (Test-Path -LiteralPath (Join-Path $frontendRoot "node_modules") -PathType Container)) {
    throw "frontend/node_modules 不存在。请先在 frontend 执行 npm ci；启动脚本不会自动下载依赖。"
}
$buildId = Join-Path $frontendRoot ".next\BUILD_ID"
if ($Build) { Invoke-NpmBuild; $frontendMode = "production" }
elseif (Test-Path -LiteralPath $buildId -PathType Leaf) { $frontendMode = "production" }
else { Write-Output "未找到 frontend/.next/BUILD_ID，切换为 Next.js 开发模式；如需生产模式请使用 -Build。"; $frontendMode = "development" }

if ($frontendMode -eq "production") { Ensure-StandaloneAssets }

$backendEnv = @{ PYTHONDONTWRITEBYTECODE = "1"; CHAOTANG_DECREE_JOB_WORKER_ENABLED = "1" }
$frontendEnv = @{
    BACKEND_BASE_URL = "http://127.0.0.1:$BackendPort"
    NEXT_TELEMETRY_DISABLED = "1"
    CHAOTANG_COOKIE_SECURE = "false"
    # Next.js standalone server reads its bind address and port from the
    # environment; CLI arguments are ignored by .next/standalone/server.js.
    HOSTNAME = "127.0.0.1"
    PORT = "$FrontendPort"
}
$started = @()
try {
    $backend = Start-ManagedProcess "backend" $python "-m uvicorn app.main:app --host 127.0.0.1 --port $BackendPort" $backendRoot $backendEnv
    $started += $backend
    [void](Wait-Http "http://127.0.0.1:$BackendPort/health")
    if ($frontendMode -eq "production") { $frontend = Start-ManagedProcess "frontend" $npm "run start" $frontendRoot $frontendEnv }
    else { $frontend = Start-ManagedProcess "frontend" $npm "run dev" $frontendRoot $frontendEnv }
    $started += $frontend
    [void](Wait-Http "http://127.0.0.1:$FrontendPort/")
    $state = [ordered]@{
        schemaVersion = "chaotang.local-runtime.v1"
        startedAt = (Get-Date).ToUniversalTime().ToString("o")
        repoRoot = $repoRoot
        backendPort = $BackendPort
        frontendPort = $FrontendPort
        frontendMode = $frontendMode
        backend = $backend
        frontend = $frontend
        logs = $logRoot
        modelCalls = "disabled until user submits a task with configured provider credentials"
    }
    Write-JsonFile $statePath $state
    Write-Output "朝堂本地运行时已启动。"
    Write-Output "前端：http://127.0.0.1:$FrontendPort/"
    Write-Output "健康：http://127.0.0.1:$FrontendPort/health"
    Write-Output "状态：pwsh -File scripts/start-local.ps1 -Action Status"
    Write-Output "停止：pwsh -File scripts/start-local.ps1 -Action Stop"
    Write-Output "日志：$logRoot"
}
catch {
    foreach ($item in ($started | Sort-Object -Property pid -Descending)) { Stop-ProcessTree $item.pid }
    Remove-Item -LiteralPath $statePath -Force -ErrorAction SilentlyContinue
    throw
}
