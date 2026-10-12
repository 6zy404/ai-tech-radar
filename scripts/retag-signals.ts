// One-off: refines the topic tags on published signals (2026-10-12).
//
//   node scripts/run-ts.cjs scripts/retag-signals.ts           # dry run
//   node scripts/run-ts.cjs scripts/retag-signals.ts --apply   # write
//
// Until this date `src/data/tags.ts` had 10 topics, and on the 107 published
// signals 智能体 sat on 61 (57%) and 前沿模型 on 49 (46%), so the topic pages,
// the 按话题 view, 我关注的 and the per-topic feeds could hardly narrow
// anything. Nine narrower topics were added; this script puts them on the
// signals, and takes the three broad tags off where they had been attached
// loosely: 前沿模型 on engine releases, incidents and eval papers, 智能体 on
// model launches that only quoted an agent benchmark, 推理与部署 where the
// reason was price. The 编码智能体 signals leave 智能体. No tag id is removed
// from `tags.ts`: readers' follows, 关注码 and feed addresses refer to them.
//
// The tags are an explicit table read by a person, not a runtime rule: every
// signal below was read and decided once. A planned id missing from the store
// is reported and skipped; a second run changes nothing.
//
// Only the `tags` field is rewritten, in place. The workflow's
// `updateTechnologyWorkspaceRecord` would also bump `updatedAt` and re-sort the
// store by it, and same-day signals take their public order (精选, 上一条 /
// 下一条) from the store order, so it would quietly reorder them. Skill and
// knowledge entries get additions only; one that is still a bare seed is
// copied into its workspace store through the workflow (copy-on-write).
import path from "node:path";

import { knowledgeItems } from "../src/data/knowledge";
import { skillItems } from "../src/data/skills";
import { topicTags } from "../src/data/tags";
import { updateKnowledgeWorkspaceRecord } from "../src/lib/knowledge-workflow";
import {
  getLocalStoreFilePath,
  readLocalJsonFile,
  writeLocalJsonFile
} from "../src/lib/repositories/local-json-store";
import { updateSkillWorkspaceRecord } from "../src/lib/skill-workflow";

export interface RetagPlan {
  add: string[];
  remove: string[];
}

/** The topics added on 2026-10-12. */
export const newTopicIds = [
  "tag-ai-safety",
  "tag-open-weights",
  "tag-agent-infra",
  "tag-ai-for-science",
  "tag-coding-agents",
  "tag-model-pricing",
  "tag-benchmarks",
  "tag-training",
  "tag-efficient-inference"
] as const;

/** The only tags this script ever takes off a signal. */
export const narrowedTopicIds = [
  "tag-ai-agents",
  "tag-frontier-models",
  "tag-inference"
] as const;

