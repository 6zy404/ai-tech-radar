# 信源试跑（2026-10-12）

扩充信源之前，先把候选源放进**线上数据的一份副本**里，用项目自己的导入器和质量规则
跑一遍，看每个源会给编辑轮和公开快讯页带来什么。线上 `config/` 没有被写入：试跑前后
`external-sources.json`、`imported-candidates.live.json`、`candidate-review-state.json`
三个文件的 md5 一致。

## 结论

| 建议          | 源                                                                                                                               |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **上**        | Mistral AI News、Ai2 Blog、Microsoft Research Blog、Transformers Releases                                                        |
| **再观察**    | PyTorch Blog、Google Research Blog                                                                                               |
| **不上**      | NVIDIA Technical Blog、AWS ML Blog、Apple ML Research、Qwen Code / Claude Code / OpenAI Codex / LangChain / llama.cpp 的 release |
| **没有 feed** | Anthropic、Meta AI、Qwen 模型、DeepSeek、Kimi、LangChain 博客、LlamaIndex 博客                                                   |

建议上的四个源合计每周约 5 条，试跑时在快讯页 7 天窗口里一共占 6 张卡（现有 13 个源
占 28 张）。站点至今**一条 Mistral 信号都没有**，而 Mistral Large 4 是 10-06 发布的。

## 对比表

「30 天」是按 feed 或 GitHub API 实数的近 30 天条数（截至 2026-10-12）；feed 只保留
10 条而 10 条都在 30 天内的，记作下限。「可发布」是按
[`docs/editorial-round-playbook.md`](../../docs/editorial-round-playbook.md) Step 2
的标准（发布 / 产品上线 / 有分量的技术文章；融资、合作、客户案例、版本号小修不算）
对**试跑导入的那批条目**逐条判的，确定的计数，拿不准的写在括号里。「快讯 7 天」是
导入并执行任务运行器的自动拒之后，`getPublicNewsItems()` 里该源的卡片数——快讯页对
读者公开，未处置的候选也在上面。

| 源                      | 30 天 → 每周             | 试跑导入             | 可发布（例）                                                                                                                                                                   | 自动拒 / 已发布过                                              | 摘要                                                                      | 快讯 7 天 | 建议   |
| ----------------------- | ------------------------ | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- | ------------------------------------------------------------------------- | --------- | ------ |
| Mistral AI News         | 3 → 0.7                  | 12 条，07-08 → 10-06 | **3**（+1）：Mistral Large 4、Shieldstral 3B 安全分类器、Robostral Navigate 8B；（Mozilla 浏览器内置）                                                                         | 0                                                              | 2 条为空（含 Large 4），8 条只有一句；原文页 200 可读                     | 1         | **上** |
| Ai2 Blog                | 7 → 1.6                  | 12 条，08-26 → 10-09 | **2**（+1）：AstaBrief 8B 开放权重、Bolmo 字节级模型登 Nature；（GPU 调度器）                                                                                                  | 2 条已发布过（Olmo-core 3、BenchMIRT，经 HF 博客转载），自动拒 | 正常                                                                      | 3         | **上** |
| Microsoft Research Blog | 7 → 1.6                  | 10 条，08-12 → 10-07 | **1**（+3）：Agent Lightning v1.0；（Quine、机器人推理卸载、MindTopo 基准）                                                                                                    | 0                                                              | 正常                                                                      | 2         | **上** |
| Transformers Releases   | 2 → 0.5（三个月约 0.8）  | 10 条，07-11 → 10-06 | 0～1 条本身可发；价值在**线索**：release notes 列出新加入的模型，Qwen4-Exp、Hy4-Preview 780B 站内没有，Muse Glimmer、EmbeddingGemma 2、Inkling、GLM-5.3-Flash 已经从别的源发过 | 0                                                              | 正常                                                                      | 0         | **上** |
| PyTorch Blog            | ≥10 → 约 8               | 10 条，09-30 → 10-08 | **2**（+1）：Helion 做 vLLM 线性层后端、TLX 写 Blackwell 上的 Jagged Flash Attention；（Dynamo 会话感知推理）；认证、大会指南不算                                              | 0                                                              | 正常                                                                      | 3         | 再观察 |
| Google Research Blog    | 9 → 2.1                  | 12 条，09-03 → 10-07 | 1（+1）：ToolGrad；（Retrieve-for-Train）                                                                                                                                      | 0                                                              | **11 条摘要只是栏目名**（如「Generative AI」），1 条为空；原文页 200 可读 | 2         | 再观察 |
| NVIDIA Technical Blog   | 42 → 9.8                 | 12 条，**9 天内**    | 1（+1）：Megatron Core 逐位确定性预训练；（AICR v1.0）；其余是 DOCA / cuOpt / cuPhoton 教程                                                                                    | 0                                                              | 正常                                                                      | **8**     | 不上   |
| Apple ML Research       | ≥10 → 约 7               | 10 条，09-29 → 10-08 | 0（+1）：全是论文摘要；（自主 ML 工程智能体要多少 harness）                                                                                                                    | 0                                                              | 正常                                                                      | 2         | 不上   |
| AWS ML Blog             | 20 条 / 5 天 → 约 28     | 12 条，**4 天内**    | 0：客户案例与 Bedrock 推广；「Claude Haiku 5.5 on AWS」站内已发                                                                                                                | 0                                                              | 正常                                                                      | **12**    | 不上   |
| Qwen Code Releases      | 29 → 6.8                 | 10 条，6 天          | 0：3 条正式版都是补丁（v0.25.1、SDK、Desktop）                                                                                                                                 | 7 条预发布（nightly / preview）                                | 正常                                                                      | 2         | 不上   |
| Claude Code Releases    | 26 → 6.1                 | 10 条，9 天          | 0（+1）：全是 v2.1.x 补丁；（2.1.287 的 Claude Mods）                                                                                                                          | **0**——补丁号不是预发布，规则拦不住                            | 正常                                                                      | **6**     | 不上   |
| OpenAI Codex Releases   | 145 → 34（129 条 alpha） | 10 条，3 天          | 0                                                                                                                                                                              | 8 条 alpha                                                     | alpha 的摘要只有「Release x.y.z」                                         | 1         | 不上   |
| LangChain Releases      | 30 → 7                   | 10 条，10 天         | 0：各子包的补丁                                                                                                                                                                | 0                                                              | 正常                                                                      | 5         | 不上   |
| llama.cpp Releases      | 300 → **70**             | 10 条，2 天          | 0：每个 `b11559` 是一次提交                                                                                                                                                    | **0**——构建号不带 rc / alpha，规则拦不住                       | 正常                                                                      | **10**    | 不上   |

