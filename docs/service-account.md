# 用低权限账户运行线上服务

> 状态（2026-10-15）：步骤与脚本已写好，**还没有执行**。由 owner 亲自在管理员
> PowerShell 里执行；第 4、5 步会重启线上进程，按 CLAUDE.md 的约定只能由主控窗口
> 协调。脚本：`scripts/setup-service-account.ps1`（默认只打印计划，加 `-Apply`
> 才改东西）。

## 为什么要换

2026-10-15 读到的现状：

| 计划任务                       | 运行身份      | 登录方式    |
| ------------------------------ | ------------- | ----------- |
| `ai-tech-radar-server`（网站） | Administrator | S4U         |
| `ai-tech-radar-tasks`（导入）  | Administrator | S4U         |
| `ai-tech-radar-backup`（备份） | Administrator | S4U         |
| `ai-tech-radar-tunnel`（隧道） | Administrator | S4U         |
| `ai-tech-radar-pipeline-alert` | Administrator | Interactive |

这带来两个问题：

1. **权限太大。** 这个 Administrator 是内置账户（RID 500），而
   `FilterAdministratorToken` 没有开，UAC 不给它降权的令牌，所以任务里写的
   `RunLevel Limited` 不起作用：直接对着公网的 `node` 进程和 `cloudflared` 都带着
   完整的管理员权限。网站一旦被攻破（比如某个依赖出了问题），攻击者拿到的就是本机
   管理员。确认方法：任务管理器 → 详细信息 → 在列标题上右键「选择列」勾上「提升」，
   看占着 3000 端口的那个 `node.exe`。
2. **一个账户被锁，整站起不来。** 2026-10-02 无头 Chrome 让 Administrator 在 10
   分钟内登录失败 10 次，账户被锁 10 分钟；服务任务要以这个账户登录，于是 20 分钟
   起不来，回滚也没用（见 `docs/deployment.md` →「Deploy with one command」）。

换完之后：网站进程只能读仓库、写四个目录；隧道进程只能读自己的配置；Administrator
被锁不再影响网站、隧道、导入和备份。

## 换完是什么样

