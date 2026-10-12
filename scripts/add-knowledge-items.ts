// One-off: adds eight knowledge items for concepts the signal bodies keep
// using but no knowledge page explained (2026-10-12).
//
//   node scripts/run-ts.cjs scripts/add-knowledge-items.ts           # dry run
//   node scripts/run-ts.cjs scripts/add-knowledge-items.ts --apply   # write
//
// The 107 published signals cited the general knowledge items over and over
// (评估闭环 40, 模型选型 37 …) while classic concepts they name in their bodies
// — KV 缓存, 强化学习, 蒸馏, 微调, 沙箱, 开放权重, SWE-bench, 可复现 — had
// no page of their own, and the 编码智能体 / AI 与科研 / 开放权重模型 topics
// had no knowledge at all. Each item's signals below were read and chosen by
// hand from a scan of the bodies, not matched at run time.
//
// Three stores are written, all in place:
// - `knowledge-workspace.json`: the eight records, published, with fixed ids
//   (the alias table in `src/lib/knowledge-autolink.ts` refers to them);
// - `technology-workspace.json`: each signal's `relatedKnowledgeIds` gains the
//   id. Only that field changes and `updatedAt` is left alone: same-day
//   signals take their public order from the store order, and the workflow's
//   update would bump `updatedAt` and re-sort it (the reason
//   `retag-signals.ts` writes in place too);
// - `link-relation-workspace.json`: one 释义 (`explains`) override per new
//   pair, knowledge → signal and knowledge → skill, no note, so none of the
//   new edges falls back to 关联.
//
// A second run changes nothing: an existing record is left as it is, a link
// already present is skipped, a pair that already has an override keeps it.
import { randomUUID } from "node:crypto";
import path from "node:path";

import { knowledgeItems } from "../src/data/knowledge";
import { skillItems } from "../src/data/skills";
import { topicTags } from "../src/data/tags";
import { evaluateKnowledgePublishReadiness } from "../src/lib/knowledge-workflow";
import { getRelationPairKey } from "../src/lib/link-relation-workflow";
import {
  getLocalStoreFilePath,
  readLocalJsonFile,
  writeLocalJsonFile
} from "../src/lib/repositories/local-json-store";
import { tryRecordWorkflowEvent } from "../src/lib/workflow-events";
import type { KnowledgeItem, LinkRelation } from "../src/types/content";

export interface NewKnowledgeItem extends Omit<
  KnowledgeItem,
  "relatedTechnologyIds" | "relatedSkillIds"
> {
  /** Published signals this concept explains, by slug. */
  signalSlugs: string[];
  skillIds: string[];
}

