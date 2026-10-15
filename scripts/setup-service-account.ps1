<#
.SYNOPSIS
把线上站点的计划任务从内置 Administrator 换到两个本地标准账户运行。
默认只打印计划，不改任何东西；加 -Apply 才执行。

.DESCRIPTION
完整说明、每一步为什么这样做、怎么验证、怎么回退：docs/service-account.md。

要做的事（每一步都先检查，已经做好的跳过，所以可以重复运行）：

  1. 账户     新建本地标准用户 radar-svc（网站、导入、备份）和 radar-tunnel
              （cloudflared），只在 Users 组；授予「作为批处理作业登录」；
              默认再拒绝本地 / 远程桌面 / 网络登录（-AllowInteractiveLogon 跳过）。
              密码随机生成并只在屏幕上显示一次（或 -PromptPassword 自己输入），
              不写进任何文件。S4U 任务用不到这个密码。
  2. 文件权限 仓库目录 radar-svc 只读；config、.cache、.next*、备份目录可写；
              确认 .env.local 可读。
  3. 隧道     把 cloudflared 的 config.yml 和隧道凭据复制到 C:\ProgramData 下
              一个只有管理员和 radar-tunnel 能读的目录，原件不动。
  4. 探针     以两个账户各跑一次临时计划任务，实测读写权限，跑完删除。
              没通过就停在这里，正式任务一个都不改。
  5. 任务     先把四个任务的原始定义导出备份，再把 ai-tech-radar-server /
              -tasks / -backup 改为 radar-svc（S4U），备份任务加 BACKUP_DIR
              指回原来的备份目录；ai-tech-radar-tunnel 改为 radar-tunnel（S4U），
              指向新的配置目录。ai-tech-radar-pipeline-alert 不动（它要在
              Administrator 的桌面上弹通知）。

不做的事：不重启、不停止任何正在运行的进程（改的是任务定义，正在跑的服务仍是
原来的身份，按文档第 4、5 步切换）；不改 deploy.ps1；不碰 3000 端口。

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts\setup-service-account.ps1
  # 只打印计划和当前状态

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts\setup-service-account.ps1 -Apply
  # 执行（需要管理员 PowerShell）

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts\setup-service-account.ps1 -Revert -Apply
  # 把四个任务恢复成第一次运行前导出的定义（账户、权限、复制的配置保留）
#>

[CmdletBinding()]
param(
    [switch]$Apply,
    [switch]$Revert,
    [string]$ServiceUser = "radar-svc",
    [string]$TunnelUser = "radar-tunnel",
    [string]$RepoRoot = "",
    [string]$BackupDir = "",
    [string]$TunnelDir = "C:\ProgramData\ai-tech-radar\cloudflared",
    [string]$StateDir = "C:\ProgramData\ai-tech-radar\service-account",
    [switch]$PromptPassword,
    [switch]$AllowInteractiveLogon,
    [switch]$SkipTunnel,
    [switch]$SkipProbe
)

$ErrorActionPreference = "Stop"

$ServerTask = "ai-tech-radar-server"
$ImportTask = "ai-tech-radar-tasks"
$BackupTask = "ai-tech-radar-backup"
$TunnelTask = "ai-tech-radar-tunnel"
$ProbeTask = "ai-tech-radar-svc-probe"
$UsersGroupSid = "S-1-5-32-545"
$AdminsGroupSid = "S-1-5-32-544"
$SystemSid = "S-1-5-18"
$DenyRights = @(
    @{ Right = "SeDenyInteractiveLogonRight"; Label = "拒绝本地登录" },
    @{ Right = "SeDenyRemoteInteractiveLogonRight"; Label = "拒绝通过远程桌面登录" },
    @{ Right = "SeDenyNetworkLogonRight"; Label = "拒绝从网络访问这台计算机" }
)

$script:Pending = 0
$script:SharedAccount = ($ServiceUser -eq $TunnelUser)

# ---------------------------------------------------------------- 输出

function Write-Section {
    param([string]$Title)
    Write-Host ""
    Write-Host "== $Title" -ForegroundColor Cyan
}

function Write-Info {
    param([string]$Message)
    Write-Host "   $Message"
}

function Write-Warn {
    param([string]$Message)
    Write-Host "   [注意]   $Message" -ForegroundColor Yellow
}

# 先检查；已就绪就跳过；没有 -Apply 只报告；执行后再检查一次。
# 参数名带 Step 前缀：传进来的脚本块在这里运行，会看到这个函数的变量，
# 叫 $Description 之类就会盖住调用方的同名变量。
function Invoke-Step {
    param([string]$StepName, [scriptblock]$StepTest, [scriptblock]$StepAction)

    if (& $StepTest) {
        Write-Host "   [已就绪] $StepName" -ForegroundColor Green
        return
    }

    if (-not $Apply) {
        Write-Host "   [将执行] $StepName" -ForegroundColor Yellow
        $script:Pending++
        return
    }

    Write-Host "   [执行]   $StepName" -ForegroundColor Cyan
    & $StepAction

    if (-not (& $StepTest)) {
        throw "执行后复查没有通过：$StepName"
    }

    Write-Host "            复查通过" -ForegroundColor Green
}

# ---------------------------------------------------------------- 账户与权限

function Resolve-AccountSid {
    param([string]$Name)

    if (-not $Name) {
        return $null
    }

    try {
        return (New-Object System.Security.Principal.NTAccount($Name)).Translate([System.Security.Principal.SecurityIdentifier])
    } catch {
        return $null
    }
}

function Get-SidBytes {
    param([System.Security.Principal.SecurityIdentifier]$Sid)
    $bytes = New-Object byte[] ($Sid.BinaryLength)
    $Sid.GetBinaryForm($bytes, 0)
    return , $bytes
}