| 计划任务                       | 之后的身份            | 命令行的变化                                                                            |
| ------------------------------ | --------------------- | --------------------------------------------------------------------------------------- |
| `ai-tech-radar-server`         | `radar-svc`，S4U      | 不变                                                                                    |
| `ai-tech-radar-tasks`          | `radar-svc`，S4U      | 不变                                                                                    |
| `ai-tech-radar-backup`         | `radar-svc`，S4U      | 加 `set "BACKUP_DIR=C:\Users\Administrator\ai-tech-radar-backups"`                      |
| `ai-tech-radar-tunnel`         | `radar-tunnel`，S4U   | `--config` 与日志改到 `C:\ProgramData\ai-tech-radar\cloudflared\`，加 `--no-autoupdate` |
| `ai-tech-radar-pipeline-alert` | 不变（Administrator） | 不变：它要在 Administrator 的桌面上弹通知，必须在那个会话里跑                           |

触发器、`StartWhenAvailable`、重启次数等设置都不动：脚本只换任务的运行身份，以及
上表里两个任务的命令行。

两个账户的权限：

| 位置                                                                                   | `radar-svc`                  | `radar-tunnel` |
| -------------------------------------------------------------------------------------- | ---------------------------- | -------------- |
| 仓库 `C:\Users\Administrator\ai-tech-radar`（含 `.env.local`、`node_modules`、工作树） | 只读                         | 无             |
| 仓库里的 `config`、`.cache`、`.next`、`.next-old`（有 `.next-new` 时也算）             | 读写                         | 无             |
| 备份目录 `C:\Users\Administrator\ai-tech-radar-backups`                                | 读写                         | 无             |
| `C:\ProgramData\ai-tech-radar\cloudflared`（`config.yml`、隧道凭据）                   | 无                           | 只读           |
| `C:\ProgramData\ai-tech-radar\cloudflared\logs`                                        | 无                           | 读写           |
| `C:\ProgramData\ai-tech-radar\service-account\task-backup`（任务原始定义）             | 无                           | 无             |
| `C:\ProgramData\ai-tech-radar\service-account\probe`（探针）                           | 读写                         | 读写           |
| `C:\Program Files\nodejs`、`cloudflared.exe`                                           | 运行（Users 组本来就有权限） | 运行           |

**为什么分两个账户。** 隧道凭据（那个 JSON）能让任何一台机器替 `aizyradar.cn`
接流量。网站进程是对着公网的那一个，它被攻破时不该顺带拿到凭据；分开以后，探针会
实测 `radar-svc` 读不到凭据、`radar-tunnel` 读不到网站的 `.env.local`。只想要一个
账户的话，运行脚本时加 `-TunnelUser radar-svc`。

**为什么仓库放在 Administrator 的主目录下也行。** Windows 默认给所有用户「跳过
遍历检查」（Bypass traverse checking）这项权限：一个账户不需要能打开
`C:\Users\Administrator`，只要对仓库目录本身有权限，就能按完整路径进去。仓库目录
上现在已经有一条 `CodexSandboxUsers` 只读的规则，用的是同一个办法。第 2 步的探针
会以新账户实测这一点，不靠推理。

## 脚本做什么、不做什么

`scripts/setup-service-account.ps1` 分五部分，每一项都**先检查、已经做好的跳过、
做完再复查一次**，所以可以重复运行；第二次运行时每一行都应是「已就绪」。

1. 账户：建 `radar-svc` 和 `radar-tunnel`（只在 Users 组，密码不过期），授予「作为
   批处理作业登录」（S4U 任务需要），默认再加三条拒绝：本地登录、远程桌面登录、从
   网络访问。账户如果已经在 Administrators 组里，脚本拒绝继续。
2. 文件权限：见上表。
3. 隧道配置：把现在的 `config.yml` 和凭据 JSON **复制**到
   `C:\ProgramData\ai-tech-radar\cloudflared\`，副本里的 `credentials-file` 改成
   新位置。原件不动。
4. 探针：以两个账户各注册并运行一次临时计划任务 `ai-tech-radar-svc-probe`，实测上表
   的每一项，跑完删除。**任何一项不通过就停下，计划任务一个都不改。**
5. 计划任务：先把四个任务的原始定义导出到
   `C:\ProgramData\ai-tech-radar\service-account\task-backup\*.original.xml`（只在
   第一次导出，回退用它），再按上表改。

不做的事：**不重启、不停止任何正在运行的进程**（改的是任务定义；正在跑的网站和
隧道仍是 Administrator，要按第 4、5 步切换），不碰 3000 端口，不改 `deploy.ps1`，
不删除任何东西，不把密码写进任何文件。

| 参数                           | 作用                                                                     |
| ------------------------------ | ------------------------------------------------------------------------ |
| （不加参数）                   | 只打印计划和当前状态，什么都不改                                         |
| `-Apply`                       | 执行。需要管理员 PowerShell                                              |
| `-Revert -Apply`               | 用导出的原始定义重建四个任务（账户、权限、复制的配置保留）               |
| `-ServiceUser` / `-TunnelUser` | 账户名，默认 `radar-svc` / `radar-tunnel`；两个设成同一个就只建一个      |
| `-RepoRoot`                    | 线上检出。默认从 `ai-tech-radar-server` 的命令行里读出来                 |
| `-BackupDir`                   | 备份目录。默认取备份任务原来那个账户的主目录下的 `ai-tech-radar-backups` |
| `-TunnelDir` / `-StateDir`     | 隧道配置副本、状态目录的位置（默认都在 `C:\ProgramData\ai-tech-radar\`） |
| `-PromptPassword`              | 自己输入密码，不随机生成                                                 |
| `-AllowInteractiveLogon`       | 不加那三条拒绝登录（想用 `runas` 调试时）                                |
| `-SkipTunnel`                  | 只处理网站、导入、备份，不动隧道                                         |
| `-SkipProbe`                   | 跳过探针（不建议）                                                       |

## 步骤

每一步写了：做什么、为什么、怎么验证、怎么回退。

### 0. 开始前

- **做什么**：挑时间，确认条件。
- **为什么**：第 2 步要给整个仓库改权限，第 4、5 步要重启线上进程；避开定时任务和
  编辑轮，出问题时才分得清原因。
- **条件**：
  - 管理员 PowerShell（本机的 Administrator 本来就总是提升的）。
  - 不在 07:45 备份、08:05 导入前后；编辑轮没在跑；没有别的窗口在部署。
  - 最近 10 分钟没有失败登录（部署脚本也查这个）。下面这条命令应当报「找不到」：
    ```powershell
    Get-WinEvent -FilterHashtable @{ LogName = 'Security'; Id = 4625; StartTime = (Get-Date).AddMinutes(-10) }
    ```
  - 先做一次备份：在主检出运行 `npm run backup:data`（当天已有快照时它只记一行就
    退出，也行）。
  - 脚本从哪里运行都可以：它从 `ai-tech-radar-server` 的命令行读出线上检出，改的
    总是那一个。分支合进 `main` 之前，可以直接用工作树里的脚本路径运行。
- **怎么回退**：这一步没改东西。

### 1. 演练：只打印计划

- **做什么**：
  ```powershell
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts\setup-service-account.ps1
  ```
- **为什么**：先看它认出的路径和要做的事对不对。这一步只读：读计划任务、账户、
  文件权限、隧道配置的位置，以及端口 3000 和 `cloudflared` 进程属于谁。
- **预期输出**（第一次运行，节选）：
  ```text
  模式：只打印计划，不改任何东西
     线上检出：C:\Users\Administrator\ai-tech-radar
     备份目录：C:\Users\Administrator\ai-tech-radar-backups
     网站账户：radar-svc    隧道账户：radar-tunnel
     隧道配置：C:\ProgramData\ai-tech-radar\cloudflared
     状态目录：C:\ProgramData\ai-tech-radar\service-account

  == 1. 账户与登录权限
     [将执行] 本地用户 radar-svc 存在
     [将执行] radar-svc 已启用
     [将执行] radar-svc 的密码不过期
     [将执行] radar-svc 属于 Users 组（才能运行 C:\Program Files 下的 node 与 cloudflared）
     [将执行] radar-svc 有「作为批处理作业登录」（S4U 任务需要）
     [将执行] radar-svc：拒绝本地登录
     [将执行] radar-svc：拒绝通过远程桌面登录
     [将执行] radar-svc：拒绝从网络访问这台计算机
     （radar-tunnel 同样 8 行）

  == 2. 文件权限
     [将执行] radar-svc 对仓库只读（继承到所有子目录，第一次可能要几分钟）
     [已就绪] .cache 目录存在（服务运行时会写它，不能等服务自己在只读的仓库根目录里建）
     [将执行] radar-svc 可写 config
     [将执行] radar-svc 可写 .cache
     [将执行] radar-svc 可写 .next
     [将执行] radar-svc 可写 .next-old
     [已就绪] 备份目录 C:\Users\Administrator\ai-tech-radar-backups 存在
     [将执行] radar-svc 可写备份目录（含删除旧快照）
     [将执行] radar-svc 可读 .env.local
     [将执行] 状态目录 C:\ProgramData\ai-tech-radar\service-account（只有管理员能写，存任务原始定义）
     [将执行] 任务备份目录存在
     [将执行] 探针目录（两个账户可写，与任务备份分开）

  == 3. 隧道配置（复制到 C:\ProgramData\ai-tech-radar\cloudflared，原件不动）
     原配置：C:\Users\Administrator\.cloudflared\config.yml
     [将执行] 隧道目录（管理员可写，radar-tunnel 只读）
     [将执行] 日志目录（radar-tunnel 可写）
     [将执行] 隧道凭据已复制（不显示内容）
     [将执行] config.yml 已复制，credentials-file 指向新位置

  == 4. 探针：以新账户实测读写
     [将执行] 以 radar-svc 和 radar-tunnel 各跑一次临时任务 ai-tech-radar-svc-probe，跑完删除

  == 5. 计划任务改为新账户（S4U），正在运行的进程不动
     [将执行] ai-tech-radar-server 以 radar-svc 运行
     [将执行] ai-tech-radar-tasks 以 radar-svc 运行
     [将执行] ai-tech-radar-backup 以 radar-svc 运行
     [将执行] ai-tech-radar-backup 的命令行带 BACKUP_DIR（否则备份会改写到 radar-svc 的主目录）
     [将执行] ai-tech-radar-tunnel 读新配置、日志写到新目录、关掉自动更新
     [将执行] ai-tech-radar-tunnel 以 radar-tunnel 运行

  == 当前状态（只读）
     ai-tech-radar-server           Administrator / S4U / Running
     ai-tech-radar-tasks            Administrator / S4U / Ready
     ai-tech-radar-backup           Administrator / S4U / Ready
     ai-tech-radar-tunnel           Administrator / S4U / Running
     ai-tech-radar-pipeline-alert   Administrator / Interactive / Ready
     端口 3000：PID …… node.exe，以 ALAKSA\Administrator 运行
     cloudflared：PID …… cloudflared.exe，以 ALAKSA\Administrator 运行

  == 结果
     还有 …… 项要做。确认无误后加 -Apply 再运行（管理员 PowerShell）。
  ```
  这份样例是照脚本的输出语句写的，**脚本还没在这台机器上真正跑过**；`.cache`、
  `.next-old` 两行取决于当时目录在不在。
- **怎么验证**：「线上检出」是 `C:\Users\Administrator\ai-tech-radar`；「备份目录」
  是 `C:\Users\Administrator\ai-tech-radar-backups`（和现在快照所在的目录一致）；
  「原配置」是 `C:\Users\Administrator\.cloudflared\config.yml`。有一项不对就停下，
  用对应参数指定。
- **怎么回退**：这一步没改东西。

### 2. 执行

- **做什么**：
  ```powershell
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts\setup-service-account.ps1 -Apply
  ```
- **注意**：
  - 建账户时屏幕上会显示两个随机密码，各**只显示一次**，不会写进任何文件。S4U 任务
    用不到它们，可以不记；要记就记进密码管理器。不要在开着 `Start-Transcript` 的
    窗口里运行，否则密码会进记录。想自己定密码，加 `-PromptPassword`。
  - 给仓库加只读权限时，权限要传到每一个文件（含 `node_modules` 和各个工作树），
    第一次可能要几分钟。期间网站照常运行。
  - 探针的输出应当是这样（每个账户一段）：
    ```text
       radar-svc：
                OK    身份 — radar-svc，HOME=C:\Users\radar-svc
                OK    node — v24.12.0（C:\Program Files\nodejs\node.exe）
                OK    读 package.json
                OK    读 node_modules
                OK    读 .env.local — 可读（内容未输出）
                OK    写 config
                OK    写 .cache
                OK    写 .next
                OK    写备份目录
                OK    仓库根目录只读 — 被拒绝（EPERM）
                OK    src 只读 — 被拒绝（EPERM）
                OK    读不到隧道凭据 — 被拒绝（EPERM）
                OK    npm — 11.6.2
                OK    代理 127.0.0.1:7890 — 可连接（只是报告：代理只在 Administrator 登录桌面后运行）
                结果：全部通过
       radar-tunnel：
                OK    身份 — radar-tunnel，HOME=C:\Users\radar-tunnel
                OK    node — …
                OK    读 config.yml — 可读（内容未输出）
                OK    读隧道凭据 — 可读（内容未输出）
                OK    写 logs
                OK    隧道目录只读 — 被拒绝（EPERM）
                OK    读不到网站的 .env.local — 被拒绝（EPERM）
                结果：全部通过
    ```
    探针代码只报告能不能读写，不输出任何文件内容；它以管理员身份在临时目录里试跑过
    一次（2026-10-15），格式如上。**以新账户运行的结果要等第一次 `-Apply` 才知道。**
    任何一行 `FAIL`，脚本就停在这里，计划任务一个都没改。常见原因：任务返回
    `0x80070569`（缺「作为批处理作业登录」，第 1 部分没做成）；「'node' 不是内部或
    外部命令」（系统 PATH 里没有 node）；「写 config」失败（第 2 部分没做成）。修好
    后重新运行，已做好的会跳过。
- **为什么探针要用计划任务**：S4U 计划任务就是正式任务的运行方式；用 `runas` 测的是
  交互登录，和真实情况不一样，而且默认的拒绝登录会让 `runas` 直接失败。
- **怎么验证**：
  1. 脚本最后的「当前状态」里，四个任务显示新账户 / S4U；端口 3000 和 `cloudflared`
     **仍显示 Administrator**——这是对的，还没重启。
  2. 不带 `-Apply` 再运行一次，每一行都是「已就绪」，最后是「全部就绪」。
  3. `C:\ProgramData\ai-tech-radar\service-account\task-backup\` 里有四个
     `.original.xml`。
- **怎么回退**：见第 9 步。

### 3. （可选）手动复核

- **做什么**：
  ```powershell
  Get-ScheduledTask ai-tech-radar-* | Select-Object TaskName, @{ n = 'User'; e = { $_.Principal.UserId } }, @{ n = 'Logon'; e = { $_.Principal.LogonType } }
  (Get-ScheduledTask ai-tech-radar-backup).Actions.Arguments
  (Get-ScheduledTask ai-tech-radar-tunnel).Actions.Arguments
  icacls C:\Users\Administrator\ai-tech-radar | Select-String radar
  icacls C:\Users\Administrator\ai-tech-radar\config | Select-String radar
  icacls C:\ProgramData\ai-tech-radar\cloudflared
  ```
- **为什么**：不只信脚本自己的复查。
- **怎么验证**：仓库根目录上是 `radar-svc:(OI)(CI)(RX)`，`config` 上多一条
  `radar-svc:(OI)(CI)(M)`；`cloudflared` 目录只有 SYSTEM、Administrators、
  `radar-tunnel`，且没有 `(I)`（不继承上级）。
- **怎么回退**：这一步没改东西。

### 4. 切换网站进程（停机约 2–3 秒）

- **做什么**：让 `ai-tech-radar-server` 以新身份重新启动。在主检出、管理员
  PowerShell 里：
  ```powershell
  cd C:\Users\Administrator\ai-tech-radar
  $listener = @(Get-NetTCPConnection -LocalPort 3000 -State Listen)[0]
  (Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)").CommandLine
  # ↑ 必须包含 C:\Users\Administrator\ai-tech-radar\node_modules\ ，不是就停下，别往下做
  Stop-ScheduledTask ai-tech-radar-server
  taskkill /PID $listener.OwningProcess /T /F
  Start-ScheduledTask ai-tech-radar-server
  Start-Sleep -Seconds 8
  Invoke-RestMethod http://127.0.0.1:3000/api/health | Select-Object status, build, uptimeSeconds
  ```
  这和 `deploy.ps1` 的停启是同一套动作（先核对进程来自这个检出，`Stop-ScheduledTask`
  不会结束后台的 `next start`，所以要显式结束端口上的进程树）。
- **另一种做法**：等下一次正常部署，`npm run deploy` 会做同样的停启，并且只有新进程
  应答健康检查才算成功。缺点是把换账户和发布新代码混在一次里，出问题时分不清是哪个。
- **为什么**：改任务定义不影响正在运行的进程，进程不重启就还是 Administrator。
- **怎么验证**：
  1. `/api/health` 返回 `status: ok`，`uptimeSeconds` 只有几秒到十几秒。
  2. 再运行一次脚本（不带 `-Apply`），「当前状态」里端口 3000 显示
     `ALAKSA\radar-svc`；或在任务管理器 → 详细信息里看这个 `node.exe` 的用户名，
     「提升」一列是「否」。
  3. `config\server.log` 末尾没有 `EPERM` / `EACCES`。
  4. 公网 `https://aizyradar.cn/api/health` 返回 200；一次搜索结果里有「语义相近」
     （说明 `.cache\models` 读得到）。