/** Published signal id → tags to add and to remove. */
export const signalRetags: Record<string, RetagPlan> = {
  // 2026-07-07 Gemini API Managed Agents 扩展：后台任务与远程 MCP 接入
  "draft-candidate-rss-https-blog-google-innovation-and-ai-technology-developers-tools-expanding-managed-agents-gemini-api":
    {
      add: ["tag-agent-infra"],
      remove: []
    },
  // 2026-07-08 NVIDIA Nemotron 开放数据：用合成数据支撑智能体开发
  "draft-candidate-rss-https-hf-mirror-com-blog-nvidia-open-data-for-agents": {
    add: ["tag-training"],
    remove: []
  },
  // 2026-07-09 GPT-5.6：OpenAI 新一代旗舰模型，主打单位算力智能密度
  "draft-candidate-rss-https-openai-com-index-gpt-5-6": {
    add: ["tag-model-pricing"],
    remove: ["tag-inference"]
  },
  // 2026-07-10 Copilot 代码审查复盘：更好的工具让智能体更差，指令才是关键
  "draft-candidate-rss-https-github-blog-p-97467": {
    add: ["tag-coding-agents"],
    remove: ["tag-ai-agents"]
  },
  // 2026-07-15 Real World VoiceEQ：衡量语音 AI「人性质量」的评测基准
  "draft-candidate-rss-https-hf-mirror-com-blog-real-world-voiceeq": {
    add: ["tag-benchmarks"],
    remove: []
  },
  // 2026-07-15 GPT-Red：OpenAI 用自博弈自动红队提升模型鲁棒性
  "draft-candidate-rss-https-openai-com-index-unlocking-self-improvement-gpt-red":
    {
      add: ["tag-ai-safety", "tag-training"],
      remove: ["tag-ai-agents"]
    },
  // 2026-07-15 Inkling：Thinking Machines 开源万亿参数多模态 MoE 模型
  "draft-candidate-rss-https-hf-mirror-com-blog-thinkingmachines-inkling": {
    add: ["tag-open-weights"],
    remove: []
  },
  // 2026-07-15 Shippy 复盘：Ai2 高风险场景智能体的四条工程经验与三件开源工件
  "draft-candidate-rss-https-hf-mirror-com-blog-allenai-shippy-tech-blog": {
    add: ["tag-agent-infra"],
    remove: []
  },
  // 2026-07-16 Kimi K3：Moonshot 发布 2.8 万亿参数旗舰，承诺月内开放权重
  "draft-candidate-rss-https-simonwillison-net-2026-jul-16-kimi-k3-atom-entries":
    {
      add: ["tag-open-weights"],
      remove: ["tag-inference"]
    },
  // 2026-07-16 Hugging Face 安全事件披露：首例自主智能体驱动的生产入侵
  "draft-candidate-rss-https-hf-mirror-com-blog-security-incident-july-2026": {
    add: ["tag-ai-safety"],
    remove: []
  },
  // 2026-07-17 NeMo Automodel 接入 Diffusers：任意扩散模型的规模化分布式微调
  "draft-candidate-rss-https-hf-mirror-com-blog-nvidia-scale-diffusers-finetuning-nemo-automodel":
    {
      add: ["tag-training"],
      remove: ["tag-frontier-models"]
    },
  // 2026-07-20 OpenAI：长时程模型时代的安全与对齐实践
  "draft-candidate-rss-https-openai-com-index-safety-alignment-long-horizon-models":
    {
      add: ["tag-ai-safety"],
      remove: []
    },
  // 2026-07-21 Google Gemini Flash Cyber：面向漏洞发现与修复的轻量安全模型
  "draft-candidate-rss-https-deepmind-google-blog-introducing-gemini-36-flash-35-flash-lite-and-35-flash-cyber":
    {
      add: ["tag-ai-safety"],
      remove: []
    },
  // 2026-07-22 Copilot 与裸 API：为编码智能体的「外壳」付费，到底买到了什么
  "draft-candidate-rss-https-github-blog-p-97686": {
    add: ["tag-coding-agents", "tag-model-pricing"],
    remove: ["tag-ai-agents"]
  },
  // 2026-07-25 Ollama v0.32.4：Apple GPU 上的 Laguna 支持与推测解码草稿量化
  "draft-candidate-rss-https-github-com-ollama-ollama-releases-tag-v0-32-4": {
    add: ["tag-efficient-inference"],
    remove: []
  },
  // 2026-07-25 vLLM v0.26.0：为 Inkling 万亿参数模型补齐推理全栈
  "draft-candidate-rss-https-github-com-vllm-project-vllm-releases-tag-v0-26-0":
    {
      add: [],
      remove: ["tag-frontier-models"]
    },
  // 2026-07-27 智能体入侵技术复盘：17,600 次动作、两条初始入口，以及一次为了「考试作弊」的越权
  "draft-candidate-rss-https-hf-mirror-com-blog-agent-intrusion-technical-timeline":
    {
      add: ["tag-ai-safety"],
      remove: []
    },
  // 2026-07-28 LFM2.5-Encoders：能在 CPU 上跑长文档的小编码器，长上下文比 ModernBE…
  "draft-candidate-rss-https-hf-mirror-com-blog-liquidai-lfm2-5-encoders": {
    add: ["tag-open-weights"],
    remove: []
  },
  // 2026-07-31 MCP 2.0：协议核心改为无状态
  "draft-candidate-rss-https-simonwillison-net-2026-jul-31-stateless-mcp-atom-entries":
    {
      add: ["tag-agent-infra"],
      remove: []
    },
  // 2026-08-04 LFM2.5-2.6B：一个在智能体外壳里训练出来的端侧模型
  "draft-candidate-rss-https-hf-mirror-com-blog-liquidai-lfm2-5-2-6b": {
    add: ["tag-training"],
    remove: []
  },
  // 2026-08-04 LLM 0.32：一个命令行工具长成了智能体框架
  "draft-candidate-rss-https-simonwillison-net-2026-aug-4-new-release-of-llm-atom-entries":
    {
      add: ["tag-agent-infra"],
      remove: []
    },
  // 2026-08-07 那次入侵的来源查清了：它是从 OpenAI 训练环境里意外长出来的
  "draft-candidate-rss-https-simonwillison-net-2026-aug-7-openai-timeline-atom-entries":
    {
      add: ["tag-ai-safety"],
      remove: []
    },
  // 2026-08-07 TutorMoments：只说「做好一点」时，模型会普遍过度帮忙
  "draft-candidate-rss-https-hf-mirror-com-blog-allenai-tutormoments": {
    add: ["tag-benchmarks"],
    remove: []
  },
  // 2026-08-08 SGLang v0.5.17：Kimi K3 首日可服务，以及一个认识会话的前缀缓存
  "draft-candidate-rss-https-github-com-sgl-project-sglang-releases-tag-v0-5-17":
    {
      add: ["tag-efficient-inference"],
      remove: ["tag-frontier-models", "tag-ai-agents"]
    },
  // 2026-08-09 一次 180 万美元的智能体账单：超预算 860%，五个月后才被发现
  "draft-candidate-rss-https-www-qbitai-com-p-469010": {
    add: ["tag-model-pricing"],
    remove: []
  },
  // 2026-08-09 BigBang-v1：把数据生产系统本身当成优化对象，以及一处对不上的口径
  "draft-candidate-rss-https-www-qbitai-com-p-468782": {
    add: ["tag-open-weights", "tag-training"],
    remove: []
  },
  // 2026-08-10 微软 Agent Framework Harness 正式发布：智能体的运行时成了产品
  "draft-candidate-rss-https-www-infoq-cn-article-adejegvnskwvue2jz0yi-utm-source-rss-amp-utm-medium-article":
    {
      add: ["tag-agent-infra"],
      remove: []
    },
  // 2026-08-10 vLLM v0.27.0：561 次提交，一个版本内为 Kimi K3 落齐整条推理栈
  "draft-candidate-rss-https-github-com-vllm-project-vllm-releases-tag-v0-27-0":
    {
      add: [],
      remove: ["tag-frontier-models"]
    },
  // 2026-08-10 智能体复现审计：ICML 2026 的 92 篇论文里，只有 8 篇能复现八成结论
  "draft-candidate-rss-https-www-qbitai-com-p-469795": {
    add: ["tag-ai-for-science"],
    remove: []
  },
  // 2026-08-10 ARA：把论文从 PDF 改成智能体能直接操作的知识包
  "draft-candidate-rss-https-www-qbitai-com-p-469721": {
    add: ["tag-ai-for-science"],
    remove: []
  },
  // 2026-08-10 Meta Muse Glimmer：30B 蒸馏开源模型，专为本地智能体设计
  "draft-candidate-rss-https-hf-mirror-com-blog-muse-glimmer": {
    add: ["tag-open-weights"],
    remove: []
  },
  // 2026-08-11 AMIE 实时视频问诊：把「医生还会看你一眼」那部分放进随机对照研究
  "draft-candidate-rss-https-blog-google-innovation-and-ai-models-and-research-google-research-amie-video-consultations":
    {
      add: ["tag-ai-for-science"],
      remove: []
    },
  // 2026-08-12 Vercel Zero：一门把编译器输出的第一读者当成智能体的语言
  "draft-candidate-rss-https-www-infoq-cn-article-keq5kqg53vxpd0bxcy7y-utm-source-rss-amp-utm-medium-article":
    {
      add: ["tag-coding-agents"],
      remove: ["tag-ai-agents"]
    },
  // 2026-08-12 Meta 重回开放权重：一封长文、一个独立董事会，和一组本地部署的数字
  "draft-candidate-rss-https-www-infoq-cn-article-9sy33ca91fp8z5mlovnu-utm-source-rss-amp-utm-medium-article":
    {
      add: ["tag-open-weights", "tag-efficient-inference"],
      remove: []
    },
  // 2026-08-13 668 阶哈达玛矩阵被构造出来：三个人加 Claude，清掉 2000 阶以下所有未决阶数
  "draft-candidate-rss-https-www-qbitai-com-p-472016": {
    add: ["tag-ai-for-science"],
    remove: []
  },
  // 2026-08-13 两千两百篇论文被重跑了一遍：「已验证」说的是检查，不是论文
  "draft-candidate-rss-https-hf-mirror-com-blog-icml-2026-open-reproductions": {
    add: ["tag-ai-for-science"],
    remove: []
  },
  // 2026-08-13 Gemini 3.7 Flash：主力档三周一迭代，价格砍半
  "draft-candidate-rss-https-deepmind-google-blog-introducing-gemini-3-7-flash":
    {
      add: ["tag-model-pricing"],
      remove: ["tag-ai-agents"]
    },
  // 2026-08-13 生产要持久、评估要轻量——把编排从运行时里拆出来
  "draft-candidate-rss-https-www-infoq-cn-article-za8vafwpcm7lturfhdmd-utm-source-rss-amp-utm-medium-article":
    {
      add: ["tag-agent-infra"],
      remove: []
    },
  // 2026-08-14 DeepSeek Harness 开源：连 Agent Loop 都能换掉
  "draft-candidate-rss-https-www-infoq-cn-article-de9aljwc4ejw2kayw8dd-utm-source-rss-amp-utm-medium-article":
    {
      add: ["tag-agent-infra"],
      remove: ["tag-inference"]
    },
  // 2026-08-14 开放模型生态半年报：点赞与下载，只有一个仓库同时上榜
  "draft-candidate-rss-https-hf-mirror-com-blog-state-of-open-models-summer-2026":
    {
      add: ["tag-open-weights"],
      remove: ["tag-ai-agents", "tag-frontier-models"]
    },
  // 2026-08-15 Cloudflare Computer：不给智能体一个容器，给它一台机器
  "draft-candidate-rss-https-www-infoq-cn-article-rakih7e4la9uq4iasltb-utm-source-rss-amp-utm-medium-article":
    {
      add: ["tag-agent-infra"],
      remove: ["tag-inference"]
    },
  // 2026-08-15 Qwen3.8-27B 开源：消费级显卡跑得动，尺子却是自己命名的
  "draft-candidate-rss-https-www-qbitai-com-p-473669": {
    add: ["tag-open-weights"],
    remove: ["tag-ai-agents"]
  },
  // 2026-08-16 Qwen3.8-27B 的第三方实测：模型很好，出厂默认值不好
  "draft-candidate-rss-https-simonwillison-net-2026-aug-16-qwen-38-27b": {
    add: ["tag-benchmarks", "tag-open-weights"],
    remove: []
  },
  // 2026-08-16 MCP 无状态之后：被少报的那一半，是网关终于读得懂智能体流量
  "draft-candidate-rss-https-www-infoq-cn-article-412hbbva0nf0ayp0cjzd-utm-source-rss-amp-utm-medium-article":
    {
      add: ["tag-agent-infra"],
      remove: []
    },
  // 2026-08-17 Rootly 废掉了小 PR 规则：审查的对象从行数换成了影响半径
  "draft-candidate-rss-https-www-infoq-cn-article-fzwv9jzv2cpk8yjlpxda-utm-source-rss-amp-utm-medium-article":
    {
      add: ["tag-coding-agents"],
      remove: ["tag-ai-agents"]
    },
  // 2026-08-17 菲尔兹奖得主：模型强在找到那个对象，弱在知道何时放弃
  "draft-candidate-rss-https-www-qbitai-com-p-474381": {
    add: ["tag-ai-for-science"],
    remove: []
  },
  // 2026-08-17 同一个集群多出 33 个点的利用率：变的只是分配顺序
  "draft-candidate-rss-https-hf-mirror-com-blog-dharma-ai-gpu-management-pt2": {
    add: ["tag-model-pricing"],
    remove: []
  },
  // 2026-08-19 以前替你否掉那个功能的是一周工期，现在它只要一小时
  "draft-candidate-rss-https-simonwillison-net-2026-aug-19-conceptual-integrity-and-counting-lines-of-code":
    {
      add: ["tag-coding-agents"],
      remove: []
    },
  // 2026-08-21 Muse Glimmer 开源：30B 压进消费级显卡，报错不停下
  "draft-candidate-rss-https-www-infoq-cn-article-agfksn1ylmlruqmpea9l-utm-source-rss-amp-utm-medium-article":
    {
      add: ["tag-open-weights", "tag-efficient-inference"],
      remove: []
    },
  // 2026-08-27 首次双盲评测：评测方看不到权重，模型方看不到题
  "draft-candidate-rss-https-deepmind-google-blog-piloting-the-worlds-first-double-blind-ai-evaluations":
    {
      add: ["tag-benchmarks", "tag-ai-safety"],
      remove: ["tag-frontier-models"]
    },
  // 2026-09-01 BenchMIRT：一个基准的分数，常常在测别的东西
  "draft-candidate-rss-https-hf-mirror-com-blog-allenai-benchmirt": {
    add: ["tag-benchmarks"],
    remove: ["tag-frontier-models"]
  },
  // 2026-09-03 GPT-6 Astra 发布：越权行为从 48% 降到 0
  "draft-candidate-rss-https-openai-com-index-gpt-6-astra": {
    add: ["tag-ai-safety"],
    remove: ["tag-ai-agents"]
  },
  // 2026-09-04 智能体在公共 wiki 上串谋：沙箱假定 GET 不写数据
  "draft-candidate-rss-https-simonwillison-net-2026-sep-4-rogue-agent-wikis": {
    add: ["tag-ai-safety"],
    remove: []
  },
  // 2026-09-05 FreeToken：消费级机器不是缩水的服务器，是异构资源
  "draft-candidate-rss-https-www-infoq-cn-article-tij5t0vj1yk0s7uov7se-utm-source-rss-amp-utm-medium-article":
    {
      add: [],
      remove: ["tag-ai-agents"]
    },
  // 2026-09-06 每个研究员配 3.1 个智能体，而一半仍要人插手
  "draft-candidate-rss-https-openai-com-index-research-acceleration-view-inside-openai":
    {
      add: ["tag-ai-for-science"],
      remove: ["tag-frontier-models"]
    },
  // 2026-09-07 Kiro Crew 开源：内部 3.9 万人在用，没人被要求
  "draft-candidate-rss-https-www-infoq-cn-article-utrvjxwesgdp2kzlhpiv-utm-source-rss-amp-utm-medium-article":
    {
      add: ["tag-coding-agents", "tag-agent-infra"],
      remove: ["tag-ai-agents"]
    },
  // 2026-09-07 模型之间只传 17 比特：一座桥补上一半差距
  "draft-candidate-rss-https-www-qbitai-com-p-485108": {
    add: [],
    remove: ["tag-frontier-models"]
  },
  // 2026-09-08 纳维-斯托克斯之争：88 小时、3000 亿 token，和一个没回答的问题
  "draft-candidate-rss-https-simonwillison-net-2026-sep-8-on-navier-stokes": {
    add: ["tag-ai-for-science"],
    remove: []
  },
  // 2026-09-08 拒答率涨到 85%，同一检查点误拒也涨到 74%
  "draft-candidate-rss-https-hf-mirror-com-blog-multiversecomputingcai-safety-for-whom":
    {
      add: ["tag-ai-safety", "tag-training"],
      remove: ["tag-frontier-models"]
    },
  // 2026-09-08 90 亿个变异预先算好：把模型变成一份资源
  "draft-candidate-rss-https-deepmind-google-blog-alphagenome-atlas-a-predictive-map-of-every-possible-dna-letter-change-in-the-human-genome":
    {
      add: ["tag-ai-for-science"],
      remove: ["tag-frontier-models"]
    },
  // 2026-09-12 外部调查进场：约 7% 的运行记录被智能体伪造过
  "draft-candidate-rss-https-simonwillison-net-2026-sep-12-openai-agents-rubygems":
    {
      add: ["tag-ai-safety"],
      remove: ["tag-frontier-models"]
    },
  // 2026-09-15 平均成功率 77%，五次全对只有 53%：智能体的一致性差距
  "draft-candidate-rss-https-hf-mirror-com-blog-ibm-research-altk-evolve-consistency":
    {
      add: ["tag-benchmarks"],
      remove: []
    },
  // 2026-09-16 Copilot 运行时改写成 83 万行 Rust：别让智能体碰判卷标准
  "draft-candidate-rss-https-github-blog-p-98713": {
    add: ["tag-coding-agents"],
    remove: ["tag-ai-agents"]
  },
  // 2026-09-17 Anthropic 公布内部测量：Claude 主导 26% 的研发，裁判也是 Claude
  "draft-candidate-rss-https-www-infoq-cn-article-cephwkjzae7lzborilcq-utm-source-rss-amp-utm-medium-article":
    {
      add: ["tag-ai-for-science"],
      remove: ["tag-frontier-models"]
    },
  // 2026-09-21 Jev：只输出概率、不输出文字的决策模型
  "draft-candidate-rss-https-simonwillison-net-2026-sep-21-jev": {
    add: ["tag-model-pricing"],
    remove: ["tag-frontier-models"]
  },
  // 2026-09-22 vLLM v0.30.0：快速启动，外加生成水印
  "draft-candidate-rss-https-github-com-vllm-project-vllm-releases-tag-v0-30-0":
    {
      add: [],
      remove: ["tag-frontier-models"]
    },
  // 2026-09-22 Opus 5.5 与 GPT-6 同日降价，最贵的一档没有动
  "draft-candidate-rss-https-simonwillison-net-2026-sep-22-opus-and-sol-and-luna":
    {
      add: ["tag-model-pricing"],
      remove: ["tag-ai-agents"]
    },
  // 2026-09-22 英国 AISI 公开评测明细：分数要连同条件一起发
  "draft-candidate-rss-https-hf-mirror-com-blog-evaleval-aisi": {
    add: ["tag-benchmarks"],
    remove: ["tag-frontier-models"]
  },
  // 2026-09-23 Pinterest 数百亿向量检索：量化与 SSD 的取舍明细
  "draft-candidate-rss-https-www-infoq-cn-article-rb0wgcg9ilirh3xzojy5-utm-source-rss-amp-utm-medium-article":
    {
      add: ["tag-efficient-inference"],
      remove: []
    },
  // 2026-09-23 DeepSeek DSec：智能体训练拼的是沙盒
  "draft-candidate-rss-https-www-qbitai-com-p-496393": {
    add: ["tag-agent-infra", "tag-training"],
    remove: ["tag-frontier-models"]
  },
  // 2026-09-23 ZCode 快照事件之后：开源能挽回多少信任
  "draft-candidate-rss-https-www-infoq-cn-article-qehi6k5ycwxuiasvfnkh-utm-source-rss-amp-utm-medium-article":
    {
      add: ["tag-coding-agents", "tag-ai-safety"],
      remove: ["tag-ai-agents"]
    },
  // 2026-09-24 LFM2.5-VL-DSpark：解码快三倍，整体受图像编码拖累
  "draft-candidate-rss-https-hf-mirror-com-blog-liquidai-lfm2-5-vl-dspark": {
    add: ["tag-efficient-inference"],
    remove: []
  },
  // 2026-09-24 模糊测试交给智能体：它做决定，工具管执行
  "draft-candidate-rss-https-github-blog-p-98465": {
    add: ["tag-coding-agents", "tag-ai-safety"],
    remove: ["tag-ai-agents"]
  },
  // 2026-09-26 DoorDash 清理过期开关：50 个里 45 个可用，一次 4.79 美元
  "draft-candidate-rss-https-www-infoq-cn-article-gk4rwsqg09pwtftzlje3-utm-source-rss-amp-utm-medium-article":
    {
      add: ["tag-coding-agents"],
      remove: ["tag-ai-agents"]
    },
  // 2026-09-26 Open Code Review：少报错的代价是漏掉八成问题
  "draft-candidate-rss-https-www-infoq-cn-article-jjixcalhuvpgswtoz1uq-utm-source-rss-amp-utm-medium-article":
    {
      add: ["tag-coding-agents"],
      remove: ["tag-ai-agents"]
    },
  // 2026-09-26 只能打开网址的智能体，是怎样把代码送出去的
  "draft-candidate-rss-https-www-qbitai-com-p-497382": {
    add: ["tag-ai-safety"],
    remove: []
  },
  // 2026-09-26 TPU 巨核：同样是 16 块芯片，Kimi K3 快 57%
  "draft-candidate-rss-https-www-qbitai-com-p-497425": {
    add: ["tag-efficient-inference"],
    remove: ["tag-frontier-models"]
  },
  // 2026-09-26 Colibrì：25GB 内存跑 744B 模型，权重按需从硬盘读
  "draft-candidate-rss-https-www-qbitai-com-p-497624": {
    add: [],
    remove: ["tag-frontier-models"]
  },
  // 2026-09-27 ADK Kotlin 1.0：智能体逻辑不必再绕回 Python
  "draft-candidate-rss-https-www-infoq-cn-article-sqv4eomjpp0j3hm3lyf9-utm-source-rss-amp-utm-medium-article":
    {
      add: ["tag-agent-infra"],
      remove: []
    },
  // 2026-09-27 OpenAI 的智能体借 DNS 出了沙箱：警报响了，运行没停
  "draft-candidate-rss-https-www-qbitai-com-p-498546": {
    add: ["tag-ai-safety"],
    remove: ["tag-frontier-models"]
  },
  // 2026-09-28 Claude Sonnet 5.5：终端任务从 10% 到 71%，按任务算未必更便宜
  "draft-candidate-rss-https-www-infoq-cn-article-psvhjyojtc9bslwyxpff-utm-source-rss-amp-utm-medium-article":
    {
      add: ["tag-model-pricing"],
      remove: ["tag-inference", "tag-ai-agents"]
    },
  // 2026-09-28 开源电脑操作模型 Holo4：最强款不能商用
  "draft-candidate-rss-https-hf-mirror-com-blog-hcompany-holo4": {
    add: ["tag-open-weights"],
    remove: ["tag-inference"]
  },
  // 2026-09-29 NVIDIA 开放表格模型 Kumo Tabular：无需训练，一次前向出预测
  "draft-candidate-rss-https-hf-mirror-com-blog-nvidia-kumo-tabular": {
    add: ["tag-open-weights"],
    remove: []
  },
  // 2026-09-29 GPT-6.1 Sol：标价没变，缓存减半，号称逼近 Astra
  "draft-candidate-rss-https-openai-com-index-introducing-gpt-6-1-sol": {
    add: ["tag-model-pricing"],
    remove: ["tag-ai-agents", "tag-inference"]
  },
  // 2026-09-30 DeepSeek 开源昇腾版 DeepGEMM 等组件：接口与 NVIDIA 版相同
  "draft-candidate-rss-https-www-infoq-cn-article-t5i2yv2z0lwibk36lter-utm-source-rss-amp-utm-medium-article":
    {
      add: [],
      remove: ["tag-frontier-models"]
    },
  // 2026-09-30 Google 开源 AX：按 Kubernetes 的方式编排智能体，可秒级暂停
  "draft-candidate-rss-https-www-infoq-cn-article-m6brtrsyjvug8y0m0kyh-utm-source-rss-amp-utm-medium-article":
    {
      add: ["tag-agent-infra"],
      remove: ["tag-inference"]
    },
  // 2026-10-01 Gemini 4 Argon：DeepSWE 等多项领先，先只给网络安全团队用
  "draft-candidate-rss-https-www-infoq-cn-article-vvrszjhevkmpevs7wzzu-utm-source-rss-amp-utm-medium-article":
    {
      add: ["tag-ai-safety"],
      remove: ["tag-inference", "tag-ai-agents"]
    },
  // 2026-10-01 Olmo-core 3：开源 MoE 训练框架，吞吐提升到原来的 2.7 倍
  "draft-candidate-rss-https-hf-mirror-com-blog-allenai-olmocore3": {
    add: ["tag-training"],
    remove: ["tag-inference", "tag-frontier-models"]
  },
  // 2026-10-02 Cloudflare 开放 Clef：意图分类胜过 Jev，推理判断落后
  "draft-candidate-rss-https-github-com-ollama-ollama-releases-tag-v0-35-1": {
    add: ["tag-open-weights"],
    remove: ["tag-ai-agents"]
  },
  // 2026-10-03 智能体做错的任务，三分之二没有报错
  "draft-candidate-rss-https-hf-mirror-com-blog-microsoft-thinkingbox": {
    add: ["tag-benchmarks"],
    remove: []
  },
  // 2026-10-06 谷歌开放新嵌入模型：图片音频文字同一个空间
  "draft-candidate-rss-https-deepmind-google-blog-embeddinggemma-2-an-open-lightweight-multimodal-embedding-model":
    {
      add: ["tag-open-weights"],
      remove: []
    },
  // 2026-10-06 OpenAI 公开 719 篇数学结果：四成有 Lean 证明，第二天就撤回三篇
  "draft-candidate-rss-https-openai-com-index-sharing-ai-progress-in-mathematics":
    {
      add: ["tag-ai-for-science"],
      remove: []
    },
  // 2026-10-07 Nemotron 竞赛模型：IMO 金牌官方评定，IOI 金牌自测
  "draft-candidate-rss-https-hf-mirror-com-blog-nvidia-nemotron-ioi-and-imo-2026":
    {
      add: ["tag-ai-for-science", "tag-benchmarks"],
      remove: ["tag-inference"]
    },
  // 2026-10-07 Claude Haiku 5.5：标价降了九成，token 却多用两成五
  "draft-candidate-rss-https-simonwillison-net-2026-oct-7-claude-haiku-5-5": {
    add: ["tag-model-pricing"],
    remove: ["tag-ai-agents", "tag-inference"]
  },
  // 2026-10-09 DeepSeek-V4 的周期性盲点：信息换个位置，检索准确率差 40 个百分点
  "draft-candidate-rss-https-www-qbitai-com-p-502364": {
    add: ["tag-benchmarks"],
    remove: []
  },
  // 2026-10-10 MiMo-V2.6 技术报告：小米花 260 万美元跑一次强化学习
  "draft-candidate-rss-https-www-infoq-cn-article-gndwodm8ygkajxfslabk-utm-source-rss-amp-utm-medium-article":
    {
      add: ["tag-training"],
      remove: ["tag-ai-agents"]
    }
};

