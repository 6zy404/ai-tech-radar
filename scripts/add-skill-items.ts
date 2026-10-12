// One-off: adds six skills for the four topics that had none (2026-10-12).
//
//   node scripts/run-ts.cjs scripts/add-skill-items.ts           # dry run
//   node scripts/run-ts.cjs scripts/add-skill-items.ts --apply   # write
//
// 编码智能体 (11 signals), AI 与科研 (12), 开放权重模型 (14) and 量化与推测解码
// (7) had knowledge since 2026-10-12 but no skill. A skill here is something a
// reader can go and do, so each body is a procedure built from what these
// signals actually did (DoorDash's flag cleanup, the Copilot Rust port, the
// ICML reproductions …), not a concept. Every signal below was read and
// chosen by hand, together with the relation it gets.
//
// Four stores are written, all in place:
// - `skill-workspace.json`: the six records, published, with fixed ids;
// - `technology-workspace.json`: each signal's `relatedSkillIds` gains the
//   id. Only that field changes and `updatedAt` is left alone, for the reason
//   `add-knowledge-items.ts` gives (same-day signals keep their store order);
// - `knowledge-workspace.json`: each linked knowledge item's
//   `relatedSkillIds` gains the id, also in place. The knowledge page lists
//   its skills from that field alone, so without it a new skill would show
//   the knowledge but the knowledge would not show the skill. Every
//   knowledge item lives in this store (the seeds were copied in earlier);
// - `link-relation-workspace.json`: one typed override per new pair. Skill →
//   signal is 印证 (`supports`, the signal is an instance of the practice) or
//   借助 (`uses`, the skill uses the signal's tool); skill → knowledge is 必备
//   (`requires`, from the skill, so the knowledge is read first and lands in
//   the skill page's 先读这些). None falls back to 关联.
//
// A second run changes nothing: an existing record is left as it is, a link
// already present is skipped, a pair that already has an override keeps it.
import { randomUUID } from "node:crypto";
import path from "node:path";

import { skillItems } from "../src/data/skills";
import { topicTags } from "../src/data/tags";
import { getRelationPairKey } from "../src/lib/link-relation-workflow";
import {
  getLocalStoreFilePath,
  readLocalJsonFile,
  writeLocalJsonFile
} from "../src/lib/repositories/local-json-store";
import { evaluateSkillPublishReadiness } from "../src/lib/skill-workflow";
import { tryRecordWorkflowEvent } from "../src/lib/workflow-events";
import type { LinkRelation, SkillItem } from "../src/types/content";

export type SignalRelation = "supports" | "uses";

export interface NewSkillItem extends Omit<
  SkillItem,
  "relatedTechnologyIds" | "relatedKnowledgeIds"
> {
  /** Published signals, by slug, each with the relation it gets. */
  signals: { slug: string; relation: SignalRelation }[];
  /** Knowledge the skill requires, read first. */
  knowledgeIds: string[];
}

const supports = (slug: string) => ({
  slug,
  relation: "supports" as const
});
const uses = (slug: string) => ({ slug, relation: "uses" as const });