- **怎么回退**：健康检查不过，先运行 `scripts\setup-service-account.ps1 -Revert -Apply`
  把任务定义改回 Administrator，再把本步的停启命令重做一遍。

### 5. 切换隧道（不停机）

- **做什么**：`cloudflared` 允许同一条隧道同时有多个连接器在线，所以先让新的连上，
  再停旧的。管理员 PowerShell：
  ```powershell
  $old = @(Get-CimInstance Win32_Process -Filter "Name='cloudflared.exe'" | Select-Object -ExpandProperty ProcessId)
  $old                                       # 记下旧进程的 PID，应当只有一个
  Stop-ScheduledTask ai-tech-radar-tunnel    # 结束的是任务里的 cmd，旧的 cloudflared 照常跑
  Start-ScheduledTask ai-tech-radar-tunnel   # 以 radar-tunnel 启动新的 cloudflared，读新配置
  Start-Sleep -Seconds 15
  Select-String -Path C:\ProgramData\ai-tech-radar\cloudflared\logs\tunnel.log -Pattern "Registered tunnel connection" | Select-Object -Last 4
  # ↑ 应看到 4 行（connIndex=0 到 3）；没有就停下，看下面的回退
  & "C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel info ai-tech-radar   # 这时应列出两个连接器
  Stop-Process -Id $old
  ```
