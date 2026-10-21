# Next Task

这份文件只回答两个问题：**现在是什么状态**，**接下来还有什么没做**。它是一块
状态板，不是日志——每次改动时**替换**内容，不要往上追加。

- 每一轮做了什么、怎么量的、为什么这样决定：写进 `CHANGELOG.md` 的条目。
- 2026-07-10 至 2026-09-24 的 110 条会话记录原样归档在
  [`docs/history/next-task-log.md`](history/next-task-log.md)，只读，需要
  查一个旧结论的原话时去 grep。
- 「现在有什么功能」看 `docs/reference.md`，不在这里重复。

## 当前状态（2026-10-21）

- **线上**：`https://aizyradar.cn`，Cloudflare Tunnel 接本机 `next start`（公开构建 `npm run build:public`，工作台路由物理不存在），只监听 `127.0.0.1`。现跑构建 `SGDTWr__nzYI…`（2026-10-21 03:59，审查第一批 A / B / C 共 18 个修复提交，停机 2.8 秒）。每次部署后核对：公开路由 200（含 /radar、/signal-vectors.json、/sw.js、/manifest.webmanifest、/api/push/config）、五个内部前缀 401（守卫开着时中间件先答，带 WWW-Authenticate；公开构建里这些路由本身不存在，守卫关了就是 404）、/api/health 的五个计数。
- **2026-09-29 至 10-15 上线的功能**（逐条在 CHANGELOG）：分享卡、本页目录、搜索筛选、阅读码、收录于、上一条 / 下一条、复制链接、阅读进度、/sources、话题图谱、窄屏内边距；10-12 话题细分到 19 个、/about、8 条新知识与正文自动链接、按话题视图精简、知识页「正文里提到它的信号」、兜底关系补类型、6 项新技能；10-13 工作台「AI 起草」、候选语义去重（只提示不自动拒）、技术雷达 /radar（首期 40 条）、本机推荐「和你读过的相近」、PWA + 新信号提醒（推送密钥在主检出 .env.local，发送要走代理）、问雷达追问、AI 起草导语、本周总结、Telegram / Discord 投递、信源健康历史与删除；10-14 全站英文界面 /en（内容不翻译）、全面审查与安全升级（Next.js 15.5.27、请求体上限、IPv6 /64 限流、工作台拒绝跨站写入；审查报告 https://claude.ai/artifact/AR8mMHHnHWd9RtqdjHWLsm 私有，约 110 条 P2/P3 待排期）；10-15 全站页脚、CI 首次通过、公开仓库历史清洗（完整历史在桌面 bundle，勿上传）。「N 家信源报道」量过后没做：自动链接只配出误配。
- **2026-10-20 线上断了两天半**（10-17 21:36 至 10-20 10:19）：机器重启后 cloudflared 向校园网 DNS 拿到假地址 `10.3.33.253` 一直重拨，本机 3000 全程健康，没人知道。杀掉进程再 `Start-ScheduledTask ai-tech-radar-tunnel` 即恢复（`Stop-ScheduledTask` 停不掉它，任务经 `cmd /c … >> tunnel.log` 起）。当天上线看门狗：计划任务 `ai-tech-radar-tunnel-watchdog` 每 5 分钟跑 `scripts/tunnel-watchdog.ps1`，本机 200 而公网（边缘有应答但）非 200 连续两次就重启隧道并告警，重启不见效则 15/30/60/120 分钟递增退避；探测完全无响应（代理与直连都连不上）算本机网络问题、不重启——当晚代理掉线一小时，旧逻辑把健康的隧道重启了三次，已修；日志 `config/tunnel-watchdog.log`（UTF-8 无 BOM，`Get-Content -Encoding UTF8`；其中 `[alert]` 行曾是乱码——任务控制台按 GBK 解码 node 的 UTF-8 输出——10-21 修复）；新规则进 main 后还没经历过真实掉线；站外告警 `src/lib/ops-alert.ts` 走 `OPS_ALERT_CHANNEL_ID` 指定的投递渠道，真渠道还没建（§5）。
- **2026-10-20 编辑轮**（盲评，起草提示词 v2「用自己的话」）：71 条，发 7 条（Gemini 4 Argon 全面开放置顶、Muse Spark Open、Beam、DeepSeek V4.1 Flash 1017、Agent Lightning、vLLM v0.32.0、Harness²），标已看 42、拒 22，出 10-20 简报。同日：10-13 三条 AI 起草正文改写完（逐字取自原文 41–58% → 4–12%）；8 条新知识的 113 处关系补附注；25 条原文链接 hf-mirror.com → huggingface.co；雷达 6 条补依据；稍后读 / 已读按钮修复上线；公开 AI 接口每日总额度上线（默认 500 次 / 天）。模型调用偶发 `fetch failed`（代理到 api.deepseek.com 的 TLS 被重置），重试即可，原因进服务器日志。
- **2026-10-21 审查批次 B 已结**（性能与崩溃）：perf-1 / perf-8 / dev-public-6 / dev-public-7 在 10-14 已修、复测不复现；perf-4 补了关系覆盖层解析缓存（页面关系查询再降约 60–65%，vitest 1357 用例全过）；dev-public-2 的清理脚本 `purge-mock-ai-cache.ts` 10-21 对线上跑过，删掉 7 月 mock 模型写进三个 AI 缓存的 9 条模板答案（7 条解读、1 条对比、1 条学习路径），三个缓存现在是空的。perf-4 的代码 10-21 03:59 上线。
- **2026-10-21 审查批次 A 已结**（公开页读屏与键盘，10 条）：8 条已被 10-14 晚的 93127f5 修过（当时没记 CHANGELOG）；本轮补全站 scroll-padding（落点不变）、雷达 +/− 不进读屏名、筛选无结果链接下划线、当前视图加强调条、对比下拉框英文名，主控在窗格里复核过视图条、雷达、技能筛选三页，10-21 03:59 上线。Shift+Tab 落到顶栏后面只在 Firefox / Safari 发生，没真机验证；关系网络 166 个节点的 Tab 顺序仍按数组（审查没给修法）。
- **2026-10-21 审查批次 C 已结**（运维与数据安全，7 条）：ops-host-3 10-14 已有 fsync（补量：7.3 MB 写入中位 7.3 ms，无刷盘 3.6）；dev-arch-1 站点地址只定义一处，任务运行器从 .env.local 读 NEXT_PUBLIC_SITE_URL，地址是 localhost 时拒绝向真实渠道投递 / 推送；dev-arch-13 补齐 .env.example 与部署文档的变量；sec-internal-3 加 Dependabot（每周一，next 一组）；ops-data-7 check:pipeline 打印运行时间、启动器可选 LOG_TIMESTAMPS=1、隧道日志轮转写进文档；ops-data-8 /api/health 读首页全部五个数据文件，坏一个 503 并点名；ops-data-9 BACKUP_KEEP 改为天数（现值 14 即 14 天）。主控在开发服务器上核对过 /api/health，10-21 03:59 上线。
- **2026-10-21 审查批次 F 已结**（内容与文案小错，10 条）：6 条 10-14 已修（ui-live-10/12/13、content-7、dev-core-8/9）；修了 4 条——快讯只放规范话题名（ui-live-3）、「适合谁」改成一行文字、药丸只剩难度和话题（ui-live-4，首页三卡 899→786px）、卡片标题 text-wrap: balance 且名称与版本号不拆行（ui-live-8，末行 ≤2 字 17/110→0/117）、发布检查对超过 36 字的标题提醒（content-8，现有 117 条里 30 条超长、最长 58 字）。主控在窗格里看过首页 / 列表 / 简报（桌面与 375）。五个信源的默认标签 10-21 改成规范话题 id（此前快讯里原样露出 local-inference 之类的英文代号）。待部署。
- **2026-10-02 停机约 20 分钟**：无头 Chrome 每个进程以 Administrator 失败登录一次，10 分钟 10 次即锁账户，服务的计划任务（S4U）随之起不来。截图用预览窗格；`npm run deploy` / `deploy:rollback` 先查 10 分钟内的 4625 事件，有就拒绝。
- **部署方式**：`npm run deploy`（旁路构建 → 换目录 → 重启 → 健康检查，不健康自动回滚）；`deploy:rollback` 回上一版；`.next-old` 始终是上一版。二十余次实跑停机 1.7–3.4 秒。**依赖变了时 deploy 不重装**：先停服务、主检出 `npm ci`、再 deploy（10-14 实测停机约 1.5 分钟）。说明在 `docs/deployment.md` →「Deploy with one command」。
- **本机探测用 `127.0.0.1`，别用 `localhost`**（IPv6 先试被拒，首次约 2 秒）。2026-09-28 演练脚本误停过线上 78 秒，已加防护。
- **定时导入 09-25 至 09-27 曾全部丢失**：任务运行器被当成校验脚本写进临时副本。现在走 `scripts/run-ts.cjs`，日志首行写明「真实数据目录」；候选池安静时先看这一行和 `scheduled-import.json` 的 `nextRunAt`；运维看板 36 小时无新导入或逾期 6 小时报严重。
- **编辑轮怎么跑**：线上没有工作台，一轮在临时 `next dev`（只绑 `127.0.0.1`）上做，指向线上 `config/`（手册 Step 0）。定时导入每天 08:05 自动跑并自动拒掉预发布 tag、已发布过的条目与篡改标题，其余候选**在处置前都公开挂在快讯页上**。
- **内容**（2026-10-20 实测）：已发布信号 117、技能 22、知识 27、技术简报 37 期、在用信源 15（Mistral AI News 自 10-12 建源 0 次成功、7 次连接超时，10-21 停用，网络通了再启用）；兜底「关联」约 5.6%（10-14 实测）。技能 / 知识池零占位。
- **闸门**：typecheck / vitest（127 个测试文件）/ lint / format / `validate:all` 21 个 / `build:public` 全绿（2026-10-20）。CI 在推到 GitHub 时跑（Node 24，生产依赖有严重漏洞即失败），2026-10-15 起通过；main 与 GitHub 一致。
- **重活一次只跑一个**（CLAUDE.md →「Parallel windows」）：`css:diff` 一次约 6 分钟，采集串行。每个新会话自动读入约 270 KB 文档；CHANGELOG 与历史日志按需读。

