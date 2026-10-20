<#
.SYNOPSIS
Tunnel watchdog: restarts cloudflared when the site answers locally but not
through the domain. Run every 5 minutes by the ai-tech-radar-tunnel-watchdog
scheduled task (scripts/setup-tunnel-watchdog.ps1).

.DESCRIPTION
Why it exists: on 2026-10-17 21:37 the machine restarted, cloudflared came up
before the campus resolver (210.42.24.19) answered properly, resolved
region1.v2.argotunnel.com to a private address (10.3.33.253), and then dialled
that address on port 7844 once a minute for two and a half days while the
server on port 3000 stayed healthy the whole time. Nothing noticed, because
the only alert in the system was a desktop toast.

Each run:

  1. GET http://127.0.0.1:3000/api/health   (direct, never through a proxy;
     its `build` field goes into every alert)
  2. GET https://aizyradar.cn/api/health     (through the proxy or direct —
     decided by scripts/with-proxy-env.mjs, which reads HTTP(S)_PROXY from
     the environment, else from .env.local, and uses the proxy only when it
     answers a TCP connect; both ways reach the Cloudflare edge from this
     machine, measured 2026-10-20)
  3. read the last 20 lines of tunnel.log for an ERR that dials a private
     address (10/8, 172.16/12, 192.168/16) on port 7844

The tunnel counts as broken when the local check is 200 and either the public
check is not 200 (530 / error 1033 = no connector) or the log shows a private
dial. Two consecutive broken runs (state kept in config/tunnel-watchdog-state.json)
→ stop every cloudflared.exe, Start-ScheduledTask ai-tech-radar-tunnel, wait
30 seconds, check the domain again, append the outcome to
config/tunnel-watchdog.log and send an off-site alert
(scripts/send-ops-alert.ts, channel OPS_ALERT_CHANNEL_ID).

Stop-Process is needed because the tunnel task's action is
`cmd /c cloudflared ... >> tunnel.log`: Stop-ScheduledTask ends cmd and leaves
cloudflared running (measured 2026-10-20), so the task cannot be restarted
without killing the child by hand.

A local check that is not 200 is NOT a tunnel problem. The script then only
sends one alert (on the second consecutive failure; `localAlerted` in the
state file, cleared when the local check recovers) and does nothing else.

What this script never does — asserted at runtime, not only promised here,
and printed under -DryRun:
  - it never stops a process that is not named cloudflared;
  - it never stops a process that owns a listener on port 3000;
  - it never calls Stop-ScheduledTask / Start-ScheduledTask with any task but
    the tunnel task, and refuses to run if that name is ai-tech-radar-server;
  - it writes only the state file and the log, neither of them under .next.

Exit code: 0 healthy (or healthy again after a restart), 1 a problem was seen
and is still there, 3 the script itself failed.

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts\tunnel-watchdog.ps1 -DryRun
  # run the three checks against the real endpoints and print what a real run
  # would do, with the safety assertions; writes nothing, stops nothing, sends
  # nothing

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts\tunnel-watchdog.ps1
  # one real pass (what the scheduled task runs)
#>