- **为什么**：先并存再停旧的，读者感觉不到切换；直接重启隧道会有十几秒 530。
- **怎么验证**：
  1. `cloudflared tunnel info ai-tech-radar` 只剩一个连接器（用的是 Administrator
     主目录里的 `cert.pem`，所以以 Administrator 运行）。
  2. 再运行一次脚本，「当前状态」里 `cloudflared` 显示 `ALAKSA\radar-tunnel`。
  3. `https://aizyradar.cn/api/health` 返回 200，`https://aizyradar.cn/workspace`
     仍是 404（拒绝规则跟着配置一起复制过去了）。
- **如果旧进程跟着任务一起结束了**：站点会有十几秒 530，新连接器连上后恢复；这不影响
  后面的步骤。
- **怎么回退**：新连接器没连上时，旧的还在服务，站点不受影响。结束新的那个
  （`Get-CimInstance Win32_Process -Filter "Name='cloudflared.exe'"` 里不是 `$old` 的
  那个 PID），然后只把隧道任务改回原样（`-Revert` 会把四个任务都改回去；网站已经
  切换成功的话，只退隧道就够了）：
  ```powershell
  schtasks /Create /TN ai-tech-radar-tunnel /XML "C:\ProgramData\ai-tech-radar\service-account\task-backup\ai-tech-radar-tunnel.original.xml" /F
  ```
  旧进程这时不属于任何任务实例，但照常服务；之后找个时间按第 5 步的办法换回由任务
  启动的连接器。