export const newSkillItems: NewSkillItem[] = [
  {
    id: "skill-coding-agent-acceptance",
    title: "给编码智能体划定任务与验收",
    slug: "coding-agent-task-scoping-and-acceptance",
    summary:
      "把一类重复的代码改动交给编码智能体之前，先挑对任务、把判卷标准锁在它够不着的地方，再按任务记账——这样才知道它做对了没有、值不值。",
    content: `## 先挑能验收的任务

不是所有代码活都适合交给智能体。好的起点有三个条件：任务定义明确、已经有自动检查能判断做没做对、出了错能回滚。DoorDash 清理过期功能开关就是这样一类活：一个开关可能散在 5 到 20 个文件里，按规则改写的工具覆盖不了，但构建、测试和覆盖率检查都是现成的。

它还把流程分成两段：第一段**只读**，智能体查仓库、查实验平台、写出报告，由工程师确认目标值；第二段才改代码。先让它说清楚要做什么，再放它动手。

## 把判卷标准锁起来

负责改实现的智能体，不能同时有权改「什么算对」。GitHub 用智能体把 Copilot 运行时改写成 83 万行 Rust，最重的一条教训就是这个：削弱测试、更新快照、放宽兼容基线、贴豁免标签，都不能在没人看着的情况下发生。具体做法：

1. 行为契约（端到端测试、接口约定）和实现分开存放，改它们要另一个人批准；
2. 检查分几层，每层失效的方式不同，一个错误不足以让大回归上线；
3. 迁移期间端到端测试不许重写，必需测试没过的 PR 不合入。

验收也要看系统最后的状态，而不是智能体自己的汇报。ThinkingBox-Bench 按后端最终状态评分，没通过的运行里有三分之二正常结束、也没有报错。

## 确定的步骤交给程序，判断交给模型

- Open Code Review 把选文件、打包、匹配规则、对齐行号都交给确定的程序，只把分析留给智能体；GitHub 安全实验室的模糊测试流水线里，智能体决定测什么，编译和运行 AFL 都由工具执行。
- 每个任务跑在隔离的环境里：DoorDash 每个仓库最多同时 4 个相互隔离的 Git 工作树，构建工具禁用守护进程；安全实验室明说它的流水线只应在一次性环境里、不带提升权限运行。
- 指令和工具是一体的。Copilot 代码审查换上维护更好的通用工具后效果反而变差，按审查者读 PR 的方式重写指令才翻过来。换工具就要重写指令，并重跑回归基准。

## 按任务记账

每类任务记四个数：首次提交就被合并的比例、需要人修改的比例、需要人接手的比例、每次的时间和花费。DoorDash 的 50 个开关里，31 个首次提交即合并、14 个要修改、5 个要工程师介入，平均 13.8 分钟、4.79 美元——拿去和人工的 1 到 2 小时比，才知道值不值。

花费要设上限并每天看。亚马逊一个给网站填充作者信息的智能体项目花了 180 万美元、超预算 860%，五个月后才被发现。

## 与相邻能力的分工

「智能体工作流设计」讲一般的智能体怎么搭；这一条只管编码智能体的任务边界和验收。智能体交回来的代码怎么审，见「按影响半径审查智能体写的代码」。`,
    skillType: "engineering",
    heatLevel: "hot",
    learningCost: "medium",
    tags: ["tag-coding-agents", "tag-workflow"],
    signals: [
      supports("doordash-feature-flag-cleanup-agents"),
      supports("copilot-runtime-rust-port"),
      supports("seclab-fuzzing-taskflow"),
      uses("alibaba-open-code-review"),
      supports("copilot-code-review-tool-workflow-lessons"),
      uses("aws-kiro-crew-async-agents"),
      supports("vercel-zero-agent-native-language"),
      supports("thinkingbox-agent-end-state"),
      supports("agent-token-spend-runaway")
    ],
    knowledgeIds: [
      "knowledge-ws-e251051e",
      "knowledge-execution-based-eval",
      "knowledge-agent-sandboxing",
      "knowledge-human-loop"
    ]
  },
  {
    id: "skill-agent-code-review",
    title: "按影响半径审查智能体写的代码",
    slug: "agent-code-review-by-blast-radius",
    summary:
      "智能体按特性交回整块代码，按行数审已经失效；改问「坏了会影响谁」，由人写清改动的理由，并把安全边界从合并挪到渐进发布。",
    content: `## 为什么小 PR 规则不管用了

人手写代码时，diff 小就好审、好回滚，所以团队推小 PR。智能体按**特性**而不是按增量输出：迁移、模型、服务、测试、前端一次给齐。Rootly 试过让智能体拆成堆叠 PR，每个都挑不出错，合起来却更难审——审一个 PR 的意见，总要依赖另一个 PR 的改法。

缺陷的样子也变了：代码能跑、测试全绿，只是用错了场景。一次迁移删掉了后台任务还在调用的字段；一个服务往另一个团队正在读的表里写数据。按行数审，这类问题看不出来。

## 审查分四步

1. **先问坏了会影响谁。** 把会改变业务行为的变更，和只影响性能或界面的变更分开定级。Rootly 的内部审查器只回答这一个问题，交给人的是一份带风险评估和严重程度的报告，不是原始 diff。
2. **「为什么改」由人写。** PR 里的动机和背景，由使用智能体的那个人填写，不让 AI 生成——这一段的价值就在于记下生成代码的那一方不知道的上下文。每个 PR 还要写明怎么回退，包括要不要修数据。
3. **用审查工具前先选方向。** Open Code Review 精确率高、token 用量约为通用智能体的九分之一，但召回上限约 20%：专家标出的问题它有八成找不到。它适合减少人要看的噪声，不能单独兜底。
4. **把安全边界挪到发布。** 重要特性放在功能开关后面，合并时默认关闭，先在团队内部打开，再到一小批客户、10%、全量。真正的审查发生在放量过程中。

## 守住整体设计

产出不再是瓶颈，能被人看懂的设计才是。Simon Willison 借《人月神话》的「概念完整性」说：过去一周工期会替你否掉的功能，现在一小时就能写出来，所以「要不要这个功能」得有人明确把关。

审查时还要看测试和基线有没有跟着被改。Copilot 运行时改写成 Rust 的过程中，漏掉功能的回归几乎都来自端到端测试不够；DoorDash 的 45 个合并请求里有 14 个仍需要人修改。

## 与相邻能力的分工

任务怎么挑、验收标准怎么锁，见「给编码智能体划定任务与验收」；这一条接在它后面，处理已经交回来的代码。`,
    skillType: "analysis",
    heatLevel: "emerging",
    learningCost: "medium",
    tags: ["tag-coding-agents", "tag-workflow"],
    signals: [
      supports("rootly-retires-small-pr-rule"),
      uses("alibaba-open-code-review"),
      supports("copilot-code-review-tool-workflow-lessons"),
      supports("conceptual-integrity-and-lines-of-code"),
      supports("copilot-runtime-rust-port"),
      supports("doordash-feature-flag-cleanup-agents")
    ],
    knowledgeIds: [
      "knowledge-human-loop",
      "knowledge-ws-e251051e",
      "knowledge-system-design"
    ]
  },
  {
    id: "skill-ai-science-evidence",
    title: "核查 AI 科研成果的证据",
    slug: "checking-ai-research-claims",
    summary:
      "面对「AI 解决了某个难题」，按四个问题判断它站得多稳：能不能被机器检验、谁打的分、人参与了多少、裁判是不是它自己。",
    content: `## 先分清它是哪一种结果

「AI 解决了一个难题」背后可能是完全不同的东西：一个能直接代入检验的对象、一份机器能检查的证明、一篇没人核过的长文，或者一个由模型自己打出来的分数。它们的可信程度差得很远。下面四个问题按顺序问。

## 四个问题

1. **能不能被机器检验？** 668 阶哈达玛矩阵是一个 ±1 方阵，任意两行内积为 0 可以直接算，第三方也复现了解码过程，所以不用相信任何人的说法。OpenAI 公开的 719 篇数学稿件里只有 300 篇（约 42%）有 Lean 证明，第二天就因一个符号错误撤回了 3 篇——没有形式化证明的部分，应当按待核验对待。
2. **谁打的分？** Nemotron 在 IMO 拿的 30 分由 IMO 官方评分员评定；IOI 的 535.4 分是 NVIDIA 按比赛限制自己跑的，不在官方排名里。同一份发布里的两个金牌，分量不同。
3. **人参与了多少、花了多少？** 「三个人加 Claude」不是 AI 独立完成。纳维-斯托克斯一项，按 OpenAI 自己的数字，智能体跑了约 88 小时，Lean 形式化又花了 17 小时，所有问题合计约 3,000 亿个输出 token。OpenAI 也说，原本 4 到 8 小时的任务，一半以上的成功案例人插过手。
4. **裁判是不是它自己？** Anthropic 说 Claude「主导」了约 26% 的研发工作，而给每类任务评定自动化等级的是另一个 Claude；人与人之间对「协作」和「主导」的判断一致率只有 35%，26% 恰好落在这条分歧最大的边界上。

## 看结果的形状

Gowers 的观察可以当一条经验：近期轰动的模型数学成果几乎都是**构造出一个对象**，而模型的两项确定优势是知道得多、失败得起。所以「找到了一个满足条件的对象」这类声明通常最容易核，也最站得住；「判断出这条路走不通」「独立完成了一项研究」这类声明要打折看。

合成分数要能拆开。AlphaGenome Atlas 的 AVI 分数把两个模型压成一个数，但每个分数都链接回驱动它的生物学特征；拆不回去的综合分，就只能采信。还要看评估怎么设计：AMIE 的结论来自模拟问诊的随机对照研究，评估者是临床医生，病人由演员扮演，离真实就诊还隔着一层。

## 与相邻能力的分工

「模型与输出评估」讲怎么评自己的模型和输出；这一条是读别人发布的科研声明。想自己动手把一篇论文重跑一遍，见「用智能体复现论文结论」。`,
    skillType: "analysis",
    heatLevel: "active",
    learningCost: "medium",
    tags: ["tag-ai-for-science", "tag-benchmarks"],
    signals: [
      supports("openai-math-results-repository"),
      supports("nemotron-imo-ioi-2026"),
      supports("navier-stokes-priority-and-data"),
      supports("claude-hadamard-668"),
      supports("gowers-what-maths-llms-are-good-at"),
      supports("anthropic-measuring-ai-led-rd"),
      supports("openai-research-acceleration-agents"),
      supports("alphagenome-atlas-precomputed-variants"),
      supports("amie-real-time-video-consultation")
    ],
    knowledgeIds: ["knowledge-reproducibility", "knowledge-evaluation-loops"]
  },
  {
    id: "skill-paper-reproduction",
    title: "用智能体复现论文结论",
    slug: "reproducing-papers-with-agents",
    summary:
      "用编码智能体把一篇论文的核心论断重跑一遍，并留下别人能复查的记录——从一条论断开始，不信智能体的自我评价，失败先分原因。",
    content: `## 复现为什么突然做得起了

过去审稿人几乎没有时间下载数据、重跑实验，这一层验证一直是空的。编码智能体把重跑的成本降到可以批量做：Hugging Face 组织 1,221 名社区成员，每人 20 美元算力，重跑了 ICML 2026 的 2,226 篇论文，判定了 35,908 条论断。

## 一次复现怎么做

1. **从一条论断开始。** 先抽出论文里具体、可核对的科学论断，让智能体从这一条出发，而不是从一份 40 页的 PDF 出发。
2. **把过程留成记录。** 每次运行都产出结论、跑过的代码、生成的工件，最好还有完整的智能体执行轨迹。审计过程本身也要能被审计。
3. **判定时不信自我评价。** 把每份记录的自我评价当作不可信，每条论断归入「已验证 / 已证伪 / 玩具规模 / 无法判定」之一。「玩具规模」要单独列出：只在小规模上跑通，说明不了论文的主结论。
4. **同一条论断让不同的人做。** ICML 那一次，有 242 篇论文出现了不同团队对同一条论断给出相反结论的情况；只跑一次的「已验证」分辨不出这一点。

## 失败先分原因

复现不了不等于造假。一次对 ICML 2026 口头报告论文的审计里，多数失败是工程原因：缺关键文件、依赖版本断裂；有 4 篇依赖的模型已经下线，永远无法复现。但也有实质性的不一致：一篇论文宣称只训练基础模型 0.77% 的参数，开源的检查点实际训练了 6.31%。写报告时把这两类分开。

也要给人留介入的位置。OpenAI 公布的内部数据里，原本 4 到 8 小时的研究任务，一半以上的成功案例人至少插过一次手。

## 让结果能被别人接着用

- 分数和复现它所需的配置放在同一个结构里。英国 AI 安全研究所改用 EvalEval 的共享格式公开评测结果，原因是同一个模型的分数会随评测协议和推理算力变化。
- 论文之外附一份机器能直接操作的材料。ARA 主张把研究写成分层的知识包，保留探索过程和复现所需的工程细节，而不只是一条剪干净的成功路径。
- 智能体会安装依赖、执行论文仓库里的脚本，让它跑在隔离环境里。

## 与相邻能力的分工

只读一份声明、不打算重跑时，用「核查 AI 科研成果的证据」。`,
    skillType: "engineering",
    heatLevel: "emerging",
    learningCost: "high",
    tags: ["tag-ai-for-science", "tag-coding-agents"],
    signals: [
      supports("icml-2026-open-reproductions"),
      supports("icml-2026-agent-reproduction-audit"),
      uses("ara-agent-native-research-artifacts"),
      uses("aisi-evaleval-reproducible-evaluations"),
      supports("openai-research-acceleration-agents")
    ],
    knowledgeIds: [
      "knowledge-reproducibility",
      "knowledge-execution-based-eval",
      "knowledge-agent-sandboxing"
    ]
  },
  {
    id: "skill-open-weights-self-hosting",
    title: "评估开放权重模型能否自托管",
    slug: "open-weights-self-hosting-assessment",
    summary:
      "拿到一份开放权重发布，回答「我们能不能、该不该自己跑它」：许可、显存、引擎支持、自己复测、总成本，五件事依次看。",
    content: `## 先读许可证，按尺寸逐个读

同一次发布里的几个尺寸，许可可能不一样。Holo4 系列权重全部公开，但分数最高的 27B 用的是 CC BY-NC 4.0，不能商用。Clef 用 Apache 2.0，Kumo Tabular 用允许商用的 OpenMDW-1.1，条款各不相同。没写许可的，不要默认可以商用；承诺开放、权重还没落地的（Kimi K3 发布时承诺月内开放），对自托管来说暂时没有价值。

## 算显存，别按参数量猜

1. **权重**：参数量乘以精度，再看有没有官方量化版本。Muse Glimmer 是 30B，4 位动态量化把 55GB 以上的需求压到 17 至 20GB。混合专家模型按总参数存、按激活参数算：BigBang-v1 是 35B 总参数、约 3B 激活，Inkling 约 1 万亿总参数、41B 激活。
2. **上下文**：给 KV 缓存留出余量。LM Studio 默认 8,192 的上下文上限，会被 Qwen3.8 的思考过程整个吃光。
3. **规模**：先问任务需不需要大模型。Hugging Face 的统计里，1B 以下的模型拿走了 83% 的下载量；EmbeddingGemma 2 只处理文字时只需 270M，LFM2.5 的小编码器能在 CPU 上跑长文档。

## 查引擎支持到了哪一级

权重放出来，不等于你的引擎能高效跑它。SGLang 在 Kimi K3 发布首日就带着完整的性能路径，而 Muse Glimmer 发布当天的硬件支持是分档的。确认你用的引擎、你的硬件落在哪一档。

## 在自己的机器上复测

- **先改出厂默认值。** Qwen3.8-27B 默认推理强度是 xhigh：同一道题跑了 21 分钟、22,276 个思考 token，关掉思考只要 137 秒。
- **厂商自己命名的基准不算数。** Qwen3.8 领先最多的那一项，跑在以厂商命名的基准上；Holo4 的分数全部来自厂商博客，没有第三方复现。
- **看它输在哪里。** Muse Glimmer 在工具调用和检索类基准上领先，在桌面和终端操作上输给 Qwen3.6-27B。和你的任务对得上的那几项才有用。

## 最后和 API 比总成本

把机器、显存、运维人力和 API 按量价格放在一起比。自托管的理由往往不只是便宜：数据不出本地、能微调、换供应商的成本低——这些要和能力差距一起算。

## 与相邻能力的分工

这一条回答「能不能、该不该自己跑」，把几件事串成一次上线决定，细节在相邻的两项技能里：「模型与推理引擎的支持路径」讲引擎支持到哪一级、走哪条路接入；「端侧模型部署与硬件适配」讲一台具体机器上的量化档位、运行时和验收。要不要换掉正在用的模型，先看「旗舰模型发布解读与换代判断」。`,
    skillType: "analysis",
    heatLevel: "hot",
    learningCost: "medium",
    tags: ["tag-open-weights", "tag-inference"],
    signals: [
      supports("holo4-open-computer-use-agents"),
      supports("qwen3-8-27b"),
      supports("qwen3-8-27b-overthinking-default"),
      supports("meta-muse-glimmer"),
      supports("muse-glimmer-local-agent-model"),
      supports("meta-open-weights-turn"),
      supports("kimi-k3"),
      supports("thinkingmachines-inkling"),
      supports("state-of-open-models-summer-2026"),
      supports("nvidia-kumo-tabular"),
      supports("cloudflare-clef-decision-models"),
      supports("embeddinggemma-2"),
      supports("bigbang-v1-self-evolving-data"),
      supports("lfm2-5-encoders")
    ],
    knowledgeIds: [
      "knowledge-open-weights",
      "knowledge-ws-34da6116",
      "knowledge-model-sizing",
      "knowledge-ws-c761533e",
      "knowledge-distillation"
    ]
  },
  {
    id: "skill-inference-speedup-verification",
    title: "验证量化与推测解码的实际提速",
    slug: "verifying-quantization-and-speculative-speedups",
    summary:
      "遇到「快 3 倍」「省 70% 显存」，判断它在自己的负载上还剩多少：分清加速的是哪一段，在同样的条件下比，按质量下限选量化档位。",
    content: `## 先分清加速的是哪一段

推理分预填充和解码两段。推测解码只加速解码；量化省的是显存和带宽。宣传里的倍数，通常只是被加速的那一段。LFM2.5-VL 的推测解码草稿模型在 M5 Max 上把解码提速 2.30 到 3.13 倍，端到端只有 1.56 到 2.62 倍：图像编码和预填充没变，而在端侧设备上它们占了很大一块时间。先量清楚自己的请求里两段各占多少。

## 在同样的条件下比

1. **同硬件、同批量。** Inferact 的 TPU 巨核让 Kimi K3 在 16 块 TPU v7 上比 16 块 GB200 上的 vLLM 快 57%；不开推测解码时，优势只在批量 1 到 8 之间，约为 1.4 到 2 倍。批量一变，结论可能就变。
2. **同接受率。** 推测解码的收益取决于草稿被接受的比例，Inferact 那组数是每步平均接受 6 个 token。你的提示和输出分布不同，接受率也会不同。
3. **同一套正确性检查。** 用贪心解码在固定基准上对比输出。推测解码按设计不改变输出，量化会改变。

Muse Glimmer 发布时给出的量化与推测解码数字，也要按这三条逐一对照，再决定能不能照搬到自己的机器上。

## 量化看质量下限，不看压缩率

Pinterest 在 1 亿条向量上比过：标量量化把 HNSW 索引从 121GB 压到 50GB，召回 92.92%；乘积量化压到 32GB，召回掉到 77.25%。选哪种取决于你能接受的召回下限。模型量化也一样，先定质量底线，再找最省的档位。

平均分会把弱点藏起来。采用分块 KV 缓存压缩的模型，检索准确率会随信息相对压缩窗口边界的位置周期性起伏，最多差 40 个百分点，只看平均数看不出来。

## 盯住容易漏的地方

- **精度不一致。** Ollama v0.32.4 修了 Qwen3 MoE 各专家量化精度不一致时的解码问题，还让推测解码草稿模型的输出头按指定精度量化——此前它可能留在更高精度上，吃掉推测解码本该省下的显存与带宽。
- **新路径的质量缺陷。** 同一版本在 Apple GPU 上的 NVFP4 路径有输出质量下降的 bug，两天后的 v0.32.5 才修。输出流畅不代表没掉质量。
- **省显存的另一种代价。** Colibrì 把路由专家放在硬盘上按需读取，能在小机器上跑大模型，但每秒只有 0.05 到 1.8 个 token；它保证不改动模型，不保证速度。

SGLang、vLLM、Ollama 的新版本常带来新的量化或推测解码路径。每次升级引擎后，用同一组请求重跑一遍。

## 与相邻能力的分工

确认提速是真的之后，要多少卡、多少副本，交给「推理服务容量规划」；模型能不能在一台具体的机器上跑，见「端侧模型部署与硬件适配」。`,
    skillType: "engineering",
    heatLevel: "active",
    learningCost: "medium",
    tags: ["tag-efficient-inference", "tag-inference"],
    signals: [
      supports("lfm2-5-vl-dspark"),
      supports("inferact-tpu-megakernels-kimi-k3"),
      supports("pinterest-vector-search-quantization"),
      uses("ollama-v0-32-4"),
      uses("sglang-v0-5-17"),
      supports("muse-glimmer-local-agent-model"),
      supports("meta-open-weights-turn"),
      uses("vllm-v0-30-0"),
      uses("vllm-v0-26-0"),
      supports("colibri-weights-jit-tiered-inference"),
      supports("chunked-kv-cache-phase-sensitivity")
    ],
    knowledgeIds: [
      "knowledge-ws-34da6116",
      "knowledge-ws-68963f7f",
      "knowledge-kv-cache",
      "knowledge-latency-tradeoffs",
      "knowledge-ws-36346103"
    ]
  }
];

