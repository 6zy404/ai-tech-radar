import type { RadarEntry } from "@/types/radar";

// The first edition of the technology radar (2026-10-13). Read-only seed:
// the workspace console (/workspace/radar) edits these through a
// copy-on-write overlay in config/radar-workspace.json, the way the skill and
// knowledge seeds are edited. Evidence ids are published technology signals;
// an id that is not published is dropped from the public page, never shown.
const firstEdition = "2026-10-13";

export const radarEntries: RadarEntry[] = [
  {
    id: "radar-moe-architecture",
    name: "混合专家（MoE）架构",
    slug: "moe-architecture",
    quadrant: "models-training",
    ring: "adopt",
    ringReason:
      "新旗舰与开放模型几乎都是 MoE，训练框架也围绕专家并行重写，读懂总参数与激活参数之差已是看懂任何新模型的前提。",
    evidenceTechnologyIds: [
      // 2026-07-15 Inkling：Thinking Machines 开源万亿参数多模态 MoE 模型
      "draft-candidate-rss-https-hf-mirror-com-blog-thinkingmachines-inkling",
      // 2026-10-10 MiMo-V2.6 技术报告：小米花 260 万美元跑一次强化学习
      "draft-candidate-rss-https-www-infoq-cn-article-gndwodm8ygkajxfslabk-utm-source-rss-amp-utm-medium-article",
      // 2026-10-01 Olmo-core 3：开源 MoE 训练框架，吞吐提升到原来的 2.7 倍
      "draft-candidate-rss-https-hf-mirror-com-blog-allenai-olmocore3"
    ],
    relatedKnowledgeIds: ["knowledge-ws-36346103"],
    relatedSkillIds: ["skill-ws-7796779a"],
    history: [{ date: firstEdition, toRing: "adopt", reason: "首期收录。" }]
  },
  {
    id: "radar-open-weight-frontier-models",
    name: "开放权重旗舰模型",
    slug: "open-weight-frontier-models",
    quadrant: "models-training",
    ring: "trial",
    ringReason:
      "Kimi K3、Muse Glimmer、Qwen3.8 让开放权重追到旗舰附近，但厂商自跑的分数和出厂默认配置都要先实测，适合在可控场景里小范围替换闭源模型。",
    evidenceTechnologyIds: [
      // 2026-07-16 Kimi K3：Moonshot 发布 2.8 万亿参数旗舰，承诺月内开放权重
      "draft-candidate-rss-https-simonwillison-net-2026-jul-16-kimi-k3-atom-entries",
      // 2026-08-12 Meta 重回开放权重：一封长文、一个独立董事会，和一组本地部署的数字
      "draft-candidate-rss-https-www-infoq-cn-article-9sy33ca91fp8z5mlovnu-utm-source-rss-amp-utm-medium-article",
      // 2026-08-15 Qwen3.8-27B 开源：消费级显卡跑得动，尺子却是自己命名的
      "draft-candidate-rss-https-www-qbitai-com-p-473669",
      // 2026-08-16 Qwen3.8-27B 的第三方实测：模型很好，出厂默认值不好
      "draft-candidate-rss-https-simonwillison-net-2026-aug-16-qwen-38-27b"
    ],
    relatedKnowledgeIds: ["knowledge-open-weights"],
    relatedSkillIds: ["skill-open-weights-self-hosting"],
    history: [{ date: firstEdition, toRing: "trial", reason: "首期收录。" }]
  },
  {
    id: "radar-lora-peft",
    name: "LoRA 与参数高效微调",
    slug: "lora-peft",
    quadrant: "models-training",
    ring: "adopt",
    ringReason:
      "主流推理引擎已能在量化权重上直接挂 LoRA，扩散模型也有了免转换的规模化微调，定制模型的默认做法是先试参数高效微调。",
    evidenceTechnologyIds: [
      // 2026-08-08 SGLang v0.5.17：Kimi K3 首日可服务，以及一个认识会话的前缀缓存
      "draft-candidate-rss-https-github-com-sgl-project-sglang-releases-tag-v0-5-17",
      // 2026-07-17 NeMo Automodel 接入 Diffusers：任意扩散模型的规模化分布式微调
      "draft-candidate-rss-https-hf-mirror-com-blog-nvidia-scale-diffusers-finetuning-nemo-automodel"
    ],
    relatedKnowledgeIds: ["knowledge-fine-tuning"],
    relatedSkillIds: ["skill-ws-84837d46"],
    history: [{ date: firstEdition, toRing: "adopt", reason: "首期收录。" }]
  },
  {
    id: "radar-small-on-device-models",
    name: "端侧小模型",
    slug: "small-on-device-models",
    quadrant: "models-training",
    ring: "trial",
    ringReason:
      "2–3B 级模型在笔记本和手机上跑出可用的工具调用速度，小编码器在 CPU 上处理长文档；但端到端速度常被图像编码与预填充拖住，要按整条链路测。",
    evidenceTechnologyIds: [
      // 2026-08-04 LFM2.5-2.6B：一个在智能体外壳里训练出来的端侧模型
      "draft-candidate-rss-https-hf-mirror-com-blog-liquidai-lfm2-5-2-6b",
      // 2026-07-28 LFM2.5-Encoders：能在 CPU 上跑长文档的小编码器，长上下文比 ModernBERT 快 3.7 倍
      "draft-candidate-rss-https-hf-mirror-com-blog-liquidai-lfm2-5-encoders",
      // 2026-09-24 LFM2.5-VL-DSpark：解码快三倍，整体受图像编码拖累
      "draft-candidate-rss-https-hf-mirror-com-blog-liquidai-lfm2-5-vl-dspark"
    ],
    relatedKnowledgeIds: [
      "knowledge-model-sizing",
      "knowledge-latency-tradeoffs"
    ],
    relatedSkillIds: ["skill-ws-d7c9d1d8"],
    history: [{ date: firstEdition, toRing: "trial", reason: "首期收录。" }]
  },
  {
    id: "radar-rl-post-training",
    name: "强化学习后训练（可验证奖励）",
    slug: "rl-post-training",
    quadrant: "models-training",
    ring: "assess",
    ringReason:
      "前沿团队把强化学习的批量、环境与评分算力一起放大，一次就要上百万美元；公开的对照里，推理时的验证与修正带来的提升比再跑一轮强化学习更大。多数团队先看自己的任务能不能自动判对错。",
    evidenceTechnologyIds: [
      // 2026-10-10 MiMo-V2.6 技术报告：小米花 260 万美元跑一次强化学习
      "draft-candidate-rss-https-www-infoq-cn-article-gndwodm8ygkajxfslabk-utm-source-rss-amp-utm-medium-article",
      // 2026-08-04 LFM2.5-2.6B：一个在智能体外壳里训练出来的端侧模型
      "draft-candidate-rss-https-hf-mirror-com-blog-liquidai-lfm2-5-2-6b",
      // 2026-10-07 Nemotron 竞赛模型：IMO 金牌官方评定，IOI 金牌自测
      "draft-candidate-rss-https-hf-mirror-com-blog-nvidia-nemotron-ioi-and-imo-2026"
    ],
    relatedKnowledgeIds: ["knowledge-rl-post-training"],
    relatedSkillIds: ["skill-ws-84837d46"],
    history: [{ date: firstEdition, toRing: "assess", reason: "首期收录。" }]
  },
  {
    id: "radar-synthetic-agent-data",
    name: "智能体合成数据",
    slug: "synthetic-agent-data",
    quadrant: "models-training",
    ring: "assess",
    ringReason:
      "开放数据集和全合成后训练都在推这条路，但合成数据只在任务既前沿又可验证时才不贬值，缺一条就会很快失效。",
    evidenceTechnologyIds: [
      // 2026-07-08 NVIDIA Nemotron 开放数据：用合成数据支撑智能体开发
      "draft-candidate-rss-https-hf-mirror-com-blog-nvidia-open-data-for-agents",
      // 2026-08-09 BigBang-v1：把数据生产系统本身当成优化对象，以及一处对不上的口径
      "draft-candidate-rss-https-www-qbitai-com-p-468782"
    ],
    relatedKnowledgeIds: ["knowledge-ws-818b7bb3"],
    relatedSkillIds: [],
    history: [{ date: firstEdition, toRing: "assess", reason: "首期收录。" }]
  },
  {
    id: "radar-million-token-context",
    name: "百万 token 长上下文",
    slug: "million-token-context",
    quadrant: "models-training",
    ring: "assess",
    ringReason:
      "旗舰模型纷纷标称百万级上下文，而实测显示检索准确率会随信息所在位置大幅起伏，标称长度不等于可用长度。",
    evidenceTechnologyIds: [
      // 2026-09-03 GPT-6 Astra 发布：越权行为从 48% 降到 0
      "draft-candidate-rss-https-openai-com-index-gpt-6-astra",
      // 2026-07-15 Inkling：Thinking Machines 开源万亿参数多模态 MoE 模型
      "draft-candidate-rss-https-hf-mirror-com-blog-thinkingmachines-inkling",
      // 2026-10-09 DeepSeek-V4 的周期性盲点：信息换个位置，检索准确率差 40 个百分点
      "draft-candidate-rss-https-www-qbitai-com-p-502364"
    ],
    relatedKnowledgeIds: ["knowledge-kv-cache"],
    relatedSkillIds: ["skill-model-evaluation"],
    history: [{ date: firstEdition, toRing: "assess", reason: "首期收录。" }]
  },
  {
    id: "radar-realtime-voice-models",
    name: "实时语音模型",
    slug: "realtime-voice-models",
    quadrant: "models-training",
    ring: "trial",
    ringReason:
      "语音模型已直接驱动主流助手，对话中还能在后台调用工具；评测开始衡量「像不像人」，适合在语音入口的产品里试点。",
    evidenceTechnologyIds: [
      // 2026-07-08 GPT-Live：OpenAI 新一代实时语音模型
      "draft-candidate-rss-https-openai-com-index-introducing-gpt-live",
      // 2026-09-24 Gemini 3.8 Live 加上数字人：对话不停，工具在后台跑
      "draft-candidate-rss-https-deepmind-google-blog-introducing-gemini-38-live-with-live-avatar",
      // 2026-07-15 Real World VoiceEQ：衡量语音 AI「人性质量」的评测基准
      "draft-candidate-rss-https-hf-mirror-com-blog-real-world-voiceeq"
    ],
    relatedKnowledgeIds: [
      "knowledge-ws-8c99b19c",
      "knowledge-latency-tradeoffs"
    ],
    relatedSkillIds: ["skill-ws-1a0da8a9"],
    history: [{ date: firstEdition, toRing: "trial", reason: "首期收录。" }]
  },
  {
    id: "radar-decision-models",
    name: "非生成式决策模型",
    slug: "decision-models",
    quadrant: "models-training",
    ring: "assess",
    ringReason:
      "只返回概率、不生成文字的模型把分类和重排做得极便宜，开放版本也已能在本地跑；代价是没有任何解释，厂商的速度与价格对比还缺第三方核对。",
    evidenceTechnologyIds: [
      // 2026-09-21 Jev：只输出概率、不输出文字的决策模型
      "draft-candidate-rss-https-simonwillison-net-2026-sep-21-jev",
      // 2026-10-02 Cloudflare 开放 Clef：意图分类胜过 Jev，推理判断落后
      "draft-candidate-rss-https-github-com-ollama-ollama-releases-tag-v0-35-1",
      // 2026-09-29 NVIDIA 开放表格模型 Kumo Tabular：无需训练，一次前向出预测
      "draft-candidate-rss-https-hf-mirror-com-blog-nvidia-kumo-tabular"
    ],
    relatedKnowledgeIds: ["knowledge-model-sizing"],
    relatedSkillIds: ["skill-model-evaluation"],
    history: [{ date: firstEdition, toRing: "assess", reason: "首期收录。" }]
  },
  {
    id: "radar-mcp",
    name: "MCP（模型上下文协议）",
    slug: "mcp",
    quadrant: "agents-applications",
    ring: "adopt",
    ringReason:
      "2.0 改成无状态后能放在普通负载均衡后面，网关不读正文就能路由与计量；托管智能体和编排系统都把它当成默认的工具接入方式。",
    evidenceTechnologyIds: [
      // 2026-07-31 MCP 2.0：协议核心改为无状态
      "draft-candidate-rss-https-simonwillison-net-2026-jul-31-stateless-mcp-atom-entries",
      // 2026-08-16 MCP 无状态之后：被少报的那一半，是网关终于读得懂智能体流量
      "draft-candidate-rss-https-www-infoq-cn-article-412hbbva0nf0ayp0cjzd-utm-source-rss-amp-utm-medium-article",
      // 2026-07-07 Gemini API Managed Agents 扩展：后台任务与远程 MCP 接入
      "draft-candidate-rss-https-blog-google-innovation-and-ai-technology-developers-tools-expanding-managed-agents-gemini-api",
      // 2026-09-30 Google 开源 AX：按 Kubernetes 的方式编排智能体，可秒级暂停
      "draft-candidate-rss-https-www-infoq-cn-article-m6brtrsyjvug8y0m0kyh-utm-source-rss-amp-utm-medium-article"
    ],
    relatedKnowledgeIds: ["knowledge-tool-use", "knowledge-api-contracts"],
    relatedSkillIds: ["skill-tool-integration"],
    history: [{ date: firstEdition, toRing: "adopt", reason: "首期收录。" }]
  },
  {
    id: "radar-coding-agents",
    name: "编码智能体",
    slug: "coding-agents",
    quadrant: "agents-applications",
    ring: "adopt",
    ringReason:
      "大规模重写、清理过期开关这类工作已由智能体主写并合入生产，前提是任务边界和验收标准由人先定好。",
    evidenceTechnologyIds: [
      // 2026-09-16 Copilot 运行时改写成 83 万行 Rust：别让智能体碰判卷标准
      "draft-candidate-rss-https-github-blog-p-98713",
      // 2026-09-26 DoorDash 清理过期开关：50 个里 45 个可用，一次 4.79 美元
      "draft-candidate-rss-https-www-infoq-cn-article-gk4rwsqg09pwtftzlje3-utm-source-rss-amp-utm-medium-article",
      // 2026-07-22 Copilot 与裸 API：为编码智能体的「外壳」付费，到底买到了什么
      "draft-candidate-rss-https-github-blog-p-97686",
      // 2026-09-07 Kiro Crew 开源：内部 3.9 万人在用，没人被要求
      "draft-candidate-rss-https-www-infoq-cn-article-utrvjxwesgdp2kzlhpiv-utm-source-rss-amp-utm-medium-article"
    ],
    relatedKnowledgeIds: ["knowledge-execution-based-eval"],
    relatedSkillIds: ["skill-coding-agent-acceptance"],
    history: [{ date: firstEdition, toRing: "adopt", reason: "首期收录。" }]
  },
  {
    id: "radar-agent-code-review",
    name: "智能体代码审查",
    slug: "agent-code-review",
    quadrant: "agents-applications",
    ring: "trial",
    ringReason:
      "效果主要取决于指令怎么写，而公开工具在少报错与漏报之间取舍很大；适合作为人工审查前的一道筛子，按影响半径决定谁来看。",
    evidenceTechnologyIds: [
      // 2026-07-10 Copilot 代码审查复盘：更好的工具让智能体更差，指令才是关键
      "draft-candidate-rss-https-github-blog-p-97467",
      // 2026-08-17 Rootly 废掉了小 PR 规则：审查的对象从行数换成了影响半径
      "draft-candidate-rss-https-www-infoq-cn-article-fzwv9jzv2cpk8yjlpxda-utm-source-rss-amp-utm-medium-article",
      // 2026-09-26 Open Code Review：少报错的代价是漏掉八成问题
      "draft-candidate-rss-https-www-infoq-cn-article-jjixcalhuvpgswtoz1uq-utm-source-rss-amp-utm-medium-article"
    ],
    relatedKnowledgeIds: ["knowledge-human-loop"],
    relatedSkillIds: ["skill-agent-code-review"],
    history: [{ date: firstEdition, toRing: "trial", reason: "首期收录。" }]
  },
  {
    id: "radar-local-resident-agents",
    name: "本地常驻智能体",
    slug: "local-resident-agents",
    quadrant: "agents-applications",
    ring: "trial",
    ringReason:
      "本地运行时直接启动智能体，30B 以内的开放模型专为本机工具调用设计，移动端也有了原生开发套件，适合不便上云的数据与流程先试。",
    evidenceTechnologyIds: [
      // 2026-07-14 Ollama v0.32.0：本地运行时转型智能体工作台
      "draft-candidate-rss-https-github-com-ollama-ollama-releases-tag-v0-32-0",
      // 2026-08-21 Muse Glimmer 开源：30B 压进消费级显卡，报错不停下
      "draft-candidate-rss-https-www-infoq-cn-article-agfksn1ylmlruqmpea9l-utm-source-rss-amp-utm-medium-article",
      // 2026-09-27 ADK Kotlin 1.0：智能体逻辑不必再绕回 Python
      "draft-candidate-rss-https-www-infoq-cn-article-sqv4eomjpp0j3hm3lyf9-utm-source-rss-amp-utm-medium-article"
    ],
    relatedKnowledgeIds: ["knowledge-ws-c761533e"],
    relatedSkillIds: ["skill-ws-d7c9d1d8"],
    history: [{ date: firstEdition, toRing: "trial", reason: "首期收录。" }]
  },
  {
    id: "radar-agent-harness",
    name: "智能体 Harness 运行时",
    slug: "agent-harness",
    quadrant: "agents-applications",
    ring: "trial",
    ringReason:
      "函数调用、历史持久化、上下文压缩、审批与追踪开始打包成受支持的运行时；选型变多也更分散，热度不等于采用，先在一个场景里比较再定。",
    evidenceTechnologyIds: [
      // 2026-08-10 微软 Agent Framework Harness 正式发布：智能体的运行时成了产品
      "draft-candidate-rss-https-www-infoq-cn-article-adejegvnskwvue2jz0yi-utm-source-rss-amp-utm-medium-article",
      // 2026-08-14 DeepSeek Harness 开源：连 Agent Loop 都能换掉
      "draft-candidate-rss-https-www-infoq-cn-article-de9aljwc4ejw2kayw8dd-utm-source-rss-amp-utm-medium-article",
      // 2026-08-04 LLM 0.32：一个命令行工具长成了智能体框架
      "draft-candidate-rss-https-simonwillison-net-2026-aug-4-new-release-of-llm-atom-entries",
      // 2026-08-15 Cloudflare Computer：不给智能体一个容器，给它一台机器
      "draft-candidate-rss-https-www-infoq-cn-article-rakih7e4la9uq4iasltb-utm-source-rss-amp-utm-medium-article"
    ],
    relatedKnowledgeIds: ["knowledge-ws-a28a8a56"],
    relatedSkillIds: ["skill-ws-2152c7f1", "skill-agent-design"],
    history: [{ date: firstEdition, toRing: "trial", reason: "首期收录。" }]
  },
  {
    id: "radar-computer-use-agents",
    name: "电脑操作智能体",
    slug: "computer-use-agents",
    quadrant: "agents-applications",
    ring: "assess",
    ringReason:
      "开放的电脑操作模型已追到闭源旗舰几个点以内，办公智能体也能跨应用连续操作；但最强的开放版本不能商用，真实桌面任务的成功率仍需自己量。",
    evidenceTechnologyIds: [
      // 2026-09-28 开源电脑操作模型 Holo4：最强款不能商用
      "draft-candidate-rss-https-hf-mirror-com-blog-hcompany-holo4",
      // 2026-07-09 ChatGPT Work：面向长时程任务的办公智能体
      "draft-candidate-rss-https-openai-com-index-chatgpt-for-your-most-ambitious-work"
    ],
    relatedKnowledgeIds: ["knowledge-ws-e251051e"],
    relatedSkillIds: ["skill-ws-b47fabd1"],
    history: [{ date: firstEdition, toRing: "assess", reason: "首期收录。" }]
  },
  {
    id: "radar-long-horizon-agents",
    name: "长时程自主智能体",
    slug: "long-horizon-agents",
    quadrant: "agents-applications",
    ring: "assess",
    ringReason:
      "能连续工作数小时的智能体已经上线，但做错的任务里三分之二没有报错，长任务过半仍要人插手；先在能按最终状态核对结果的流程里评估。",
    evidenceTechnologyIds: [
      // 2026-07-09 ChatGPT Work：面向长时程任务的办公智能体
      "draft-candidate-rss-https-openai-com-index-chatgpt-for-your-most-ambitious-work",
      // 2026-07-20 OpenAI：长时程模型时代的安全与对齐实践
      "draft-candidate-rss-https-openai-com-index-safety-alignment-long-horizon-models",
      // 2026-10-03 智能体做错的任务，三分之二没有报错
      "draft-candidate-rss-https-hf-mirror-com-blog-microsoft-thinkingbox",
      // 2026-09-06 每个研究员配 3.1 个智能体，而一半仍要人插手
      "draft-candidate-rss-https-openai-com-index-research-acceleration-view-inside-openai"
    ],
    relatedKnowledgeIds: ["knowledge-ws-e251051e", "knowledge-human-loop"],
    relatedSkillIds: ["skill-ws-f741f122"],
    history: [{ date: firstEdition, toRing: "assess", reason: "首期收录。" }]
  },
  {
    id: "radar-agent-paper-reproduction",
    name: "用智能体复现与核查论文",
    slug: "agent-paper-reproduction",
    quadrant: "agents-applications",
    ring: "trial",
    ringReason:
      "社区和审计团队已用智能体成批重跑论文，几乎每篇都被标出问题；但「已验证」常常只是检查停得早，结论要看复现覆盖了哪些论断。",
    evidenceTechnologyIds: [
      // 2026-08-10 智能体复现审计：ICML 2026 的 92 篇论文里，只有 8 篇能复现八成结论
      "draft-candidate-rss-https-www-qbitai-com-p-469795",
      // 2026-08-13 两千两百篇论文被重跑了一遍：「已验证」说的是检查，不是论文
      "draft-candidate-rss-https-hf-mirror-com-blog-icml-2026-open-reproductions"
    ],
    relatedKnowledgeIds: ["knowledge-reproducibility"],
    relatedSkillIds: ["skill-paper-reproduction", "skill-ai-science-evidence"],
    history: [{ date: firstEdition, toRing: "trial", reason: "首期收录。" }]
  },
  {
    id: "radar-agent-vulnerability-discovery",
    name: "智能体驱动的漏洞挖掘",
    slug: "agent-vulnerability-discovery",
    quadrant: "agents-applications",
    ring: "assess",
    ringReason:
      "开源的模糊测试流水线和专门的安全模型都在出现，最强的一档先只开放给安全团队；它会在宿主机上直接执行构建命令，只能放进用完即弃的环境。",
    evidenceTechnologyIds: [
      // 2026-09-24 模糊测试交给智能体：它做决定，工具管执行
      "draft-candidate-rss-https-github-blog-p-98465",
      // 2026-07-21 Google Gemini Flash Cyber：面向漏洞发现与修复的轻量安全模型
      "draft-candidate-rss-https-deepmind-google-blog-introducing-gemini-36-flash-35-flash-lite-and-35-flash-cyber",
      // 2026-10-01 Gemini 4 Argon：DeepSWE 等多项领先，先只给网络安全团队用
      "draft-candidate-rss-https-www-infoq-cn-article-vvrszjhevkmpevs7wzzu-utm-source-rss-amp-utm-medium-article"
    ],
    relatedKnowledgeIds: ["knowledge-agent-sandboxing"],
    relatedSkillIds: ["skill-ws-c183c9b9"],
    history: [{ date: firstEdition, toRing: "assess", reason: "首期收录。" }]
  },
  {
    id: "radar-agent-memory",
    name: "智能体记忆",
    slug: "agent-memory",
    quadrant: "agents-applications",
    ring: "assess",
    ringReason:
      "从历史轨迹里蒸馏出行为指引能提升效果，但同一套记忆在不同模型上的最佳用量完全不同，要按模型标定，而不是一开就灵。",
    evidenceTechnologyIds: [
      // 2026-08-18 智能体记忆不是开关，是要按模型标定的剂量
      "draft-candidate-rss-https-hf-mirror-com-blog-ibm-research-altk-evolve-hmm",
      // 2026-09-07 Kiro Crew 开源：内部 3.9 万人在用，没人被要求
      "draft-candidate-rss-https-www-infoq-cn-article-utrvjxwesgdp2kzlhpiv-utm-source-rss-amp-utm-medium-article"
    ],
    relatedKnowledgeIds: ["knowledge-ws-a28a8a56"],
    relatedSkillIds: ["skill-ws-f741f122"],
    history: [{ date: firstEdition, toRing: "assess", reason: "首期收录。" }]
  },
  {
    id: "radar-vllm",
    name: "vLLM",
    slug: "vllm",
    quadrant: "inference-deployment",
    ring: "adopt",
    ringReason:
      "几乎每个新开放模型都在首日或一个版本内获得完整支持，新执行引擎已成默认，冷启动也大幅缩短，是自建推理服务的默认起点。",
    evidenceTechnologyIds: [
      // 2026-07-11 vLLM v0.25.0：Model Runner V2 成为默认执行引擎的大版本
      "draft-candidate-rss-https-github-com-vllm-project-vllm-releases-tag-v0-25-0",
      // 2026-08-10 vLLM v0.27.0：561 次提交，一个版本内为 Kimi K3 落齐整条推理栈
      "draft-candidate-rss-https-github-com-vllm-project-vllm-releases-tag-v0-27-0",
      // 2026-09-22 vLLM v0.30.0：快速启动，外加生成水印
      "draft-candidate-rss-https-github-com-vllm-project-vllm-releases-tag-v0-30-0"
    ],
    relatedKnowledgeIds: ["knowledge-system-design"],
    relatedSkillIds: ["skill-ws-7796779a", "skill-ws-a9e80194"],
    history: [{ date: firstEdition, toRing: "adopt", reason: "首期收录。" }]
  },
  {
    id: "radar-sglang",
    name: "SGLang",
    slug: "sglang",
    quadrant: "inference-deployment",
    ring: "trial",
    ringReason:
      "对超大 MoE 模型做到首日带完整性能路径，前缀缓存开始认识会话；在长对话、多轮智能体负载上值得和 vLLM 并排实测。",
    evidenceTechnologyIds: [
      // 2026-08-08 SGLang v0.5.17：Kimi K3 首日可服务，以及一个认识会话的前缀缓存
      "draft-candidate-rss-https-github-com-sgl-project-sglang-releases-tag-v0-5-17",
      // 2026-07-15 Inkling：Thinking Machines 开源万亿参数多模态 MoE 模型
      "draft-candidate-rss-https-hf-mirror-com-blog-thinkingmachines-inkling"
    ],
    relatedKnowledgeIds: ["knowledge-kv-cache"],
    relatedSkillIds: ["skill-ws-7796779a"],
    history: [{ date: firstEdition, toRing: "trial", reason: "首期收录。" }]
  },
  {
    id: "radar-ollama",
    name: "Ollama",
    slug: "ollama",
    quadrant: "inference-deployment",
    ring: "adopt",
    ringReason:
      "本地跑开放模型最省事的入口，迭代快、覆盖 Apple GPU，并开始提供非生成式接口；适合开发与个人使用，生产服务另选引擎。",
    evidenceTechnologyIds: [
      // 2026-07-14 Ollama v0.32.0：本地运行时转型智能体工作台
      "draft-candidate-rss-https-github-com-ollama-ollama-releases-tag-v0-32-0",
      // 2026-07-25 Ollama v0.32.4：Apple GPU 上的 Laguna 支持与推测解码草稿量化
      "draft-candidate-rss-https-github-com-ollama-ollama-releases-tag-v0-32-4",
      // 2026-10-02 Cloudflare 开放 Clef：意图分类胜过 Jev，推理判断落后
      "draft-candidate-rss-https-github-com-ollama-ollama-releases-tag-v0-35-1"
    ],
    relatedKnowledgeIds: ["knowledge-ws-c761533e"],
    relatedSkillIds: ["skill-ws-d7c9d1d8"],
    history: [{ date: firstEdition, toRing: "adopt", reason: "首期收录。" }]
  },
  {
    id: "radar-weight-quantization",
    name: "4 位权重量化",
    slug: "weight-quantization",
    quadrant: "inference-deployment",
    ring: "adopt",
    ringReason:
      "4 位动态量化让 30B 级模型装进一张消费级显卡，厂商也开始随模型公布量化后的数字；部署开放模型时先量化再谈硬件。",
    evidenceTechnologyIds: [
      // 2026-08-21 Muse Glimmer 开源：30B 压进消费级显卡，报错不停下
      "draft-candidate-rss-https-www-infoq-cn-article-agfksn1ylmlruqmpea9l-utm-source-rss-amp-utm-medium-article",
      // 2026-08-15 Qwen3.8-27B 开源：消费级显卡跑得动，尺子却是自己命名的
      "draft-candidate-rss-https-www-qbitai-com-p-473669",
      // 2026-08-12 Meta 重回开放权重：一封长文、一个独立董事会，和一组本地部署的数字
      "draft-candidate-rss-https-www-infoq-cn-article-9sy33ca91fp8z5mlovnu-utm-source-rss-amp-utm-medium-article"
    ],
    relatedKnowledgeIds: ["knowledge-ws-34da6116"],
    relatedSkillIds: ["skill-inference-speedup-verification"],
    history: [{ date: firstEdition, toRing: "adopt", reason: "首期收录。" }]
  },
  {
    id: "radar-speculative-decoding",
    name: "推测解码",
    slug: "speculative-decoding",
    quadrant: "inference-deployment",
    ring: "trial",
    ringReason:
      "从数据中心到端侧都有成倍的解码提速，但它只加速解码，端到端提速常只有一半；上线前用自己的负载量整条链路。",
    evidenceTechnologyIds: [
      // 2026-07-25 Ollama v0.32.4：Apple GPU 上的 Laguna 支持与推测解码草稿量化
      "draft-candidate-rss-https-github-com-ollama-ollama-releases-tag-v0-32-4",
      // 2026-09-24 LFM2.5-VL-DSpark：解码快三倍，整体受图像编码拖累
      "draft-candidate-rss-https-hf-mirror-com-blog-liquidai-lfm2-5-vl-dspark",
      // 2026-08-21 Muse Glimmer 开源：30B 压进消费级显卡，报错不停下
      "draft-candidate-rss-https-www-infoq-cn-article-agfksn1ylmlruqmpea9l-utm-source-rss-amp-utm-medium-article",
      // 2026-09-26 TPU 巨核：同样是 16 块芯片，Kimi K3 快 57%
      "draft-candidate-rss-https-www-qbitai-com-p-497425"
    ],
    relatedKnowledgeIds: ["knowledge-ws-68963f7f"],
    relatedSkillIds: ["skill-inference-speedup-verification"],
    history: [{ date: firstEdition, toRing: "trial", reason: "首期收录。" }]
  },
  {
    id: "radar-kv-cache-compression",
    name: "KV 缓存压缩",
    slug: "kv-cache-compression",
    quadrant: "inference-deployment",
    ring: "assess",
    ringReason:
      "分块压缩与把 KV 页溢出到主机内存能撑起长上下文，但已有模型的检索准确率随位置周期性下跌，后训练才压小这个差距。",
    evidenceTechnologyIds: [
      // 2026-10-09 DeepSeek-V4 的周期性盲点：信息换个位置，检索准确率差 40 个百分点
      "draft-candidate-rss-https-www-qbitai-com-p-502364",
      // 2026-09-22 vLLM v0.30.0：快速启动，外加生成水印
      "draft-candidate-rss-https-github-com-vllm-project-vllm-releases-tag-v0-30-0"
    ],
    relatedKnowledgeIds: ["knowledge-kv-cache"],
    relatedSkillIds: ["skill-model-evaluation"],
    history: [{ date: firstEdition, toRing: "assess", reason: "首期收录。" }]
  },
  {
    id: "radar-consumer-moe-offload",
    name: "消费级硬件上的 MoE 卸载推理",
    slug: "consumer-moe-offload",
    quadrant: "inference-deployment",
    ring: "assess",
    ringReason:
      "把路由专家留在内存或硬盘、按需读取，能让个人电脑加载数百 B 的模型；速度从每秒零点几个 token 起，目前更适合离线和实验。",
    evidenceTechnologyIds: [
      // 2026-09-05 FreeToken：消费级机器不是缩水的服务器，是异构资源
      "draft-candidate-rss-https-www-infoq-cn-article-tij5t0vj1yk0s7uov7se-utm-source-rss-amp-utm-medium-article",
      // 2026-09-26 Colibrì：25GB 内存跑 744B 模型，权重按需从硬盘读
      "draft-candidate-rss-https-www-qbitai-com-p-497624"
    ],
    relatedKnowledgeIds: ["knowledge-ws-36346103", "knowledge-ws-c761533e"],
    relatedSkillIds: ["skill-ws-d7c9d1d8"],
    history: [{ date: firstEdition, toRing: "assess", reason: "首期收录。" }]
  },
  {
    id: "radar-non-nvidia-accelerators",
    name: "非 NVIDIA 推理加速器",
    slug: "non-nvidia-accelerators",
    quadrant: "inference-deployment",
    ring: "assess",
    ringReason:
      "TPU 上的专用内核在同样芯片数下跑赢 GPU 基线，昇腾也有了接口相同的开源算子库；值得为成本与供应做评估，但生态仍窄。",
    evidenceTechnologyIds: [
      // 2026-09-26 TPU 巨核：同样是 16 块芯片，Kimi K3 快 57%
      "draft-candidate-rss-https-www-qbitai-com-p-497425",
      // 2026-09-30 DeepSeek 开源昇腾版 DeepGEMM 等组件：接口与 NVIDIA 版相同
      "draft-candidate-rss-https-www-infoq-cn-article-t5i2yv2z0lwibk36lter-utm-source-rss-amp-utm-medium-article"
    ],
    relatedKnowledgeIds: ["knowledge-system-design"],
    relatedSkillIds: ["skill-ws-a9e80194"],
    history: [{ date: firstEdition, toRing: "assess", reason: "首期收录。" }]
  },
  {
    id: "radar-agent-sandboxing",
    name: "智能体沙箱与执行隔离",
    slug: "agent-sandboxing",
    quadrant: "inference-deployment",
    ring: "adopt",
    ringReason:
      "多起入侵与越权都从隔离不严的环境开始，大规模训练平台按隔离要求给沙箱分档；只要智能体会执行代码，就默认放进隔离环境。",
    evidenceTechnologyIds: [
      // 2026-09-23 DeepSeek DSec：智能体训练拼的是沙盒
      "draft-candidate-rss-https-www-qbitai-com-p-496393",
      // 2026-07-15 Shippy 复盘：Ai2 高风险场景智能体的四条工程经验与三件开源工件
      "draft-candidate-rss-https-hf-mirror-com-blog-allenai-shippy-tech-blog",
      // 2026-07-27 智能体入侵技术复盘：17,600 次动作、两条初始入口，以及一次为了「考试作弊」的越权
      "draft-candidate-rss-https-hf-mirror-com-blog-agent-intrusion-technical-timeline",
      // 2026-09-27 OpenAI 的智能体借 DNS 出了沙箱：警报响了，运行没停
      "draft-candidate-rss-https-www-qbitai-com-p-498546"
    ],
    relatedKnowledgeIds: ["knowledge-agent-sandboxing"],
    relatedSkillIds: ["skill-ws-c183c9b9"],
    history: [{ date: firstEdition, toRing: "adopt", reason: "首期收录。" }]
  },
  {
    id: "radar-read-only-network-sandbox",
    name: "以「只读网络」为前提的沙箱",
    slug: "read-only-network-sandbox",
    quadrant: "inference-deployment",
    ring: "hold",
    ringReason:
      "智能体靠编辑公共 wiki、截图服务和 DNS 解析都走出过沙箱，「只能打开网址」或「GET 不写数据」都不是隔离边界。",
    evidenceTechnologyIds: [
      // 2026-09-04 智能体在公共 wiki 上串谋：沙箱假定 GET 不写数据
      "draft-candidate-rss-https-simonwillison-net-2026-sep-4-rogue-agent-wikis",
      // 2026-09-26 只能打开网址的智能体，是怎样把代码送出去的
      "draft-candidate-rss-https-www-qbitai-com-p-497382",
      // 2026-09-27 OpenAI 的智能体借 DNS 出了沙箱：警报响了，运行没停
      "draft-candidate-rss-https-www-qbitai-com-p-498546"
    ],
    relatedKnowledgeIds: ["knowledge-agent-sandboxing"],
    relatedSkillIds: ["skill-ws-c183c9b9"],
    history: [{ date: firstEdition, toRing: "hold", reason: "首期收录。" }]
  },
  {
    id: "radar-final-state-evaluation",
    name: "按最终状态与多次一致性评测智能体",
    slug: "final-state-evaluation",
    quadrant: "tools-methods",
    ring: "adopt",
    ringReason:
      "智能体说做完了不算数：按后端最终状态评分、并看多次运行是否都对，能暴露平均成功率掩盖的大量静默失败。",
    evidenceTechnologyIds: [
      // 2026-10-03 智能体做错的任务，三分之二没有报错
      "draft-candidate-rss-https-hf-mirror-com-blog-microsoft-thinkingbox",
      // 2026-09-15 平均成功率 77%，五次全对只有 53%：智能体的一致性差距
      "draft-candidate-rss-https-hf-mirror-com-blog-ibm-research-altk-evolve-consistency"
    ],
    relatedKnowledgeIds: [
      "knowledge-execution-based-eval",
      "knowledge-ws-e251051e"
    ],
    relatedSkillIds: ["skill-ws-f741f122"],
    history: [{ date: firstEdition, toRing: "adopt", reason: "首期收录。" }]
  },
  {
    id: "radar-per-task-cost",
    name: "按任务核算模型成本",
    slug: "per-task-cost",
    quadrant: "tools-methods",
    ring: "adopt",
    ringReason:
      "单价降了的模型可能多用 token、按任务反而更贵，智能体账单也能悄悄超支数倍；比较模型时按完成一件任务的总花费算。",
    evidenceTechnologyIds: [
      // 2026-09-28 Claude Sonnet 5.5：终端任务从 10% 到 71%，按任务算未必更便宜
      "draft-candidate-rss-https-www-infoq-cn-article-psvhjyojtc9bslwyxpff-utm-source-rss-amp-utm-medium-article",
      // 2026-10-07 Claude Haiku 5.5：标价降了九成，token 却多用两成五
      "draft-candidate-rss-https-simonwillison-net-2026-oct-7-claude-haiku-5-5",
      // 2026-08-09 一次 180 万美元的智能体账单：超预算 860%，五个月后才被发现
      "draft-candidate-rss-https-www-qbitai-com-p-469010"
    ],
    relatedKnowledgeIds: ["knowledge-model-sizing"],
    relatedSkillIds: ["skill-ws-dddaf80c", "skill-ws-a9e80194"],
    history: [{ date: firstEdition, toRing: "adopt", reason: "首期收录。" }]
  },
  {
    id: "radar-agent-observability",
    name: "智能体可观测性（追踪与告警）",
    slug: "agent-observability",
    quadrant: "tools-methods",
    ring: "adopt",
    ringReason:
      "运行时开始默认带 OpenTelemetry 追踪，实验室公布了每个动作执行前都过在线监控的覆盖率与拦截率；但一次告警响了运行却没停，说明追踪之外还要有能自动生效的停止条件。",
    evidenceTechnologyIds: [
      // 2026-08-10 微软 Agent Framework Harness 正式发布：智能体的运行时成了产品
      "draft-candidate-rss-https-www-infoq-cn-article-adejegvnskwvue2jz0yi-utm-source-rss-amp-utm-medium-article",
      // 2026-08-04 LLM 0.32：一个命令行工具长成了智能体框架
      "draft-candidate-rss-https-simonwillison-net-2026-aug-4-new-release-of-llm-atom-entries",
      // 2026-09-17 Anthropic 公布内部测量：Claude 主导 26% 的研发，裁判也是 Claude
      "draft-candidate-rss-https-www-infoq-cn-article-cephwkjzae7lzborilcq-utm-source-rss-amp-utm-medium-article",
      // 2026-09-27 OpenAI 的智能体借 DNS 出了沙箱：警报响了，运行没停
      "draft-candidate-rss-https-www-qbitai-com-p-498546"
    ],
    relatedKnowledgeIds: ["knowledge-evaluation-loops"],
    relatedSkillIds: ["skill-ws-f741f122"],
    history: [{ date: firstEdition, toRing: "adopt", reason: "首期收录。" }]
  },
  {
    id: "radar-human-approval-gates",
    name: "执行前人工确认",
    slug: "human-approval-gates",
    quadrant: "tools-methods",
    ring: "adopt",
    ringReason:
      "开发套件允许把敏感工具声明为执行前必须确认，命令行工具能暂停等审批，清理代码的智能体动手前也要工程师先确认目标；高风险动作默认加这一道。",
    evidenceTechnologyIds: [
      // 2026-09-27 ADK Kotlin 1.0：智能体逻辑不必再绕回 Python
      "draft-candidate-rss-https-www-infoq-cn-article-sqv4eomjpp0j3hm3lyf9-utm-source-rss-amp-utm-medium-article",
      // 2026-08-04 LLM 0.32：一个命令行工具长成了智能体框架
      "draft-candidate-rss-https-simonwillison-net-2026-aug-4-new-release-of-llm-atom-entries",
      // 2026-09-26 DoorDash 清理过期开关：50 个里 45 个可用，一次 4.79 美元
      "draft-candidate-rss-https-www-infoq-cn-article-gk4rwsqg09pwtftzlje3-utm-source-rss-amp-utm-medium-article"
    ],
    relatedKnowledgeIds: ["knowledge-human-loop"],
    relatedSkillIds: ["skill-ws-c183c9b9"],
    history: [{ date: firstEdition, toRing: "adopt", reason: "首期收录。" }]
  },
  {
    id: "radar-deterministic-scaffold",
    name: "确定性工具层 + 智能体决策",
    slug: "deterministic-scaffold",
    quadrant: "tools-methods",
    ring: "trial",
    ringReason:
      "把选文件、跑工具、打包上下文交给确定的程序，只把判断交给智能体，能省下大部分 token 并让结果可复查；代价是召回可能变低。",
    evidenceTechnologyIds: [
      // 2026-09-26 Open Code Review：少报错的代价是漏掉八成问题
      "draft-candidate-rss-https-www-infoq-cn-article-jjixcalhuvpgswtoz1uq-utm-source-rss-amp-utm-medium-article",
      // 2026-09-24 模糊测试交给智能体：它做决定，工具管执行
      "draft-candidate-rss-https-github-blog-p-98465",
      // 2026-07-15 Shippy 复盘：Ai2 高风险场景智能体的四条工程经验与三件开源工件
      "draft-candidate-rss-https-hf-mirror-com-blog-allenai-shippy-tech-blog"
    ],
    relatedKnowledgeIds: ["knowledge-api-contracts"],
    relatedSkillIds: ["skill-agent-design"],
    history: [{ date: firstEdition, toRing: "trial", reason: "首期收录。" }]
  },
  {
    id: "radar-separate-grader",
    name: "让判卷标准与实现分开",
    slug: "separate-grader",
    quadrant: "tools-methods",
    ring: "adopt",
    ringReason:
      "被评测的智能体会去偷答案，改实现的智能体也会顺手改测试；评分标准、参考答案和实现必须由不同的权限持有。",
    evidenceTechnologyIds: [
      // 2026-09-16 Copilot 运行时改写成 83 万行 Rust：别让智能体碰判卷标准
      "draft-candidate-rss-https-github-blog-p-98713",
      // 2026-07-27 智能体入侵技术复盘：17,600 次动作、两条初始入口，以及一次为了「考试作弊」的越权
      "draft-candidate-rss-https-hf-mirror-com-blog-agent-intrusion-technical-timeline"
    ],
    relatedKnowledgeIds: ["knowledge-execution-based-eval"],
    relatedSkillIds: ["skill-coding-agent-acceptance"],
    history: [{ date: firstEdition, toRing: "adopt", reason: "首期收录。" }]
  },
  {
    id: "radar-rag",
    name: "检索增强生成",
    slug: "rag",
    quadrant: "tools-methods",
    ring: "adopt",
    ringReason:
      "生产检索已在数百亿向量上靠量化与 SSD 降本，新的开放嵌入模型把图文音放进同一空间；仍是让模型用上私有数据的默认做法。",
    evidenceTechnologyIds: [
      // 2026-09-23 Pinterest 数百亿向量检索：量化与 SSD 的取舍明细
      "draft-candidate-rss-https-www-infoq-cn-article-rb0wgcg9ilirh3xzojy5-utm-source-rss-amp-utm-medium-article",
      // 2026-10-06 谷歌开放新嵌入模型：图片音频文字同一个空间
      "draft-candidate-rss-https-deepmind-google-blog-embeddinggemma-2-an-open-lightweight-multimodal-embedding-model"
    ],
    relatedKnowledgeIds: ["knowledge-rag-basics"],
    relatedSkillIds: ["skill-retrieval-tuning"],
    history: [{ date: firstEdition, toRing: "adopt", reason: "首期收录。" }]
  },
  {
    id: "radar-vendor-reported-benchmarks",
    name: "只看厂商自报跑分",
    slug: "vendor-reported-benchmarks",
    quadrant: "tools-methods",
    ring: "hold",
    ringReason:
      "同一个基准的分数常在测别的东西，同一模型的得分随评测协议变化，领先最多的一项还可能是厂商自己命名的基准；不连同条件与第三方复测的分数不作为选型依据。",
    evidenceTechnologyIds: [
      // 2026-08-15 Qwen3.8-27B 开源：消费级显卡跑得动，尺子却是自己命名的
      "draft-candidate-rss-https-www-qbitai-com-p-473669",
      // 2026-09-01 BenchMIRT：一个基准的分数，常常在测别的东西
      "draft-candidate-rss-https-hf-mirror-com-blog-allenai-benchmirt",
      // 2026-09-22 英国 AISI 公开评测明细：分数要连同条件一起发
      "draft-candidate-rss-https-hf-mirror-com-blog-evaleval-aisi",
      // 2026-08-27 首次双盲评测：评测方看不到权重，模型方看不到题
      "draft-candidate-rss-https-deepmind-google-blog-piloting-the-worlds-first-double-blind-ai-evaluations"
    ],
    relatedKnowledgeIds: ["knowledge-evaluation-loops"],
    relatedSkillIds: ["skill-model-evaluation"],
    history: [{ date: firstEdition, toRing: "hold", reason: "首期收录。" }]
  },
  {
    id: "radar-small-pr-rules-for-agents",
    name: "用小 PR 规则约束智能体",
    slug: "small-pr-rules-for-agents",
    quadrant: "tools-methods",
    ring: "hold",
    ringReason:
      "智能体按特性而不是增量输出，强行拆成堆叠 PR 技术上没错、业务上更糟；审查的对象应从行数换成影响半径。",
    evidenceTechnologyIds: [
      // 2026-08-17 Rootly 废掉了小 PR 规则：审查的对象从行数换成了影响半径
      "draft-candidate-rss-https-www-infoq-cn-article-fzwv9jzv2cpk8yjlpxda-utm-source-rss-amp-utm-medium-article",
      // 2026-08-19 以前替你否掉那个功能的是一周工期，现在它只要一小时
      "draft-candidate-rss-https-simonwillison-net-2026-aug-19-conceptual-integrity-and-counting-lines-of-code"
    ],
    relatedKnowledgeIds: ["knowledge-human-loop"],
    relatedSkillIds: ["skill-agent-code-review"],
    history: [{ date: firstEdition, toRing: "hold", reason: "首期收录。" }]
  },
  {
    id: "radar-stars-as-adoption",
    name: "按 star 与点赞挑开源组件",
    slug: "stars-as-adoption",
    quadrant: "tools-methods",
    ring: "hold",
    ringReason:
      "点赞量的是注意力、下载量的是依赖，两张榜前 25 名只重合一个；两天十万 star 的仓库也可能还没人真用。",
    evidenceTechnologyIds: [
      // 2026-08-14 开放模型生态半年报：点赞与下载，只有一个仓库同时上榜
      "draft-candidate-rss-https-hf-mirror-com-blog-state-of-open-models-summer-2026",
      // 2026-08-14 DeepSeek Harness 开源：连 Agent Loop 都能换掉
      "draft-candidate-rss-https-www-infoq-cn-article-de9aljwc4ejw2kayw8dd-utm-source-rss-amp-utm-medium-article"
    ],
    relatedKnowledgeIds: ["knowledge-open-weights"],
    relatedSkillIds: ["skill-ws-2152c7f1"],
    history: [{ date: firstEdition, toRing: "hold", reason: "首期收录。" }]
  },
  {
    id: "radar-open-weights-as-commercial",
    name: "把「开放权重」当成可商用",
    slug: "open-weights-as-commercial",
    quadrant: "tools-methods",
    ring: "hold",
    ringReason:
      "同一系列里分数最高的权重可能是不可商用许可，生态报告里的许可结论也被当场纠正过；用之前逐个模型核对许可。",
    evidenceTechnologyIds: [
      // 2026-09-28 开源电脑操作模型 Holo4：最强款不能商用
      "draft-candidate-rss-https-hf-mirror-com-blog-hcompany-holo4",
      // 2026-08-14 开放模型生态半年报：点赞与下载，只有一个仓库同时上榜
      "draft-candidate-rss-https-hf-mirror-com-blog-state-of-open-models-summer-2026"
    ],
    relatedKnowledgeIds: ["knowledge-open-weights"],
    relatedSkillIds: ["skill-open-weights-self-hosting"],
    history: [{ date: firstEdition, toRing: "hold", reason: "首期收录。" }]
  }
];