### 6. 第二天：看导入和备份

- **做什么**：看第一次以新账户跑的 07:45 备份和 08:05 导入。
- **为什么**：这两个任务一天只跑一次，第 4、5 步验证不到它们。
- **怎么验证**：
  - 备份：`config\backup-cron.log` 末尾正常，新快照出现在
    `C:\Users\Administrator\ai-tech-radar-backups`，**不是** `C:\Users\radar-svc\…`。
  - 导入：`config\task-runner-cron.log` 这一次的第一行是「数据目录：…（真实数据
    目录）」；`config\scheduled-import.json` 的 `nextRunAt` 是明天。
  - 想马上看：`schtasks /Run /TN ai-tech-radar-tasks` 可以随时手动触发（未到期时只
    记几行「未到期」，但会写 `config\task-runner.json`，正好验证写权限）。备份当天
    已有快照时手动触发只记一行就退出，看不出什么，等第二天。
- **怎么回退**：见第 9 步。

### 7. 部署脚本要跟着改的地方（建议，本次没有改 `deploy.ps1`）

读过 `scripts/deploy.ps1` 的 `Assert-TaskServesCheckout`、`Assert-PortHeldByThisCheckout`、
`Stop-Server`、`Start-Server`、`Assert-NoRecentLogonFailures`：