## 剩余待办（按优先级）

### 1. 编辑轮（周期性，不是一次性任务）

距上次 10-20。候选每天累积、公开可见，超过二十条或一周未处置就该跑一轮（运维看板现在会提醒），按
手册走。09-30 起每轮都盲评（`blind: true`，可供 `eval:triage -- --fresh` 复核），逐轮数字见 CHANGELOG。
10-20 这一轮：71 条里发 7 条（都用「AI 起草」v2），标已看 42、拒 22，出了 10-20 简报（头条 Gemini 4 Argon 全面开放）。
AI 起草的标题 7 条全超长（41–60 字），要手改并量换行；`V4.1-Flash-1017` 这种带连字符的版本号会在连字符处断行，标题里换成不带连字符的说法。
模型调用偶发 `fetch failed` 时重试即可（服务器日志里有原因）。
下一轮注意：给新信号打标签要用 10-12 新增的细话题（发布闸门只查 id 是否规范，不会提醒「用了宽的」），
过几轮复量各话题占比；新增知识时同步在 `knowledgeAliases` 里加别名（工作台新建的不会被测试提醒），发现误链就加排除短语；新增技能时技能→知识的「必备」每项不超过 3 条（「先读这些」会顺着前置展开），每对关系都写附注（否则信号页印兜底句）；Mistral 等新源首次导入会带来回溯到 7 月的旧条目，可成批标「已看」。发布新信号后可在 /workspace/delivery 推送提醒，推之前按手册 Step 7b 确认 .env.local。出简报时先置顶和排除，再点「AI 起草导语」，核对数字、删到 250 字左右再保存；每周可在「周总结」写上一周的总结并发布。值得发的候选先点「AI 起草」，再按编辑备注里的「AI 起草提示」和手册 Step 8 的六项逐条核对；备注写着原文取不到的，按只有标题的候选处理；重要程度要手动设；标题超过 36 字的手动缩短。候选上出现「疑似已发布（语义）」时，点开详情看匹配到的是哪一条；语义重复组和普通重复组一样处理。改中文 /about 时要手动同步 `src/components/pages/about-page-en.tsx`；新增话题要在 `src/lib/i18n/topic-names.ts` 加英文名（有测试兜底）。新发布的信号如果印证或推翻了某条雷达条目，就到 /workspace/radar 调环位、补依据（每条 2–4 条）。发布方名称先到 /sources 查有没有现成写法，同一机构只用一个名字（10-21 content-5 的教训）。

