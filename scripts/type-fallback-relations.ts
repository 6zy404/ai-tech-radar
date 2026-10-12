// One-off: gives a relation type to the fallback 关联 edges (2026-10-12).
//
//   node scripts/run-ts.cjs scripts/type-fallback-relations.ts           # dry run
//   node scripts/run-ts.cjs scripts/type-fallback-relations.ts --apply   # write
//
// Measured through getContentGraph that day: 1124 edges, 203 of them the
// fallback 关联 (18.1%, the README said about 12%). 96 had no relation entry
// at all — the editor does not store a pair left on its default type — and
// 107 were stored as 关联 with a note. Every pair was read once, both titles
// and summaries, and given the type below; 69 that are only loosely related
// (same-week comparisons, analogies) stay 关联, which leaves it at 6.1%.
// Seven published signals also had an empty `relatedTechnologyIds`; each
// gets two published signals.
//
// What it writes:
// - `link-relation-workspace.json`: an existing 关联 override is retyped in
//   place, keeping its id, note and direction (except `requires`, the one
//   type read with its direction: the signal needs the knowledge first). A
//   pair with no entry gets a new override with no note. A pair that already
//   carries another type is left alone and reported.
// - `technology-workspace.json`: the orphan signals' `relatedTechnologyIds`
//   are appended to in place, with `updatedAt` left alone — the workflow
//   update would re-sort same-day signals (see `retag-signals.ts`). A target
//   that is not a published signal is skipped.
//
// A second run reports nothing to write.
import { randomUUID } from "node:crypto";
import path from "node:path";

import { linkRelations } from "../src/data/relations";
import { getAllTechnologies, getContentGraph } from "../src/lib/content";
import {
  applyLinkRelationOverlay,
  findRelationIn,
  getRelationPairKey
} from "../src/lib/link-relation-workflow";
import {
  getLocalStoreFilePath,
  readLocalJsonFile,
  writeLocalJsonFile
} from "../src/lib/repositories/local-json-store";
import type {
  ContentKind,
  LinkRelation,
  RelationType
} from "../src/types/content";

/** `[from, to, type]`, each end written `kind:id`, `from` first. */
export type FallbackTyping = [string, string, RelationType];