- **不受影响**：`Assert-TaskServesCheckout` 只看任务命令行里的检出路径，服务任务的
  命令行没变。`Start-Server`、健康检查、日志轮转、目录改名也不受影响：新账户写出的
  文件都继承了 Administrator 的完全控制。
- **要管理员才行，现在照常**：`Assert-PortHeldByThisCheckout` 要读另一个账户进程的
  命令行，`Stop-Server` 要结束另一个账户的进程，这两件事都需要管理员。本机的内置
  Administrator 总是提升的，所以照常。

建议的三处修改：

1. **开头检查是不是管理员。** 不是管理员时，`Assert-PortHeldByThisCheckout` 读不到
   命令行，会报「不是从这个检出启动的」（方向安全，但说法误导）；而 `Stop-Server`
   里 `taskkill` 的错误被 `>nul 2>&1` 吞掉，只会表现为「端口在 20 秒内没有释放」。
   在 `Invoke-Deploy` 和 `Invoke-Rollback` 的第一句前加：
   ```powershell
   $principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
   if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
       throw "部署要在管理员 PowerShell 里运行：服务进程属于另一个账户。"
   }
   ```
2. **构建完、切换前给 `.next-new` 写权限。** `.next-new` 由管理员构建，只继承仓库的
   只读权限，改名成 `.next` 后网站对它只读。按 2026-10-15 的代码看，公开构建运行时
   不写 `.next`（没用 `next/image`，没有 ISR 重新验证，`fetch` 不缓存），只读多半也
   能跑，但没有实测。在 `Invoke-Deploy` 里 `Invoke-Build` 之后加：
   ```powershell
   $serviceAccount = (Get-ScheduledTask -TaskName $TaskName).Principal.UserId
   Invoke-Change "给 $serviceAccount 写 $($script:NewDir) 的权限" {
       & icacls.exe (Resolve-RepoPath $script:NewDir) /grant "${serviceAccount}:(OI)(CI)M" /Q | Out-Host
   }
   ```
   这一条加进去之前，每次部署后跑一次 `setup-service-account.ps1 -Apply`：它会发现
   新的 `.next` 少了写权限并补上，其他项都是「已就绪」（探针也会再跑一遍，约十秒）。
3. **账户锁定检查只看服务账户。** `Assert-NoRecentLogonFailures` 现在对任何账户的
   失败登录都拒绝部署。换账户后，Administrator 被锁已经拦不住服务任务，可以只看任务
   运行身份的那个账户：
   ```powershell
   $account = ((Get-ScheduledTask -TaskName $TaskName).Principal.UserId -split '\\')[-1]
   $failures = @($failures | Where-Object { [string]$_.Properties[5].Value -eq $account })
   ```
   （放在 `Get-WinEvent` 之后、判断数量之前。）不改也安全，只是更保守：Chrome 锁住
   Administrator 时它照样拒绝部署。

