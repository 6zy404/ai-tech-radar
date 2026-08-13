<#
.SYNOPSIS
Registers this project's Windows scheduled tasks.

.DESCRIPTION
Two tasks, deliberately separated because they are needed at different times:

  ai-tech-radar-backup   daily 07:45, verified snapshot of LOCAL_DATA_DIR
  ai-tech-radar-server   at startup, `npm run start` for the public site

Register the backup one now. **Hold the server one until the tunnel is about to
go up**: it binds port 3000 and holds `.next`, which collides with the dev
server used for editorial rounds and visual passes. Two processes on one
`.next` produce the confusing failure this project already hit — pages keep
returning 200 while API routes return 500, so the workspace looks fine and
every write silently fails.

Four settings are load-bearing on both tasks:

  S4U                  background session, no console. A console receives
                       CTRL_C_EVENT — that killed 17% of the import task's runs
                       before it was changed on 2026-08-09.
  StartWhenAvailable   run after a missed trigger instead of skipping the day.
                       Its absence cost the import task 9 missed days.
  battery settings     do not skip or stop on battery.
  ExecutionTimeLimit   server only: unlimited, or Windows stops it after 3 days.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\register-windows-tasks.ps1
  # registers the backup task only

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\register-windows-tasks.ps1 -IncludeServer
  # also registers the site process — only once the tunnel is ready

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\register-windows-tasks.ps1 -WhatIf
  # print what would be registered, change nothing
#>

[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [switch]$IncludeServer
)

$repoRoot = Split-Path -Parent $PSScriptRoot
$userId = "$env:USERDOMAIN\$env:USERNAME"

Write-Host "仓库:   $repoRoot"
Write-Host "运行身份: $userId"
Write-Host ""

function Register-ProjectTask {
    param(
        [string]$Name,
        [string]$Argument,
        $Trigger,
        $Settings,
        [string]$Description
    )

    $existing = Get-ScheduledTask -TaskName $Name -ErrorAction SilentlyContinue

    if ($existing) {
        Write-Host "跳过 $Name — 已存在（State=$($existing.State)）。要重建请先 schtasks /Delete /TN `"$Name`"" -ForegroundColor Yellow
        return
    }

    if (-not $PSCmdlet.ShouldProcess($Name, "Register-ScheduledTask")) {
        Write-Host "将注册 $Name — $Description"
        return
    }

    $action = New-ScheduledTaskAction -Execute "cmd" -Argument $Argument
    $principal = New-ScheduledTaskPrincipal -UserId $userId -LogonType S4U -RunLevel Limited

    Register-ScheduledTask -TaskName $Name -Action $action -Trigger $Trigger `
        -Principal $principal -Settings $Settings -Description $Description | Out-Null

    Write-Host "已注册 $Name" -ForegroundColor Green
}

# --- 备份：每天 07:45，比 08:05 的导入早 20 分钟，快照取的是稳定状态 ---
Register-ProjectTask `
    -Name "ai-tech-radar-backup" `
    -Argument "/c cd /d $repoRoot && npm run backup:data >> config\backup-cron.log 2>&1" `
    -Trigger (New-ScheduledTaskTrigger -Daily -At 7:45am) `
    -Settings (New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopIfGoingOnBatteries -AllowStartIfOnBatteries) `
    -Description "Verified daily snapshot of the local data directory."

# --- 站点常驻：仅在 -IncludeServer 时注册 ---
if ($IncludeServer) {
    Register-ProjectTask `
        -Name "ai-tech-radar-server" `
        -Argument "/c cd /d $repoRoot && npm run start >> config\server.log 2>&1" `
        -Trigger (New-ScheduledTaskTrigger -AtStartup) `
        -Settings (New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopIfGoingOnBatteries -AllowStartIfOnBatteries -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero)) `
        -Description "Production Next server for the public site."
} else {
    Write-Host "未注册 ai-tech-radar-server（需要 -IncludeServer）。" -ForegroundColor Cyan
    Write-Host "  它会占用 3000 端口并持有 .next，与本地开发和编辑轮冲突。" -ForegroundColor Cyan
    Write-Host "  等隧道要起来时再加 -IncludeServer 重跑本脚本。" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "--- 当前本项目的计划任务 ---"
Get-ScheduledTask -TaskName "ai-tech-radar-*" |
    ForEach-Object {
        $info = Get-ScheduledTaskInfo -TaskName $_.TaskName
        [PSCustomObject]@{
            Name      = $_.TaskName
            State     = $_.State
            LogonType = $_.Principal.LogonType
            NextRun   = $info.NextRunTime
            LastRun   = $info.LastRunTime
            LastCode  = $info.LastTaskResult
        }
    } | Format-Table -AutoSize