interface SkillRecord extends SkillItem {
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface SignalRecord {
  id: string;
  slug: string;
  status: string;
  relatedSkillIds: string[];
}

interface KnowledgeRecord {
  id: string;
  status: string;
  relatedSkillIds: string[];
}

export interface AdditionInput {
  skills: SkillRecord[];
  /** Bundled seed skills, for slug uniqueness. */
  seedSkills: { id: string; slug: string }[];
  signals: SignalRecord[];
  knowledge: KnowledgeRecord[];
  relations: LinkRelation[];
}

export interface ItemReport {
  id: string;
  title: string;
  /** False when the store already had the id: its record is left alone. */
  added: boolean;
  signalCount: number;
  knowledgeCount: number;
  /** Planned slugs with no published signal behind them. */
  missingSignals: string[];
  missingKnowledge: string[];
}

export interface AdditionPlan {
  skills: SkillRecord[];
  signals: SignalRecord[];
  knowledge: KnowledgeRecord[];
  relations: LinkRelation[];
  reports: ItemReport[];
  addedRecords: SkillRecord[];
  /** Signals whose relatedSkillIds gained at least one id. */
  signalChanges: number;
  /** Ids appended across all signals. */
  signalLinks: number;
  /** Knowledge items whose relatedSkillIds gained at least one id. */
  knowledgeChanges: number;
  knowledgeLinks: number;
  newRelations: LinkRelation[];
  /** Pairs left alone because an override already existed. */
  keptRelations: number;
}

function appendIds<T extends { id: string; relatedSkillIds: string[] }>(
  records: T[],
  additions: Map<string, string[]>
): T[] {
  return records.map((record) => {
    const extra = additions.get(record.id);
    return extra
      ? { ...record, relatedSkillIds: [...record.relatedSkillIds, ...extra] }
      : record;
  });
}

function countLinks(additions: Map<string, string[]>): number {
  return [...additions.values()].reduce((sum, ids) => sum + ids.length, 0);
}

/**
 * Pure plan: the next four stores, given the current ones. Throws when a
 * new slug collides with an existing one.
 */
export function planSkillAddition(
  input: AdditionInput,
  items: NewSkillItem[],
  now: string,
  newRelationId: () => string = () => `rel-ws-${randomUUID().slice(0, 8)}`
): AdditionPlan {
  const publishedBySlug = new Map(
    input.signals
      .filter((signal) => signal.status === "published")
      .map((signal) => [signal.slug, signal])
  );
  const publishedKnowledge = new Map(
    input.knowledge
      .filter((record) => record.status === "published")
      .map((record) => [record.id, record])
  );
  const existingIds = new Set(input.skills.map((record) => record.id));
  const takenSlugs = new Map<string, string>();
  for (const item of [...input.seedSkills, ...input.skills]) {
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

  const addedRecords: SkillRecord[] = [];
  const newRelations: LinkRelation[] = [];
  const signalAdditions = new Map<string, string[]>();
  const knowledgeAdditions = new Map<string, string[]>();
  const reports: ItemReport[] = [];
  let keptRelations = 0;

  const addRelation = (
    item: NewSkillItem,
    toId: string,
    toType: "technology" | "knowledge",
    relationType: LinkRelation["relationType"]
  ) => {
    const key = getRelationPairKey(item.id, "skill", toId, toType);
    if (overridden.has(key)) {
      keptRelations += 1;
      return;
    }
    overridden.add(key);
    newRelations.push({
      id: newRelationId(),
      fromId: item.id,
      fromType: "skill",
      toId,
      toType,
      relationType
    });
  };

  const queue = (
    additions: Map<string, string[]>,
    record: { id: string; relatedSkillIds: string[] },
    skillId: string
  ) => {
    if (record.relatedSkillIds.includes(skillId)) return;
    const pending = additions.get(record.id) ?? [];
    if (!pending.includes(skillId)) pending.push(skillId);
    additions.set(record.id, pending);
  };

  for (const item of items) {
    const owner = takenSlugs.get(item.slug);
    if (owner && owner !== item.id) {
      throw new Error(`Slug「${item.slug}」已被 ${owner} 使用。`);
    }

    const signals = item.signals.flatMap((entry) => {
      const signal = publishedBySlug.get(entry.slug);
      return signal ? [{ signal, relation: entry.relation }] : [];
    });
    const missingSignals = item.signals
      .map((entry) => entry.slug)
      .filter((slug) => !publishedBySlug.has(slug));
    const knowledge = item.knowledgeIds.flatMap((id) => {
      const record = publishedKnowledge.get(id);
      return record ? [record] : [];
    });
    const missingKnowledge = item.knowledgeIds.filter(
      (id) => !publishedKnowledge.has(id)
    );

    const added = !existingIds.has(item.id);
    if (added) {
      const {
        signals: _signals,
        knowledgeIds: _knowledgeIds,
        ...fields
      } = item;
      addedRecords.push({
        ...fields,
        relatedTechnologyIds: signals.map(({ signal }) => signal.id),
        relatedKnowledgeIds: knowledge.map((record) => record.id),
        status: "published",
        createdAt: now,
        updatedAt: now
      });
      existingIds.add(item.id);
      takenSlugs.set(item.slug, item.id);
    }

    for (const { signal, relation } of signals) {
      queue(signalAdditions, signal, item.id);
      addRelation(item, signal.id, "technology", relation);
    }
    for (const record of knowledge) {
      queue(knowledgeAdditions, record, item.id);
      addRelation(item, record.id, "knowledge", "requires");
    }

    reports.push({
      id: item.id,
      title: item.title,
      added,
      signalCount: signals.length,
      knowledgeCount: knowledge.length,
      missingSignals,
      missingKnowledge
    });
  }

  return {
    skills: [...input.skills, ...addedRecords],
    signals: appendIds(input.signals, signalAdditions),
    knowledge: appendIds(input.knowledge, knowledgeAdditions),
    relations: [...input.relations, ...newRelations],
    reports,
    addedRecords,
    signalChanges: signalAdditions.size,
    signalLinks: countLinks(signalAdditions),
    knowledgeChanges: knowledgeAdditions.size,
    knowledgeLinks: countLinks(knowledgeAdditions),
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

  const skillPath = getLocalStoreFilePath("skill-workspace.json");
  const signalPath = getLocalStoreFilePath("technology-workspace.json");
  const knowledgePath = getLocalStoreFilePath("knowledge-workspace.json");
  const relationPath = getLocalStoreFilePath("link-relation-workspace.json");

  const skillStore = readLocalJsonFile<Store<SkillRecord>>(skillPath, {});
  const signalStore = readLocalJsonFile<Store<SignalRecord>>(signalPath, {});
  const knowledgeStore = readLocalJsonFile<Store<KnowledgeRecord>>(
    knowledgePath,
    {}
  );
  const relationStore = readLocalJsonFile<{
    updatedAt?: string;
    relations?: LinkRelation[];
  }>(relationPath, {});

  const now = new Date().toISOString();
  const plan = planSkillAddition(
    {
      skills: skillStore.records ?? [],
      seedSkills: skillItems,
      signals: signalStore.records ?? [],
      knowledge: knowledgeStore.records ?? [],
      relations: relationStore.relations ?? []
    },
    newSkillItems,
    now
  );

  // Every new record must clear the workspace publish gate as it stands.
  const knownTags = new Set(topicTags.map((tag) => tag.id));
  const allSlugs = [
    ...skillItems.map((item) => ({ id: item.id, slug: item.slug })),
    ...plan.skills.map((item) => ({ id: item.id, slug: item.slug }))
  ];
  for (const record of plan.addedRecords) {
    const others = allSlugs
      .filter((item) => item.id !== record.id)
      .map((item) => item.slug);
    const readiness = evaluateSkillPublishReadiness(record, others, knownTags);
    const problems = [...readiness.blockingErrors, ...readiness.warnings];
    if (problems.length > 0) {
      throw new Error(
        `${record.id} 没过发布检查：${problems.map((issue) => issue.message).join("；")}`
      );
    }
  }

  console.log(`技能条目：新增 ${plan.addedRecords.length} 项`);
  for (const report of plan.reports) {
    const state = report.added ? "新增" : "已存在，内容不改";
    console.log(
      `  ${report.title}（${state}）  关联信号 ${report.signalCount} 条，知识 ${report.knowledgeCount} 条`
    );
    for (const slug of report.missingSignals) {
      console.log(`    没有这条已发布信号，跳过：${slug}`);
    }
    for (const id of report.missingKnowledge) {
      console.log(`    没有这条已发布知识，跳过：${id}`);
    }
  }
  const byType = (type: LinkRelation["relationType"]) =>
    plan.newRelations.filter((relation) => relation.relationType === type)
      .length;
  console.log(
    `\n信号：${plan.signalChanges} 条的 relatedSkillIds 追加 ${plan.signalLinks} 个 id（不改 updatedAt）`
  );
  console.log(
    `知识：${plan.knowledgeChanges} 条的 relatedSkillIds 追加 ${plan.knowledgeLinks} 个 id（不改 updatedAt）`
  );
  console.log(
    `关系：新增 ${plan.newRelations.length} 条覆盖（技能→信号 印证 ${byType("supports")}、借助 ${byType("uses")}；技能→知识 必备 ${byType("requires")}）` +
      (plan.keptRelations ? `，${plan.keptRelations} 对已有覆盖保持不变` : "")
  );

  const pending =
    plan.addedRecords.length +
    plan.signalChanges +
    plan.knowledgeChanges +
    plan.newRelations.length;
  if (pending === 0) {
    console.log("\n没有需要写的内容。");
    return;
  }
  if (!apply) {
    console.log("\n预览，没有写入。加 --apply 写入。");
    return;
  }

  if (plan.addedRecords.length > 0) {
    writeLocalJsonFile(skillPath, {
      ...skillStore,
      updatedAt: now,
      records: plan.skills
    });
  }
  if (plan.signalChanges > 0) {
    writeLocalJsonFile(signalPath, {
      ...signalStore,
      updatedAt: now,
      records: plan.signals
    });
  }
  if (plan.knowledgeChanges > 0) {
    writeLocalJsonFile(knowledgePath, {
      ...knowledgeStore,
      updatedAt: now,
      records: plan.knowledge
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
      entityType: "skill",
      entityId: record.id,
      action: "skill.created",
      actorType: "system",
      afterSnapshot: { title: record.title, slug: record.slug },
      metadata: { source: "scripts/add-skill-items.ts" }
    });
  }
  console.log(`\n已写入（${path.dirname(skillPath)}）。`);
}

// Runs only when launched by scripts/run-ts.cjs, not when a test imports it.
if (path.basename(process.argv[2] ?? "") === "add-skill-items.ts") {
  main();
}