/** Skill entries: additions only. */
export const skillRetags: Record<string, RetagPlan> = {
  // 模型微调与后训练定制
  "skill-ws-84837d46": { add: ["tag-training"], remove: [] },
  // 智能体安全与提示注入防御
  "skill-ws-c183c9b9": { add: ["tag-ai-safety"], remove: [] },
  // 智能体可观测性与评测运维
  "skill-ws-f741f122": { add: ["tag-benchmarks"], remove: [] },
  // 模型与输出评估
  "skill-model-evaluation": { add: ["tag-benchmarks"], remove: [] },
  // 工具集成模式
  "skill-tool-integration": { add: ["tag-agent-infra"], remove: [] },
  // 智能体工作流设计
  "skill-agent-design": { add: ["tag-agent-infra"], remove: [] },
  // 推理服务容量规划
  "skill-ws-a9e80194": { add: ["tag-model-pricing"], remove: [] },
  // 旗舰模型发布解读与换代判断
  "skill-ws-dddaf80c": { add: ["tag-model-pricing"], remove: [] }
};

/** Knowledge entries: additions only. */
export const knowledgeRetags: Record<string, RetagPlan> = {
  // 合成数据与数据配方
  "knowledge-ws-818b7bb3": { add: ["tag-training"], remove: [] },
  // 对抗性评估与红队方法
  "knowledge-ws-89b98df3": {
    add: ["tag-ai-safety", "tag-benchmarks"],
    remove: []
  },
  // 模型量化与数值精度
  "knowledge-ws-34da6116": { add: ["tag-efficient-inference"], remove: [] },
  // 推测解码与推理加速技术
  "knowledge-ws-68963f7f": { add: ["tag-efficient-inference"], remove: [] },
  // 工具使用与函数调用
  "knowledge-tool-use": { add: ["tag-agent-infra"], remove: [] },
  // 完成判定与验收信号
  "knowledge-ws-e251051e": { add: ["tag-benchmarks"], remove: [] },
  // 评估闭环
  "knowledge-evaluation-loops": { add: ["tag-benchmarks"], remove: [] }
};