export const fallbackRelationTypes: FallbackTyping[] = [
  // MiMo-V2.6 技术报告 ↔ 模型微调与后训练定制
  [
    "technology:draft-candidate-rss-https-www-infoq-cn-article-gndwodm8ygkajxfslabk-utm-source-rss-amp-utm-medium-article",
    "skill:skill-ws-84837d46",
    "supports"
  ],
  // MiMo-V2.6 技术报告 ↔ 模型与输出评估
  [
    "technology:draft-candidate-rss-https-www-infoq-cn-article-gndwodm8ygkajxfslabk-utm-source-rss-amp-utm-medium-article",
    "skill:skill-model-evaluation",
    "uses"
  ],
  // MiMo-V2.6 技术报告 ↔ 旗舰模型发布解读与换代判断
  [
    "technology:draft-candidate-rss-https-www-infoq-cn-article-gndwodm8ygkajxfslabk-utm-source-rss-amp-utm-medium-article",
    "skill:skill-ws-dddaf80c",
    "supports"
  ],
  // MiMo-V2.6 技术报告 ↔ 混合专家模型（MoE）架构
  [
    "technology:draft-candidate-rss-https-www-infoq-cn-article-gndwodm8ygkajxfslabk-utm-source-rss-amp-utm-medium-article",
    "knowledge:knowledge-ws-36346103",
    "requires"
  ],
  // 完成判定与验收信号 ↔ MiMo-V2.6 技术报告
  [
    "knowledge:knowledge-ws-e251051e",
    "technology:draft-candidate-rss-https-www-infoq-cn-article-gndwodm8ygkajxfslabk-utm-source-rss-amp-utm-medium-article",
    "explains"
  ],
  // DeepSeek-V4 的周期性盲点 ↔ 模型与输出评估
  [
    "technology:draft-candidate-rss-https-www-qbitai-com-p-502364",
    "skill:skill-model-evaluation",
    "supports"
  ],
  // DeepSeek-V4 的周期性盲点 ↔ 推理服务容量规划
  [
    "technology:draft-candidate-rss-https-www-qbitai-com-p-502364",
    "skill:skill-ws-a9e80194",
    "extends"
  ],
  // DeepSeek-V4 的周期性盲点 ↔ 检索流水线调优
  [
    "technology:draft-candidate-rss-https-www-qbitai-com-p-502364",
    "skill:skill-retrieval-tuning",
    "extends"
  ],
  // DeepSeek-V4 的周期性盲点 ↔ 长时程智能体的记忆与上下文管理
  [
    "technology:draft-candidate-rss-https-www-qbitai-com-p-502364",
    "knowledge:knowledge-ws-a28a8a56",
    "supports"
  ],
  // 推测解码与推理加速技术 ↔ DeepSeek-V4 的周期性盲点
  [
    "knowledge:knowledge-ws-68963f7f",
    "technology:draft-candidate-rss-https-www-qbitai-com-p-502364",
    "explains"
  ],
  // Nemotron 竞赛模型 ↔ 菲尔兹奖得主
  [
    "technology:draft-candidate-rss-https-hf-mirror-com-blog-nvidia-nemotron-ioi-and-imo-2026",
    "technology:draft-candidate-rss-https-www-qbitai-com-p-474381",
    "extends"
  ],
  // Nemotron 竞赛模型 ↔ OpenAI 公开 719 篇数学结果
  [
    "technology:draft-candidate-rss-https-hf-mirror-com-blog-nvidia-nemotron-ioi-and-imo-2026",
    "technology:draft-candidate-rss-https-openai-com-index-sharing-ai-progress-in-mathematics",
    "supports"
  ],
  // Nemotron 竞赛模型 ↔ 模型微调与后训练定制
  [
    "technology:draft-candidate-rss-https-hf-mirror-com-blog-nvidia-nemotron-ioi-and-imo-2026",
    "skill:skill-ws-84837d46",
    "supports"
  ],
  // Nemotron 竞赛模型 ↔ 模型与输出评估
  [
    "technology:draft-candidate-rss-https-hf-mirror-com-blog-nvidia-nemotron-ioi-and-imo-2026",
    "skill:skill-model-evaluation",
    "supports"
  ],
  // Nemotron 竞赛模型 ↔ 混合专家模型（MoE）架构
  [
    "technology:draft-candidate-rss-https-hf-mirror-com-blog-nvidia-nemotron-ioi-and-imo-2026",
    "knowledge:knowledge-ws-36346103",
    "requires"
  ],
  // 模型量化与数值精度 ↔ Nemotron 竞赛模型
  [
    "knowledge:knowledge-ws-34da6116",
    "technology:draft-candidate-rss-https-hf-mirror-com-blog-nvidia-nemotron-ioi-and-imo-2026",
    "explains"
  ],
  // Claude Haiku 5.5 ↔ Opus 5.5 与 GPT-6 同日降价，最贵
  [
    "technology:draft-candidate-rss-https-simonwillison-net-2026-oct-7-claude-haiku-5-5",
    "technology:draft-candidate-rss-https-simonwillison-net-2026-sep-22-opus-and-sol-and-luna",
    "supports"
  ],
  // Claude Haiku 5.5 ↔ 旗舰模型发布解读与换代判断
  [
    "technology:draft-candidate-rss-https-simonwillison-net-2026-oct-7-claude-haiku-5-5",
    "skill:skill-ws-dddaf80c",
    "supports"
  ],
  // 模型选型与约束匹配 ↔ Claude Haiku 5.5
  [
    "knowledge:knowledge-model-sizing",
    "technology:draft-candidate-rss-https-simonwillison-net-2026-oct-7-claude-haiku-5-5",
    "explains"
  ],
  // 谷歌开放新嵌入模型 ↔ 检索流水线调优
  [
    "technology:draft-candidate-rss-https-deepmind-google-blog-embeddinggemma-2-an-open-lightweight-multimodal-embedding-model",
    "skill:skill-retrieval-tuning",
    "uses"
  ],
  // 谷歌开放新嵌入模型 ↔ 端侧模型部署与硬件适配
  [
    "technology:draft-candidate-rss-https-deepmind-google-blog-embeddinggemma-2-an-open-lightweight-multimodal-embedding-model",
    "skill:skill-ws-d7c9d1d8",
    "supports"
  ],
  // 检索增强生成基础 ↔ 谷歌开放新嵌入模型
  [
    "knowledge:knowledge-rag-basics",
    "technology:draft-candidate-rss-https-deepmind-google-blog-embeddinggemma-2-an-open-lightweight-multimodal-embedding-model",
    "explains"
  ],
  // 谷歌开放新嵌入模型 ↔ 模型选型与约束匹配
  [
    "technology:draft-candidate-rss-https-deepmind-google-blog-embeddinggemma-2-an-open-lightweight-multimodal-embedding-model",
    "knowledge:knowledge-model-sizing",
    "supports"
  ],
  // OpenAI 公开 719 篇数学结果 ↔ 菲尔兹奖得主
  [
    "technology:draft-candidate-rss-https-openai-com-index-sharing-ai-progress-in-mathematics",
    "technology:draft-candidate-rss-https-www-qbitai-com-p-474381",
    "extends"
  ],
  // OpenAI 公开 719 篇数学结果 ↔ 模型与输出评估
  [
    "technology:draft-candidate-rss-https-openai-com-index-sharing-ai-progress-in-mathematics",
    "skill:skill-model-evaluation",
    "supports"
  ],
  // OpenAI 公开 719 篇数学结果 ↔ 旗舰模型发布解读与换代判断
  [
    "technology:draft-candidate-rss-https-openai-com-index-sharing-ai-progress-in-mathematics",
    "skill:skill-ws-dddaf80c",
    "supports"
  ],
  // OpenAI 公开 719 篇数学结果 ↔ 人在回路的审查
  [
    "technology:draft-candidate-rss-https-openai-com-index-sharing-ai-progress-in-mathematics",
    "knowledge:knowledge-human-loop",
    "supports"
  ],
  // OpenAI 公开 719 篇数学结果 ↔ 评估闭环
  [
    "technology:draft-candidate-rss-https-openai-com-index-sharing-ai-progress-in-mathematics",
    "knowledge:knowledge-evaluation-loops",
    "supports"
  ],
  // 完成判定与验收信号 ↔ OpenAI 公开 719 篇数学结果
  [
    "knowledge:knowledge-ws-e251051e",
    "technology:draft-candidate-rss-https-openai-com-index-sharing-ai-progress-in-mathematics",
    "explains"
  ],
  // 智能体做错的任务，三分之二没有报错 ↔ 智能体可观测性与评测运维
  [
    "technology:draft-candidate-rss-https-hf-mirror-com-blog-microsoft-thinkingbox",
    "skill:skill-ws-f741f122",
    "supports"
  ],
  // 智能体做错的任务，三分之二没有报错 ↔ 模型与输出评估
  [
    "technology:draft-candidate-rss-https-hf-mirror-com-blog-microsoft-thinkingbox",
    "skill:skill-model-evaluation",
    "supports"
  ],
  // 智能体做错的任务，三分之二没有报错 ↔ 完成判定与验收信号
  [
    "technology:draft-candidate-rss-https-hf-mirror-com-blog-microsoft-thinkingbox",
    "knowledge:knowledge-ws-e251051e",
    "supports"
  ],
  // 评估闭环 ↔ 智能体做错的任务，三分之二没有报错
  [
    "knowledge:knowledge-evaluation-loops",
    "technology:draft-candidate-rss-https-hf-mirror-com-blog-microsoft-thinkingbox",
    "explains"
  ],
  // Cloudflare 开放 Clef ↔ 模型与推理引擎的支持路径
  [
    "technology:draft-candidate-rss-https-github-com-ollama-ollama-releases-tag-v0-35-1",
    "skill:skill-ws-7796779a",
    "supports"
  ],
  // Cloudflare 开放 Clef ↔ 模型与输出评估
  [
    "technology:draft-candidate-rss-https-github-com-ollama-ollama-releases-tag-v0-35-1",
    "skill:skill-model-evaluation",
    "supports"
  ],
  // Cloudflare 开放 Clef ↔ 智能体工作流设计
  [
    "technology:draft-candidate-rss-https-github-com-ollama-ollama-releases-tag-v0-35-1",
    "skill:skill-agent-design",
    "uses"
  ],
  // Cloudflare 开放 Clef ↔ 模型选型与约束匹配
  [
    "technology:draft-candidate-rss-https-github-com-ollama-ollama-releases-tag-v0-35-1",
    "knowledge:knowledge-model-sizing",
    "supports"
  ],
  // Cloudflare 开放 Clef ↔ 交互系统中的延迟权衡
  [
    "technology:draft-candidate-rss-https-github-com-ollama-ollama-releases-tag-v0-35-1",
    "knowledge:knowledge-latency-tradeoffs",
    "supports"
  ],
  // API 契约与接口边界 ↔ Cloudflare 开放 Clef
  [
    "knowledge:knowledge-api-contracts",
    "technology:draft-candidate-rss-https-github-com-ollama-ollama-releases-tag-v0-35-1",
    "explains"
  ],
  // Gemini 4 Argon ↔ 旗舰模型发布解读与换代判断
  [
    "technology:draft-candidate-rss-https-www-infoq-cn-article-vvrszjhevkmpevs7wzzu-utm-source-rss-amp-utm-medium-article",
    "skill:skill-ws-dddaf80c",
    "supports"
  ],
  // Olmo-core 3 ↔ 模型微调与后训练定制
  [
    "technology:draft-candidate-rss-https-hf-mirror-com-blog-allenai-olmocore3",
    "skill:skill-ws-84837d46",
    "uses"
  ],
  // Olmo-core 3 ↔ 混合专家模型（MoE）架构
  [
    "technology:draft-candidate-rss-https-hf-mirror-com-blog-allenai-olmocore3",
    "knowledge:knowledge-ws-36346103",
    "requires"
  ],
  // Olmo-core 3 ↔ 模型量化与数值精度
  [
    "technology:draft-candidate-rss-https-hf-mirror-com-blog-allenai-olmocore3",
    "knowledge:knowledge-ws-34da6116",
    "uses"
  ],
  // Olmo-core 3 ↔ 系统设计的权衡
  [
    "technology:draft-candidate-rss-https-hf-mirror-com-blog-allenai-olmocore3",
    "knowledge:knowledge-system-design",
    "supports"
  ],
  // DeepSeek 开源昇腾版 DeepGEMM  ↔ TPU 巨核
  [
    "technology:draft-candidate-rss-https-www-infoq-cn-article-t5i2yv2z0lwibk36lter-utm-source-rss-amp-utm-medium-article",
    "technology:draft-candidate-rss-https-www-qbitai-com-p-497425",
    "supports"
  ],
  // DeepSeek 开源昇腾版 DeepGEMM  ↔ 模型与推理引擎的支持路径
  [
    "technology:draft-candidate-rss-https-www-infoq-cn-article-t5i2yv2z0lwibk36lter-utm-source-rss-amp-utm-medium-article",
    "skill:skill-ws-7796779a",
    "supports"
  ],
  // DeepSeek 开源昇腾版 DeepGEMM  ↔ 混合专家模型（MoE）架构
  [
    "technology:draft-candidate-rss-https-www-infoq-cn-article-t5i2yv2z0lwibk36lter-utm-source-rss-amp-utm-medium-article",
    "knowledge:knowledge-ws-36346103",
    "requires"
  ],
  // DeepSeek 开源昇腾版 DeepGEMM  ↔ 模型量化与数值精度
  [
    "technology:draft-candidate-rss-https-www-infoq-cn-article-t5i2yv2z0lwibk36lter-utm-source-rss-amp-utm-medium-article",
    "knowledge:knowledge-ws-34da6116",
    "uses"
  ],
  // DeepSeek 开源昇腾版 DeepGEMM  ↔ 系统设计的权衡
  [
    "technology:draft-candidate-rss-https-www-infoq-cn-article-t5i2yv2z0lwibk36lter-utm-source-rss-amp-utm-medium-article",
    "knowledge:knowledge-system-design",
    "supports"
  ],
  // Google 开源 AX ↔ DeepSeek DSec
  [
    "technology:draft-candidate-rss-https-www-infoq-cn-article-m6brtrsyjvug8y0m0kyh-utm-source-rss-amp-utm-medium-article",
    "technology:draft-candidate-rss-https-www-qbitai-com-p-496393",
    "supports"
  ],
  // Google 开源 AX ↔ ADK Kotlin 1.0
  [
    "technology:draft-candidate-rss-https-www-infoq-cn-article-m6brtrsyjvug8y0m0kyh-utm-source-rss-amp-utm-medium-article",
    "technology:draft-candidate-rss-https-www-infoq-cn-article-sqv4eomjpp0j3hm3lyf9-utm-source-rss-amp-utm-medium-article",
    "extends"
  ],
  // Google 开源 AX ↔ 智能体安全与提示注入防御
  [
    "technology:draft-candidate-rss-https-www-infoq-cn-article-m6brtrsyjvug8y0m0kyh-utm-source-rss-amp-utm-medium-article",
    "skill:skill-ws-c183c9b9",
    "supports"
  ],
  // Google 开源 AX ↔ 智能体工作流设计
  [
    "technology:draft-candidate-rss-https-www-infoq-cn-article-m6brtrsyjvug8y0m0kyh-utm-source-rss-amp-utm-medium-article",
    "skill:skill-agent-design",
    "uses"
  ],
  // Google 开源 AX ↔ 系统设计的权衡
  [
    "technology:draft-candidate-rss-https-www-infoq-cn-article-m6brtrsyjvug8y0m0kyh-utm-source-rss-amp-utm-medium-article",
    "knowledge:knowledge-system-design",
    "supports"
  ],
  // NVIDIA 开放表格模型 Kumo Tabul ↔ 模型与输出评估
  [
    "technology:draft-candidate-rss-https-hf-mirror-com-blog-nvidia-kumo-tabular",
    "skill:skill-model-evaluation",
    "supports"
  ],
  // NVIDIA 开放表格模型 Kumo Tabul ↔ AI 试点范围界定
  [
    "technology:draft-candidate-rss-https-hf-mirror-com-blog-nvidia-kumo-tabular",
    "skill:skill-scope-pilots",
    "supports"
  ],
  // NVIDIA 开放表格模型 Kumo Tabul ↔ 合成数据与数据配方
  [
    "technology:draft-candidate-rss-https-hf-mirror-com-blog-nvidia-kumo-tabular",
    "knowledge:knowledge-ws-818b7bb3",
    "uses"
  ],
  // NVIDIA 开放表格模型 Kumo Tabul ↔ 模型选型与约束匹配
  [
    "technology:draft-candidate-rss-https-hf-mirror-com-blog-nvidia-kumo-tabular",
    "knowledge:knowledge-model-sizing",
    "supports"
  ],
  // GPT-6.1 Sol ↔ 旗舰模型发布解读与换代判断
  [
    "technology:draft-candidate-rss-https-openai-com-index-introducing-gpt-6-1-sol",
    "skill:skill-ws-dddaf80c",
    "supports"
  ],
  // 模型选型与约束匹配 ↔ GPT-6.1 Sol
  [
    "knowledge:knowledge-model-sizing",
    "technology:draft-candidate-rss-https-openai-com-index-introducing-gpt-6-1-sol",
    "explains"
  ],
  // Claude Sonnet 5.5 ↔ 旗舰模型发布解读与换代判断
  [
    "technology:draft-candidate-rss-https-www-infoq-cn-article-psvhjyojtc9bslwyxpff-utm-source-rss-amp-utm-medium-article",
    "skill:skill-ws-dddaf80c",
    "supports"
  ],
  // 模型选型与约束匹配 ↔ Claude Sonnet 5.5
  [
    "knowledge:knowledge-model-sizing",
    "technology:draft-candidate-rss-https-www-infoq-cn-article-psvhjyojtc9bslwyxpff-utm-source-rss-amp-utm-medium-article",
    "explains"
  ],
  // Pinterest 数百亿向量检索 ↔ LFM2.5-Encoders
  [
    "technology:draft-candidate-rss-https-www-infoq-cn-article-rb0wgcg9ilirh3xzojy5-utm-source-rss-amp-utm-medium-article",
    "technology:draft-candidate-rss-https-hf-mirror-com-blog-liquidai-lfm2-5-encoders",
    "extends"
  ],
  // Pinterest 数百亿向量检索 ↔ Jev
  [
    "technology:draft-candidate-rss-https-www-infoq-cn-article-rb0wgcg9ilirh3xzojy5-utm-source-rss-amp-utm-medium-article",
    "technology:draft-candidate-rss-https-simonwillison-net-2026-sep-21-jev",
    "extends"
  ],
  // DeepSeek DSec ↔ Cloudflare Computer
  [
    "technology:draft-candidate-rss-https-www-qbitai-com-p-496393",
    "technology:draft-candidate-rss-https-www-infoq-cn-article-rakih7e4la9uq4iasltb-utm-source-rss-amp-utm-medium-article",
    "extends"
  ],
  // DeepSeek DSec ↔ DeepSeek Harness 开源
  [
    "technology:draft-candidate-rss-https-www-qbitai-com-p-496393",
    "technology:draft-candidate-rss-https-www-infoq-cn-article-de9aljwc4ejw2kayw8dd-utm-source-rss-amp-utm-medium-article",
    "extends"
  ],
  // vLLM v0.30.0 ↔ SGLang v0.5.17
  [
    "technology:draft-candidate-rss-https-github-com-vllm-project-vllm-releases-tag-v0-30-0",
    "technology:draft-candidate-rss-https-github-com-sgl-project-sglang-releases-tag-v0-5-17",
    "supports"
  ],
  // Opus 5.5 与 GPT-6 同日降价，最贵 ↔ Jev
  [
    "technology:draft-candidate-rss-https-simonwillison-net-2026-sep-22-opus-and-sol-and-luna",
    "technology:draft-candidate-rss-https-simonwillison-net-2026-sep-21-jev",
    "supports"
  ],
  // Opus 5.5 与 GPT-6 同日降价，最贵 ↔ 英国 AISI 公开评测明细
  [
    "technology:draft-candidate-rss-https-simonwillison-net-2026-sep-22-opus-and-sol-and-luna",
    "technology:draft-candidate-rss-https-hf-mirror-com-blog-evaleval-aisi",
    "extends"
  ],
  // 英国 AISI 公开评测明细 ↔ 首次双盲评测
  [
    "technology:draft-candidate-rss-https-hf-mirror-com-blog-evaleval-aisi",
    "technology:draft-candidate-rss-https-deepmind-google-blog-piloting-the-worlds-first-double-blind-ai-evaluations",
    "extends"
  ],
  // Anthropic 公布内部测量 ↔ BenchMIRT
  [
    "technology:draft-candidate-rss-https-www-infoq-cn-article-cephwkjzae7lzborilcq-utm-source-rss-amp-utm-medium-article",
    "technology:draft-candidate-rss-https-hf-mirror-com-blog-allenai-benchmirt",
    "extends"
  ],
  // Anthropic 公布内部测量 ↔ 纳维-斯托克斯之争
  [
    "technology:draft-candidate-rss-https-www-infoq-cn-article-cephwkjzae7lzborilcq-utm-source-rss-amp-utm-medium-article",
    "technology:draft-candidate-rss-https-simonwillison-net-2026-sep-8-on-navier-stokes",
    "supports"
  ],
  // Copilot 运行时改写成 83 万行 Rus ↔ Rootly 废掉了小 PR 规则
  [
    "technology:draft-candidate-rss-https-github-blog-p-98713",
    "technology:draft-candidate-rss-https-www-infoq-cn-article-fzwv9jzv2cpk8yjlpxda-utm-source-rss-amp-utm-medium-article",
    "supports"
  ],
  // Copilot 运行时改写成 83 万行 Rus ↔ Kiro Crew 开源
  [
    "technology:draft-candidate-rss-https-github-blog-p-98713",
    "technology:draft-candidate-rss-https-www-infoq-cn-article-utrvjxwesgdp2kzlhpiv-utm-source-rss-amp-utm-medium-article",
    "supports"
  ],
  // Copilot 运行时改写成 83 万行 Rus ↔ 微软 Agent Framework Harne
  [
    "technology:draft-candidate-rss-https-github-blog-p-98713",
    "technology:draft-candidate-rss-https-www-infoq-cn-article-adejegvnskwvue2jz0yi-utm-source-rss-amp-utm-medium-article",
    "extends"
  ],
  // Copilot 运行时改写成 83 万行 Rus ↔ 外部调查进场
  [
    "technology:draft-candidate-rss-https-github-blog-p-98713",
    "technology:draft-candidate-rss-https-simonwillison-net-2026-sep-12-openai-agents-rubygems",
    "extends"
  ],
  // 平均成功率 77%，五次全对只有 53% ↔ BenchMIRT
  [
    "technology:draft-candidate-rss-https-hf-mirror-com-blog-ibm-research-altk-evolve-consistency",
    "technology:draft-candidate-rss-https-hf-mirror-com-blog-allenai-benchmirt",
    "supports"
  ],
  // 平均成功率 77%，五次全对只有 53% ↔ 两千两百篇论文被重跑了一遍
  [
    "technology:draft-candidate-rss-https-hf-mirror-com-blog-ibm-research-altk-evolve-consistency",
    "technology:draft-candidate-rss-https-hf-mirror-com-blog-icml-2026-open-reproductions",
    "supports"
  ],
  // 平均成功率 77%，五次全对只有 53% ↔ 推理服务容量规划
  [
    "technology:draft-candidate-rss-https-hf-mirror-com-blog-ibm-research-altk-evolve-consistency",
    "skill:skill-ws-a9e80194",
    "extends"
  ],
  // 外部调查进场 ↔ GPT-6 Astra 发布
  [
    "technology:draft-candidate-rss-https-simonwillison-net-2026-sep-12-openai-agents-rubygems",
    "technology:draft-candidate-rss-https-openai-com-index-gpt-6-astra",
    "builds-on"
  ],
  // 纳维-斯托克斯之争 ↔ GPT-6 Astra 发布
  [
    "technology:draft-candidate-rss-https-simonwillison-net-2026-sep-8-on-navier-stokes",
    "technology:draft-candidate-rss-https-openai-com-index-gpt-6-astra",
    "uses"
  ],
  // 拒答率涨到 85%，同一检查点误拒也涨到 74% ↔ GPT-6 Astra 发布
  [
    "technology:draft-candidate-rss-https-hf-mirror-com-blog-multiversecomputingcai-safety-for-whom",
    "technology:draft-candidate-rss-https-openai-com-index-gpt-6-astra",
    "extends"
  ],
  // Kiro Crew 开源 ↔ 微软 Agent Framework Harne
  [
    "technology:draft-candidate-rss-https-www-infoq-cn-article-utrvjxwesgdp2kzlhpiv-utm-source-rss-amp-utm-medium-article",
    "technology:draft-candidate-rss-https-www-infoq-cn-article-adejegvnskwvue2jz0yi-utm-source-rss-amp-utm-medium-article",
    "supports"
  ],
  // Kiro Crew 开源 ↔ 每个研究员配 3.1 个智能体，而一半仍要人插手
  [
    "technology:draft-candidate-rss-https-www-infoq-cn-article-utrvjxwesgdp2kzlhpiv-utm-source-rss-amp-utm-medium-article",
    "technology:draft-candidate-rss-https-openai-com-index-research-acceleration-view-inside-openai",
    "supports"
  ],
  // 模型之间只传 17 比特 ↔ LFM2.5-2.6B
  [
    "technology:draft-candidate-rss-https-www-qbitai-com-p-485108",
    "technology:draft-candidate-rss-https-hf-mirror-com-blog-liquidai-lfm2-5-2-6b",
    "extends"
  ],
  // 模型之间只传 17 比特 ↔ Qwen3.8-27B 开源
  [
    "technology:draft-candidate-rss-https-www-qbitai-com-p-485108",
    "technology:draft-candidate-rss-https-www-qbitai-com-p-473669",
    "uses"
  ],
  // 每个研究员配 3.1 个智能体，而一半仍要人插手 ↔ 智能体在公共 wiki 上串谋
  [
    "technology:draft-candidate-rss-https-openai-com-index-research-acceleration-view-inside-openai",
    "technology:draft-candidate-rss-https-simonwillison-net-2026-sep-4-rogue-agent-wikis",
    "extends"
  ],
  // FreeToken ↔ Muse Glimmer 开源
  [
    "technology:draft-candidate-rss-https-www-infoq-cn-article-tij5t0vj1yk0s7uov7se-utm-source-rss-amp-utm-medium-article",
    "technology:draft-candidate-rss-https-www-infoq-cn-article-agfksn1ylmlruqmpea9l-utm-source-rss-amp-utm-medium-article",
    "supports"
  ],
  // FreeToken ↔ LFM2.5-2.6B
  [
    "technology:draft-candidate-rss-https-www-infoq-cn-article-tij5t0vj1yk0s7uov7se-utm-source-rss-amp-utm-medium-article",
    "technology:draft-candidate-rss-https-hf-mirror-com-blog-liquidai-lfm2-5-2-6b",
    "extends"
  ],
  // 智能体在公共 wiki 上串谋 ↔ GPT-6 Astra 发布
  [
    "technology:draft-candidate-rss-https-simonwillison-net-2026-sep-4-rogue-agent-wikis",
    "technology:draft-candidate-rss-https-openai-com-index-gpt-6-astra",
    "builds-on"
  ],
  // GPT-6 Astra 发布 ↔ Google Gemini Flash Cybe
  [
    "technology:draft-candidate-rss-https-openai-com-index-gpt-6-astra",
    "technology:draft-candidate-rss-https-deepmind-google-blog-introducing-gemini-36-flash-35-flash-lite-and-35-flash-cyber",
    "supports"
  ],
  // GPT-6 Astra 发布 ↔ BenchMIRT
  [
    "technology:draft-candidate-rss-https-openai-com-index-gpt-6-astra",
    "technology:draft-candidate-rss-https-hf-mirror-com-blog-allenai-benchmirt",
    "extends"
  ],
  // BenchMIRT ↔ 首次双盲评测
  [
    "technology:draft-candidate-rss-https-hf-mirror-com-blog-allenai-benchmirt",
    "technology:draft-candidate-rss-https-deepmind-google-blog-piloting-the-worlds-first-double-blind-ai-evaluations",
    "extends"
  ],
  // 首次双盲评测 ↔ Google Gemini Flash Cybe
  [
    "technology:draft-candidate-rss-https-deepmind-google-blog-piloting-the-worlds-first-double-blind-ai-evaluations",
    "technology:draft-candidate-rss-https-deepmind-google-blog-introducing-gemini-36-flash-35-flash-lite-and-35-flash-cyber",
    "extends"
  ],
  // Muse Glimmer 开源 ↔ LFM2.5-2.6B
  [
    "technology:draft-candidate-rss-https-www-infoq-cn-article-agfksn1ylmlruqmpea9l-utm-source-rss-amp-utm-medium-article",
    "technology:draft-candidate-rss-https-hf-mirror-com-blog-liquidai-lfm2-5-2-6b",
    "supports"
  ],
  // Muse Glimmer 开源 ↔ Qwen3.8-27B 开源
  [
    "technology:draft-candidate-rss-https-www-infoq-cn-article-agfksn1ylmlruqmpea9l-utm-source-rss-amp-utm-medium-article",
    "technology:draft-candidate-rss-https-www-qbitai-com-p-473669",
    "supports"
  ],
  // 以前替你否掉那个功能的是一周工期，现在它只要一小 ↔ 菲尔兹奖得主
  [
    "technology:draft-candidate-rss-https-simonwillison-net-2026-aug-19-conceptual-integrity-and-counting-lines-of-code",
    "technology:draft-candidate-rss-https-www-qbitai-com-p-474381",
    "extends"
  ],
  // 以前替你否掉那个功能的是一周工期，现在它只要一小 ↔ AI 工具链选型与自建边界评估
  [
    "technology:draft-candidate-rss-https-simonwillison-net-2026-aug-19-conceptual-integrity-and-counting-lines-of-code",
    "skill:skill-ws-2152c7f1",
    "extends"
  ],
  // Rootly 废掉了小 PR 规则 ↔ 一次 180 万美元的智能体账单
  [
    "technology:draft-candidate-rss-https-www-infoq-cn-article-fzwv9jzv2cpk8yjlpxda-utm-source-rss-amp-utm-medium-article",
    "technology:draft-candidate-rss-https-www-qbitai-com-p-469010",
    "supports"
  ],
  // 菲尔兹奖得主 ↔ 两千两百篇论文被重跑了一遍
  [
    "technology:draft-candidate-rss-https-www-qbitai-com-p-474381",
    "technology:draft-candidate-rss-https-hf-mirror-com-blog-icml-2026-open-reproductions",
    "supports"
  ],
  // Qwen3.8-27B 的第三方实测 ↔ Ollama v0.32.4
  [
    "technology:draft-candidate-rss-https-simonwillison-net-2026-aug-16-qwen-38-27b",
    "technology:draft-candidate-rss-https-github-com-ollama-ollama-releases-tag-v0-32-4",
    "supports"
  ],
  // MCP 无状态之后 ↔ Cloudflare Computer
  [
    "technology:draft-candidate-rss-https-www-infoq-cn-article-412hbbva0nf0ayp0cjzd-utm-source-rss-amp-utm-medium-article",
    "technology:draft-candidate-rss-https-www-infoq-cn-article-rakih7e4la9uq4iasltb-utm-source-rss-amp-utm-medium-article",
    "supports"
  ],
  // MCP 无状态之后 ↔ Gemini API Managed Agent
  [
    "technology:draft-candidate-rss-https-www-infoq-cn-article-412hbbva0nf0ayp0cjzd-utm-source-rss-amp-utm-medium-article",
    "technology:draft-candidate-rss-https-blog-google-innovation-and-ai-technology-developers-tools-expanding-managed-agents-gemini-api",
    "extends"
  ],
  // Cloudflare Computer ↔ DeepSeek Harness 开源
  [
    "technology:draft-candidate-rss-https-www-infoq-cn-article-rakih7e4la9uq4iasltb-utm-source-rss-amp-utm-medium-article",
    "technology:draft-candidate-rss-https-www-infoq-cn-article-de9aljwc4ejw2kayw8dd-utm-source-rss-amp-utm-medium-article",
    "supports"
  ],
  // Cloudflare Computer ↔ 微软 Agent Framework Harne
  [
    "technology:draft-candidate-rss-https-www-infoq-cn-article-rakih7e4la9uq4iasltb-utm-source-rss-amp-utm-medium-article",
    "technology:draft-candidate-rss-https-www-infoq-cn-article-adejegvnskwvue2jz0yi-utm-source-rss-amp-utm-medium-article",
    "supports"
  ],
  // Cloudflare Computer ↔ 生产要持久、评估要轻量——把编排从运行时里拆出来
  [
    "technology:draft-candidate-rss-https-www-infoq-cn-article-rakih7e4la9uq4iasltb-utm-source-rss-amp-utm-medium-article",
    "technology:draft-candidate-rss-https-www-infoq-cn-article-za8vafwpcm7lturfhdmd-utm-source-rss-amp-utm-medium-article",
    "supports"
  ],
  // Qwen3.8-27B 开源 ↔ Meta Muse Glimmer
  [
    "technology:draft-candidate-rss-https-www-qbitai-com-p-473669",
    "technology:draft-candidate-rss-https-hf-mirror-com-blog-muse-glimmer",
    "supports"
  ],
  // Qwen3.8-27B 开源 ↔ LFM2.5-2.6B
  [
    "technology:draft-candidate-rss-https-www-qbitai-com-p-473669",
    "technology:draft-candidate-rss-https-hf-mirror-com-blog-liquidai-lfm2-5-2-6b",
    "supports"
  ],
  // Qwen3.8-27B 开源 ↔ Meta 重回开放权重
  [
    "technology:draft-candidate-rss-https-www-qbitai-com-p-473669",
    "technology:draft-candidate-rss-https-www-infoq-cn-article-9sy33ca91fp8z5mlovnu-utm-source-rss-amp-utm-medium-article",
    "supports"
  ],
  // DeepSeek Harness 开源 ↔ 生产要持久、评估要轻量——把编排从运行时里拆出来
  [
    "technology:draft-candidate-rss-https-www-infoq-cn-article-de9aljwc4ejw2kayw8dd-utm-source-rss-amp-utm-medium-article",
    "technology:draft-candidate-rss-https-www-infoq-cn-article-za8vafwpcm7lturfhdmd-utm-source-rss-amp-utm-medium-article",
    "supports"
  ],
  // 开放模型生态半年报 ↔ Meta Muse Glimmer
  [
    "technology:draft-candidate-rss-https-hf-mirror-com-blog-state-of-open-models-summer-2026",
    "technology:draft-candidate-rss-https-hf-mirror-com-blog-muse-glimmer",
    "extends"
  ],
  // 两千两百篇论文被重跑了一遍 ↔ ARA
  [
    "technology:draft-candidate-rss-https-hf-mirror-com-blog-icml-2026-open-reproductions",
    "technology:draft-candidate-rss-https-www-qbitai-com-p-469721",
    "supports"
  ],
  // 两千两百篇论文被重跑了一遍 ↔ 视觉输入的组织与核验
  [
    "technology:draft-candidate-rss-https-hf-mirror-com-blog-icml-2026-open-reproductions",
    "skill:skill-ws-b47fabd1",
    "supports"
  ],
  // SL2T ↔ AMIE 实时视频问诊
  [
    "technology:draft-candidate-rss-https-deepmind-google-blog-putting-sign-language-ai-into-users-hands",
    "technology:draft-candidate-rss-https-blog-google-innovation-and-ai-models-and-research-google-research-amie-video-consultations",
    "supports"
  ],
  // 微软 Agent Framework Harne ↔ Gemini API Managed Agent
  [
    "technology:draft-candidate-rss-https-www-infoq-cn-article-adejegvnskwvue2jz0yi-utm-source-rss-amp-utm-medium-article",
    "technology:draft-candidate-rss-https-blog-google-innovation-and-ai-technology-developers-tools-expanding-managed-agents-gemini-api",
    "supports"
  ],
  // vLLM v0.27.0 ↔ Meta Muse Glimmer
  [
    "technology:draft-candidate-rss-https-github-com-vllm-project-vllm-releases-tag-v0-27-0",
    "technology:draft-candidate-rss-https-hf-mirror-com-blog-muse-glimmer",
    "uses"
  ],
  // Meta Muse Glimmer ↔ Ollama v0.32.4
  [
    "technology:draft-candidate-rss-https-hf-mirror-com-blog-muse-glimmer",
    "technology:draft-candidate-rss-https-github-com-ollama-ollama-releases-tag-v0-32-4",
    "extends"
  ],
  // 一次 180 万美元的智能体账单 ↔ ChatGPT Work
  [
    "technology:draft-candidate-rss-https-www-qbitai-com-p-469010",
    "technology:draft-candidate-rss-https-openai-com-index-chatgpt-for-your-most-ambitious-work",
    "extends"
  ],
  // 一次 180 万美元的智能体账单 ↔ Copilot 与裸 API
  [
    "technology:draft-candidate-rss-https-www-qbitai-com-p-469010",
    "technology:draft-candidate-rss-https-github-blog-p-97686",
    "extends"
  ],
  // BigBang-v1 ↔ GPT-Red
  [
    "technology:draft-candidate-rss-https-www-qbitai-com-p-468782",
    "technology:draft-candidate-rss-https-openai-com-index-unlocking-self-improvement-gpt-red",
    "supports"
  ],
  // SGLang v0.5.17 ↔ vLLM v0.26.0
  [
    "technology:draft-candidate-rss-https-github-com-sgl-project-sglang-releases-tag-v0-5-17",
    "technology:draft-candidate-rss-https-github-com-vllm-project-vllm-releases-tag-v0-26-0",
    "supports"
  ],
  // SGLang v0.5.17 ↔ Inkling
  [
    "technology:draft-candidate-rss-https-github-com-sgl-project-sglang-releases-tag-v0-5-17",
    "technology:draft-candidate-rss-https-hf-mirror-com-blog-thinkingmachines-inkling",
    "uses"
  ],
  // SGLang v0.5.17 ↔ LFM2.5-Encoders
  [
    "technology:draft-candidate-rss-https-github-com-sgl-project-sglang-releases-tag-v0-5-17",
    "technology:draft-candidate-rss-https-hf-mirror-com-blog-liquidai-lfm2-5-encoders",
    "uses"
  ],
  // 那次入侵的来源查清了 ↔ OpenAI
  [
    "technology:draft-candidate-rss-https-simonwillison-net-2026-aug-7-openai-timeline-atom-entries",
    "technology:draft-candidate-rss-https-openai-com-index-safety-alignment-long-horizon-models",
    "extends"
  ],
  // TutorMoments ↔ Copilot 代码审查复盘
  [
    "technology:draft-candidate-rss-https-hf-mirror-com-blog-allenai-tutormoments",
    "technology:draft-candidate-rss-https-github-blog-p-97467",
    "supports"
  ],
  // TutorMoments ↔ Shippy 复盘
  [
    "technology:draft-candidate-rss-https-hf-mirror-com-blog-allenai-tutormoments",
    "technology:draft-candidate-rss-https-hf-mirror-com-blog-allenai-shippy-tech-blog",
    "supports"
  ],
  // LFM2.5-2.6B ↔ LLM 0.32
  [
    "technology:draft-candidate-rss-https-hf-mirror-com-blog-liquidai-lfm2-5-2-6b",
    "technology:draft-candidate-rss-https-simonwillison-net-2026-aug-4-new-release-of-llm-atom-entries",
    "extends"
  ],
  // Google Gemini Flash Cybe ↔ 对抗性评估与红队方法
  [
    "technology:draft-candidate-rss-https-deepmind-google-blog-introducing-gemini-36-flash-35-flash-lite-and-35-flash-cyber",
    "knowledge:knowledge-ws-89b98df3",
    "supports"
  ],
  // Google Gemini Flash Cybe ↔ 模型选型与约束匹配
  [
    "technology:draft-candidate-rss-https-deepmind-google-blog-introducing-gemini-36-flash-35-flash-lite-and-35-flash-cyber",
    "knowledge:knowledge-model-sizing",
    "supports"
  ],
  // OpenAI ↔ 智能体可观测性与评测运维
  [
    "technology:draft-candidate-rss-https-openai-com-index-safety-alignment-long-horizon-models",
    "skill:skill-ws-f741f122",
    "supports"
  ],
  // OpenAI ↔ 智能体安全与提示注入防御
  [
    "technology:draft-candidate-rss-https-openai-com-index-safety-alignment-long-horizon-models",
    "skill:skill-ws-c183c9b9",
    "supports"
  ],
  // OpenAI ↔ 人在回路的审查
  [
    "technology:draft-candidate-rss-https-openai-com-index-safety-alignment-long-horizon-models",
    "knowledge:knowledge-human-loop",
    "supports"
  ],
  // Kimi K3 ↔ 模型与推理引擎的支持路径
  [
    "technology:draft-candidate-rss-https-simonwillison-net-2026-jul-16-kimi-k3-atom-entries",
    "skill:skill-ws-7796779a",
    "extends"
  ],
  // vLLM v0.25.0 ↔ 模型与推理引擎的支持路径
  [
    "technology:draft-candidate-rss-https-github-com-vllm-project-vllm-releases-tag-v0-25-0",
    "skill:skill-ws-7796779a",
    "supports"
  ]
];

