<#
.SYNOPSIS
Rehearses scripts\deploy.ps1 against a stand-in server, without touching the
live one.

.DESCRIPTION
Builds a throwaway "repository" under the temp directory (fake .next
directories, a 2 MB log), starts scripts\deploy-rehearsal-server.mjs on port
3199 in place of the scheduled task, and drives the real Invoke-Deploy and
Invoke-Rollback through it: a healthy deploy, a build that fails its health
check, a swap with no restart, rollback there and back, a server bound to
every interface, and a port held by a process that is not this checkout's.

Only the scheduled task is stubbed. Everything else - the directory swap, the
health check, the automatic rollback, log rotation, the port-owner check, the
real Stop-Server - is the code that runs in a real deploy.

Run it after changing scripts\deploy.ps1. It takes about a minute and exits
non-zero when a check fails.

.PARAMETER LiveCheckout
The checkout the server task serves. When given, the two real preflight checks
are also run against the real task and the real port 3000, read-only.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\deploy-rehearsal.ps1

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\deploy-rehearsal.ps1 -LiveCheckout C:\Users\Administrator\ai-tech-radar
#>

param(
    [string]$LiveCheckout = ""
)

# Every name here carries the `rehearsal` prefix on purpose. PowerShell
# variable names are case-insensitive and dot-sourcing a script assigns its
# parameters in THIS scope, so a harness variable called $port IS the deploy
# script's $Port. On 2026-09-28 that collision pointed the first version of
# this file at port 3000 and it stopped the live server for 78 seconds.
$rehearsalRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$rehearsalDeployScript = Join-Path $rehearsalRoot "deploy.ps1"
$rehearsalStandIn = Join-Path $rehearsalRoot "deploy-rehearsal-server.mjs"
$rehearsalOwnCheckout = Split-Path -Parent $rehearsalRoot
$rehearsalRepo = Join-Path ([System.IO.Path]::GetTempPath()) "ai-tech-radar-deploy-rehearsal"
$rehearsalPort = 3199
$rehearsalLivePort = 3000
$script:RehearsalBindHost = "127.0.0.1"
$script:RehearsalPassed = 0
$script:RehearsalFailed = 0

function Check {
    param([string]$Name, [bool]$Condition, [string]$Detail = "")

    if ($Condition) {
        $script:RehearsalPassed++
        Write-Host "PASS  $Name" -ForegroundColor Green
    } else {
        $script:RehearsalFailed++
        Write-Host "FAIL  $Name  $Detail" -ForegroundColor Red
    }
}

function New-Build {
    param([string]$Directory, [string]$BuildId, [string[]]$Markers = @())

    $target = Join-Path $rehearsalRepo $Directory
    New-Item -ItemType Directory -Force $target | Out-Null
    Set-Content -LiteralPath (Join-Path $target "BUILD_ID") -Value $BuildId -NoNewline

    foreach ($marker in $Markers) {
        Set-Content -LiteralPath (Join-Path $target $marker) -Value "1"
    }
}

function Read-Build {
    param([string]$Directory)

    $buildIdPath = Join-Path $rehearsalRepo "$Directory\BUILD_ID"

    if (Test-Path -LiteralPath $buildIdPath) {
        return (Get-Content -LiteralPath $buildIdPath -Raw).Trim()
    }

    return "(absent)"
}

function Stop-RehearsalListener {
    if ($rehearsalPort -eq $rehearsalLivePort) {
        throw "rehearsal port equals the live port; refusing"
    }

    foreach ($owner in @(Get-NetTCPConnection -LocalPort $rehearsalPort -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique)) {
        Stop-Process -Id $owner -Force -ErrorAction SilentlyContinue
    }

    while (Get-NetTCPConnection -LocalPort $rehearsalPort -State Listen -ErrorAction SilentlyContinue) {
        Start-Sleep -Milliseconds 200
    }
}