if (-not ("RadarSetup.Lsa" -as [type])) {
    Add-Type -Language CSharp -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Runtime.InteropServices;

namespace RadarSetup {
    public static class Lsa {
        [StructLayout(LayoutKind.Sequential)]
        private struct LSA_UNICODE_STRING {
            public ushort Length;
            public ushort MaximumLength;
            public IntPtr Buffer;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct LSA_OBJECT_ATTRIBUTES {
            public int Length;
            public IntPtr RootDirectory;
            public IntPtr ObjectName;
            public uint Attributes;
            public IntPtr SecurityDescriptor;
            public IntPtr SecurityQualityOfService;
        }

        [DllImport("advapi32.dll")]
        private static extern uint LsaOpenPolicy(IntPtr systemName, ref LSA_OBJECT_ATTRIBUTES attributes, uint access, out IntPtr handle);

        [DllImport("advapi32.dll")]
        private static extern uint LsaEnumerateAccountRights(IntPtr handle, byte[] sid, out IntPtr rights, out uint count);

        [DllImport("advapi32.dll")]
        private static extern uint LsaAddAccountRights(IntPtr handle, byte[] sid, LSA_UNICODE_STRING[] rights, uint count);

        [DllImport("advapi32.dll")]
        private static extern uint LsaFreeMemory(IntPtr buffer);

        [DllImport("advapi32.dll")]
        private static extern uint LsaClose(IntPtr handle);

        [DllImport("advapi32.dll")]
        private static extern int LsaNtStatusToWinError(uint status);

        private const uint PolicyCreateAccount = 0x00000010;
        private const uint PolicyLookupNames = 0x00000800;
        private const uint StatusObjectNameNotFound = 0xC0000034;

        private static IntPtr Open(uint access) {
            LSA_OBJECT_ATTRIBUTES attributes = new LSA_OBJECT_ATTRIBUTES();
            attributes.Length = Marshal.SizeOf(typeof(LSA_OBJECT_ATTRIBUTES));
            IntPtr handle;
            uint status = LsaOpenPolicy(IntPtr.Zero, ref attributes, access, out handle);
            if (status != 0) throw new Win32Exception(LsaNtStatusToWinError(status));
            return handle;
        }

        public static string[] GetRights(byte[] sid) {
            IntPtr handle = Open(PolicyLookupNames);
            try {
                IntPtr rights;
                uint count;
                uint status = LsaEnumerateAccountRights(handle, sid, out rights, out count);
                if (status == StatusObjectNameNotFound) return new string[0];
                if (status != 0) throw new Win32Exception(LsaNtStatusToWinError(status));
                try {
                    List<string> names = new List<string>();
                    int size = Marshal.SizeOf(typeof(LSA_UNICODE_STRING));
                    for (int i = 0; i < count; i++) {
                        LSA_UNICODE_STRING item = (LSA_UNICODE_STRING)Marshal.PtrToStructure(new IntPtr(rights.ToInt64() + i * size), typeof(LSA_UNICODE_STRING));
                        names.Add(Marshal.PtrToStringUni(item.Buffer, item.Length / 2));
                    }
                    return names.ToArray();
                } finally {
                    LsaFreeMemory(rights);
                }
            } finally {
                LsaClose(handle);
            }
        }

        public static void AddRight(byte[] sid, string right) {
            IntPtr handle = Open(PolicyLookupNames | PolicyCreateAccount);
            LSA_UNICODE_STRING[] rights = new LSA_UNICODE_STRING[1];
            rights[0].Buffer = Marshal.StringToHGlobalUni(right);
            rights[0].Length = (ushort)(right.Length * 2);
            rights[0].MaximumLength = (ushort)((right.Length + 1) * 2);
            try {
                uint status = LsaAddAccountRights(handle, sid, rights, 1);
                if (status != 0) throw new Win32Exception(LsaNtStatusToWinError(status));
            } finally {
                Marshal.FreeHGlobal(rights[0].Buffer);
                LsaClose(handle);
            }
        }
    }
}
'@
}

function Test-UserRight {
    param([string]$User, [string]$Right)

    $sid = Resolve-AccountSid $User

    if (-not $sid) {
        return $false
    }

    try {
        return ([RadarSetup.Lsa]::GetRights((Get-SidBytes $sid)) -contains $Right)
    } catch {
        return $false
    }
}

function Grant-UserRight {
    param([string]$User, [string]$Right)
    [RadarSetup.Lsa]::AddRight((Get-SidBytes (Resolve-AccountSid $User)), $Right)
}

function Test-GroupMember {
    param([string]$GroupSid, [string]$User)

    $userSid = Resolve-AccountSid $User

    if (-not $userSid) {
        return $false
    }

    # Get-LocalGroupMember 遇到组里有失效 SID 时会报错，所以走 ADSI。
    $group = Get-LocalGroup -SID $GroupSid
    $adsi = [ADSI]"WinNT://$env:COMPUTERNAME/$($group.Name),group"

    foreach ($member in @($adsi.Invoke("Members"))) {
        $bytes = $member.GetType().InvokeMember("objectSid", "GetProperty", $null, $member, $null)

        if ((New-Object System.Security.Principal.SecurityIdentifier($bytes, 0)).Value -eq $userSid.Value) {
            return $true
        }
    }

    return $false
}

function New-RandomPassword {
    $alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!#%+-=?@_".ToCharArray()
    $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()

    try {
        while ($true) {
            $bytes = New-Object byte[] 28
            $generator.GetBytes($bytes)
            $plain = -join ($bytes | ForEach-Object { $alphabet[$_ % $alphabet.Length] })

            if ($plain -cmatch "[A-Z]" -and $plain -cmatch "[a-z]" -and $plain -match "[0-9]" -and $plain -match "[^A-Za-z0-9]") {
                return $plain
            }
        }
    } finally {
        $generator.Dispose()
    }
}

function ConvertTo-PlainText {
    param([System.Security.SecureString]$Secure)
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Secure)

    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    } finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    }
}