export const orphanSignalLinks: Record<string, [string, RelationType][]> = {
  // DeepSeek-V4 的周期性盲点
  "draft-candidate-rss-https-www-qbitai-com-p-502364": [
    // BenchMIRT
    [
      "draft-candidate-rss-https-hf-mirror-com-blog-allenai-benchmirt",
      "supports"
    ],
    // 平均成功率 77%，五次全对只有 53%
    [
      "draft-candidate-rss-https-hf-mirror-com-blog-ibm-research-altk-evolve-consistency",
      "supports"
    ]
  ],
  // 谷歌开放新嵌入模型
  "draft-candidate-rss-https-deepmind-google-blog-embeddinggemma-2-an-open-lightweight-multimodal-embedding-model":
    [
      // LFM2.5-Encoders
      [
        "draft-candidate-rss-https-hf-mirror-com-blog-liquidai-lfm2-5-encoders",
        "supports"
      ],
      // Pinterest 数百亿向量检索
      [
        "draft-candidate-rss-https-www-infoq-cn-article-rb0wgcg9ilirh3xzojy5-utm-source-rss-amp-utm-medium-article",
        "extends"
      ]
    ],
  // Olmo-core 3
  "draft-candidate-rss-https-hf-mirror-com-blog-allenai-olmocore3": [
    // DeepSeek 开源昇腾版 DeepGEMM
    [
      "draft-candidate-rss-https-www-infoq-cn-article-t5i2yv2z0lwibk36lter-utm-source-rss-amp-utm-medium-article",
      "supports"
    ],
    // NeMo Automodel 接入 Diffus
    [
      "draft-candidate-rss-https-hf-mirror-com-blog-nvidia-scale-diffusers-finetuning-nemo-automodel",
      "supports"
    ]
  ],
  // NVIDIA 开放表格模型 Kumo Tabul
  "draft-candidate-rss-https-hf-mirror-com-blog-nvidia-kumo-tabular": [
    // Jev
    ["draft-candidate-rss-https-simonwillison-net-2026-sep-21-jev", "supports"],
    // Cloudflare 开放 Clef
    [
      "draft-candidate-rss-https-github-com-ollama-ollama-releases-tag-v0-35-1",
      "supports"
    ]
  ],
  // 同一个集群多出 33 个点的利用率
  "draft-candidate-rss-https-hf-mirror-com-blog-dharma-ai-gpu-management-pt2": [
    // FreeToken
    [
      "draft-candidate-rss-https-www-infoq-cn-article-tij5t0vj1yk0s7uov7se-utm-source-rss-amp-utm-medium-article",
      "supports"
    ],
    // TPU 巨核
    ["draft-candidate-rss-https-www-qbitai-com-p-497425", "supports"]
  ],
  // NeMo Automodel 接入 Diffus
  "draft-candidate-rss-https-hf-mirror-com-blog-nvidia-scale-diffusers-finetuning-nemo-automodel":
    [
      // NVIDIA Nemotron 开放数据
      [
        "draft-candidate-rss-https-hf-mirror-com-blog-nvidia-open-data-for-agents",
        "extends"
      ],
      // Olmo-core 3
      [
        "draft-candidate-rss-https-hf-mirror-com-blog-allenai-olmocore3",
        "supports"
      ]
    ],
  // vLLM 的 Transformers 后端达到
  "draft-candidate-rss-https-hf-mirror-com-blog-native-speed-vllm-transformers-backend":
    [
      // vLLM v0.25.0
      [
        "draft-candidate-rss-https-github-com-vllm-project-vllm-releases-tag-v0-25-0",
        "extends"
      ],
      // vLLM v0.26.0
      [
        "draft-candidate-rss-https-github-com-vllm-project-vllm-releases-tag-v0-26-0",
        "extends"
      ]
    ]
};