/** Existing order kept; removals dropped, missing additions appended. */
export function applyRetag(tags: string[], plan: RetagPlan): string[] {
  const kept = tags.filter((tag) => !plan.remove.includes(tag));
  return [...kept, ...plan.add.filter((tag) => !kept.includes(tag))];
}

export interface TaggedRecord {
  id: string;
  tags: string[];
}

export interface RetagChange {
  id: string;
  before: string[];
  after: string[];
}

/**
 * Applies `plans` to `records`, touching nothing but `tags` and keeping the
 * record order. Returns the next records, the records that changed, and the
 * planned ids the records do not contain.
 */
export function planRetag<T extends TaggedRecord>(
  records: T[],
  plans: Record<string, RetagPlan>
): { next: T[]; changes: RetagChange[]; missing: string[] } {
  const changes: RetagChange[] = [];
  const next = records.map((record) => {
    const plan = plans[record.id];
    if (!plan) return record;
    const after = applyRetag(record.tags, plan);
    if (after.join("|") === record.tags.join("|")) return record;
    changes.push({ id: record.id, before: record.tags, after });
    return { ...record, tags: after };
  });
  const ids = new Set(records.map((record) => record.id));
  const missing = Object.keys(plans).filter((id) => !ids.has(id));
  return { next, changes, missing };
}

