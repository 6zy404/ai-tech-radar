<#
.SYNOPSIS
Deploys the public build with seconds of downtime, or rolls back to the
previous one.

.DESCRIPTION
The scripted form of docs/deployment.md -> "Rebuild with seconds of downtime",
which was three hand-typed PowerShell steps until 2026-09-28.

  deploy     build into .next-new while the server keeps serving, stop the
             server, swap directories, start it, and wait for /api/health to
             answer from the NEW build. If it does not, swap back and restart
             on the previous build automatically.
  rollback   swap .next and .next-old and restart. Running it twice returns to
             where you started.

Directories, all beside each other in the repository root:

  .next         what the server serves
  .next-new     the build in progress
  .next-old     the previous build, kept as the rollback
  .next-failed  a build that did not pass its health check, kept for inspection
                and removed by the next deploy

What "healthy" means here, and why each part is there:

  build id     /api/health must report the BUILD_ID of the directory that was
               just swapped in.
  uptime       /api/health reads BUILD_ID from disk on every request, so a
               process that was never restarted would report the new id while
               still serving the old code. The reported uptime has to be
               younger than the restart.
  pages        four public routes answer 200.
  binding      every listener on the port is a loopback address. Anything else
               means the start command lost its `-H 127.0.0.1`.
  public URL   NEXT_PUBLIC_SITE_URL from .env.local answers through the
               tunnel. Reported, never a reason to roll back: the edge has
               measured anywhere from 0.8s to 29s from this network.

Logs are rotated inside the stop window, because `server.log` is held open by
the running task and cannot be renamed at any other time.

The script refuses to run from a checkout the server task does not serve, so
running it from a git worktree cannot stop the live site.

Exit codes: 0 healthy, 1 failed (the previous build was restored where
possible), 2 healthy but not loopback-only.

.EXAMPLE
  npm run deploy

.EXAMPLE
  npm run deploy:rollback

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\deploy.ps1 -WhatIf
  # print every step and health-check the running server, change nothing

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\deploy.ps1 -SkipBuild
  # swap in a .next-new that an earlier run already built
#>

[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [switch]$Rollback,
    [switch]$SkipBuild,
    [switch]$SkipPublicCheck,
    [string]$RepoRoot = "",
    [string]$TaskName = "ai-tech-radar-server",
    [int]$Port = 3000,
    [int]$HealthTimeoutSeconds = 90,
    [int]$LogMaxKB = 1024,
    [int]$LogKeep = 3
)

$ErrorActionPreference = "Stop"

# Resolved here, not as the parameter's default: $PSScriptRoot is still empty
# while Windows PowerShell 5.1 binds the defaults of a script run with -File.
if (-not $RepoRoot) {
    $RepoRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
}

# -WhatIf is honoured by Invoke-Change below. The preference itself is switched
# off so that read-only cmdlets can auto-load their modules without printing a
# "What if: New Alias" line for every alias the module defines.
$script:DryRun = [bool]$WhatIfPreference
$WhatIfPreference = $false
$script:ServingDir = ".next"
$script:NewDir = ".next-new"
$script:OldDir = ".next-old"
$script:OlderDir = ".next-old-prev"
$script:FailedDir = ".next-failed"
$script:SwapDir = ".next-swap"
$script:PublicPages = @("/", "/technologies", "/digest/today", "/feed.xml")
$script:RotatedLogs = @("config\server.log", "config\task-runner-cron.log", "config\backup-cron.log")

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host "== $Message" -ForegroundColor Cyan
}

function Write-Ok {
    param([string]$Message)
    Write-Host "   $Message" -ForegroundColor Green
}

function Write-Note {
    param([string]$Message)
    Write-Host "   $Message"
}

function Write-Problem {
    param([string]$Message)
    Write-Host "   $Message" -ForegroundColor Yellow
}

# Runs a change, or only names it under -WhatIf.
function Invoke-Change {
    param([string]$Description, [scriptblock]$Action)

    if ($script:DryRun) {
        Write-Host "   [演练] 将执行：$Description" -ForegroundColor DarkGray
        return
    }

    Write-Note $Description

    # Out-Host keeps a step's output on the console instead of letting it join
    # the calling function's return value.
    & $Action | Out-Host
}