export interface SignalRecord {
  id: string;
  status: string;
  relatedTechnologyIds?: string[];
  [field: string]: unknown;
}

export interface TypingInput {
  /** The workspace overrides, as stored. */
  relations: LinkRelation[];
  seeds: LinkRelation[];
  /** `kind:id` of every published node. */
  knownNodes: Set<string>;
  signals: SignalRecord[];
  publishedSignalIds: Set<string>;
}

export interface TypingPlan {
  relations: LinkRelation[];
  signals: SignalRecord[];
  retyped: number;
  created: number;
  byType: Partial<Record<RelationType, number>>;
  signalChanges: { id: string; added: string[] }[];
  skipped: string[];
}

interface End {
  type: ContentKind;
  id: string;
}

function parseEnd(end: string): End {
  const at = end.indexOf(":");
  return { type: end.slice(0, at) as ContentKind, id: end.slice(at + 1) };
}

function keyOf(relation: LinkRelation): string {
  return getRelationPairKey(
    relation.fromId,
    relation.fromType,
    relation.toId,
    relation.toType
  );
}

/** Pure: the next override list and signal records, and what changed. */
export function planFallbackTyping(
  input: TypingInput,
  typings: FallbackTyping[] = fallbackRelationTypes,
  orphans: Record<string, [string, RelationType][]> = orphanSignalLinks,
  newRelationId: () => string = () => `rel-ws-${randomUUID().slice(0, 8)}`
): TypingPlan {
  const relations = input.relations.map((relation) => ({ ...relation }));
  const overrides = new Map(
    relations.map((relation) => [keyOf(relation), relation])
  );
  const seeds = new Map(
    input.seeds.map((relation) => [keyOf(relation), relation])
  );
  const plan: TypingPlan = {
    relations,
    signals: input.signals,
    retyped: 0,
    created: 0,
    byType: {},
    signalChanges: [],
    skipped: []
  };

  const setType = (from: End, to: End, relationType: RelationType) => {
    const pairKey = getRelationPairKey(from.id, from.type, to.id, to.type);
    const override = overrides.get(pairKey);
    const existing = override ?? seeds.get(pairKey);

    if (existing && existing.relationType !== "related-to") {
      if (existing.relationType !== relationType) {
        plan.skipped.push(
          `已是 ${existing.relationType}，不动：${from.id} ↔ ${to.id}`
        );
      }
      return;
    }

    const ends = {
      fromId: from.id,
      fromType: from.type,
      toId: to.id,
      toType: to.type
    };

    if (override) {
      // The stored direction carries no meaning except for `requires`.
      Object.assign(override, relationType === "requires" ? ends : {}, {
        relationType
      });
      plan.retyped += 1;
    } else {
      // A bare pair, or a seed stored as 关联: copy-on-write.
      const created: LinkRelation = {
        id: newRelationId(),
        ...ends,
        relationType,
        ...(existing?.note ? { note: existing.note } : {})
      };
      relations.push(created);
      overrides.set(pairKey, created);
      plan.created += 1;
    }
    plan.byType[relationType] = (plan.byType[relationType] ?? 0) + 1;
  };

  for (const [fromEnd, toEnd, relationType] of typings) {
    if (!input.knownNodes.has(fromEnd) || !input.knownNodes.has(toEnd)) {
      plan.skipped.push(`不是已发布的节点，跳过：${fromEnd} ↔ ${toEnd}`);
      continue;
    }
    setType(parseEnd(fromEnd), parseEnd(toEnd), relationType);
  }

  for (const id of Object.keys(orphans)) {
    if (!input.signals.some((record) => record.id === id)) {
      plan.skipped.push(`不在存储里，跳过：${id}`);
    }
  }

  plan.signals = input.signals.map((record) => {
    const links = orphans[record.id];
    if (!links) return record;
    if (record.status !== "published") {
      plan.skipped.push(`不是已发布的信号，跳过：${record.id}`);
      return record;
    }
    const current = record.relatedTechnologyIds ?? [];
    const added: string[] = [];
    for (const [targetId, relationType] of links) {
      if (targetId === record.id || !input.publishedSignalIds.has(targetId)) {
        plan.skipped.push(`目标不是已发布的信号，跳过：${targetId}`);
        continue;
      }
      setType(
        { type: "technology", id: record.id },
        { type: "technology", id: targetId },
        relationType
      );
      if (!current.includes(targetId)) added.push(targetId);
    }
    if (added.length === 0) return record;
    plan.signalChanges.push({ id: record.id, added });
    return { ...record, relatedTechnologyIds: [...current, ...added] };
  });

  return plan;
}