function Read-AccountPassword {
    param([string]$User)

    if ($PromptPassword) {
        while ($true) {
            $first = Read-Host -AsSecureString "给 $User 设一个密码"
            $second = Read-Host -AsSecureString "再输一次"

            if ((ConvertTo-PlainText $first) -ceq (ConvertTo-PlainText $second)) {
                return $first
            }

            Write-Warn "两次不一致，重新输入。"
        }
    }

    $plain = New-RandomPassword
    Write-Host ""
    Write-Host "   $User 的密码（只显示这一次，不写进任何文件）：" -ForegroundColor Magenta
    Write-Host "       $plain" -ForegroundColor Magenta
    Write-Host "   S4U 任务用不到它；要记就记进密码管理器，忘了也可以由管理员重置。" -ForegroundColor Magenta
    Write-Host ""

    $secure = New-Object System.Security.SecureString

    foreach ($character in $plain.ToCharArray()) {
        $secure.AppendChar($character)
    }

    $plain = $null
    $secure.MakeReadOnly()
    return $secure
}

function New-ServiceAccount {
    param([string]$User, [string]$AccountDescription)
    $password = Read-AccountPassword $User
    New-LocalUser -Name $User -Password $password -Description $AccountDescription `
        -PasswordNeverExpires -UserMayNotChangePassword -AccountNeverExpires | Out-Null
}

function Ensure-Account {
    param([string]$User, [string]$AccountDescription)

    Invoke-Step "本地用户 $User 存在" -StepTest { [bool](Get-LocalUser -Name $User -ErrorAction SilentlyContinue) } -StepAction {
        New-ServiceAccount -User $User -AccountDescription $AccountDescription
    }

    if (Test-GroupMember $AdminsGroupSid $User) {
        throw "$User 在 Administrators 组里，不是低权限账户。脚本不会替你移出，请先确认这个账户的来历。"
    }

    Invoke-Step "$User 已启用" -StepTest {
        $account = Get-LocalUser -Name $User -ErrorAction SilentlyContinue
        [bool]($account -and $account.Enabled)
    } -StepAction { Enable-LocalUser -Name $User }

    Invoke-Step "$User 的密码不过期" -StepTest {
        $account = Get-LocalUser -Name $User -ErrorAction SilentlyContinue
        [bool]($account -and -not $account.PasswordExpires)
    } -StepAction { Set-LocalUser -Name $User -PasswordNeverExpires $true }

    Invoke-Step "$User 属于 Users 组（才能运行 C:\Program Files 下的 node 与 cloudflared）" -StepTest {
        Test-GroupMember $UsersGroupSid $User
    } -StepAction { Add-LocalGroupMember -SID $UsersGroupSid -Member $User }

    Invoke-Step "$User 有「作为批处理作业登录」（S4U 任务需要）" -StepTest {
        Test-UserRight $User "SeBatchLogonRight"
    } -StepAction { Grant-UserRight $User "SeBatchLogonRight" }

    if ($AllowInteractiveLogon) {
        Write-Info "按 -AllowInteractiveLogon，不给 $User 加拒绝登录。"
        return
    }

    foreach ($deny in $DenyRights) {
        $right = $deny.Right
        Invoke-Step "$User：$($deny.Label)" -StepTest { Test-UserRight $User $right } -StepAction { Grant-UserRight $User $right }
    }
}

# ---------------------------------------------------------------- 文件权限

function Test-FileGrant {
    param(
        [string]$Path,
        [string]$User,
        [System.Security.AccessControl.FileSystemRights]$Rights,
        [switch]$Inheritable
    )

    $sid = Resolve-AccountSid $User

    if (-not $sid -or -not (Test-Path -LiteralPath $Path)) {
        return $false
    }

    $acl = Get-Acl -LiteralPath $Path
    $both = [System.Security.AccessControl.InheritanceFlags]"ContainerInherit, ObjectInherit"

    foreach ($rule in $acl.GetAccessRules($true, $true, [System.Security.Principal.SecurityIdentifier])) {
        if ($rule.IdentityReference.Value -ne $sid.Value) { continue }
        if ($rule.AccessControlType -ne "Allow") { continue }
        if (($rule.FileSystemRights -band $Rights) -ne $Rights) { continue }

        if ($Inheritable) {
            if (($rule.InheritanceFlags -band $both) -ne $both) { continue }
            if ($rule.PropagationFlags -ne "None") { continue }
        }

        return $true
    }

    return $false
}

function Grant-FileAccess {
    param([string]$Path, [string]$User, [string]$Permission, [switch]$Inheritable)

    $sid = Resolve-AccountSid $User
    $spec = if ($Inheritable) { "*$($sid.Value):(OI)(CI)$Permission" } else { "*$($sid.Value):$Permission" }
    $timer = [System.Diagnostics.Stopwatch]::StartNew()
    & icacls.exe $Path /grant $spec /Q | Out-Host

    # 往下传播时个别文件失败也会是非零退出码；是否达标由 Invoke-Step 的复查和第 4 步的探针判断。
    if ($LASTEXITCODE -ne 0) {
        Write-Warn "icacls 退出码 $LASTEXITCODE（$Path），上面列出了没处理成功的文件。"
    }

    if ($timer.Elapsed.TotalSeconds -gt 5) {
        Write-Info "用时 $([math]::Round($timer.Elapsed.TotalSeconds)) 秒（权限传到了所有子文件）"
    }
}

# 只有 SYSTEM、Administrators 和指定账户能进的目录。已存在但不归管理员所有的，拒绝处理。
function Test-PrivateDirectory {
    param([string]$Path, [hashtable]$Grants)

    if (-not (Test-Path -LiteralPath $Path -PathType Container)) {
        return $false
    }

    $acl = Get-Acl -LiteralPath $Path

    if (-not $acl.AreAccessRulesProtected) {
        return $false
    }

    # 比较时去掉 Synchronize（0x100000）：icacls 写的规则带它。
    $masks = @{ "F" = 0x0F01FF; "M" = 0x0301BF; "RX" = 0x0200A9 }
    $expected = @{ $SystemSid = "F"; $AdminsGroupSid = "F" }

    foreach ($user in $Grants.Keys) {
        $sid = Resolve-AccountSid $user

        if (-not $sid) {
            return $false
        }

        $expected[$sid.Value] = $Grants[$user]
    }

    $seen = @{}

    foreach ($rule in $acl.GetAccessRules($true, $true, [System.Security.Principal.SecurityIdentifier])) {
        if ($rule.AccessControlType -ne "Allow") { continue }

        $ruleSid = $rule.IdentityReference.Value

        if (-not $expected.ContainsKey($ruleSid)) {
            return $false
        }

        if (([int]$rule.FileSystemRights -band 0x0F01FF) -ne $masks[$expected[$ruleSid]]) {
            return $false
        }

        $seen[$ruleSid] = $true
    }

    return ($seen.Count -eq $expected.Count)
}

function Set-PrivateDirectory {
    param([string]$Path, [hashtable]$Grants)

    if (Test-Path -LiteralPath $Path) {
        $owner = (Get-Acl -LiteralPath $Path).GetOwner([System.Security.Principal.SecurityIdentifier]).Value

        if ($owner -ne $AdminsGroupSid -and $owner -ne $SystemSid -and $owner -ne ([System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value)) {
            throw "$Path 已存在，所有者是 $owner，不是管理员。脚本不处理，请检查里面是什么，删除后再运行。"
        }
    } else {
        New-Item -ItemType Directory -Path $Path -Force | Out-Null
    }

    # 整个换掉访问列表（icacls /grant:r 只替换列出的账户，多出来的条目会留着）。
    $rights = @{ "F" = "FullControl"; "M" = "Modify"; "RX" = "ReadAndExecute" }
    $entries = @(
        @{ Sid = $SystemSid; Permission = "F" },
        @{ Sid = $AdminsGroupSid; Permission = "F" }
    )

    foreach ($user in $Grants.Keys) {
        $entries += @{ Sid = (Resolve-AccountSid $user).Value; Permission = $Grants[$user] }
    }

    $security = New-Object System.Security.AccessControl.DirectorySecurity
    $security.SetAccessRuleProtection($true, $false)
    $security.SetOwner((New-Object System.Security.Principal.SecurityIdentifier($AdminsGroupSid)))

    foreach ($entry in $entries) {
        $security.AddAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule(
                    (New-Object System.Security.Principal.SecurityIdentifier($entry.Sid)),
                    [System.Security.AccessControl.FileSystemRights]$rights[$entry.Permission],
                    [System.Security.AccessControl.InheritanceFlags]"ContainerInherit, ObjectInherit",
                    [System.Security.AccessControl.PropagationFlags]::None,
                    [System.Security.AccessControl.AccessControlType]::Allow)))
    }

    [System.IO.Directory]::SetAccessControl($Path, $security)
}

# ---------------------------------------------------------------- 计划任务

function Get-TaskArguments {
    param([string]$Name)
    $task = Get-ScheduledTask -TaskName $Name -ErrorAction SilentlyContinue

    if (-not $task) {
        return ""
    }

    return (($task.Actions | ForEach-Object { $_.Arguments }) -join " ")
}

function Test-TaskRunsAs {
    param([string]$Name, [string]$User)
    $task = Get-ScheduledTask -TaskName $Name -ErrorAction SilentlyContinue
    $want = Resolve-AccountSid $User

    if (-not $task -or -not $want) {
        return $false
    }

    $have = Resolve-AccountSid $task.Principal.UserId
    return ($task.Principal.LogonType -eq "S4U" -and $have -and $have.Value -eq $want.Value)
}

function Save-OriginalTask {
    param([string]$Name)
    $file = Join-Path $script:TaskBackupDir "$Name.original.xml"

    # 只保留第一次改动之前的定义，-Revert 用它。
    if (Test-Path -LiteralPath $file) {
        return
    }

    Export-ScheduledTask -TaskName $Name | Set-Content -LiteralPath $file -Encoding Unicode
    Write-Info "原始定义已导出：$file"
}

function Set-TaskRunsAs {
    param([string]$Name, [string]$User)
    Save-OriginalTask $Name
    $principal = New-ScheduledTaskPrincipal -UserId "$env:COMPUTERNAME\$User" -LogonType S4U -RunLevel Limited
    Set-ScheduledTask -TaskName $Name -Principal $principal | Out-Null
}

function Set-TaskArguments {
    param([string]$Name, [string]$Arguments)
    Save-OriginalTask $Name
    $actions = @((Get-ScheduledTask -TaskName $Name).Actions)

    if ($actions.Count -ne 1) {
        throw "$Name 有 $($actions.Count) 个动作，脚本只处理一个动作的任务。"
    }

    $parameters = @{ Execute = $actions[0].Execute; Argument = $Arguments }

    if ($actions[0].WorkingDirectory) {
        $parameters.WorkingDirectory = $actions[0].WorkingDirectory
    }

    Set-ScheduledTask -TaskName $Name -Action (New-ScheduledTaskAction @parameters) | Out-Null
}

# ---------------------------------------------------------------- 探针

$ProbeSource = @'
"use strict";
// 由 scripts/setup-service-account.ps1 写入并以服务账户运行；只报告能不能读写，不输出任何文件内容。
const fs = require("fs");
const net = require("net");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const [mode, ...rest] = process.argv.slice(2);
const lines = [];
let failed = 0;

const ok = (name, detail) => lines.push("OK    " + name + (detail ? " — " + detail : ""));
const fail = (name, detail) => {
  failed++;
  lines.push("FAIL  " + name + (detail ? " — " + detail : ""));
};
const attempt = (name, fn) => {
  try {
    ok(name, fn());
  } catch (error) {
    fail(name, error.code || error.message);
  }
};
const refused = (name, fn) => {
  try {
    fn();
    fail(name, "成功了，应当被拒绝");
  } catch (error) {
    if (error.code === "EPERM" || error.code === "EACCES") ok(name, "被拒绝（" + error.code + "）");
    else fail(name, "失败但不是权限拒绝：" + (error.code || error.message));
  }
};
const writeProbe = (dir) => {
  const file = path.join(dir, ".svc-probe-" + process.pid + ".tmp");
  fs.writeFileSync(file, "probe");
  fs.unlinkSync(file);
};
const readOnly = (file) => {
  fs.readFileSync(file);
  return "可读（内容未输出）";
};
const connect = (port) =>
  new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port });
    const done = (result) => {
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(1500, () => done("超时"));
    socket.once("connect", () => done("可连接"));
    socket.once("error", (error) => done(error.code || error.message));
  });

async function main() {
  ok("身份", os.userInfo().username + "，HOME=" + os.homedir());
  ok("node", process.version + "（" + process.execPath + "）");

  if (mode === "service") {
    const [repo, backupDir, tunnelSecret] = rest;
    attempt("读 package.json", () => {
      JSON.parse(fs.readFileSync(path.join(repo, "package.json"), "utf8"));
    });
    attempt("读 node_modules", () => {
      require.resolve("next/package.json", { paths: [repo] });
    });
    attempt("读 .env.local", () => readOnly(path.join(repo, ".env.local")));
    for (const dir of ["config", ".cache", ".next"]) attempt("写 " + dir, () => writeProbe(path.join(repo, dir)));
    attempt("写备份目录", () => writeProbe(backupDir));
    refused("仓库根目录只读", () => writeProbe(repo));
    refused("src 只读", () => writeProbe(path.join(repo, "src")));
    if (tunnelSecret) refused("读不到隧道凭据", () => readOnly(tunnelSecret));
    const npm = spawnSync("cmd.exe", ["/d", "/c", "npm -v"], { cwd: repo, encoding: "utf8", timeout: 60000 });
    if (npm.status === 0) ok("npm", npm.stdout.trim());
    else fail("npm", String(npm.stderr || (npm.error && npm.error.message) || "退出码 " + npm.status).trim());
    ok("代理 127.0.0.1:7890", (await connect(7890)) + "（只是报告：代理只在 Administrator 登录桌面后运行）");
  } else if (mode === "tunnel") {
    const [tunnelDir, credentials, repoEnv] = rest;
    attempt("读 config.yml", () => readOnly(path.join(tunnelDir, "config.yml")));
    attempt("读隧道凭据", () => readOnly(credentials));
    attempt("写 logs", () => writeProbe(path.join(tunnelDir, "logs")));
    refused("隧道目录只读", () => writeProbe(tunnelDir));
    if (repoEnv) refused("读不到网站的 .env.local", () => readOnly(repoEnv));
  } else {
    fail("参数", "未知模式 " + mode);
  }

  lines.push(failed ? "结果：" + failed + " 项失败" : "结果：全部通过");
  process.stdout.write(lines.join("\n") + "\n");
  process.exitCode = failed ? 1 : 0;
}

main();
'@

function Invoke-Probe {
    param([string]$User, [string]$WorkingDir, [string]$Mode, [string[]]$ProbeArguments)

    $probeDir = Join-Path $StateDir "probe"
    $probeFile = Join-Path $probeDir "probe.cjs"
    $resultFile = Join-Path $probeDir "result-$User.txt"
    [System.IO.File]::WriteAllText($probeFile, $ProbeSource, (New-Object System.Text.UTF8Encoding($false)))
    Remove-Item -LiteralPath $resultFile -Force -ErrorAction SilentlyContinue

    # 和正式任务一样：cmd 里 cd 过去、靠 PATH 找 node。开头不是引号，cmd 不会剥引号。
    $quoted = ($ProbeArguments | ForEach-Object { '"' + $_ + '"' }) -join " "
    $argumentLine = "/c cd /d `"$WorkingDir`" && node `"$probeFile`" $Mode $quoted > `"$resultFile`" 2>&1"

    $action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument $argumentLine
    $principal = New-ScheduledTaskPrincipal -UserId "$env:COMPUTERNAME\$User" -LogonType S4U -RunLevel Limited
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 5)
    Register-ScheduledTask -TaskName $ProbeTask -Action $action -Principal $principal -Settings $settings -Force | Out-Null

    try {
        $mark = (Get-Date).AddSeconds(-2)
        Start-ScheduledTask -TaskName $ProbeTask
        $deadline = (Get-Date).AddSeconds(120)

        while ($true) {
            Start-Sleep -Milliseconds 500
            $state = (Get-ScheduledTask -TaskName $ProbeTask).State
            $info = Get-ScheduledTaskInfo -TaskName $ProbeTask

            if ($state -ne "Running" -and $info.LastRunTime -ge $mark) { break }
            if ((Get-Date) -gt $deadline) { throw ("探针任务 120 秒没有结束（任务返回 0x{0:X8}）。" -f $info.LastTaskResult) }
        }
    } finally {
        Unregister-ScheduledTask -TaskName $ProbeTask -Confirm:$false -ErrorAction SilentlyContinue
    }

    if (-not (Test-Path -LiteralPath $resultFile)) {
        Write-Warn ("探针没有输出，任务返回 0x{0:X8}。0x80070569 = 缺「作为批处理作业登录」；0x8007052F = 账户被禁用或受限；0x00000001 多半是 cd 进不去工作目录（没有读权限）。" -f $info.LastTaskResult)
        return $false
    }

    $lines = @(Get-Content -LiteralPath $resultFile -Encoding UTF8)

    foreach ($line in $lines) {
        $color = if ($line -like "FAIL*") { "Red" } elseif ($line -like "OK*") { "Gray" } else { "White" }
        Write-Host "            $line" -ForegroundColor $color
    }

    return -not ($lines | Where-Object { $_ -like "FAIL*" -or $_ -like "*Error*" -or $_ -like "*不是内部或外部命令*" -or $_ -like "*is not recognized*" })
}

# ---------------------------------------------------------------- 隧道配置

function Get-TunnelConfigPath {
    param([string]$Arguments)

    if ($Arguments -match '--config\s+"?([^"\s]+)"?') {
        return $Matches[1]
    }

    return $null
}

function Get-CredentialsPath {
    param([string]$ConfigPath)

    if (-not $ConfigPath -or -not (Test-Path -LiteralPath $ConfigPath)) {
        return $null
    }

    foreach ($line in Get-Content -LiteralPath $ConfigPath -Encoding UTF8) {
        if ($line -match '^\s*credentials-file\s*:\s*["'']?([^"''#]+?)["'']?\s*$') {
            return $Matches[1].Trim()
        }
    }

    return $null
}

# ---------------------------------------------------------------- 当前状态（只读）

function Write-ProcessOwner {
    param([int]$ProcessId, [string]$Label)
    $process = Get-CimInstance Win32_Process -Filter "ProcessId=$ProcessId" -ErrorAction SilentlyContinue

    if (-not $process) {
        return
    }

    $owner = Invoke-CimMethod -InputObject $process -MethodName GetOwner -ErrorAction SilentlyContinue
    $who = if ($owner -and $owner.User) { "$($owner.Domain)\$($owner.User)" } else { "（读不到，需要管理员）" }
    Write-Info "$Label：PID $ProcessId $($process.Name)，以 $who 运行"
}

function Write-CurrentState {
    Write-Section "当前状态（只读）"

    foreach ($name in @($ServerTask, $ImportTask, $BackupTask, $TunnelTask, "ai-tech-radar-pipeline-alert")) {
        $task = Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue

        if ($task) {
            Write-Info ("{0,-30} {1} / {2} / {3}" -f $name, $task.Principal.UserId, $task.Principal.LogonType, $task.State)
        } else {
            Write-Info ("{0,-30} 不存在" -f $name)
        }
    }

    foreach ($ownerPid in @(Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique)) {
        Write-ProcessOwner -ProcessId $ownerPid -Label "端口 3000"
    }

    foreach ($tunnelProcess in @(Get-CimInstance Win32_Process -Filter "Name='cloudflared.exe'" -ErrorAction SilentlyContinue)) {
        Write-ProcessOwner -ProcessId $tunnelProcess.ProcessId -Label "cloudflared"
    }
}

# ================================================================ 开始

$identity = [System.Security.Principal.WindowsIdentity]::GetCurrent()
$isAdmin = (New-Object System.Security.Principal.WindowsPrincipal($identity)).IsInRole([System.Security.Principal.WindowsBuiltInRole]::Administrator)

Write-Host ("模式：{0}" -f $(if ($Apply) { "执行（-Apply）" } else { "只打印计划，不改任何东西" })) -ForegroundColor Cyan

if ($Apply -and -not $isAdmin) {
    throw "-Apply 需要管理员 PowerShell。"
}

if (-not $isAdmin) {
    Write-Warn "不是管理员：用户权限、其他账户的进程等读不到，下面的计划可能把已做好的事也列成「将执行」。"
}

if (-not $RepoRoot) {
    $serverArguments = Get-TaskArguments $ServerTask

    if ($serverArguments -match 'cd /d\s+"?([^"&]+?)"?\s*&&') {
        $RepoRoot = $Matches[1].Trim()
    } else {
        throw "读不出 $ServerTask 服务的检出目录。用 -RepoRoot 指定。"
    }
}

$RepoRoot = $RepoRoot.TrimEnd("\")
$ownCheckout = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

if (-not (Test-Path -LiteralPath (Join-Path $RepoRoot "package.json"))) {
    throw "$RepoRoot 下没有 package.json。"
}

if (-not $BackupDir) {
    $backupArguments = Get-TaskArguments $BackupTask

    if ($backupArguments -match 'BACKUP_DIR=([^"&]+?)"?\s*&&') {
        $BackupDir = $Matches[1].Trim()
    } else {
        # 备份脚本默认写到「运行账户的主目录\ai-tech-radar-backups」。取改动前那个账户：
        # 有导出的原始定义就读它，没有就读任务现在的账户。
        $backupTaskObject = Get-ScheduledTask -TaskName $BackupTask -ErrorAction SilentlyContinue

        if (-not $backupTaskObject) {
            throw "找不到计划任务 $BackupTask。用 -BackupDir 指定备份目录。"
        }

        $originalBackupXml = Join-Path (Join-Path $StateDir "task-backup") "$BackupTask.original.xml"
        $originalUser = $backupTaskObject.Principal.UserId

        if (Test-Path -LiteralPath $originalBackupXml) {
            $originalUser = ([xml](Get-Content -LiteralPath $originalBackupXml -Raw -Encoding Unicode)).Task.Principals.Principal.UserId
        }

        $currentSid = Resolve-AccountSid $originalUser
        $profilePath = (Get-CimInstance Win32_UserProfile -ErrorAction SilentlyContinue | Where-Object { $currentSid -and $_.SID -eq $currentSid.Value }).LocalPath

        if (-not $profilePath) {
            throw "推断不出现在的备份目录。用 -BackupDir 指定。"
        }

        $BackupDir = Join-Path $profilePath "ai-tech-radar-backups"
    }
}

$script:TaskBackupDir = Join-Path $StateDir "task-backup"

Write-Info "线上检出：$RepoRoot"

if ($ownCheckout.TrimEnd("\") -ne $RepoRoot) {
    Write-Info "（脚本本身在 $ownCheckout，改的是上面那个检出。）"
}

Write-Info "备份目录：$BackupDir"
Write-Info "网站账户：$ServiceUser    隧道账户：$(if ($SkipTunnel) { '（跳过）' } else { $TunnelUser })"
Write-Info "隧道配置：$TunnelDir"
Write-Info "状态目录：$StateDir"

# ---------------------------------------------------------------- 回退

if ($Revert) {
    Write-Section "回退：用第一次改动前导出的定义重建任务"

    foreach ($name in @($ServerTask, $ImportTask, $BackupTask, $TunnelTask)) {
        $file = Join-Path $script:TaskBackupDir "$name.original.xml"

        if (-not (Test-Path -LiteralPath $file)) {
            Write-Info "$name：没有备份（这个任务没被本脚本改过），跳过"
            continue
        }

        if (-not $Apply) {
            Write-Host "   [将执行] 按 $file 重建 $name" -ForegroundColor Yellow
            continue
        }

        Register-ScheduledTask -TaskName $name -Xml (Get-Content -LiteralPath $file -Raw -Encoding Unicode) -Force | Out-Null
        Write-Host "   [执行]   $name 已恢复：$((Get-ScheduledTask -TaskName $name).Principal.UserId)" -ForegroundColor Cyan
    }

    Write-Info "正在运行的进程没有动。按 docs/service-account.md 第 9 步重启网站和隧道，它们才回到原来的账户。"
    Write-Info "账户、文件权限、复制的隧道配置都还在；要删按文档第 9 步。"
    Write-CurrentState
    return
}

# ---------------------------------------------------------------- 1. 账户

Write-Section "1. 账户与登录权限"
Ensure-Account -User $ServiceUser -AccountDescription "AI Tech Radar 网站服务"

if (-not $SkipTunnel -and -not $script:SharedAccount) {
    Ensure-Account -User $TunnelUser -AccountDescription "AI Tech Radar 隧道"
}

# ---------------------------------------------------------------- 2. 文件权限

Write-Section "2. 文件权限"

Invoke-Step "$ServiceUser 对仓库只读（继承到所有子目录，第一次可能要几分钟）" -StepTest {
    Test-FileGrant -Path $RepoRoot -User $ServiceUser -Rights ReadAndExecute -Inheritable
} -StepAction { Grant-FileAccess -Path $RepoRoot -User $ServiceUser -Permission "RX" -Inheritable }

$cacheDir = Join-Path $RepoRoot ".cache"

Invoke-Step ".cache 目录存在（服务运行时会写它，不能等服务自己在只读的仓库根目录里建）" -StepTest {
    Test-Path -LiteralPath $cacheDir -PathType Container
} -StepAction { New-Item -ItemType Directory -Path $cacheDir | Out-Null }

$writable = @("config", ".cache") + @(".next", ".next-old", ".next-new" | Where-Object { Test-Path -LiteralPath (Join-Path $RepoRoot $_) })

foreach ($relative in $writable) {
    $target = Join-Path $RepoRoot $relative
    Invoke-Step "$ServiceUser 可写 $relative" -StepTest {
        Test-FileGrant -Path $target -User $ServiceUser -Rights Modify -Inheritable
    } -StepAction { Grant-FileAccess -Path $target -User $ServiceUser -Permission "M" -Inheritable }
}

Invoke-Step "备份目录 $BackupDir 存在" -StepTest { Test-Path -LiteralPath $BackupDir -PathType Container } -StepAction {
    New-Item -ItemType Directory -Path $BackupDir | Out-Null
}

Invoke-Step "$ServiceUser 可写备份目录（含删除旧快照）" -StepTest {
    Test-FileGrant -Path $BackupDir -User $ServiceUser -Rights Modify -Inheritable
} -StepAction { Grant-FileAccess -Path $BackupDir -User $ServiceUser -Permission "M" -Inheritable }

$envFile = Join-Path $RepoRoot ".env.local"

if (Test-Path -LiteralPath $envFile) {
    Invoke-Step "$ServiceUser 可读 .env.local" -StepTest {
        Test-FileGrant -Path $envFile -User $ServiceUser -Rights Read
    } -StepAction { Grant-FileAccess -Path $envFile -User $ServiceUser -Permission "R" }
} else {
    Write-Warn "$envFile 不存在。网站要读它（站点地址、令牌、密钥），先确认检出对不对。"
}

$stateGrants = @{}
Invoke-Step "状态目录 $StateDir（只有管理员能写，存任务原始定义）" -StepTest {
    Test-PrivateDirectory -Path $StateDir -Grants $stateGrants
} -StepAction { Set-PrivateDirectory -Path $StateDir -Grants $stateGrants }

Invoke-Step "任务备份目录存在" -StepTest { Test-Path -LiteralPath $script:TaskBackupDir -PathType Container } -StepAction {
    New-Item -ItemType Directory -Path $script:TaskBackupDir | Out-Null
}

$probeDir = Join-Path $StateDir "probe"
$probeGrants = @{ $ServiceUser = "M" }

if (-not $SkipTunnel -and -not $script:SharedAccount) {
    $probeGrants[$TunnelUser] = "M"
}

Invoke-Step "探针目录（两个账户可写，与任务备份分开）" -StepTest {
    Test-PrivateDirectory -Path $probeDir -Grants $probeGrants
} -StepAction { Set-PrivateDirectory -Path $probeDir -Grants $probeGrants }

# ---------------------------------------------------------------- 3. 隧道配置

$tunnelCredentials = $null

if (-not $SkipTunnel) {
    Write-Section "3. 隧道配置（复制到 $TunnelDir，原件不动）"

    if ($TunnelDir -match "\s") {
        throw "隧道目录不能含空格（任务命令行靠它不加引号）：$TunnelDir"
    }

    $tunnelConfig = Join-Path $TunnelDir "config.yml"
    $tunnelLogs = Join-Path $TunnelDir "logs"
    $tunnelArguments = Get-TaskArguments $TunnelTask

    if (-not $tunnelArguments) {
        throw "找不到计划任务 $TunnelTask。"
    }

    $sourceConfig = Get-TunnelConfigPath $tunnelArguments

    if ($sourceConfig -eq $tunnelConfig) {
        # 已经切过一次：原件位置从导出的原始定义里读。
        $original = Join-Path $script:TaskBackupDir "$TunnelTask.original.xml"

        if (Test-Path -LiteralPath $original) {
            $sourceConfig = Get-TunnelConfigPath ((Get-Content -LiteralPath $original -Raw -Encoding Unicode) -replace "&quot;", '"')
        }
    }

    $sourceCredentials = Get-CredentialsPath $sourceConfig

    if (-not $sourceCredentials) {
        throw "从 $sourceConfig 里读不出 credentials-file。"
    }

    $tunnelCredentials = Join-Path $TunnelDir (Split-Path -Leaf $sourceCredentials)
    $tunnelGrants = @{ $TunnelUser = "RX" }
    $logGrants = @{ $TunnelUser = "M" }
    Write-Info "原配置：$sourceConfig"

    Invoke-Step "隧道目录（管理员可写，$TunnelUser 只读）" -StepTest {
        Test-PrivateDirectory -Path $TunnelDir -Grants $tunnelGrants
    } -StepAction { Set-PrivateDirectory -Path $TunnelDir -Grants $tunnelGrants }

    Invoke-Step "日志目录（$TunnelUser 可写）" -StepTest {
        Test-PrivateDirectory -Path $tunnelLogs -Grants $logGrants
    } -StepAction { Set-PrivateDirectory -Path $tunnelLogs -Grants $logGrants }

    Invoke-Step "隧道凭据已复制（不显示内容）" -StepTest { Test-Path -LiteralPath $tunnelCredentials } -StepAction {
        Copy-Item -LiteralPath $sourceCredentials -Destination $tunnelCredentials
    }

    Invoke-Step "config.yml 已复制，credentials-file 指向新位置" -StepTest {
        (Get-CredentialsPath $tunnelConfig) -eq $tunnelCredentials
    } -StepAction {
        $text = [System.IO.File]::ReadAllText($sourceConfig)
        $pattern = '(?m)^(\s*credentials-file\s*:\s*).*?(\r?)$'
        $replacement = '${1}' + $tunnelCredentials.Replace('$', '$$') + '${2}'
        [System.IO.File]::WriteAllText($tunnelConfig, ([regex]::Replace($text, $pattern, $replacement)), (New-Object System.Text.UTF8Encoding($false)))
    }
}

# ---------------------------------------------------------------- 4. 探针

Write-Section "4. 探针：以新账户实测读写"

$probeReady = $true

if ($SkipProbe) {
    Write-Warn "按 -SkipProbe 跳过。没有实测过的权限，第一次真正启动时才会暴露问题。"
} elseif (-not $Apply) {
    Write-Host "   [将执行] 以 $ServiceUser$(if (-not $SkipTunnel -and -not $script:SharedAccount) { " 和 $TunnelUser" }) 各跑一次临时任务 $ProbeTask，跑完删除" -ForegroundColor Yellow
    $script:Pending++
} else {
    $tunnelSecretForService = if ($tunnelCredentials -and -not $script:SharedAccount) { $tunnelCredentials } else { "" }
    Write-Info "$ServiceUser："
    $probeReady = Invoke-Probe -User $ServiceUser -WorkingDir $RepoRoot -Mode "service" -ProbeArguments @($RepoRoot, $BackupDir, $tunnelSecretForService)

    if (-not $SkipTunnel) {
        $repoEnvForTunnel = if ($script:SharedAccount) { "" } else { $envFile }
        Write-Info "$TunnelUser："
        $tunnelReady = Invoke-Probe -User $TunnelUser -WorkingDir $TunnelDir -Mode "tunnel" -ProbeArguments @($TunnelDir, $tunnelCredentials, $repoEnvForTunnel)
        $probeReady = $probeReady -and $tunnelReady
    }

    if (-not $probeReady) {
        throw "探针没有全部通过，计划任务一个都没改。修好上面 FAIL 的项后重新运行。"
    }
}

# ---------------------------------------------------------------- 5. 计划任务

Write-Section "5. 计划任务改为新账户（S4U），正在运行的进程不动"

foreach ($name in @($ServerTask, $ImportTask, $BackupTask)) {
    if (-not (Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue)) {
        Write-Warn "$name 不存在，跳过。"
        continue
    }

    $taskName = $name
    Invoke-Step "$name 以 $ServiceUser 运行" -StepTest { Test-TaskRunsAs $taskName $ServiceUser } -StepAction {
        Set-TaskRunsAs $taskName $ServiceUser
    }
}

Invoke-Step "$BackupTask 的命令行带 BACKUP_DIR（否则备份会改写到 $ServiceUser 的主目录）" -StepTest {
    (Get-TaskArguments $BackupTask) -like "*BACKUP_DIR=$BackupDir*"
} -StepAction {
    $current = Get-TaskArguments $BackupTask
    $updated = $current -replace '&&\s*npm run backup:data', ("&& set `"BACKUP_DIR=$BackupDir`" && npm run backup:data")

    if ($updated -eq $current) {
        throw "认不出 $BackupTask 的命令行：$current"
    }

    Set-TaskArguments $BackupTask $updated
}