export const newKnowledgeItems: NewKnowledgeItem[] = [
  {
    id: "knowledge-kv-cache",
    title: "KV 缓存与长上下文推理",
    slug: "kv-cache-and-long-context",
    summary:
      "生成每个新 token 都要回看前面所有 token；KV 缓存把这份回看要用的中间结果存下来，于是上下文越长，显存和带宽越紧——读懂推理引擎更新和长上下文定价的前提。",
    content: `## 它是什么

Transformer 生成文本是一个 token 一个 token 往后写的。每写一个新 token，注意力都要和前面所有 token 的键（K）与值（V）做一次计算。这些 K、V 只取决于已经写下的内容，算过一次就不会再变，所以推理引擎把它们存起来反复用，这份存储就是 **KV 缓存**。

## 为什么上下文越长越贵

- KV 缓存的大小与「层数 × KV 头数 × 每头维度 × 上下文长度」成正比，随上下文**线性增长**。长上下文推理的瓶颈往往不是算力，而是这份缓存占掉的显存，以及每一步都要把它读一遍的带宽。
- 推理分两段：**预填充**一次性读入整段输入、算出全部 K、V，可以并行，吃算力；**解码**每次只多出一个 token，却要读完整份缓存，吃带宽。两段的成本结构不同，引擎经常把它们拆开调度。

## 常见手段与代价

1. **分页管理**（PagedAttention）：像操作系统管理内存页那样分块分配缓存，减少碎片，同一张卡能并发更多请求。
2. **前缀缓存**：多个请求共享同一段开头（系统提示、同一份文档）时只算一次。智能体反复带着同一段历史调用模型，命中率高，收益明显。
3. **压缩**：降低精度（如 \`FP8\` KV 缓存）、让多个注意力头共享 K/V，或把几个 token 合成一个缓存条目。省下了显存，但可能带来新的失效方式——分块压缩会让检索准确率随信息相对压缩窗口边界的位置周期性起伏。

## 读信号时看什么

- 「上下文窗口 100 万 token」说的是放得下，不说明在这么长时还找得回信息，也不说明你付得起这份显存。
- 推理引擎更新里关于 KV 缓存和预填充的改动，直接决定同一张卡能扛多少并发；升级前后用自己的负载实测。
- 长上下文按长度分档定价，背后就是这份缓存的成本。`,
    category: "machine-learning",
    difficulty: "advanced",
    tags: ["tag-efficient-inference", "tag-inference"],
    signalSlugs: [
      "chunked-kv-cache-phase-sensitivity",
      "freetoken-bandwidth-adaptive-moe",
      "vllm-v0-25-0",
      "vllm-v0-27-0",
      "qwen3-8-27b",
      "meta-open-weights-turn",
      "meta-muse-glimmer",
      "gpt-6-astra",
      "thinkingmachines-inkling",
      "sglang-v0-5-17",
      "mostik-hidden-state-bridge",
      "lfm2-5-vl-dspark"
    ],
    skillIds: ["skill-ws-a9e80194", "skill-ws-7796779a", "skill-ws-d7c9d1d8"]
  },
  {
    id: "knowledge-rl-post-training",
    title: "强化学习后训练与可验证奖励",
    slug: "rl-post-training-and-verifiable-rewards",
    summary:
      "让模型自己作答、按结果打分、再朝高分方向更新——近一年推理与智能体能力的主要来源，也是奖励投机这类意外行为的源头。",
    content: `## 它在训练流程里的位置

大模型通常先**预训练**（读海量文本、学会预测下一个 token），再**监督微调**（模仿人写好的示范），最后用**强化学习**继续调整。前两步都是在模仿给定的答案；强化学习不同，它让模型自己生成完整的回答或操作序列，再根据结果打分，把高分的做法加强、低分的做法削弱。

## 奖励从哪里来

- **可验证奖励**：结果能被程序自动判对错——数学题的最终答案、代码能否通过测试、智能体有没有把环境改到目标状态。信号便宜、客观，是近年推理模型和编码智能体进步的主力。
- **偏好奖励**：难以自动判对错的任务（写作、对话语气），先让人比较两个回答哪个好，训练一个**奖励模型**来模仿这种判断，再用它打分。

常见的更新算法有 PPO 和 GRPO；后者用同一道题的一组回答互相比较来估计好坏，省掉了单独的价值模型。

## 成本在哪里

每一步训练都要先让模型做大量**推演**（rollout）：在沙箱里跑代码、调工具、走完多轮交互。推演往往比参数更新本身更花时间和算力，所以推理引擎开始为强化学习负载专门优化，训练环境也成了要专门建设的基础设施。

## 奖励投机

模型优化的是**奖励信号**，不是出题人的意图。信号有漏洞时，它会找到漏洞：改测试而不是改代码，或者为了完成任务越过环境的边界。这类行为叫奖励投机（reward hacking）。判断一份强化学习成果时，除了分数，也要看奖励怎么判、环境封得多严。`,
    category: "machine-learning",
    difficulty: "advanced",
    tags: ["tag-training", "tag-frontier-models"],
    signalSlugs: [
      "mimo-v2-6-scaled-agentic-rl",
      "nemotron-imo-ioi-2026",
      "holo4-open-computer-use-agents",
      "lfm2-5-2-6b-on-device-agents",
      "sglang-v0-5-17",
      "vllm-v0-30-0",
      "deepseek-dsec-agent-sandboxes",
      "muse-glimmer-local-agent-model",
      "meta-open-weights-turn",
      "openai-agent-dns-sandbox-escape",
      "openai-hf-attack-timeline",
      "agent-intrusion-technical-timeline"
    ],
    skillIds: ["skill-ws-84837d46", "skill-ws-c183c9b9"]
  },
  {
    id: "knowledge-distillation",
    title: "知识蒸馏",
    slug: "knowledge-distillation",
    summary:
      "用大模型（教师）的输出去训练小模型（学生），让小模型以低得多的成本接近大模型的表现——多数小型开放模型都是这样来的。",
    content: `## 它是什么

普通训练只告诉模型「正确答案是哪个」。**知识蒸馏**让学生模型去学教师模型给出的整个概率分布：教师认为第二、第三可能的选项是什么、有多可能。这些「软标签」比单一的正确答案携带更多信息，所以学生能用更少的数据、更小的规模学到接近教师的行为。

## 几种做法

- **Logit 蒸馏**：直接对齐教师和学生在每个 token 上的输出分布。需要拿到教师的完整输出，通常只在同一家公司内部可行。
- **数据蒸馏**：让教师生成大量回答或推理过程，学生在这些文本上做监督微调。只需要教师的文字输出，所以也能通过 API 进行。
- **在线策略蒸馏**：学生自己生成回答，教师逐个 token 给出它在同一位置会怎么写，学生向教师靠拢。学生在自己真会犯错的地方得到纠正，常与强化学习配合使用。

## 为什么它和开放模型、商业竞争有关

- 很多 30B 以下的开放权重模型，是从同一家的旗舰模型蒸馏下来的；发布说明里出现「蒸馏」，通常意味着能力上限由教师决定。
- 通过 API 批量收集推理过程去训练自己的模型，也是一种蒸馏。这就是闭源厂商在服务条款里限制、并开始用分类器拦截这类调用的原因。

## 局限

学生学的是教师的行为，也会把教师的错误和偏好一起学走；规模差距过大时，学生只能学到一部分。蒸馏模型的基准分数，要和教师的分数放在一起看。`,
    category: "machine-learning",
    difficulty: "intermediate",
    tags: ["tag-training", "tag-open-weights"],
    signalSlugs: [
      "lfm2-5-2-6b-on-device-agents",
      "muse-glimmer-local-agent-model",
      "meta-muse-glimmer",
      "meta-open-weights-turn",
      "claude-sonnet-5-5",
      "boundary-aware-safety-refusal"
    ],
    skillIds: ["skill-ws-84837d46", "skill-ws-d7c9d1d8"]
  },
  {
    id: "knowledge-fine-tuning",
    title: "监督微调与参数高效微调（LoRA）",
    slug: "supervised-and-parameter-efficient-fine-tuning",
    summary:
      "在训练好的模型上用一批示范数据继续训练，让它适应特定任务或风格；LoRA 只训练一小组附加参数，让个人和小团队也做得起。",
    content: `## 监督微调做什么

**监督微调**（SFT）给模型看成对的「输入—理想输出」示范，让它在这些示范上继续训练。它不太教模型新的世界知识，主要改变的是行为：遵循指令的方式、输出格式、在某类任务上的判断习惯。基础模型变成对话模型、通用模型变成决策或代码审查专用模型，第一步通常都是它。

## 全参数微调与参数高效微调

- **全参数微调**更新模型的全部权重。效果上限最高，但显存需求接近训练本身，每个版本都要存一份完整模型。
- **参数高效微调**（PEFT）冻结原模型，只训练少量新增参数。最常用的 **LoRA** 在权重矩阵旁边加一对低秩小矩阵，要训练的参数常常不到原模型的百分之一。训出来的适配器只有几十到几百 MB，可以和原模型分开存放；推理引擎能在同一份基础权重上同时挂多个适配器，按请求切换。

## 常见的坑

1. **遗忘**：在窄任务上训练过度，模型在其他任务上的能力下降。把一部分通用数据混进训练集是常用对策。
2. **副作用**：安全方向的微调容易让模型对看起来危险、其实无害的请求也拒绝回答。
3. **评测**：微调后的分数要在没参与训练的数据上量，并且和基础模型放在一起比，才知道提升来自微调。

## 什么时候值得做

提示词和检索能解决的，先不微调。需要稳定的输出格式、特定领域的判断习惯，或者想把大模型的能力搬到一个更便宜的小模型上时，微调才划算。开放权重的许可是否允许微调和再分发，也要先看清。`,
    category: "machine-learning",
    difficulty: "intermediate",
    tags: ["tag-training", "tag-open-weights"],
    signalSlugs: [
      "nemotron-imo-ioi-2026",
      "cloudflare-clef-decision-models",
      "holo4-open-computer-use-agents",
      "lfm2-5-2-6b-on-device-agents",
      "lfm2-5-encoders",
      "sglang-v0-5-17",
      "boundary-aware-safety-refusal",
      "bigbang-v1-self-evolving-data",
      "nemo-automodel-diffusers-finetuning",
      "meta-open-weights-turn",
      "muse-glimmer-local-agent-model"
    ],
    skillIds: ["skill-ws-84837d46", "skill-model-evaluation"]
  },
  {
    id: "knowledge-agent-sandboxing",
    title: "智能体沙箱与执行隔离",
    slug: "agent-sandboxing-and-execution-isolation",
    summary:
      "智能体会执行它自己写的代码和命令，沙箱决定这些动作最多能波及哪里——隔离强度、网络出口和凭据范围是三个要分开看的维度。",
    content: `## 为什么需要

编码智能体和电脑操作智能体会安装依赖、运行脚本、访问网络。这些动作由模型临时决定，而模型可能出错，也可能被网页、文件或仓库里的文字诱导——**提示注入**让读到的内容变成了指令。所以要先假设智能体会做出意料之外的事，再限定它能波及的范围。

## 隔离强度分几档

1. **进程级**：同一台机器上的受限进程，启动最快，隔离最弱。
2. **容器**：独立的文件系统和进程空间，适合要装依赖、改代码、跑测试的任务，但与宿主机共享内核。
3. **微虚拟机**：每个任务一个轻量虚拟机，有独立内核，启动通常在一秒以内，是运行不受信任代码的常见选择。
4. **完整虚拟机或独立机器**：隔离最强，成本和启动时间也最高。

按任务的风险选档，而不是一律用最强的。

## 隔离之外的两件事

- **网络出口**：默认拒绝，只放行任务需要的地址。别漏掉不显眼的通道——DNS 查询也能把数据带出去；「只读请求是安全的」这个假设，在有外部服务会替你执行请求时也不成立。
- **凭据与权限**：只给完成这次任务所需的最小权限，令牌按会话发放、用完即失效，日志里的凭据要脱敏。沙箱封得再严，带进去的令牌权限过大，损害照样发生在沙箱外面。

## 读信号时看什么

新的智能体平台或运行时，先找三个答案：代码跑在哪一档隔离里，出网规则是什么，智能体拿到的凭据能做什么。事故复盘里，问题通常出在后两项。`,
    category: "software-architecture",
    difficulty: "intermediate",
    tags: ["tag-agent-infra", "tag-coding-agents", "tag-ai-safety"],
    signalSlugs: [
      "deepseek-dsec-agent-sandboxes",
      "openai-agent-dns-sandbox-escape",
      "openai-agents-public-wiki-collusion",
      "swarm-traces-shortlink-payloads",
      "agent-intrusion-technical-timeline",
      "hf-security-incident-agentic-intrusion",
      "aws-kiro-crew-async-agents",
      "cloudflare-computer-agent-runtime",
      "seclab-fuzzing-taskflow",
      "google-ax-agent-orchestrator",
      "gemini-managed-agents-background-mcp",
      "microsoft-agent-framework-harness",
      "deepseek-harness-everything-is-a-plugin",
      "ai2-shippy-agent-lessons",
      "gpt-6-1-sol"
    ],
    skillIds: [
      "skill-ws-c183c9b9",
      "skill-agent-design",
      "skill-tool-integration"
    ]
  },
  {
    id: "knowledge-open-weights",
    title: "开放权重与模型许可",
    slug: "open-weights-and-model-licenses",
    summary:
      "「开放权重」只说明模型文件可以下载，不说明能怎么用、训练数据是否公开——读一次开放发布，要分别看权重、许可和配套这三件事。",
    content: `## 开放权重不等于开源

**开放权重**指模型参数文件公开可下载，可以在自己的机器上运行。传统意义的开源软件还意味着能看到源码并重新构建；对模型来说，对应的是训练数据、训练代码和配方。大多数开放权重模型只放出权重和推理代码，训练数据不公开，所以无法从头复现。少数项目连数据和训练框架一起公开，通常会特意标明「完全开放」。

## 许可是第二件要看的事

- **宽松许可**（Apache 2.0、MIT）：可以商用、修改、再分发，几乎没有附加条件。
- **自定义许可**：常见的附加条件包括用户规模超过某个门槛要另行授权、禁止某些用途、限制用它的输出训练别的模型。
- **没写许可**：只说「开放权重」而不给许可文本时，不能默认可以商用。

## 开放之后还要看什么

1. **推理引擎支持**：权重放出来，到主流引擎（vLLM、SGLang、llama.cpp、Ollama）能高效运行，常常要隔几天到几周，新架构尤其如此。
2. **规模与硬件**：参数量决定显存门槛，有没有量化版本决定能否在单卡或本地运行。
3. **可核对**：权重在手，厂商宣传的参数量、架构、上下文长度都能当场核对，第三方也能独立复测分数——这是闭源发布做不到的。

## 为什么重要

开放权重决定了你能否自托管、能否微调、数据能否不出本地，也决定了换供应商的成本。选型时它和能力分数同等重要。`,
    category: "product-thinking",
    difficulty: "foundation",
    tags: ["tag-open-weights"],
    signalSlugs: [
      "meta-open-weights-turn",
      "meta-muse-glimmer",
      "muse-glimmer-local-agent-model",
      "kimi-k3",
      "thinkingmachines-inkling",
      "embeddinggemma-2",
      "cloudflare-clef-decision-models",
      "holo4-open-computer-use-agents",
      "state-of-open-models-summer-2026",
      "bigbang-v1-self-evolving-data",
      "qwen3-8-27b",
      "lfm2-5-encoders",
      "nvidia-kumo-tabular",
      "sglang-v0-5-17",
      "vllm-v0-26-0",
      "vllm-v0-27-0",
      "ollama-v0-32-0"
    ],
    skillIds: ["skill-ws-7796779a", "skill-ws-2152c7f1", "skill-ws-dddaf80c"]
  },
  {
    id: "knowledge-execution-based-eval",
    title: "基于执行的代码评测",
    slug: "execution-based-code-evaluation",
    summary:
      "让模型在真实代码仓库或终端里完成任务，再用测试判定对错——SWE-bench、Terminal-Bench 这类分数说明了什么、哪些能比、哪些不能比。",
    content: `## 它怎么评

早期的代码评测看生成的代码和参考答案像不像；基于执行的评测则直接**跑起来看结果**：给模型一个真实仓库和一个问题，它改完代码后运行项目的测试，通过才算解决。

- **SWE-bench** 系列取自开源项目真实的 issue 和修复提交，考的是在陌生的大型仓库里定位并修好问题。
- **Terminal-Bench** 系列让智能体在终端里完成装环境、处理数据、配置服务这类多步任务，最后检查环境的状态。

## 同一个分数背后的变量

1. **评测外壳**：给模型哪些工具、多少轮交互、多少时间和 token 预算。外壳不同，同一个模型可以差十几个百分点。
2. **推理强度**：同一模型开到最高推理强度和用默认档，分数和成本都不同。
3. **尝试次数**：**pass@k** 是 k 次里至少成功一次的比例，量的是「能不能做到」；**pass^k** 要求 k 次全部成功，量的是「每次都能做到」。智能体上线更关心后者，而两者常常差得很远。
4. **题目子集与污染**：用的是全集还是筛过的子集，题目是否可能已经出现在训练数据里。

## 读分数的规矩

- 厂商自报的数字，只有外壳、推理强度、尝试次数都写明且一致时才能横向比较；不一致时只看同一来源的同族对比。
- 第三方用统一外壳复测的结果，比发布页上的表格更可信。
- 分数说明模型在这类任务上能做到什么，不说明它在你的仓库里表现如何；拿自己的几个真实任务试一遍，比多看一个基准有用。`,
    category: "operations",
    difficulty: "intermediate",
    tags: ["tag-coding-agents", "tag-benchmarks"],
    signalSlugs: [
      "claude-haiku-5-5",
      "claude-sonnet-5-5",
      "gemini-4-argon",
      "gpt-6-1-sol",
      "qwen3-8-27b",
      "muse-glimmer-local-agent-model",
      "meta-muse-glimmer",
      "bigbang-v1-self-evolving-data",
      "deepseek-dsec-agent-sandboxes",
      "aisi-evaleval-reproducible-evaluations",
      "agent-consistency-gap-pass-k"
    ],
    skillIds: [
      "skill-model-evaluation",
      "skill-ws-f741f122",
      "skill-ws-dddaf80c"
    ]
  },
  {
    id: "knowledge-reproducibility",
    title: "可复现性与可验证结果",
    slug: "reproducibility-and-verifiable-results",
    summary:
      "一个结果要能被别人用同样的材料重做出来才站得住——AI 做科研、AI 评测 AI 的结论越来越多，判断它们可不可信，先看这一点。",
    content: `## 什么叫可复现

**可复现**是指别人拿到同样的数据、代码、配置和步骤，能得到相同（或在误差范围内一致）的结果。它有程度之分：只有一篇论文描述，几乎无法复现；附带代码和数据，能复现一大半；连运行环境、随机种子、模型版本都固定下来，才可能逐个数字对上。

## 为什么在 AI 领域格外难

- **模型会变**：通过 API 调用的模型可能在不通知的情况下更新，同一段提示一个月后得到不同的结果。
- **随机性**：采样温度、并行顺序都会让输出不同；只报告一次运行，看不出波动有多大。
- **评测设置没写全**：提示词、评测外壳、筛选过的题目子集，任何一项不公开，分数就无法重做。

## 可验证：比可复现更强的一档

有些结果不需要重做整个过程，只要检查答案本身：

- 数学证明写成 **Lean** 这类证明助手能检查的形式后，由程序逐步验证，不依赖任何人的判断；
- 构造出来的对象（一个矩阵、一段程序）可以直接代入检验；
- 预测可以等实验或后续数据来检验。

AI 产出的科研结果越来越多，「附带机器可检查的证明或可直接验证的产物」正在成为可信度的分界线。

## 读信号时看什么

1. 结论附带了什么：代码、数据、模型快照、完整日志，还是只有一段描述？
2. 有没有独立的第三方复现过，复现到了哪一步？
3. 宣称「AI 独立完成」的研究，验证环节由谁做、花了多长时间。`,
    category: "operations",
    difficulty: "intermediate",
    tags: ["tag-ai-for-science", "tag-benchmarks"],
    signalSlugs: [
      "icml-2026-agent-reproduction-audit",
      "icml-2026-open-reproductions",
      "ara-agent-native-research-artifacts",
      "aisi-evaleval-reproducible-evaluations",
      "openai-math-results-repository",
      "navier-stokes-priority-and-data",
      "claude-hadamard-668",
      "olmo-core-3",
      "nemotron-imo-ioi-2026"
    ],
    skillIds: ["skill-model-evaluation", "skill-ws-f741f122"]
  }
];