几点读表时要知道的：

- **快讯页占用跟发帖频率走，不跟质量走**（`docs/security-boundary.md` → 「News Fast
  Lane Boundary」）。AWS 一个源 7 天 12 张卡，比量子位（9）还多；NVIDIA 8、llama.cpp
  10、Claude Code 6。这四个就算偶尔有一条好的，代价也是快讯页常年被版本号和客户案例
  占着。
- **Ai2 和 NVIDIA 的大发布本来就经 Hugging Face 博客进来**：站内已发的 Olmo-core 3、
  BenchMIRT、TutorMoments、Nemotron 竞赛模型、Kumo Tabular 都来自 `huggingface.co/blog/<org>/…`。
  Ai2 的两条重合被 `already_published` 自动拒掉了，剩下的 AstaBrief 和 Bolmo 是 HF
  博客没转的。NVIDIA 技术博客多出来的则主要是自家软件栈教程，所以一个上、一个不上。
- **「疑似重复」**：Transformers 10/10、Codex 8/10、LangChain 6/10、Qwen Code 4/10
  带 `possible_duplicate`，来自同仓库 release 的读时提示（`same_repo_release_family`），
  没有写入任何重复组；副本里的重复组仍是原来的 4 个。
- **第一次导入的积压**：上四个源，首次导入约 44 条（12 + 12 + 10 + 10），其中 2 条会被
  自动拒；Mistral 的条目回溯到 7 月，进不了快讯页的 7 天窗口，但会留在工作台待处置，
  第一轮可以把 30 天以前的成批标「已看」。

## 没有 feed 的方向

都是实测，不是猜：

| 方向                        | 试过的地址                                                                                               | 结果                                                                                                                                            |
| --------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Anthropic                   | `anthropic.com/rss.xml`、`/news/rss.xml`、`/news/feed`、`/engineering/rss.xml`                           | 全部 404。唯一能接的是 Claude Code 的 releases，见上表，不上                                                                                    |
| Meta AI                     | `ai.meta.com/blog/rss/`、`/blog/feed/`、`about.fb.com/news/category/technology/ai/feed/`                 | 404。`engineering.fb.com/category/ml-applications/feed/` 能用，但最新一篇 09-02，近 30 天 0 条；`meta-llama/llama-models` releases 停在 2025-04 |
| Qwen                        | `QwenLM/Qwen3`、`QwenLM/Qwen3-Coder` releases.atom；`qwenlm.github.io/blog/index.xml`；`qwen.ai/rss.xml` | 前两个 0 条；博客最新 2025-09（现有 Qwen Blog 源已因此停用）；`qwen.ai` 返回 HTML。`QwenLM/qwen-code` 有，见上表                                |
| DeepSeek                    | `deepseek-ai/DeepSeek-V3`、`deepseek-ai/DeepGEMM` releases.atom                                          | 前者最新 2025-06；后者一年 10 条、最新 07-20                                                                                                    |
| Kimi                        | `MoonshotAI/Kimi-K2` releases.atom                                                                       | 0 条                                                                                                                                            |
| LangChain / LlamaIndex 博客 | `blog.langchain.com/rss/`、`blog.langchain.dev/rss/`、`llamaindex.ai/blog/feed`                          | 前两个返回 HTML，后者 404；`run-llama/llama_index` releases 近 30 天 1 条                                                                       |
| 其他                        | `bair.berkeley.edu/blog/feed.xml`、`mistralai/mistral-inference` releases                                | BAIR 近 30 天 0 条；mistral-inference 停在 2025-03                                                                                              |