### 2. P2 运维剩余

| 项       | 现状                                              | 做完的效果         | 备注                                  |
| -------- | ------------------------------------------------- | ------------------ | ------------------------------------- |
| 异盘备份 | 快照与源同盘（`npm run backup:data`，每天 07:45） | 盘坏不至于两份全丢 | **需要 owner 提供第二块盘或网络位置** |

- 审查报告 10-21 按源数据重算：137 条未修（P1 4、P2 50、P3 83，其中 27 条「需要你决定」），清单在仓库外 `C:/Users/Administrator/ai-tech-radar-hub/pending/pending-findings.md`。第一批三个窗口 10-21 开工：A 公开页读屏与键盘（ui-static-1/2/4/6/7/8/9/10/14/15；10-21 已上线）、B 性能与崩溃（perf-1/4/8、dev-public-2/6/7；10-21 已上线）、C 运维与数据安全（ops-host-3、dev-arch-1/13、sec-internal-3、ops-data-7/8/9；10-21 已上线）。整批 validate:all（21 个）+ build:public（85 条路由、0 条工作台）全绿后 10-21 03:59 部署。第二批 10-21 04:10 开工：D SEO 与订阅源（seo-1/2/5/6/8/9/10/11/12）、E 文档过期（docs-4/5/6/9/11/13/14、ops-host-13、content-4；E 不能改 AGENTS.md / CLAUDE.md / next-task.md，要改的行由主控应用）、F 内容与文案小错（ui-live-3/4/8/10/12/13、content-7/8、dev-core-8/9；10-21 已并入 main，待部署）。content-5/6 主控 10-21 已在线上数据改完（发布方统一为 Ai2 / Meta / IBM Research=research-lab、Simon Willison Blog；Muse Glimmer 两条互列并以「延伸」关联附注）。再往后：dev-core-11、sec-internal-4/5/6、dev-quality-*、ui-static-11/12/13/16/17、perf-9/10/11 等待排。