function Resolve-RepoPath {
    param([string]$Relative)
    return (Join-Path $RepoRoot $Relative)
}

function Get-BuildId {
    param([string]$Directory)

    $buildIdPath = Join-Path (Resolve-RepoPath $Directory) "BUILD_ID"

    if (-not (Test-Path -LiteralPath $buildIdPath)) {
        return $null
    }

    return (Get-Content -LiteralPath $buildIdPath -Raw).Trim()
}

# A plain GET that never goes through the system proxy for local addresses and
# returns the status instead of throwing on 4xx/5xx.
function Invoke-HttpProbe {
    param(
        [string]$Url,
        [int]$TimeoutSeconds = 10,
        [switch]$UseSystemProxy
    )

    $request = [System.Net.HttpWebRequest]::Create($Url)
    $request.Method = "GET"
    $request.Timeout = $TimeoutSeconds * 1000
    $request.ReadWriteTimeout = $TimeoutSeconds * 1000
    $request.UserAgent = "ai-tech-radar-deploy"
    # A pooled connection to the process that was just stopped would fail the
    # first probe after the restart.
    $request.KeepAlive = $false

    if (-not $UseSystemProxy) {
        $request.Proxy = $null
    }

    $response = $null

    try {
        $response = $request.GetResponse()
    } catch {
        $webException = $_.Exception

        while ($webException -and -not ($webException -is [System.Net.WebException])) {
            $webException = $webException.InnerException
        }

        if (-not $webException -or -not $webException.Response) {
            return @{ Status = 0; Body = ""; Error = $_.Exception.Message }
        }

        $response = $webException.Response
    }

    try {
        $reader = New-Object System.IO.StreamReader($response.GetResponseStream(), [System.Text.Encoding]::UTF8)
        $body = $reader.ReadToEnd()
        $reader.Dispose()

        return @{ Status = [int]$response.StatusCode; Body = $body; Error = $null }
    } finally {
        $response.Close()
    }
}

# Callers wrap this in @(): PowerShell unrolls a one-element array on return,
# and `.Count` on the single CIM object that is left is empty rather than 1,
# so with exactly one listener an unwrapped count reads as "nothing listening".
function Get-PortListener {
    param([int]$Port)
    return @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
}

function Test-LoopbackOnly {
    param([int]$Port)

    $listeners = @(Get-PortListener -Port $Port)
    $addresses = @($listeners | Select-Object -ExpandProperty LocalAddress -Unique)
    $outside = @($addresses | Where-Object { $_ -ne "127.0.0.1" -and $_ -ne "::1" })

    return @{
        Listening    = ($listeners.Count -gt 0)
        Addresses    = $addresses
        LoopbackOnly = ($listeners.Count -gt 0 -and $outside.Count -eq 0)
    }
}