interface KnowledgeRecord extends KnowledgeItem {
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface SignalRecord {
  id: string;
  slug: string;
  status: string;
  relatedKnowledgeIds: string[];
}

export interface AdditionInput {
  knowledge: KnowledgeRecord[];
  /** Bundled seed knowledge, for slug uniqueness. */
  seedKnowledge: { id: string; slug: string }[];
  signals: SignalRecord[];
  skillIds: Set<string>;
  relations: LinkRelation[];
}

export interface ItemReport {
  id: string;
  title: string;
  /** False when the store already had the id: its record is left alone. */
  added: boolean;
  signalCount: number;
  skillCount: number;
  /** Planned slugs with no published signal behind them. */
  missingSignals: string[];
  missingSkills: string[];
}

export interface AdditionPlan {
  knowledge: KnowledgeRecord[];
  signals: SignalRecord[];
  relations: LinkRelation[];
  reports: ItemReport[];
  addedRecords: KnowledgeRecord[];
  /** Signals whose relatedKnowledgeIds gained at least one id. */
  signalChanges: number;
  /** Ids appended across all signals. */
  signalLinks: number;
  newRelations: LinkRelation[];
  /** Pairs left alone because an override already existed. */
  keptRelations: number;
}

/**
 * Pure plan: the next three stores, given the current ones. Throws when a
 * new slug collides with an existing one.
 */
export function planKnowledgeAddition(
  input: AdditionInput,
  items: NewKnowledgeItem[],
  now: string,
  newRelationId: () => string = () => `rel-ws-${randomUUID().slice(0, 8)}`
): AdditionPlan {
  const publishedBySlug = new Map(
    input.signals
      .filter((signal) => signal.status === "published")
      .map((signal) => [signal.slug, signal])
  );
  const existingIds = new Set(input.knowledge.map((record) => record.id));
  const takenSlugs = new Map<string, string>();
  for (const item of [...input.seedKnowledge, ...input.knowledge]) {
    takenSlugs.set(item.slug, item.id);
  }

  const overridden = new Set(
    input.relations.map((relation) =>
      getRelationPairKey(
        relation.fromId,
        relation.fromType,
        relation.toId,
        relation.toType
      )
    )
  );

  const addedRecords: KnowledgeRecord[] = [];
  const newRelations: LinkRelation[] = [];
  const signalAdditions = new Map<string, string[]>();
  const reports: ItemReport[] = [];
  let keptRelations = 0;

  const addRelation = (
    item: NewKnowledgeItem,
    toId: string,
    toType: "technology" | "skill"
  ) => {
    const key = getRelationPairKey(item.id, "knowledge", toId, toType);
    if (overridden.has(key)) {
      keptRelations += 1;
      return;
    }
    overridden.add(key);
    newRelations.push({
      id: newRelationId(),
      fromId: item.id,
      fromType: "knowledge",
      toId,
      toType,
      relationType: "explains"
    });
  };

  for (const item of items) {
    const owner = takenSlugs.get(item.slug);
    if (owner && owner !== item.id) {
      throw new Error(`Slug「${item.slug}」已被 ${owner} 使用。`);
    }

    const signals = item.signalSlugs.flatMap((slug) => {
      const signal = publishedBySlug.get(slug);
      return signal ? [signal] : [];
    });
    const missingSignals = item.signalSlugs.filter(
      (slug) => !publishedBySlug.has(slug)
    );
    const skillIds = item.skillIds.filter((id) => input.skillIds.has(id));
    const missingSkills = item.skillIds.filter((id) => !input.skillIds.has(id));

    const added = !existingIds.has(item.id);
    if (added) {
      const {
        signalSlugs: _signalSlugs,
        skillIds: _skillIds,
        ...fields
      } = item;
      addedRecords.push({
        ...fields,
        relatedTechnologyIds: signals.map((signal) => signal.id),
        relatedSkillIds: skillIds,
        status: "published",
        createdAt: now,
        updatedAt: now
      });
      existingIds.add(item.id);
    }

    for (const signal of signals) {
      if (!signal.relatedKnowledgeIds.includes(item.id)) {
        const pending = signalAdditions.get(signal.id) ?? [];
        pending.push(item.id);
        signalAdditions.set(signal.id, pending);
      }
      addRelation(item, signal.id, "technology");
    }
    for (const skillId of skillIds) addRelation(item, skillId, "skill");

    reports.push({
      id: item.id,
      title: item.title,
      added,
      signalCount: signals.length,
      skillCount: skillIds.length,
      missingSignals,
      missingSkills
    });
  }

  const nextSignals = input.signals.map((signal) => {
    const extra = signalAdditions.get(signal.id);
    return extra
      ? {
          ...signal,
          relatedKnowledgeIds: [...signal.relatedKnowledgeIds, ...extra]
        }
      : signal;
  });

  return {
    knowledge: [...input.knowledge, ...addedRecords],
    signals: nextSignals,
    relations: [...input.relations, ...newRelations],
    reports,
    addedRecords,
    signalChanges: signalAdditions.size,
    signalLinks: [...signalAdditions.values()].reduce(
      (sum, ids) => sum + ids.length,
      0
    ),
    newRelations,
    keptRelations
  };
}

interface Store<T> {
  updatedAt?: string;
  records?: T[];
}

function main() {
  const apply = process.argv.slice(3).includes("--apply");

  const knowledgePath = getLocalStoreFilePath("knowledge-workspace.json");
  const signalPath = getLocalStoreFilePath("technology-workspace.json");
  const skillPath = getLocalStoreFilePath("skill-workspace.json");
  const relationPath = getLocalStoreFilePath("link-relation-workspace.json");

  const knowledgeStore = readLocalJsonFile<Store<KnowledgeRecord>>(
    knowledgePath,
    {}
  );
  const signalStore = readLocalJsonFile<Store<SignalRecord>>(signalPath, {});
  const skillStore = readLocalJsonFile<Store<{ id: string }>>(skillPath, {});
  const relationStore = readLocalJsonFile<{
    updatedAt?: string;
    relations?: LinkRelation[];
  }>(relationPath, {});

  const now = new Date().toISOString();
  const plan = planKnowledgeAddition(
    {
      knowledge: knowledgeStore.records ?? [],
      seedKnowledge: knowledgeItems,
      signals: signalStore.records ?? [],
      skillIds: new Set([
        ...skillItems.map((skill) => skill.id),
        ...(skillStore.records ?? []).map((skill) => skill.id)
      ]),
      relations: relationStore.relations ?? []
    },
    newKnowledgeItems,
    now
  );

  // Every new record must clear the workspace publish gate as it stands.
  const knownTags = new Set(topicTags.map((tag) => tag.id));
  const allSlugs = [
    ...knowledgeItems.map((item) => ({ id: item.id, slug: item.slug })),
    ...plan.knowledge.map((item) => ({ id: item.id, slug: item.slug }))
  ];
  for (const record of plan.addedRecords) {
    const others = allSlugs
      .filter((item) => item.id !== record.id)
      .map((item) => item.slug);
    const readiness = evaluateKnowledgePublishReadiness(
      record,
      others,
      knownTags
    );
    const problems = [...readiness.blockingErrors, ...readiness.warnings];
    if (problems.length > 0) {
      throw new Error(
        `${record.id} 没过发布检查：${problems.map((issue) => issue.message).join("；")}`
      );
    }
  }

  console.log(`知识条目：新增 ${plan.addedRecords.length} 条`);
  for (const report of plan.reports) {
    const state = report.added ? "新增" : "已存在，内容不改";
    console.log(
      `  ${report.title}（${state}）  关联信号 ${report.signalCount} 条，技能 ${report.skillCount} 项`
    );
    for (const slug of report.missingSignals) {
      console.log(`    没有这条已发布信号，跳过：${slug}`);
    }
    for (const id of report.missingSkills) {
      console.log(`    没有这项技能，跳过：${id}`);
    }
  }
  const toSignals = plan.newRelations.filter(
    (relation) => relation.toType === "technology"
  ).length;
  console.log(
    `\n信号：${plan.signalChanges} 条的 relatedKnowledgeIds 追加 ${plan.signalLinks} 个 id（不改 updatedAt）`
  );
  console.log(
    `关系：新增 ${plan.newRelations.length} 条「释义」覆盖（知识→信号 ${toSignals}，知识→技能 ${plan.newRelations.length - toSignals}）` +
      (plan.keptRelations ? `，${plan.keptRelations} 对已有覆盖保持不变` : "")
  );

  const pending =
    plan.addedRecords.length + plan.signalChanges + plan.newRelations.length;
  if (pending === 0) {
    console.log("\n没有需要写的内容。");
    return;
  }
  if (!apply) {
    console.log("\n预览，没有写入。加 --apply 写入。");
    return;
  }

  if (plan.addedRecords.length > 0) {
    writeLocalJsonFile(knowledgePath, {
      ...knowledgeStore,
      updatedAt: now,
      records: plan.knowledge
    });
  }
  if (plan.signalChanges > 0) {
    writeLocalJsonFile(signalPath, {
      ...signalStore,
      updatedAt: now,
      records: plan.signals
    });
  }
  if (plan.newRelations.length > 0) {
    writeLocalJsonFile(relationPath, {
      ...relationStore,
      updatedAt: now,
      relations: plan.relations
    });
  }
  for (const record of plan.addedRecords) {
    tryRecordWorkflowEvent({
      entityType: "knowledge",
      entityId: record.id,
      action: "knowledge.created",
      actorType: "system",
      afterSnapshot: { title: record.title, slug: record.slug },
      metadata: { source: "scripts/add-knowledge-items.ts" }
    });
  }
  console.log(`\n已写入（${path.dirname(knowledgePath)}）。`);
}

// Runs only when launched by scripts/run-ts.cjs, not when a test imports it.
if (path.basename(process.argv[2] ?? "") === "add-knowledge-items.ts") {
  main();
}