- 部署脚本的自动回滚只在替身服务上演练过，真环境里还没触发过。

### 3. P3 代码与文档债

- 目前没有待办；做过的在 CHANGELOG（CSS 归组、复制粘贴收口、测试类型检查等）。

### 4. 评测与内容

- 语义去重阈值：2026-10-20 由第二位标注人盲标 246 对留出复测，现阈值（候选间 0.96、对已发布 0.92）零命中零漏，不改；三对真同一公告都是跨语言（InfoQ 中译 vs 英文原帖），模型抓不到。下次复测用 `scripts/measure-semantic-dedup.ts --batch <名> --new-since <日期> --unlabelled`（`eval/dedup/README.md`）。
- （可选）编辑确认的「另一家报道」：在编辑轮里把候选标为某条信号的另一家报道并持久化，之后才能做「共 N 家报道」展示；按历史每周约 1–2 条，跨语言也能覆盖。用户还没排进队列。
- 本地推荐阈值（均值 + 2.5 个标准差）：2026-10-20 在 117 条上复算，1 条记录 74% 能推出东西、3 条随机记录 99%，和 110 条时一样，不改；脚本 `scripts/measure-local-recommend.ts`。
- 外部问题集：出题说明与空白表格在 `eval/outside-questions/`（2026-09-29），
  **等 owner 找没看过站点的人来写**，交回后按说明标注、跑 `eval:ask` /
  `eval:search`。评测已支持 `outside` 分组与「只能答一半」题型。