# The task's action is `cmd /c cd /d <checkout> && npm run start ...`. If that
# checkout is not this one, stopping the task would take the live site down to
# swap directories it does not serve.
function Assert-TaskServesCheckout {
    $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue

    if (-not $task) {
        throw "找不到计划任务 $TaskName。先用 scripts\register-windows-tasks.ps1 -IncludeServer 注册。"
    }

    $arguments = ($task.Actions | ForEach-Object { $_.Arguments }) -join " "
    $pattern = [regex]::Escape($RepoRoot.TrimEnd("\")) + '(\s|&|"|$)'

    if ($arguments -notmatch $pattern) {
        throw "计划任务 $TaskName 服务的不是这个检出（$RepoRoot）。请在它服务的检出里运行本脚本。"
    }
}

# "It is a node process" is not enough to end it. On 2026-09-28 a rehearsal of
# this script, pointed at the wrong port by a variable-name collision, stopped
# the live server because that was the only thing checked. The listener has to
# be running out of THIS checkout's node_modules.
function Assert-PortHeldByThisCheckout {
    $ownModules = (Join-Path $RepoRoot "node_modules") + "\"

    foreach ($owner in @(Get-PortListener -Port $Port | Select-Object -ExpandProperty OwningProcess -Unique)) {
        $process = Get-CimInstance Win32_Process -Filter "ProcessId=$owner" -ErrorAction SilentlyContinue

        if (-not $process) {
            continue
        }

        if ($process.Name -ne "node.exe") {
            throw "端口 $Port 被 $($process.Name)（PID $owner）占用，不是 node。没有终止任何进程。"
        }

        if ("$($process.CommandLine)".IndexOf($ownModules, [System.StringComparison]::OrdinalIgnoreCase) -lt 0) {
            throw "端口 $Port 上的 node（PID $owner）不是从这个检出启动的（$RepoRoot）。没有终止任何进程。"
        }
    }
}

# Stop-ScheduledTask ends the task instance but leaves the detached `next
# start` holding the port, so the listener's process tree is ended explicitly.
function Stop-Server {
    Assert-PortHeldByThisCheckout
    Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue

    foreach ($owner in @(Get-PortListener -Port $Port | Select-Object -ExpandProperty OwningProcess -Unique)) {
        & cmd.exe /c "taskkill /PID $owner /T /F >nul 2>&1"
    }

    $deadline = (Get-Date).AddSeconds(20)

    while (@(Get-PortListener -Port $Port).Count -gt 0) {
        if ((Get-Date) -gt $deadline) {
            throw "端口 $Port 在 20 秒内没有释放。"
        }

        Start-Sleep -Milliseconds 300
    }
}

function Start-Server {
    Start-ScheduledTask -TaskName $TaskName
}

# Windows keeps a directory busy for a moment after the process that used it
# exits, so a rename right after the stop can fail once and then succeed.
function Rename-WithRetry {
    param([string]$From, [string]$To)

    $source = Resolve-RepoPath $From

    for ($attempt = 1; $attempt -le 10; $attempt++) {
        try {
            Rename-Item -LiteralPath $source -NewName $To
            return
        } catch {
            if ($attempt -eq 10) {
                throw "无法把 $From 改名为 $To：$($_.Exception.Message)"
            }

            Start-Sleep -Seconds 1
        }
    }
}

function Remove-BuildDirectory {
    param([string]$Directory)

    $target = Resolve-RepoPath $Directory

    if (Test-Path -LiteralPath $target) {
        Remove-Item -LiteralPath $target -Recurse -Force
    }
}

# path -> path.1 -> path.2 ... keeping $Keep generations. A log another
# process holds open is skipped, not an error.
function Invoke-LogRotation {
    param([string]$Path, [int]$MaxBytes, [int]$Keep)

    if (-not (Test-Path -LiteralPath $Path)) {
        return "absent"
    }

    if ((Get-Item -LiteralPath $Path).Length -le $MaxBytes) {
        return "kept"
    }

    try {
        $oldest = "$Path.$Keep"

        if (Test-Path -LiteralPath $oldest) {
            Remove-Item -LiteralPath $oldest -Force
        }

        for ($generation = $Keep - 1; $generation -ge 1; $generation--) {
            $from = "$Path.$generation"

            if (Test-Path -LiteralPath $from) {
                Move-Item -LiteralPath $from -Destination "$Path.$($generation + 1)"
            }
        }

        Move-Item -LiteralPath $Path -Destination "$Path.1"

        return "rotated"
    } catch {
        return "skipped: $($_.Exception.Message)"
    }
}

function Invoke-AllLogRotation {
    foreach ($relative in $script:RotatedLogs) {
        $path = Resolve-RepoPath $relative
        $outcome = Invoke-LogRotation -Path $path -MaxBytes ($LogMaxKB * 1024) -Keep $LogKeep

        if ($outcome -eq "rotated") {
            Write-Note "日志已轮转：$relative（超过 $LogMaxKB KB，保留 $LogKeep 代）"
        } elseif ($outcome -like "skipped*") {
            Write-Problem "日志未轮转：$relative（$outcome）"
        }
    }
}

function Wait-ServerHealthy {
    param(
        [string]$ExpectedBuildId,
        [int]$TimeoutSeconds,
        [switch]$RequireFreshProcess,
        [switch]$AllowMissingHealthRoute
    )

    $started = Get-Date
    $deadline = $started.AddSeconds($TimeoutSeconds)
    $last = "还没有应答"

    while ((Get-Date) -lt $deadline) {
        $probe = Invoke-HttpProbe -Url "http://127.0.0.1:$Port/api/health" -TimeoutSeconds 5

        if ($probe.Status -eq 200) {
            $health = $probe.Body | ConvertFrom-Json
            $elapsed = ((Get-Date) - $started).TotalSeconds

            if ($health.status -ne "ok") {
                $last = "status=$($health.status)"
            } elseif ($ExpectedBuildId -and $health.build -ne $ExpectedBuildId) {
                $last = "应答的构建是 $($health.build)，期望 $ExpectedBuildId"
            } elseif ($RequireFreshProcess -and $health.uptimeSeconds -gt ($elapsed + 15)) {
                $last = "应答的仍是旧进程（已运行 $($health.uptimeSeconds) 秒）"
            } else {
                return @{
                    Healthy = $true
                    Detail  = "构建 $($health.build)，已发布信号 $($health.checks.store.publishedSignals)"
                }
            }
        } elseif ($probe.Status -eq 404 -and $AllowMissingHealthRoute) {
            # A build from before 2026-09-25 has no /api/health.
            $rootPage = Invoke-HttpProbe -Url "http://127.0.0.1:$Port/" -TimeoutSeconds 10

            if ($rootPage.Status -eq 200) {
                return @{
                    Healthy = $true
                    Detail  = "这版构建没有 /api/health，改为检查首页：200"
                }
            }

            $last = "没有 /api/health，首页返回 $($rootPage.Status)"
        } elseif ($probe.Status -eq 0) {
            $last = "连接失败：$($probe.Error)"
        } else {
            $last = "/api/health 返回 $($probe.Status)"
        }

        Start-Sleep -Milliseconds 500
    }

    return @{ Healthy = $false; Detail = $last }
}

function Test-PublicPages {
    $failures = @()

    foreach ($page in $script:PublicPages) {
        $probe = Invoke-HttpProbe -Url "http://127.0.0.1:$Port$page" -TimeoutSeconds 20

        if ($probe.Status -eq 200) {
            Write-Ok "$page 200"
        } else {
            Write-Problem "$page $($probe.Status) $($probe.Error)"
            $failures += $page
        }
    }

    return $failures
}

# Only this one key is read; nothing else in .env.local is looked at or printed.
function Get-PublicSiteUrl {
    $envFile = Resolve-RepoPath ".env.local"

    if (-not (Test-Path -LiteralPath $envFile)) {
        return $null
    }

    $url = $null

    foreach ($line in Get-Content -LiteralPath $envFile) {
        if ($line -match '^\s*NEXT_PUBLIC_SITE_URL\s*=\s*["'']?([^"''#\s]+)') {
            $url = $Matches[1]
        }
    }

    if ($url -and $url -match '^https://') {
        return $url.TrimEnd("/")
    }

    return $null
}

function Test-PublicSite {
    param([string]$ExpectedBuildId)

    $siteUrl = Get-PublicSiteUrl

    if (-not $siteUrl) {
        Write-Note "没有配置公网地址，跳过。"
        return
    }

    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12

    for ($attempt = 1; $attempt -le 3; $attempt++) {
        $timer = [System.Diagnostics.Stopwatch]::StartNew()
        $probe = Invoke-HttpProbe -Url "$siteUrl/api/health" -TimeoutSeconds 30 -UseSystemProxy
        $timer.Stop()

        if ($probe.Status -eq 200) {
            $health = $probe.Body | ConvertFrom-Json
            $seconds = [math]::Round($timer.Elapsed.TotalSeconds, 1)

            if (-not $ExpectedBuildId -or $health.build -eq $ExpectedBuildId) {
                Write-Ok "$siteUrl/api/health 200，构建 $($health.build)，用时 $seconds 秒"
            } else {
                Write-Problem "$siteUrl 应答的构建是 $($health.build)，期望 $ExpectedBuildId"
            }

            return
        }

        Start-Sleep -Seconds 3
    }

    Write-Problem "$siteUrl/api/health 三次都没有返回 200（最后一次：$($probe.Status) $($probe.Error)）。本机服务正常时，先查隧道。"
}

function Write-DeployLog {
    param([string]$Line)

    if ($script:DryRun) {
        return
    }

    $logPath = Resolve-RepoPath "config\deploy.log"

    if (Test-Path -LiteralPath (Split-Path -Parent $logPath)) {
        Add-Content -LiteralPath $logPath -Value "$((Get-Date).ToString('s')) $Line" -Encoding UTF8
    }
}

function Invoke-PostStartChecks {
    param([string]$ExpectedBuildId)

    Write-Step "公开页面"
    $failedPages = @(Test-PublicPages)

    Write-Step "监听地址"
    $binding = Test-LoopbackOnly -Port $Port
    $addressList = $binding.Addresses -join ", "

    if ($binding.LoopbackOnly) {
        Write-Ok "只监听回环地址：$addressList"
    } else {
        Write-Problem "监听地址是 $addressList，不是只有回环地址。检查 package.json 的 start 是否带 -H 127.0.0.1。"
    }

    if (-not $SkipPublicCheck) {
        Write-Step "公网地址（只报告，不回滚）"
        Test-PublicSite -ExpectedBuildId $ExpectedBuildId
    }

    return @{ FailedPages = $failedPages; LoopbackOnly = $binding.LoopbackOnly }
}

# Puts a servable build back at .next after a swap that stopped half way.
function Restore-ServingDirectory {
    if (Test-Path -LiteralPath (Resolve-RepoPath $script:ServingDir)) {
        return
    }

    foreach ($candidate in @($script:OldDir, $script:SwapDir, $script:OlderDir)) {
        if (Test-Path -LiteralPath (Resolve-RepoPath $candidate)) {
            Rename-WithRetry -From $candidate -To $script:ServingDir
            Write-Problem "已把 $candidate 放回 $($script:ServingDir)。"
            return
        }
    }
}

function Invoke-Build {
    Write-Step "构建到 $($script:NewDir)（服务不受影响）"

    if ($SkipBuild) {
        Write-Note "已跳过构建，使用现有的 $($script:NewDir)。"
        return
    }

    Invoke-Change "npm run build:public（NEXT_DIST_DIR=$($script:NewDir)）" {
        $previous = $env:NEXT_DIST_DIR
        $env:NEXT_DIST_DIR = $script:NewDir

        try {
            Push-Location $RepoRoot
            & npm.cmd run build:public | Out-Host

            if ($LASTEXITCODE -ne 0) {
                throw "构建失败（退出码 $LASTEXITCODE）。服务没有被动过。"
            }
        } finally {
            Pop-Location
            $env:NEXT_DIST_DIR = $previous
        }
    }
}

function Invoke-Deploy {
    Write-Step "部署前检查"
    Assert-TaskServesCheckout
    Assert-PortHeldByThisCheckout

    if (-not (Test-Path -LiteralPath (Resolve-RepoPath $script:ServingDir))) {
        throw "没有 $($script:ServingDir)。如果上一次部署中断过，先把 $($script:OldDir) 改名回 $($script:ServingDir)。"
    }

    if ($SkipBuild -and -not (Get-BuildId $script:NewDir)) {
        throw "-SkipBuild 需要一个已经构建好的 $($script:NewDir)。"
    }

    $previousBuildId = Get-BuildId $script:ServingDir
    Write-Note "检出：$RepoRoot"
    Write-Note "当前构建：$previousBuildId"

    Invoke-Build

    $newBuildId = Get-BuildId $script:NewDir

    if (-not $script:DryRun) {
        if (-not $newBuildId) {
            throw "$($script:NewDir) 里没有 BUILD_ID，构建不完整。服务没有被动过。"
        }

        Write-Ok "新构建：$newBuildId"
    }

    Write-Step "切换（停机从这里开始）"
    $downtime = [System.Diagnostics.Stopwatch]::StartNew()

    try {
        Invoke-Change "停止 $TaskName 并释放端口 $Port" { Stop-Server }
        Invoke-Change "轮转日志" { Invoke-AllLogRotation }
        Invoke-Change "目录换位：$($script:ServingDir) -> $($script:OldDir)，$($script:NewDir) -> $($script:ServingDir)" {
            Remove-BuildDirectory $script:FailedDir
            Remove-BuildDirectory $script:OlderDir

            if (Test-Path -LiteralPath (Resolve-RepoPath $script:OldDir)) {
                Rename-WithRetry -From $script:OldDir -To $script:OlderDir
            }

            Rename-WithRetry -From $script:ServingDir -To $script:OldDir
            Rename-WithRetry -From $script:NewDir -To $script:ServingDir
        }
        Invoke-Change "启动 $TaskName" { Start-Server }
    } catch {
        Write-Problem "切换中断：$($_.Exception.Message)"

        if (-not $script:DryRun) {
            Restore-ServingDirectory
            Start-Server
            Write-DeployLog "deploy ABORTED during swap from=$previousBuildId to=$newBuildId"
        }

        throw
    }

    Write-Step "健康检查"

    if ($script:DryRun) {
        $health = Wait-ServerHealthy -ExpectedBuildId $previousBuildId -TimeoutSeconds 10
    } else {
        $health = Wait-ServerHealthy -ExpectedBuildId $newBuildId -TimeoutSeconds $HealthTimeoutSeconds -RequireFreshProcess
    }

    $downtime.Stop()

    if (-not $health.Healthy) {
        Write-Problem "没有通过：$($health.Detail)"

        if ($script:DryRun) {
            return 1
        }

        Write-Step "自动回滚到 $previousBuildId"
        Stop-Server
        Rename-WithRetry -From $script:ServingDir -To $script:FailedDir
        Rename-WithRetry -From $script:OldDir -To $script:ServingDir

        if (Test-Path -LiteralPath (Resolve-RepoPath $script:OlderDir)) {
            Rename-WithRetry -From $script:OlderDir -To $script:OldDir
        }

        Start-Server
        $restored = Wait-ServerHealthy -ExpectedBuildId $previousBuildId -TimeoutSeconds $HealthTimeoutSeconds -RequireFreshProcess -AllowMissingHealthRoute

        if ($restored.Healthy) {
            Write-Ok "已回到上一版：$($restored.Detail)"
        } else {
            Write-Problem "回滚后仍不健康：$($restored.Detail)。看 config\server.log。"
        }

        Write-Note "没通过的构建留在 $($script:FailedDir)，下次部署时清掉。"
        Write-DeployLog "deploy FAILED from=$previousBuildId to=$newBuildId reason=""$($health.Detail)"" rolledBack=$($restored.Healthy)"

        return 1
    }

    Write-Ok $health.Detail

    if (-not $script:DryRun) {
        Remove-BuildDirectory $script:OlderDir
    }

    $checks = Invoke-PostStartChecks -ExpectedBuildId $(if ($script:DryRun) { $previousBuildId } else { $newBuildId })
    $seconds = [math]::Round($downtime.Elapsed.TotalSeconds, 1)

    Write-Step "结果"

    if ($script:DryRun) {
        Write-Note "演练结束，没有改动任何东西。上面的检查针对的是正在运行的服务。"
        return 0
    }

    Write-Ok "已部署 $newBuildId（上一版 $previousBuildId 留在 $($script:OldDir)）"
    Write-Ok "停机约 $seconds 秒"
    Write-Note "回滚：npm run deploy:rollback"
    Write-DeployLog "deploy ok from=$previousBuildId to=$newBuildId downtimeSeconds=$seconds loopbackOnly=$($checks.LoopbackOnly) failedPages=$($checks.FailedPages.Count)"

    if ($checks.FailedPages.Count -gt 0) {
        Write-Problem "有页面没有返回 200：$($checks.FailedPages -join ', ')。服务是健康的，没有自动回滚；需要的话手动回滚。"
        return 1
    }

    if (-not $checks.LoopbackOnly) {
        return 2
    }

    return 0
}

function Invoke-Rollback {
    Write-Step "回滚前检查"
    Assert-TaskServesCheckout
    Assert-PortHeldByThisCheckout

    $currentBuildId = Get-BuildId $script:ServingDir
    $targetBuildId = Get-BuildId $script:OldDir

    if (-not $targetBuildId) {
        throw "没有可回滚的 $($script:OldDir)。"
    }

    Write-Note "检出：$RepoRoot"
    Write-Note "当前构建：$currentBuildId"
    Write-Note "回滚目标：$targetBuildId"

    Write-Step "切换（停机从这里开始）"
    $downtime = [System.Diagnostics.Stopwatch]::StartNew()

    try {
        Invoke-Change "停止 $TaskName 并释放端口 $Port" { Stop-Server }
        Invoke-Change "轮转日志" { Invoke-AllLogRotation }
        Invoke-Change "目录互换：$($script:ServingDir) <-> $($script:OldDir)" {
            Rename-WithRetry -From $script:ServingDir -To $script:SwapDir
            Rename-WithRetry -From $script:OldDir -To $script:ServingDir
            Rename-WithRetry -From $script:SwapDir -To $script:OldDir
        }
        Invoke-Change "启动 $TaskName" { Start-Server }
    } catch {
        Write-Problem "切换中断：$($_.Exception.Message)"

        if (-not $script:DryRun) {
            Restore-ServingDirectory
            Start-Server
            Write-DeployLog "rollback ABORTED during swap from=$currentBuildId to=$targetBuildId"
        }

        throw
    }

    Write-Step "健康检查"

    if ($script:DryRun) {
        $health = Wait-ServerHealthy -ExpectedBuildId $currentBuildId -TimeoutSeconds 10
    } else {
        $health = Wait-ServerHealthy -ExpectedBuildId $targetBuildId -TimeoutSeconds $HealthTimeoutSeconds -RequireFreshProcess -AllowMissingHealthRoute
    }

    $downtime.Stop()

    if (-not $health.Healthy) {
        Write-Problem "没有通过：$($health.Detail)"
        Write-Note "再运行一次回滚会换回 $currentBuildId。"
        Write-DeployLog "rollback FAILED from=$currentBuildId to=$targetBuildId reason=""$($health.Detail)"""

        return 1
    }

    Write-Ok $health.Detail

    $checks = Invoke-PostStartChecks -ExpectedBuildId $(if ($script:DryRun) { $currentBuildId } else { $targetBuildId })
    $seconds = [math]::Round($downtime.Elapsed.TotalSeconds, 1)

    Write-Step "结果"

    if ($script:DryRun) {
        Write-Note "演练结束，没有改动任何东西。上面的检查针对的是正在运行的服务。"
        return 0
    }

    Write-Ok "已回滚到 $targetBuildId（$currentBuildId 留在 $($script:OldDir)，再回滚一次即可换回）"
    Write-Ok "停机约 $seconds 秒"
    Write-DeployLog "rollback ok from=$currentBuildId to=$targetBuildId downtimeSeconds=$seconds loopbackOnly=$($checks.LoopbackOnly) failedPages=$($checks.FailedPages.Count)"

    if ($checks.FailedPages.Count -gt 0) {
        return 1
    }

    if (-not $checks.LoopbackOnly) {
        return 2
    }

    return 0
}

# Dot-sourcing loads the functions without running anything, which is how the
# rehearsal exercises the swap against a stand-in server.
if ($MyInvocation.InvocationName -eq ".") {
    return
}

try {
    if ($Rollback) {
        $exitCode = @(Invoke-Rollback)[-1]
    } else {
        $exitCode = @(Invoke-Deploy)[-1]
    }
} catch {
    Write-Host ""
    Write-Host "失败：$($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

exit $exitCode