[CmdletBinding()]
param(
    [switch]$DryRun,
    [string]$LocalUrl = "http://127.0.0.1:3000/api/health",
    [string]$PublicUrl = "https://aizyradar.cn/api/health",
    [string]$TunnelTask = "ai-tech-radar-tunnel",
    [string]$TunnelLog = "$env:USERPROFILE\.cloudflared\tunnel.log",
    [string]$RepoRoot = "",
    [string]$StateFile = "",
    [string]$LogFile = "",
    [int]$FailuresBeforeRestart = 2,
    [int]$RestartCooldownMinutes = 15,
    [int]$AlertIntervalMinutes = 60,
    [int]$RecheckSeconds = 30,
    [int]$TimeoutSeconds = 20,
    [int]$LogTailLines = 20,
    [int]$LogMaxKB = 1024,
    [switch]$NoAlert
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version 2

# ---------------------------------------------------------------- constants

# The two things this script must never touch. $TunnelTask is compared against
# $ServerTask before any task cmdlet runs, and every process about to be
# stopped is checked against the port's owners.
$ServerTask = "ai-tech-radar-server"
$ServerPort = 3000
$TunnelProcessName = "cloudflared"
$PrivateDialPattern = 'ERR .*dial (?:tcp|udp) (?<ip>(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})):7844'

# The repository root is where this script lives, never a fixed path, so the
# task keeps working after the checkout moves (docs/service-account.md).
if (-not $RepoRoot) {
    $RepoRoot = Split-Path -Parent $PSScriptRoot
}

if (-not $StateFile) {
    $StateFile = Join-Path $RepoRoot "config\tunnel-watchdog-state.json"
}

if (-not $LogFile) {
    $LogFile = Join-Path $RepoRoot "config\tunnel-watchdog.log"
}

# Absolute, so the .next assertion below sees the whole path.
$StateFile = [System.IO.Path]::GetFullPath($StateFile)
$LogFile = [System.IO.Path]::GetFullPath($LogFile)

$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

# ---------------------------------------------------------------- output

function Write-Log {
    param([string]$Line)

    $stamped = "$((Get-Date).ToString('yyyy-MM-dd HH:mm:ss')) $Line"

    Write-Host $stamped

    if ($DryRun) {
        return
    }

    $directory = Split-Path -Parent $LogFile

    if (-not (Test-Path -LiteralPath $directory)) {
        New-Item -ItemType Directory -Path $directory -Force | Out-Null
    }

    [System.IO.File]::AppendAllText($LogFile, "$stamped`r`n", $Utf8NoBom)
}

# One generation, like deploy.ps1's rotation: over the limit the log becomes
# .1 (replacing the previous .1). At one line per run it takes about a year.
function Rotate-LogIfLarge {
    if ($DryRun -or -not (Test-Path -LiteralPath $LogFile)) {
        return
    }

    $item = Get-Item -LiteralPath $LogFile

    if ($item.Length -le $LogMaxKB * 1024) {
        return
    }

    Move-Item -LiteralPath $LogFile -Destination "$LogFile.1" -Force
}

# ---------------------------------------------------------------- guards

function Assert-TaskNameIsTunnel {
    param([string]$Name)

    if ($Name -eq $ServerTask) {
        throw "拒绝：任务名 $Name 是网站服务任务，本脚本只允许操作隧道任务。"
    }

    if ($Name -notlike "*tunnel*") {
        throw "拒绝：任务名 $Name 看起来不是隧道任务（名字里没有 tunnel）。"
    }
}

# The state file and the log are the only two paths this script writes.
function Assert-WritePathsOutsideBuild {
    foreach ($path in @($StateFile, $LogFile)) {
        if ($path -match '[\\/]\.next([\\/]|$)') {
            throw "拒绝：写入路径 $path 在 .next 下。"
        }
    }
}

function Get-ServerPortOwners {
    $listeners = @(Get-NetTCPConnection -LocalPort $ServerPort -State Listen -ErrorAction SilentlyContinue)

    return @($listeners | ForEach-Object { $_.OwningProcess } | Sort-Object -Unique)
}

# Every process handed to Stop-Process goes through here first. Returns the
# port owners it checked against, for the log line.
function Assert-SafeToStop {
    param([object[]]$Processes)

    $owners = @(Get-ServerPortOwners)

    foreach ($process in $Processes) {
        if ($process.ProcessName -ne $TunnelProcessName) {
            throw "拒绝：准备停止的进程 $($process.ProcessName) (PID $($process.Id)) 不是 $TunnelProcessName。"
        }

        if ($owners -contains $process.Id) {
            throw "拒绝：PID $($process.Id) 持有 $ServerPort 端口，本脚本绝不停止它。"
        }
    }

    return $owners
}

# What the assertions checked, in one line: printed on every -DryRun and
# before every real restart, so the log shows the guards were exercised.
function Write-SafetyAssertions {
    param([object[]]$Processes)

    Assert-TaskNameIsTunnel -Name $TunnelTask
    Assert-WritePathsOutsideBuild
    $owners = @(Assert-SafeToStop -Processes $Processes)

    $pids = ($Processes | ForEach-Object { $_.Id }) -join ", "
    $ownerText = if ($owners.Count -gt 0) { $owners -join ", " } else { "无" }

    Write-Log "断言通过：只停止进程名为 $TunnelProcessName 的进程（PID $(if ($pids) { $pids } else { '无' })），$ServerPort 端口由 PID $ownerText 持有、不在停止之列；只操作任务 $TunnelTask，不碰 $ServerTask；只写 $StateFile 与 $LogFile，不碰 .next。"
}

# ---------------------------------------------------------------- probes

# Which way out is decided by the project's own launcher, so the proxy rule
# has one definition and this script needs no .env.local parser:
# scripts/with-proxy-env.mjs reads HTTP(S)_PROXY from the environment, else
# from .env.local, probes the proxy (1.5 s TCP connect) and leaves
# NODE_USE_ENV_PROXY=1 only when it answers. Nothing is redirected here: a
# redirected stderr turns a native command's output into errors under 5.1.
function Get-ProxyDecision {
    $expression = "process.env.NODE_USE_ENV_PROXY === '1' ? ([process.env.HTTPS_PROXY, process.env.https_proxy, process.env.HTTP_PROXY, process.env.http_proxy].find(Boolean) ?? '') : ''"

    Push-Location $RepoRoot

    try {
        $env:PROXY_ENV_QUIET = "1"
        $output = & node "scripts\with-proxy-env.mjs" node -p $expression

        if ($LASTEXITCODE -ne 0) {
            return @{ Url = $null; Note = "代理判断失败（with-proxy-env.mjs 退出码 $LASTEXITCODE），直连" }
        }

        $url = ("$output").Trim()

        if ($url) {
            return @{ Url = $url; Note = "经代理 $url" }
        }

        return @{ Url = $null; Note = "直连（无代理或代理不可达）" }
    } catch {
        return @{ Url = $null; Note = "代理判断失败（$($_.Exception.Message)），直连" }
    } finally {
        Pop-Location
    }
}

# Returns @{ Status; Body; Error }. Status 0 means no HTTP answer at all. Never
# throws on 4xx/5xx; Cloudflare's 530 is a normal answer here.
function Invoke-HttpProbe {
    param(
        [string]$Url,
        [string]$ProxyUrl,
        [int]$Timeout = 20
    )

    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor [System.Net.SecurityProtocolType]::Tls12

    $request = [System.Net.HttpWebRequest]::Create($Url)
    $request.Method = "GET"
    $request.Timeout = $Timeout * 1000
    $request.ReadWriteTimeout = $Timeout * 1000
    $request.UserAgent = "ai-tech-radar-tunnel-watchdog"
    $request.KeepAlive = $false

    if ($ProxyUrl) {
        $request.Proxy = New-Object System.Net.WebProxy($ProxyUrl)
    } else {
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

# The `build` field of /api/health, so an alert says which build was running.
function Get-BuildId {
    param([string]$Body)

    if (-not $Body) {
        return ""
    }

    try {
        $parsed = $Body | ConvertFrom-Json

        if ($parsed.PSObject.Properties["build"]) {
            return "$($parsed.build)"
        }
    } catch {
        return ""
    }

    return ""
}

function Get-PrivateDialLines {
    if (-not (Test-Path -LiteralPath $TunnelLog)) {
        return @()
    }

    $tail = @(Get-Content -LiteralPath $TunnelLog -Tail $LogTailLines -ErrorAction SilentlyContinue)

    return @($tail | Where-Object { $_ -match $PrivateDialPattern })
}

function Get-TunnelLogErrors {
    param([int]$Count = 3)

    if (-not (Test-Path -LiteralPath $TunnelLog)) {
        return @()
    }

    $tail = @(Get-Content -LiteralPath $TunnelLog -Tail $LogTailLines -ErrorAction SilentlyContinue)

    return @($tail | Where-Object { $_ -match " ERR " } | Select-Object -Last $Count)
}

# ---------------------------------------------------------------- state

function New-DefaultState {
    return [pscustomobject]@{
        publicFailures       = 0
        localFailures        = 0
        localAlerted         = $false
        episodeStartedAt     = $null
        lastRestartAt        = $null
        lastAlertAt          = $null
        pendingRecoveryAlert = $false
        lastRun              = $null
    }
}

function Read-State {
    if (-not (Test-Path -LiteralPath $StateFile)) {
        return New-DefaultState
    }

    try {
        $raw = [System.IO.File]::ReadAllText($StateFile, [System.Text.Encoding]::UTF8)
        $parsed = $raw | ConvertFrom-Json
        $state = New-DefaultState

        foreach ($property in $state.PSObject.Properties) {
            $member = $parsed.PSObject.Properties[$property.Name]

            if ($member) {
                $state.($property.Name) = $member.Value
            }
        }

        return $state
    } catch {
        Write-Log "状态文件无法读取（$($_.Exception.Message)），按全新状态处理。"
        return New-DefaultState
    }
}

function Write-State {
    param($State)

    if ($DryRun) {
        return
    }

    Assert-WritePathsOutsideBuild

    $directory = Split-Path -Parent $StateFile

    if (-not (Test-Path -LiteralPath $directory)) {
        New-Item -ItemType Directory -Path $directory -Force | Out-Null
    }

    $json = $State | ConvertTo-Json -Depth 4
    [System.IO.File]::WriteAllText($StateFile, "$json`r`n", $Utf8NoBom)
}

function Get-MinutesSince {
    param([string]$IsoTime)

    if (-not $IsoTime) {
        return [double]::PositiveInfinity
    }

    try {
        return ((Get-Date) - [DateTime]::Parse($IsoTime)).TotalMinutes
    } catch {
        return [double]::PositiveInfinity
    }
}

# ---------------------------------------------------------------- actions

function Get-TunnelProcesses {
    return @(Get-Process -Name $TunnelProcessName -ErrorAction SilentlyContinue)
}

function Restart-Tunnel {
    $processes = @(Get-TunnelProcesses)
    Write-SafetyAssertions -Processes $processes

    if ($DryRun) {
        $pids = ($processes | ForEach-Object { $_.Id }) -join ", "
        Write-Log "[DryRun] 会执行：Stop-ScheduledTask $TunnelTask；Stop-Process cloudflared（PID $(if ($pids) { $pids } else { '无' })）；Start-ScheduledTask $TunnelTask；等 $RecheckSeconds 秒复查公网。"
        return $null
    }

    # Ends the cmd wrapper so the task instance can be started again; the
    # child cloudflared survives this and is stopped next.
    Stop-ScheduledTask -TaskName $TunnelTask -ErrorAction SilentlyContinue

    foreach ($process in $processes) {
        Assert-SafeToStop -Processes @($process) | Out-Null
        Write-Log "停止 cloudflared PID $($process.Id)（启动于 $($process.StartTime.ToString('yyyy-MM-dd HH:mm:ss'))）。"
        Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
    }

    $deadline = (Get-Date).AddSeconds(15)

    while (@(Get-TunnelProcesses).Count -gt 0 -and (Get-Date) -lt $deadline) {
        Start-Sleep -Milliseconds 500
    }

    # With MultipleInstances = IgnoreNew a start while the old instance is
    # still "Running" would be dropped silently.
    $deadline = (Get-Date).AddSeconds(15)

    while ((Get-ScheduledTask -TaskName $TunnelTask).State -eq "Running" -and (Get-Date) -lt $deadline) {
        Start-Sleep -Milliseconds 500
    }

    Start-ScheduledTask -TaskName $TunnelTask
    Write-Log "已 Start-ScheduledTask $TunnelTask，等 $RecheckSeconds 秒后复查公网。"
    Start-Sleep -Seconds $RecheckSeconds

    $after = @(Get-TunnelProcesses)
    $recheck = Invoke-HttpProbe -Url $PublicUrl -ProxyUrl $script:ProxyUrl -Timeout $TimeoutSeconds
    $pidsAfter = ($after | ForEach-Object { $_.Id }) -join ", "

    Write-Log "复查：公网 $($recheck.Status)$(if ($recheck.Error) { "（$($recheck.Error)）" })；cloudflared PID $(if ($pidsAfter) { $pidsAfter } else { '无' })。"

    return $recheck
}

# The alert text travels as a UTF-8 JSON file, never as a shell argument:
# Chinese through the console code page is what garbles it. The node command
# runs under cmd so its two streams arrive as one; see Get-ProxyDecision.
function Send-Alert {
    param(
        [string]$Title,
        [string]$Body
    )

    if ($NoAlert) {
        Write-Log "（-NoAlert）跳过站外告警：$Title"
        return
    }

    if ($DryRun) {
        Write-Log "[DryRun] 会发送站外告警：$Title"
        return
    }

    $temp = Join-Path ([System.IO.Path]::GetTempPath()) "tunnel-watchdog-alert-$([guid]::NewGuid().ToString('N')).json"
    $payload = [pscustomobject]@{
        title = $Title
        body  = $Body
        at    = (Get-Date).ToString("o")
    } | ConvertTo-Json -Depth 3

    try {
        [System.IO.File]::WriteAllText($temp, $payload, $Utf8NoBom)

        Push-Location $RepoRoot

        try {
            $output = & cmd /c "node scripts\with-proxy-env.mjs node scripts\run-ts.cjs scripts\send-ops-alert.ts --json ""$temp"" 2>&1" | Out-String
            $code = $LASTEXITCODE
        } finally {
            Pop-Location
        }

        foreach ($line in ($output -split "`r?`n" | Where-Object { $_.Trim() })) {
            Write-Log "  [alert] $line"
        }

        if ($code -ne 0) {
            Write-Log "站外告警脚本退出码 $code。"
        }
    } catch {
        Write-Log "站外告警失败：$($_.Exception.Message)"
    } finally {
        Remove-Item -LiteralPath $temp -Force -ErrorAction SilentlyContinue
    }
}

function Format-Status {
    param($Probe)

    if ($Probe.Status -eq 0) {
        return "无响应（$($Probe.Error)）"
    }

    return "$($Probe.Status)"
}

# ---------------------------------------------------------------- main

try {
    Assert-TaskNameIsTunnel -Name $TunnelTask
    Assert-WritePathsOutsideBuild
    Rotate-LogIfLarge

    $state = Read-State
    $now = Get-Date

    $proxy = Get-ProxyDecision
    $script:ProxyUrl = $proxy.Url
    $proxyNote = $proxy.Note

    $local = Invoke-HttpProbe -Url $LocalUrl -ProxyUrl $null -Timeout $TimeoutSeconds
    $public = Invoke-HttpProbe -Url $PublicUrl -ProxyUrl $script:ProxyUrl -Timeout $TimeoutSeconds
    $privateDials = @(Get-PrivateDialLines)
    $buildId = Get-BuildId -Body $local.Body
    $buildText = if ($buildId) { $buildId } else { "未知" }
    $tunnelPids = (@(Get-TunnelProcesses) | ForEach-Object { $_.Id }) -join ","

    $summary = "本机 $(Format-Status $local)（构建 $buildText）；公网 $(Format-Status $public)（$proxyNote）；tunnel.log 私网拨号 $($privateDials.Count) 行；cloudflared PID $(if ($tunnelPids) { $tunnelPids } else { '无' })"

    if ($DryRun) {
        Write-Log "[DryRun] $summary"
        Write-SafetyAssertions -Processes @(Get-TunnelProcesses)
    }

    $state.lastRun = [pscustomobject]@{
        at           = $now.ToString("o")
        local        = $local.Status
        build        = $buildId
        public       = $public.Status
        privateDials = $privateDials.Count
        proxy        = $proxyNote
    }

    $buildLine = "本机构建：$buildText（$LocalUrl）。"

    # --- the server itself is unhealthy: not the tunnel's fault, never restart anything ---
    if ($local.Status -ne 200) {
        $state.localFailures = [int]$state.localFailures + 1
        $state.publicFailures = 0
        Write-Log "$summary — 本机不健康（连续 $($state.localFailures) 次），看门狗不动作。"

        if ([int]$state.localFailures -ge $FailuresBeforeRestart -and -not $state.localAlerted) {
            Send-Alert -Title "【AI Tech Radar】本机 $ServerPort 服务不健康" -Body (@(
                "本机 $LocalUrl 连续 $($state.localFailures) 次不是 200：$(Format-Status $local)。",
                $buildLine,
                "公网 $PublicUrl：$(Format-Status $public)（$proxyNote）。",
                "看门狗只管隧道，没有重启任何东西。查 config\server.log，必要时按 docs/deployment.md →「Deploy with one command」里关于端口与进程的说明重启 $ServerTask。恢复前不再重复提醒。"
            ) -join "`n")
            $state.localAlerted = $true
            $state.lastAlertAt = $now.ToString("o")
        }

        Write-State -State $state
        exit 1
    }

    if ([int]$state.localFailures -gt 0 -or $state.localAlerted) {
        Write-Log "本机恢复 200（此前连续 $($state.localFailures) 次不健康）。"
    }

    $state.localFailures = 0
    $state.localAlerted = $false

    # --- tunnel healthy ---
    $broken = ($public.Status -ne 200) -or ($privateDials.Count -gt 0)

    if (-not $broken) {
        if ([int]$state.publicFailures -gt 0) {
            Write-Log "$summary — 公网恢复（此前连续 $($state.publicFailures) 次异常）。"
        } elseif (-not $DryRun) {
            Write-Log $summary
        }

        if ($state.pendingRecoveryAlert) {
            Send-Alert -Title "【AI Tech Radar】公网已恢复" -Body (@(
                "公网 $PublicUrl 重新返回 200（$proxyNote）；本机 200。",
                $buildLine,
                "故障开始于 $($state.episodeStartedAt)，最近一次重启隧道在 $($state.lastRestartAt)。"
            ) -join "`n")
            $state.lastAlertAt = $now.ToString("o")
        }

        $state.publicFailures = 0
        $state.episodeStartedAt = $null
        $state.pendingRecoveryAlert = $false
        Write-State -State $state
        exit 0
    }

    # --- tunnel broken this run ---
    $state.publicFailures = [int]$state.publicFailures + 1

    if (-not $state.episodeStartedAt) {
        $state.episodeStartedAt = $now.ToString("o")
    }

    $reasons = @()

    if ($public.Status -ne 200) {
        $reasons += "公网 $(Format-Status $public)"
    }

    if ($privateDials.Count -gt 0) {
        $dialIp = ([regex]::Match($privateDials[-1], $PrivateDialPattern)).Groups["ip"].Value
        $reasons += "tunnel.log 拨向私网地址 ${dialIp}:7844"
    }

    $reason = $reasons -join "；"

    if ([int]$state.publicFailures -lt $FailuresBeforeRestart) {
        Write-Log "$summary — 隧道异常第 $($state.publicFailures) 次（$reason），满 $FailuresBeforeRestart 次才重启。"
        Write-State -State $state
        exit 1
    }

    $sinceRestart = Get-MinutesSince -IsoTime $state.lastRestartAt

    if ($sinceRestart -lt $RestartCooldownMinutes) {
        Write-Log "$summary — 隧道异常第 $($state.publicFailures) 次（$reason），上次重启 $([math]::Round($sinceRestart, 1)) 分钟前，冷却 $RestartCooldownMinutes 分钟内不再重启。"
        Write-State -State $state
        exit 1
    }

    Write-Log "$summary — 隧道异常第 $($state.publicFailures) 次（$reason），重启隧道。"

    foreach ($line in @(Get-TunnelLogErrors -Count 3)) {
        Write-Log "  [tunnel.log] $line"
    }

    $recheck = Restart-Tunnel
    $state.lastRestartAt = $now.ToString("o")

    if ($DryRun) {
        Write-Log "[DryRun] 会发送站外告警并更新状态文件 $StateFile。"
        exit 1
    }

    $recovered = $recheck -and ($recheck.Status -eq 200)
    $sinceAlert = Get-MinutesSince -IsoTime $state.lastAlertAt
    $logErrors = @(Get-TunnelLogErrors -Count 3)
    $body = @(
        "触发：$reason（连续 $($state.publicFailures) 次）；本机 $LocalUrl 为 200。",
        $buildLine,
        "处理：Stop-ScheduledTask $TunnelTask → Stop-Process cloudflared → Start-ScheduledTask $TunnelTask。",
        "$RecheckSeconds 秒后复查公网：$(Format-Status $recheck)（$proxyNote）。",
        "故障开始于 $($state.episodeStartedAt)。"
    )

    if ($logErrors.Count -gt 0) {
        $body += "tunnel.log 最后的 ERR："
        $body += $logErrors
    }

    if ($recovered) {
        Send-Alert -Title "【AI Tech Radar】隧道已重启，公网已恢复" -Body ($body -join "`n")
        $state.lastAlertAt = $now.ToString("o")
        $state.publicFailures = 0
        $state.episodeStartedAt = $null
        $state.pendingRecoveryAlert = $false
        Write-State -State $state
        exit 0
    }

    if ($sinceAlert -ge $AlertIntervalMinutes) {
        Send-Alert -Title "【AI Tech Radar】隧道已重启，公网仍未恢复" -Body (($body + "看门狗会每 $RestartCooldownMinutes 分钟再试一次，每 $AlertIntervalMinutes 分钟最多提醒一次；恢复时再提醒。") -join "`n")
        $state.lastAlertAt = $now.ToString("o")
    } else {
        Write-Log "距上次告警 $([math]::Round($sinceAlert, 1)) 分钟，$AlertIntervalMinutes 分钟内不重复告警。"
    }

    $state.pendingRecoveryAlert = $true
    Write-State -State $state
    exit 1
} catch {
    Write-Log "看门狗脚本出错：$($_.Exception.Message)"
    exit 3
}