- 分诊提示词 v3：2026-10-20 在 v3 写好之后的两轮盲评（105 行）上留出复测：准确率 v3 48.6% 对 v2 40.0%，发布/非发布 64.8% 对 58.1%，拒掉的里 v3 零条误判为发布；但发布找回 v3 8/11 对 v2 11/11（漏了 Argon 全面开放这条头条），两版发布建议都只有 1/5 命中，v3 每行 tokens 1.9 倍。10-21 定了保留 v2（漏掉该发的头条比多几条误报贵，v3 的 tokens 还是 1.9 倍）；以后要换的话 `TRIAGE_PROMPT_VERSION` 改 v3、`candidate-triage-suggestions.ts` 要传入编辑轮开始时的已发布标题（`eval/triage/README.md`）。
- 动态路由里 `notFound()` 出的 404 是 Next 15.5 的上游限制：服务器发的是空的
  `__next_error__` 外壳。2026-09-30 起客户端补上 `lang` 与主题（`ErrorShellRepair`），但无 JS
  时仍没有内容。没选的三种：Suspense（状态码变 200）、`dynamicParams=false`（构建后新 slug
  也 404）、middleware 预检 + rewrite（要把内容查询放进工作台守卫、改 Node runtime）。
  Next 升级后再看。
- 已知不改：390px 下技能《检索流水线调优》标题断成「检索流水线调 / 优」，375px 信号页卡片里《给编码智能体划定任务与验收》断成「…与验 / 收」
  （ICU 词典缺口，种子标题被三条正文引用）。

### 5. 卡在 owner 的事

- 真实告警渠道：10-21 选定飞书 webhook（国内直连，代理掉线时也能收到；Telegram / Discord 都得走代理）。owner 在飞书群建自定义机器人，把 webhook 地址贴进工作台 /workspace/delivery 的新建渠道表单（主控不碰密钥），主控再把渠道 id 写进主检出 .env.local 的 `OPS_ALERT_CHANNEL_ID` 并跑 `npm run check:pipeline -- --test`；线上现在只有 local-mock-webhook。
- 计划任务命令要改（C 组 10-21 提议，命令在 docs/deployment.md →「Timestamps in the service logs」与「Tunnel watchdog」）：ai-tech-radar-server / -tasks 加 `set LOG_TIMESTAMPS=1 &&`（可选，下次重启生效）；ai-tech-radar-tunnel 改成 cloudflared 直跑 + `--log-directory C:UsersAdministrator.cloudflaredlogs`（1 MB 轮转留 5 份，现日志 6.8 MB；会重启隧道），随之看门狗任务加 `-TunnelLog …logscloudflared.log`，setup-service-account.ps1 的日志重定向也要跟。
- 主检出 .env.local 加 `PUSH_VAPID_SUBJECT=mailto:<你的邮箱>`（推送的 VAPID subject 10-21 起不再回落到站点地址，没有就拒发）；Dependabot 从下周一起每周最多开 5 个 PR，要人合并。顺带确认公开 AI 日总额度 500 次 / 天合不合适（约 2M tokens / 天封顶）。
- 新信号提醒上线后用真机走一遍（桌面 Chrome 或 Android）：开提醒 → 编辑轮推送 → 收到通知 → 关提醒后服务器记录消失。预览窗格不给通知权限，做不了。
- 用真实的 Telegram bot 和 Discord webhook 各发一次已发布简报，核对排版和截断；服务器要通过代理启动（同推送，手册 Step 7b）。
- GitHub 仓库**本来就是公开的**（状态板曾误记为待办）。2026-10-15 已把候选快照、两个评测集、旧审计日志和内部截图从全部历史中删除并强推，
  完整历史在桌面 `ai-tech-radar-full-history-2026-10-15.bundle`（私有，勿上传）。还剩：删除 GitHub 上的旧分支
  `claude/globals-css-split-design-diff-1f7d77`（已并入 main，仍带旧历史）——权限分类器不让 Claude 执行，owner 在主检出跑 `git push origin --delete claude/globals-css-split-design-diff-1f7d77`；可选请 GitHub 客服清除旧提交缓存。LICENSE（MIT）与 SECURITY.md 10-21 已加，owner 还要在仓库 Settings → Security 开启 private vulnerability reporting，并把 main 推到 GitHub。
  本机其他窗口的分支仍在旧历史上：2026-10-20 逐条核对，只有稍后读按钮修复没进 main，已摘并上线；10-21 把 6 个工作树已删的旧会话和上一个调度窗口（分支停在 main、无改动）全部归档。