`npm run deploy:rehearse` 用替身服务器代替计划任务，不涉及任务的运行身份；这次没有
运行它。

### 8. 之后的日常

- **部署**：上面第 2 条加进 `deploy.ps1` 之前，每次 `npm run deploy` 后跑一次
  `setup-service-account.ps1 -Apply`。
- **改 `.env.local`**：照旧由管理员编辑，新文件继承仓库的只读权限，网站读得到。改完
  仍要重启网站（第 4 步的命令），环境变量在启动时读。
- **改隧道的 ingress**：改 `C:\ProgramData\ai-tech-radar\cloudflared\config.yml`
  （不再是 Administrator 主目录里那份），再按第 5 步换一次连接器。
- **升级 cloudflared**：任务里已加 `--no-autoupdate`（新账户也写不了
  `C:\Program Files (x86)`）。管理员运行 `winget upgrade Cloudflare.cloudflared`，再按
  第 5 步换连接器。
- **`npm ci` / 依赖变更**：照旧由管理员在主检出跑（`docs/deployment.md` →「A dependency
  change needs a stop first」）；新装的 `node_modules` 继承只读权限。
- **编辑轮**：照旧以 Administrator 跑 `next dev`；写进线上 `config` 的文件继承
  `config` 的权限，网站照样能读写。
- **新增运行时写入的位置**：以后如果代码要在 `config`、`.cache`、`.next` 之外写文件，
  新账户下会报 `EPERM`。`server.log` 里看到 `EPERM` 先想到这一条，把目录加进脚本的
  可写列表。

### 9. 回退

- **任务定义改回原样**：
  ```powershell
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts\setup-service-account.ps1 -Revert -Apply
  ```
  它用第一次改动前导出的 XML 重建四个任务。如果 `Register-ScheduledTask` 报错，可以
  逐个手动重建：
  ```powershell
  schtasks /Create /TN ai-tech-radar-server /XML "C:\ProgramData\ai-tech-radar\service-account\task-backup\ai-tech-radar-server.original.xml" /F
  ```
- **然后重启进程**：网站按第 4 步的停启命令（这次回到 Administrator）；隧道按第 5
  步（这次「旧的」是 `radar-tunnel` 的进程，新的回到 Administrator、读回原配置）。