function Start-RehearsalServer {
    param([string]$ScriptPath)

    Start-Process -FilePath node -ArgumentList "`"$ScriptPath`"", $rehearsalPort, $script:RehearsalBindHost -WorkingDirectory $rehearsalRepo -WindowStyle Hidden | Out-Null
}

function Get-RehearsalLiveOwner {
    return (Get-NetTCPConnection -LocalPort $rehearsalLivePort -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1).OwningProcess
}

$rehearsalLiveOwnerBefore = Get-RehearsalLiveOwner
Write-Host "process on port $rehearsalLivePort before the rehearsal: $rehearsalLiveOwnerBefore"

# --- fixture ---------------------------------------------------------------
if (Test-Path -LiteralPath $rehearsalRepo) {
    Remove-Item -LiteralPath $rehearsalRepo -Recurse -Force
}

New-Item -ItemType Directory -Force (Join-Path $rehearsalRepo "config") | Out-Null
$rehearsalServerInside = Join-Path $rehearsalRepo "node_modules\fake-next\server.mjs"
New-Item -ItemType Directory -Force (Split-Path -Parent $rehearsalServerInside) | Out-Null
Copy-Item -LiteralPath $rehearsalStandIn -Destination $rehearsalServerInside
New-Build ".next" "build-A"
New-Build ".next-old" "build-0"
New-Build ".next-new" "build-B"
[IO.File]::WriteAllBytes((Join-Path $rehearsalRepo "config\server.log"), (New-Object byte[] (2MB)))
Set-Content -LiteralPath (Join-Path $rehearsalRepo "config\server.log.1") -Value "previous generation"
Set-Content -LiteralPath (Join-Path $rehearsalRepo "config\task-runner-cron.log") -Value "small"

# --- the real assertions against the real machine: read-only -----------------
if ($LiveCheckout) {
    Write-Host "`n######## 0. real checks, nothing stubbed, nothing changed" -ForegroundColor Magenta

    if ($LiveCheckout.TrimEnd("\") -ne $rehearsalOwnCheckout.TrimEnd("\")) {
        . $rehearsalDeployScript -RepoRoot $rehearsalOwnCheckout -Port $rehearsalLivePort -SkipBuild -SkipPublicCheck
        $rehearsalThrew = $false
        try { Assert-TaskServesCheckout } catch { $rehearsalThrew = $true; Write-Host "      $($_.Exception.Message)" }
        Check "task check refuses a checkout the task does not serve" $rehearsalThrew
        $rehearsalThrew = $false
        try { Assert-PortHeldByThisCheckout } catch { $rehearsalThrew = $true; Write-Host "      $($_.Exception.Message)" }
        Check "port check refuses the live server from that checkout" $rehearsalThrew
    }

    . $rehearsalDeployScript -RepoRoot $LiveCheckout -Port $rehearsalLivePort -SkipBuild -SkipPublicCheck
    $rehearsalThrew = $false
    try { Assert-TaskServesCheckout; Assert-PortHeldByThisCheckout } catch { $rehearsalThrew = $true; Write-Host "      $($_.Exception.Message)" }
    Check "both checks accept the checkout the task serves" (-not $rehearsalThrew)

    $rehearsalBinding = Test-LoopbackOnly -Port $rehearsalLivePort
    Write-Host "      the live server listens on: $($rehearsalBinding.Addresses -join ', ') (loopback only: $($rehearsalBinding.LoopbackOnly))"
}

# --- load for the fake repository, then stand in for the scheduled task ------
. $rehearsalDeployScript -RepoRoot $rehearsalRepo -Port $rehearsalPort -TaskName "rehearsal" -SkipBuild -SkipPublicCheck -HealthTimeoutSeconds 8 -LogMaxKB 1024 -LogKeep 3

if ($Port -ne 3199 -or $RepoRoot -ne $rehearsalRepo) {
    throw "the deploy script is not pointed at the rehearsal fixture (Port=$Port RepoRoot=$RepoRoot); refusing"
}

$rehearsalRealStop = ${function:Stop-Server}

function Assert-TaskServesCheckout { }
function Stop-Server { Assert-PortHeldByThisCheckout; Stop-RehearsalListener }
function Start-Server { Start-RehearsalServer -ScriptPath $rehearsalServerInside }

Write-Host "`n######## 0b. the real Stop-Server ends this checkout's process and waits for the port" -ForegroundColor Magenta
Start-Server
Start-Sleep -Seconds 1
Check "stand-in is listening" ([bool](Get-NetTCPConnection -LocalPort $rehearsalPort -State Listen -ErrorAction SilentlyContinue))
& $rehearsalRealStop
Check "port is free the moment Stop-Server returns" (-not (Get-NetTCPConnection -LocalPort $rehearsalPort -State Listen -ErrorAction SilentlyContinue))

Write-Host "`n######## 1. the incident: a node process from somewhere else holds the port" -ForegroundColor Magenta
Start-RehearsalServer -ScriptPath $rehearsalStandIn
Start-Sleep -Seconds 1
$rehearsalForeignPid = (Get-NetTCPConnection -LocalPort $rehearsalPort -State Listen | Select-Object -First 1).OwningProcess
$rehearsalCode = 0
try { $rehearsalCode = @(Invoke-Deploy)[-1] } catch { $rehearsalCode = "threw"; Write-Host "      $($_.Exception.Message)" }
Check "deploy refuses before changing anything" ($rehearsalCode -eq "threw") "got $rehearsalCode"
Check "the foreign process is still running" ([bool](Get-Process -Id $rehearsalForeignPid -ErrorAction SilentlyContinue))
Check ".next is still build-A" ((Read-Build ".next") -eq "build-A") (Read-Build ".next")
Check ".next-new is still build-B" ((Read-Build ".next-new") -eq "build-B") (Read-Build ".next-new")
Stop-RehearsalListener

Start-Server
Start-Sleep -Seconds 1

Write-Host "`n######## 2. healthy deploy A -> B" -ForegroundColor Magenta
$rehearsalCode = @(Invoke-Deploy)[-1]
Check "exit code 0" ($rehearsalCode -eq 0) "got $rehearsalCode"
Check ".next is build-B" ((Read-Build ".next") -eq "build-B") (Read-Build ".next")
Check ".next-old is build-A" ((Read-Build ".next-old") -eq "build-A") (Read-Build ".next-old")
Check ".next-new is gone" (-not (Test-Path (Join-Path $rehearsalRepo ".next-new")))
Check "the older rollback generation was removed" (-not (Test-Path (Join-Path $rehearsalRepo ".next-old-prev")))
Check "server.log (2 MB) rotated to .1" ((Get-Item (Join-Path $rehearsalRepo "config\server.log.1")).Length -eq 2MB)
Check "the previous .1 moved to .2" ((Get-Content (Join-Path $rehearsalRepo "config\server.log.2") -Raw) -match "previous generation")
Check "the small log was left alone" (-not (Test-Path (Join-Path $rehearsalRepo "config\task-runner-cron.log.1")))
Check "deploy.log has one ok line" (@(Get-Content (Join-Path $rehearsalRepo "config\deploy.log") | Where-Object { $_ -match "deploy ok from=build-A to=build-B" }).Count -eq 1)

Write-Host "`n######## 3. a build that fails its health check is rolled back" -ForegroundColor Magenta
New-Build ".next-new" "build-C" @("UNHEALTHY")
$rehearsalCode = @(Invoke-Deploy)[-1]
Check "exit code 1" ($rehearsalCode -eq 1) "got $rehearsalCode"
Check ".next is back on build-B" ((Read-Build ".next") -eq "build-B") (Read-Build ".next")
Check ".next-old is still build-A" ((Read-Build ".next-old") -eq "build-A") (Read-Build ".next-old")
Check ".next-failed holds build-C" ((Read-Build ".next-failed") -eq "build-C") (Read-Build ".next-failed")
$rehearsalProbe = Invoke-HttpProbe -Url "http://127.0.0.1:$rehearsalPort/api/health"
Check "the server answers 200 from build-B afterwards" ($rehearsalProbe.Status -eq 200 -and $rehearsalProbe.Body -match "build-B") "$($rehearsalProbe.Status) $($rehearsalProbe.Body)"

Write-Host "`n######## 4. a deploy without a restart is caught by the uptime check" -ForegroundColor Magenta
New-Build ".next-new" "build-D"
function Stop-Server { }
function Start-Server { }
Start-Sleep -Seconds 20
$rehearsalCode = @(Invoke-Deploy)[-1]
Check "exit code 1 when the old process keeps answering" ($rehearsalCode -eq 1) "got $rehearsalCode"
Check ".next is back on build-B" ((Read-Build ".next") -eq "build-B") (Read-Build ".next")
function Stop-Server { Assert-PortHeldByThisCheckout; Stop-RehearsalListener }
function Start-Server { Start-RehearsalServer -ScriptPath $rehearsalServerInside }

Write-Host "`n######## 5. rollback B -> A, to a build with no /api/health" -ForegroundColor Magenta
Set-Content -LiteralPath (Join-Path $rehearsalRepo ".next-old\NO_HEALTH_ROUTE") -Value "1"
$rehearsalCode = @(Invoke-Rollback)[-1]
Check "exit code 0" ($rehearsalCode -eq 0) "got $rehearsalCode"
Check ".next is build-A" ((Read-Build ".next") -eq "build-A") (Read-Build ".next")
Check ".next-old is build-B" ((Read-Build ".next-old") -eq "build-B") (Read-Build ".next-old")

Write-Host "`n######## 6. rollback again returns to B" -ForegroundColor Magenta
$rehearsalCode = @(Invoke-Rollback)[-1]
Check "exit code 0" ($rehearsalCode -eq 0) "got $rehearsalCode"
Check ".next is build-B" ((Read-Build ".next") -eq "build-B") (Read-Build ".next")

Write-Host "`n######## 7. a server listening on every interface is reported" -ForegroundColor Magenta
$script:RehearsalBindHost = "0.0.0.0"
New-Build ".next-new" "build-E"
$rehearsalCode = @(Invoke-Deploy)[-1]
Check "exit code 2" ($rehearsalCode -eq 2) "got $rehearsalCode"
Check ".next is build-E (healthy, so not rolled back)" ((Read-Build ".next") -eq "build-E") (Read-Build ".next")

Write-Host "`n######## 8. a port held by something other than node is not touched" -ForegroundColor Magenta
Stop-RehearsalListener
$rehearsalSocket = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $rehearsalPort)
$rehearsalSocket.Start()
$rehearsalThrew = $false
try { Assert-PortHeldByThisCheckout } catch { $rehearsalThrew = $true; Write-Host "      $($_.Exception.Message)" }
$rehearsalSocket.Stop()
Check "refuses to end a non-node process" $rehearsalThrew

Stop-RehearsalListener

Write-Host "`n######## 9. whatever holds port $rehearsalLivePort was never touched" -ForegroundColor Magenta
$rehearsalLiveOwnerAfter = Get-RehearsalLiveOwner
Check "same process before and after ($rehearsalLiveOwnerBefore)" ($rehearsalLiveOwnerBefore -eq $rehearsalLiveOwnerAfter) "now $rehearsalLiveOwnerAfter"

Write-Host "`n--- deploy.log"
Get-Content (Join-Path $rehearsalRepo "config\deploy.log")
Write-Host "`n$($script:RehearsalPassed) passed, $($script:RehearsalFailed) failed"

Remove-Item -LiteralPath $rehearsalRepo -Recurse -Force

if ($script:RehearsalFailed -gt 0) {
    exit 1
}

exit 0