- 线上服务和隧道以内置 Administrator 运行：建一个低权限本地账户跑服务（顺带避开账户锁定）。
- 合规（需专业人士确认）：备案状态；问雷达等公开生成式 AI 功能的登记与标识；页脚放运营者联系方式；隐私说明补 Cloudflare。
- 外部拨测：每 5 分钟打 `/api/health`，连续两次失败再告警（账号是 owner 的，
  配置写在 `docs/deployment.md`）。
- 主机夜里实际是关机（快速启动）而不是睡眠，`WakeToRun` 从没唤醒过（09-20 起约三分之一时间离线）。2026-10-15 决定：上线期间不关机；
  Cloudflare 离线页（`ops/cloudflare/offline-worker.js`）与外部拨测按 `docs/deployment.md` 在 owner 账号里配置，尚未配。
- 低权限运行账户：按 `docs/service-account.md` 执行 `scripts/setup-service-account.ps1`（默认只打印计划，加 -Apply 才改）。10-21 跑过计划模式：37 项待做（两个账户、文件权限、隧道配置搬到 ProgramData、探针、四个任务改账户），不重启任何进程；要 owner 在管理员 PowerShell 里加 -Apply 执行，Claude 不改系统账户和计划任务。
- 存量 30 条信号标题超过 36 字（content-8 量到，最长 58 字 lfm2-5-encoders）：要不要逐条缩短？缩短就是改已发布标题，等你定；新发布的发布检查会提醒。
- 第二块盘（见异盘备份）。
- Cloudflare 往页面里注入 Web Analytics 信标（`static.cloudflareinsights.com/beacon.min.js`），被站点的
  CSP 拦下，每页控制台一条报错（2026-09-30 发现）。在 Cloudflare 面板关掉 Web Analytics 自动注入，
  或者决定要它、再放宽 CSP。

## 长期不做的

见 `AGENTS.md` →「What is intentionally NOT implemented yet」：账号 / RBAC、
生产数据库、邮件订阅、内容机器翻译、黑盒推荐（2026-10-13/14 已按用户要求做了浏览器推送、英文界面、本机可解释推荐、语义去重）。不要在没有明确要求时加进
待办。

## 怎么维护这份文件

- 完成一项：从待办里删掉，或像上面那样划掉并留一行日期；状态区改成新的事实。
- 新发现一项：写进对应优先级，附现状与做完的效果，两行以内。
- 不要写过程叙述。过程写进 `CHANGELOG.md`，那里有日期、数字与验证方式。
- 目标：这份文件保持在 150 行以内。