- **彻底清理（可选，确认回退成功后，顺序不能反：先删权限条目，再删账户）**：
  ```powershell
  $repo = 'C:\Users\Administrator\ai-tech-radar'
  foreach ($path in $repo, "$repo\config", "$repo\.cache", "$repo\.next", "$repo\.next-old", 'C:\Users\Administrator\ai-tech-radar-backups') {
      if (Test-Path $path) { icacls $path /remove radar-svc }
  }
  Remove-Item C:\ProgramData\ai-tech-radar -Recurse   # 隧道配置副本、任务原始定义、探针
  Get-CimInstance Win32_UserProfile | Where-Object { $_.LocalPath -like '*\radar-*' } | Remove-CimInstance   # 两个账户的主目录
  Remove-LocalUser radar-svc, radar-tunnel
  ```
  账户删掉后，「本地安全策略 → 用户权限分配」里会留下它们的 SID（显示为一串
  `S-1-5-21-…`），不影响任何东西，想清也可以在那里删。删 `C:\ProgramData\ai-tech-radar`
  删的是凭据**副本**，原件还在 `C:\Users\Administrator\.cloudflared\`。

## 风险与注意

- **账户锁定。** 换完之后，Administrator 被浏览器登录失败锁住，不再影响网站、隧道、
  导入、备份：它们以别的账户登录。`ai-tech-radar-pipeline-alert` 仍是 Administrator
  的交互任务，在已登录的会话里运行，锁定也不影响它。新账户默认拒绝交互登录，没有人
  会以它们输错密码。
- **代理 `127.0.0.1:7890`。** 本机任何账户都能连这个端口，所以新账户和原来走同一条
  路。代理设置从 `.env.local` 读（`scripts/with-proxy-env.mjs`），不依赖账户自己的
  注册表；代理程序本身仍只在 Administrator 登录桌面后运行，没人登录时照旧直连——这
  是已有的行为（`docs/deployment.md` →「Proxy for every entry point」）。探针会报告
  7890 当时能不能连上。
- **npm 缓存与 HOME。** 新账户的 HOME 是 `C:\Users\radar-svc`，第一次以它运行任务
  （探针那次）时由系统建立；npm 缓存在它自己的
  `AppData\Local\npm-cache`，`npm run` 几乎用不到，探针里的 `npm -v` 会确认 npm 能
  跑。Administrator 的用户级 PATH（`C:\Users\Administrator\AppData\Roaming\npm`）
  新账户看不到；项目只用系统 PATH 里的 `C:\Program Files\nodejs` 和仓库自己的
  `node_modules`。万一 npm 抱怨缓存目录，在任务命令行里加
  `set "npm_config_cache=<一个它能写的目录>"`。
- **备份目录。** 备份脚本默认写到「运行账户的主目录\ai-tech-radar-backups」。不加
  `BACKUP_DIR`，换账户后备份会悄悄写进 `C:\Users\radar-svc\ai-tech-radar-backups`，
  原目录停在切换那天，14 份的保留窗口也从零算起。脚本给备份任务加了这个变量，并给
  原目录写权限（删除旧快照也要它）。
- **只读的仓库根目录。** 按 2026-10-15 的代码，网站和导入运行时只写 `config`、
  `.cache`、`.next`。
- **工作树。** `.claude\worktrees` 下的各个工作树（含它们的 `.env.local`）对
  `radar-svc` 也是只读可见。只读，不改变它们；那里没有主检出之外的秘密。
- **隧道凭据。** 副本所在目录只有 SYSTEM、Administrators 和 `radar-tunnel` 能读，
  `radar-svc` 读不到（探针实测）。原件仍在 `C:\Users\Administrator\.cloudflared\`，
  `cert.pem` 只在那里：`cloudflared tunnel info / route` 这类管理命令照旧以
  Administrator 运行。
- **拒绝登录。** 默认给两个账户加三条拒绝（本地、远程桌面、网络）。S4U 任务是「批
  处理」登录，不受影响；代价是 `runas /user:radar-svc` 也用不了。要保留 `runas`
  调试，加 `-AllowInteractiveLogon`。这些设置在 `secpol.msc` →「本地策略 → 用户权限
  分配」里能看到和撤销。这台机器不在域里，没有域策略会覆盖它们。
- **密码。** 只显示一次，S4U 用不到。忘了没关系，管理员随时可以重置：
  `Set-LocalUser radar-svc -Password (Read-Host -AsSecureString)`。
- **安全日志。** 每次任务启动会留一条 4624（登录类型 4，批处理），属正常。
- **标准用户能做什么。** 新账户在 Users 组里，能读系统里对 Users 开放的东西（和任何
  标准用户一样）；不能装服务、改系统设置、读别的用户的主目录、写 `Program Files`。

## 附：cloudflared 装成 Windows 服务的情形（本机不是）

本机的隧道是计划任务 `ai-tech-radar-tunnel`。如果哪天改用 `cloudflared service
install`：

- 它注册一个名为 `Cloudflared` 的服务，**默认以 LocalSystem 运行**（权限比
  Administrator 还大），配置从 LocalSystem 的主目录读：
  `C:\Windows\System32\config\systemprofile\.cloudflared\config.yml`，凭据是其中
  `credentials-file` 指向的 JSON。
- 改成低权限的做法：
  1. 把 `config.yml` 和凭据放到 `C:\ProgramData\ai-tech-radar\cloudflared\`（就是
     本脚本用的目录），只给 SYSTEM、Administrators 和 LocalService 读：
     ```powershell
     icacls C:\ProgramData\ai-tech-radar\cloudflared /inheritance:r /grant:r "*S-1-5-18:(OI)(CI)F" "*S-1-5-32-544:(OI)(CI)F" "*S-1-5-19:(OI)(CI)RX"
     ```
  2. 让服务带上配置路径（Cloudflare 文档的做法是改注册表里服务的 `ImagePath`，下面
     这条等价；`=` 后面必须有空格）：
     ```powershell
     sc.exe config Cloudflared binPath= "\"C:\Program Files (x86)\cloudflared\cloudflared.exe\" --no-autoupdate --config C:\ProgramData\ai-tech-radar\cloudflared\config.yml tunnel run"
     ```
  3. 换运行身份。`NT AUTHORITY\LocalService` 不需要密码，最简单：
     ```powershell
     sc.exe config Cloudflared obj= "NT AUTHORITY\LocalService" password= ""
     Restart-Service Cloudflared
     ```
     也可以用专用账户（`obj= ".\radar-tunnel" password= "<密码>"`），但那样服务管理器
     要保存它的密码，账户还需要「作为服务登录」的权限。
  4. 验证：`cloudflared tunnel info ai-tech-radar`（管理员）能看到连接器。
- 回退：`sc.exe config Cloudflared obj= LocalSystem`，再 `Restart-Service Cloudflared`。