export function countTags(tagLists: string[][]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const tags of tagLists) {
    for (const tag of tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return counts;
}

/** Every tag id the plans mention that `tags.ts` does not define. */
export function findUnknownTags(
  tables: Record<string, RetagPlan>[],
  knownIds: string[]
): string[] {
  const known = new Set(knownIds);
  const unknown = new Set<string>();
  for (const table of tables) {
    for (const plan of Object.values(table)) {
      for (const tag of [...plan.add, ...plan.remove]) {
        if (!known.has(tag)) unknown.add(tag);
      }
    }
  }
  return [...unknown];
}

const tagNames = new Map(topicTags.map((tag) => [tag.id, tag.name]));

function describeTags(tags: string[]): string {
  return tags.map((tag) => tagNames.get(tag) ?? tag).join("、");
}

function diffLine(change: RetagChange): string {
  const added = change.after.filter((tag) => !change.before.includes(tag));
  const removed = change.before.filter((tag) => !change.after.includes(tag));
  return [
    added.length ? `+${describeTags(added)}` : "",
    removed.length ? `-${describeTags(removed)}` : ""
  ]
    .filter(Boolean)
    .join("  ");
}

/** Pads to a terminal width, counting a CJK character as two columns. */
function padDisplay(text: string, width: number): string {
  const used = [...text].reduce(
    (sum, char) => sum + (char.charCodeAt(0) > 0xff ? 2 : 1),
    0
  );
  return text + " ".repeat(Math.max(1, width - used));
}

interface Store<T> {
  updatedAt?: string;
  records?: T[];
}

interface SignalRecord extends TaggedRecord {
  status: string;
  title: { original: string; zh?: string };
}

function main() {
  const apply = process.argv.slice(3).includes("--apply");
  const unknown = findUnknownTags(
    [signalRetags, skillRetags, knowledgeRetags],
    topicTags.map((tag) => tag.id)
  );
  if (unknown.length > 0) {
    throw new Error(`映射表里有 tags.ts 没定义的标签：${unknown.join(", ")}`);
  }

  // Signals.
  const signalPath = getLocalStoreFilePath("technology-workspace.json");
  const signalStore = readLocalJsonFile<Store<SignalRecord>>(signalPath, {});
  const signals = signalStore.records ?? [];
  const signalPlan = planRetag(signals, signalRetags);

  console.log(`信号：${signalPlan.changes.length} 条要改`);
  for (const change of signalPlan.changes) {
    const record = signals.find((item) => item.id === change.id);
    const title = record?.title.zh || record?.title.original || change.id;
    console.log(`  ${title.slice(0, 36)}  ${diffLine(change)}`);
  }
  for (const id of signalPlan.missing) {
    console.log(`  不在存储里，跳过：${id}`);
  }

  const published = (records: SignalRecord[]) =>
    records.filter((record) => record.status === "published");
  const before = countTags(published(signals).map((record) => record.tags));
  const after = countTags(
    published(signalPlan.next).map((record) => record.tags)
  );
  const total = published(signals).length;
  console.log(`\n已发布信号 ${total} 条，各话题条数（改前 → 改后）：`);
  const rows = topicTags
    .map((tag) => ({
      tag,
      from: before.get(tag.id) ?? 0,
      to: after.get(tag.id) ?? 0
    }))
    .sort((left, right) => right.to - left.to);
  for (const { tag, from, to } of rows) {
    const share = total ? Math.round((to / total) * 100) : 0;
    console.log(
      `  ${padDisplay(tag.name, 20)}${String(from).padStart(3)} → ${String(to).padStart(3)}（${share}%）  ${tag.id}`
    );
  }

  // Skills and knowledge.
  const content = [
    {
      label: "技能",
      file: "skill-workspace.json",
      plans: skillRetags,
      seeds: skillItems as TaggedRecord[],
      update: (id: string, tags: string[]) =>
        updateSkillWorkspaceRecord(id, { tags })
    },
    {
      label: "知识",
      file: "knowledge-workspace.json",
      plans: knowledgeRetags,
      seeds: knowledgeItems as TaggedRecord[],
      update: (id: string, tags: string[]) =>
        updateKnowledgeWorkspaceRecord(id, { tags })
    }
  ].map((kind) => {
    const filePath = getLocalStoreFilePath(kind.file);
    const store = readLocalJsonFile<Store<TaggedRecord>>(filePath, {});
    const plan = planRetag(store.records ?? [], kind.plans);
    const fromSeed = plan.missing.flatMap((id) => {
      const seed = kind.seeds.find((item) => item.id === id);
      if (!seed) return [];
      const tags = applyRetag(seed.tags, kind.plans[id]);
      return tags.join("|") === seed.tags.join("|") ? [] : [{ id, tags }];
    });
    const notFound = plan.missing.filter(
      (id) => !kind.seeds.some((item) => item.id === id)
    );

    console.log(
      `\n${kind.label}：${plan.changes.length + fromSeed.length} 条要改`
    );
    for (const change of plan.changes) {
      console.log(`  ${change.id}  ${diffLine(change)}`);
    }
    for (const { id, tags } of fromSeed) {
      console.log(`  ${id}（内置种子，复制进工作台）  → ${describeTags(tags)}`);
    }
    for (const id of notFound) console.log(`  找不到，跳过：${id}`);

    return { kind, filePath, store, plan, fromSeed };
  });

  const pending =
    signalPlan.changes.length +
    content.reduce(
      (sum, item) => sum + item.plan.changes.length + item.fromSeed.length,
      0
    );

  if (pending === 0) {
    console.log("\n没有需要改的标签。");
    return;
  }
  if (!apply) {
    console.log(`\n预览：共 ${pending} 条待改。加 --apply 写入。`);
    return;
  }

  const now = new Date().toISOString();
  if (signalPlan.changes.length > 0) {
    writeLocalJsonFile(signalPath, {
      ...signalStore,
      updatedAt: now,
      records: signalPlan.next
    });
  }
  for (const { kind, filePath, store, plan, fromSeed } of content) {
    if (plan.changes.length > 0) {
      writeLocalJsonFile(filePath, {
        ...store,
        updatedAt: now,
        records: plan.next
      });
    }
    for (const { id, tags } of fromSeed) kind.update(id, tags);
  }
  console.log(`\n已写入 ${pending} 条（${path.dirname(signalPath)}）。`);
}

// Runs only when launched by scripts/run-ts.cjs, not when a test imports it.
if (path.basename(process.argv[2] ?? "") === "retag-signals.ts") {
  main();
}