if (-not $SkipTunnel) {
    $newTunnelConfig = Join-Path $TunnelDir "config.yml"
    $newTunnelLog = Join-Path $TunnelDir "logs\tunnel.log"

    Invoke-Step "$TunnelTask 读新配置、日志写到新目录、关掉自动更新" -StepTest {
        $arguments = Get-TaskArguments $TunnelTask
        (Get-TunnelConfigPath $arguments) -eq $newTunnelConfig -and $arguments -like "*>> $newTunnelLog*" -and $arguments -like "*--no-autoupdate*"
    } -StepAction {
        $current = Get-TaskArguments $TunnelTask
        $updated = $current -replace '--config\s+"?[^"\s]+"?', "--config $newTunnelConfig"
        $updated = $updated -replace '>>\s*"?[^"\s]+"?', ">> $newTunnelLog"

        if ($updated -notlike "*--no-autoupdate*") {
            $updated = $updated -replace '--config ', '--no-autoupdate --config '
        }

        if ($updated -eq $current -or $updated -notlike "*tunnel run*") {
            throw "认不出 $TunnelTask 的命令行：$current"
        }

        Set-TaskArguments $TunnelTask $updated
    }

    Invoke-Step "$TunnelTask 以 $TunnelUser 运行" -StepTest { Test-TaskRunsAs $TunnelTask $TunnelUser } -StepAction {
        Set-TaskRunsAs $TunnelTask $TunnelUser
    }
}

Write-CurrentState

Write-Section "结果"

if (-not $Apply) {
    if ($script:Pending -gt 0) {
        Write-Info "还有 $($script:Pending) 项要做。确认无误后加 -Apply 再运行（管理员 PowerShell）。"
    } else {
        Write-Info "全部就绪。"
    }

    return
}

Write-Info "任务定义已改好。正在运行的网站和隧道还是原来的身份，按 docs/service-account.md："
Write-Info "  第 4 步：重启网站（停机约 2–3 秒），确认端口 3000 的进程以 $ServiceUser 运行"
Write-Info "  第 5 步：切换隧道（新旧两个连接器先并存，不停机）"
Write-Info "回退：加 -Revert -Apply 运行本脚本，再按第 9 步重启。"