const typeLabels: Record<RelationType, string> = {
  "builds-on": "渊源",
  uses: "借助",
  explains: "释义",
  requires: "必备",
  extends: "延伸",
  supersedes: "续作",
  supports: "印证",
  "related-to": "关联"
};

function main() {
  const apply = process.argv.slice(3).includes("--apply");
  const relationPath = getLocalStoreFilePath("link-relation-workspace.json");
  const relationStore = readLocalJsonFile<{
    updatedAt?: string;
    relations?: LinkRelation[];
  }>(relationPath, {});
  const signalPath = getLocalStoreFilePath("technology-workspace.json");
  const signalStore = readLocalJsonFile<{
    updatedAt?: string;
    records?: SignalRecord[];
  }>(signalPath, {});
  const graph = getContentGraph();

  const plan = planFallbackTyping({
    relations: relationStore.relations ?? [],
    seeds: linkRelations,
    knownNodes: new Set(graph.nodes.map((node) => `${node.kind}:${node.id}`)),
    signals: signalStore.records ?? [],
    publishedSignalIds: new Set(getAllTechnologies().map((item) => item.id))
  });

  // The graph after the plan: today's edges plus the new orphan links, each
  // typed through the merged relations the plan would leave behind.
  const merged = applyLinkRelationOverlay(linkRelations, plan.relations);
  const kindOf = new Map(graph.nodes.map((node) => [node.id, node.kind]));
  const pairs = new Map(
    graph.edges.map((edge) => [
      [edge.sourceId, edge.targetId].sort().join("|"),
      [edge.sourceId, edge.targetId]
    ])
  );
  for (const change of plan.signalChanges) {
    for (const id of change.added) {
      pairs.set([change.id, id].sort().join("|"), [change.id, id]);
    }
  }
  const isFallback = ([a, b]: string[]) =>
    findRelationIn(merged, a, kindOf.get(a)!, b, kindOf.get(b)!)
      .relationType === "related-to";
  const before = graph.edges.filter(
    (edge) => edge.relationType === "related-to"
  ).length;
  const after = [...pairs.values()].filter(isFallback).length;
  const share = (part: number, whole: number) =>
    `${part} / ${whole}（${((part / whole) * 100).toFixed(1)}%）`;

  console.log(`关系：改类型 ${plan.retyped} 条，新建 ${plan.created} 条`);
  for (const [type, count] of Object.entries(plan.byType)) {
    console.log(`  ${typeLabels[type as RelationType]}（${type}） ${count}`);
  }
  console.log(`孤立信号：${plan.signalChanges.length} 条追加相关技术`);
  for (const change of plan.signalChanges) {
    console.log(`  ${change.id.slice(0, 72)}  +${change.added.length}`);
  }
  for (const line of plan.skipped) console.log(`  ${line}`);
  console.log(
    `\n图里的「关联」：${share(before, graph.edges.length)} → ${share(after, pairs.size)}`
  );

  const pending = plan.retyped + plan.created + plan.signalChanges.length;
  if (pending === 0) {
    console.log("\n没有需要写的。");
    return;
  }
  if (!apply) {
    console.log(`\n预览：共 ${pending} 处待写。加 --apply 写入。`);
    return;
  }

  const now = new Date().toISOString();
  if (plan.retyped + plan.created > 0) {
    writeLocalJsonFile(relationPath, {
      ...relationStore,
      updatedAt: now,
      relations: plan.relations
    });
  }
  if (plan.signalChanges.length > 0) {
    writeLocalJsonFile(signalPath, {
      ...signalStore,
      updatedAt: now,
      records: plan.signals
    });
  }
  console.log(`\n已写入 ${pending} 处（${path.dirname(relationPath)}）。`);
}

// Runs only when launched by scripts/run-ts.cjs, not when a test imports it.
if (path.basename(process.argv[2] ?? "") === "type-fallback-relations.ts") {
  main();
}
