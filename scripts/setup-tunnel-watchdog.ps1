<#
.SYNOPSIS
Registers the ai-tech-radar-tunnel-watchdog scheduled task, which runs
scripts\tunnel-watchdog.ps1 every 5 minutes. Prints the plan by default;
changes nothing without -Apply.

.DESCRIPTION
The task has the shape of the other project tasks (docs/deployment.md →
"Windows Task Scheduler"): S4U (a background session with no console, so a
stray Ctrl+C cannot kill it), StartWhenAvailable, not stopped on battery. Two
settings are its own: a 4-minute execution limit, because a run that hangs
must not pile up behind the next one, and MultipleInstances = IgnoreNew for
the same reason. The trigger is one start with a 5-minute repetition that
never ends, which keeps firing across reboots.

The action runs powershell.exe straight — not through cmd with a redirect —
because the watchdog appends to its own log (config\tunnel-watchdog.log) and
Stop-ScheduledTask then ends the real process.

Run it from the checkout the task should execute (the main checkout, not a
worktree): the task's action carries that path.

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts\setup-tunnel-watchdog.ps1
  # print what would be registered and the task's current state; change nothing

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts\setup-tunnel-watchdog.ps1 -Apply
  # dry-run the watchdog once against the real endpoints, then register (or
  # replace) the task

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts\setup-tunnel-watchdog.ps1 -Remove -Apply
  # unregister the task
#>

[CmdletBinding()]
param(
    [switch]$Apply,
    [switch]$Remove,
    [int]$IntervalMinutes = 5,
    [string]$RepoRoot = "",
    [string]$TaskName = "ai-tech-radar-tunnel-watchdog"
)

$ErrorActionPreference = "Stop"

if (-not $RepoRoot) {
    $RepoRoot = Split-Path -Parent $PSScriptRoot
}

$RepoRoot = (Resolve-Path -LiteralPath $RepoRoot).Path
$scriptPath = Join-Path $RepoRoot "scripts\tunnel-watchdog.ps1"
$userId = "$env:USERDOMAIN\$env:USERNAME"
$argument = "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$scriptPath`""

if (-not (Test-Path -LiteralPath $scriptPath)) {
    throw "找不到 $scriptPath"
}

if ($RepoRoot -like "*\.claude\worktrees\*") {
    Write-Host "注意：$RepoRoot 是一个 git 工作树。任务动作会写死这个路径；正式注册请在主检出里运行。" -ForegroundColor Yellow
}

$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue

Write-Host "任务名:   $TaskName"
Write-Host "仓库:     $RepoRoot"
Write-Host "运行身份: $userId（S4U，后台会话，无控制台）"
Write-Host "动作:     powershell.exe $argument"
Write-Host "触发:     注册后每 $IntervalMinutes 分钟一次，不停"
Write-Host "设置:     StartWhenAvailable；电池不跳过不中止；单次最多 4 分钟；已在运行则忽略新实例"
Write-Host "日志:     $RepoRoot\config\tunnel-watchdog.log（脚本自己追加）"
Write-Host "状态:     $RepoRoot\config\tunnel-watchdog-state.json"
Write-Host ""

if ($existing) {
    $info = Get-ScheduledTaskInfo -TaskName $TaskName
    Write-Host "当前已存在：State=$($existing.State)，上次运行 $($info.LastRunTime)（结果 $($info.LastTaskResult)），下次 $($info.NextRunTime)" -ForegroundColor Cyan
    Write-Host "当前动作：$($existing.Actions[0].Execute) $($existing.Actions[0].Arguments)" -ForegroundColor Cyan
} else {
    Write-Host "当前不存在。" -ForegroundColor Cyan
}

Write-Host ""

if ($Remove) {
    if (-not $existing) {
        Write-Host "没有可删除的任务。"
        exit 0
    }

    if (-not $Apply) {
        Write-Host "将删除 $TaskName（加 -Apply 执行）。"
        exit 0
    }

    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Host "已删除 $TaskName。" -ForegroundColor Green
    exit 0
}

if (-not $Apply) {
    Write-Host "只打印计划，没有改动。加 -Apply 注册（已存在则替换）。"
    exit 0
}

# A watchdog that cannot run its checks is worse than none: prove the probes
# work before handing it to the scheduler. -DryRun writes and stops nothing.
Write-Host "--- 先以 -DryRun 跑一次看门狗 ---"
& powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $scriptPath -DryRun
$dryRunCode = $LASTEXITCODE
Write-Host "--- DryRun 退出码 $dryRunCode（0 健康，1 有异常，3 脚本出错）---"
Write-Host ""

if ($dryRunCode -eq 3) {
    throw "看门狗 DryRun 出错，不注册任务。先修好上面的错误。"
}

$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $argument -WorkingDirectory $RepoRoot
$start = (Get-Date).AddMinutes(1)
$trigger = New-ScheduledTaskTrigger -Once -At $start `
    -RepetitionInterval (New-TimeSpan -Minutes $IntervalMinutes) `
    -RepetitionDuration ([TimeSpan]::MaxValue)
$principal = New-ScheduledTaskPrincipal -UserId $userId -LogonType S4U -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable `
    -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 4) `
    -MultipleInstances IgnoreNew

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger `
    -Principal $principal -Settings $settings -Force `
    -Description "Every $IntervalMinutes minutes: restart cloudflared when the site answers on 127.0.0.1:3000 but not through the domain (scripts/tunnel-watchdog.ps1)." | Out-Null

$registered = Get-ScheduledTask -TaskName $TaskName
Write-Host "已注册 $TaskName（State=$($registered.State)，首次 $($start.ToString('HH:mm')))。" -ForegroundColor Green
Write-Host "核对：Get-ScheduledTask $TaskName | Select-Object -ExpandProperty Settings"
Write-Host "日志：Get-Content $RepoRoot\config\tunnel-watchdog.log -Tail 20"