这些模型厂的消息目前靠量子位、InfoQ、Simon Willison 和 HF 博客转进来（例如 Qwen 3.8
27B 经 Simon Willison 发布）。

## 导入器观察（没改代码）

1. **14 个源全部解析成功**，用的是线上同一套 `runImportForSource`（`useFallbackOnFailure:
false`，同定时导入）。Mistral 的 RSS 以 `text/plain` 返回，解析器照样接受。
2. **`api.github.com` 走代理时 403**（匿名限流，代理出口 IP 是共享的），直连正常。
   现有 GitHub 源都是 `atom` 类型、读 `github.com/<o>/<r>/releases.atom`，不经过 API，
   所以不受影响；新源也应该用 `atom`，**不要用 `github_release` 类型**。
3. **预发布规则拦不住两种版本号**：llama.cpp 的 `b11559` 构建号和 Claude Code 的
   `v2.1.296` 补丁号。规则本身没错（它们确实不是预发布），只是这两个源因此会原样
   挂上快讯页——这是不上它们的主要原因之一，不建议为它们改规则。
4. `releases.atom` 只给最近 10 条。Codex 每周 34 条，10 条窗口约 2 天，每天导入一次
   仍能看到每一条；其余源都远低于这个频率。
5. `createExternalSource` 新建的源一律 `maxItems: 4`，现有源是后来手改成 12 的
   （CHANGELOG「Per-source item cap 4 → 12」）。加源后要同样改成 12。

## 要上的四个源的配置

标签用的是 `src/data/tags.ts` 现有的规范 id；「细化话题标签」窗口如果改了 id，以那边
为准。

```json
[
  {
    "name": "Mistral AI News",
    "type": "rss",
    "url": "https://mistral.ai/rss.xml",
    "enabled": true,
    "language": "en",
    "publisherName": "Mistral AI",
    "publisherType": "startup",
    "defaultTags": ["tag-frontier-models"],
    "defaultNormalizedType": "model",
    "maxItems": 12
  },
  {
    "name": "Ai2 Blog",
    "type": "rss",
    "url": "https://allenai.org/rss.xml",
    "enabled": true,
    "language": "en",
    "publisherName": "Ai2",
    "publisherType": "research-lab",
    "defaultTags": ["tag-frontier-models"],
    "defaultNormalizedType": "model",
    "maxItems": 12
  },
  {
    "name": "Microsoft Research Blog",
    "type": "rss",
    "url": "https://www.microsoft.com/en-us/research/feed/",
    "enabled": true,
    "language": "en",
    "publisherName": "Microsoft Research",
    "publisherType": "research-lab",
    "defaultTags": ["tag-frontier-models"],
    "defaultNormalizedType": "unknown",
    "maxItems": 12
  },
  {
    "name": "Transformers Releases",
    "type": "atom",
    "url": "https://github.com/huggingface/transformers/releases.atom",
    "enabled": true,
    "language": "en",
    "publisherName": "Hugging Face",
    "publisherType": "open-source-community",
    "defaultTags": ["tag-frontier-models", "tag-inference"],
    "defaultNormalizedType": "tool",
    "maxItems": 12
  }
]
```

站内已发信号里 Allen AI 的 `publisherName` 写的是「Allen AI」，Ai2 源用「Ai2」（机构
现名）；若要和已发信号统一，改成「Allen AI」即可，`/sources` 是按 `publisherName`
分组的。

## 怎么复现

```bash
# 1. 复制线上数据到仓库外的临时目录（只复制 *.json）
# 2. 在那份副本上试跑；脚本拒绝 LOCAL_DATA_DIR 指向仓库或线上的 config/
LOCAL_DATA_DIR=<副本目录> node scripts/with-proxy-env.mjs \
  node scripts/run-ts.cjs eval/source-trial/trial-import.ts <结果.json>
```

- `trial-sources.json`：试跑的 14 个源。
- `trial-import.ts`：在副本里建源、逐个导入、执行一次自动拒，再输出每条候选的质量标记、
  是否自动拒、摘要长度，以及每个源在快讯页 7 天窗口里的卡片数。
- 30 天条数不来自这个脚本（feed 只给 10～12 条）：RSS / Atom 按 feed 里的日期数，
  高频 GitHub 仓库用直连 `api.github.com/repos/<o>/<r>/releases?per_page=100` 数。
