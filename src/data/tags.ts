import type { TopicTag } from "@/types/content";

export const topicTags: TopicTag[] = [
  {
    id: "tag-ai-agents",
    name: "AI 智能体",
    description: "面向多步骤、会使用工具的 AI 系统的工具与模式。"
  },
  {
    id: "tag-retrieval",
    name: "检索",
    description: "搜索、依据接地和上下文组装的工作流。"
  },
  {
    id: "tag-multimodal",
    name: "多模态",
    description: "结合文本、图像、语音或浏览器操作的界面。"
  },
  {
    id: "tag-workflow",
    name: "工作流",
    description: "让 AI 工具在真实团队中可用的运营模式。"
  },
  {
    id: "tag-on-device",
    name: "端侧 AI",
    description: "在笔记本、手机或边缘设备上本地运行有能力的模型。"
  },
  {
    id: "tag-observability",
    name: "可观测性",
    description: "生产环境里的追踪、监控与事后复盘。"
  },
  {
    id: "tag-knowledge-graph",
    name: "知识图谱",
    description: "用于连接概念、实体和任务的结构化关系。"
  },
  {
    id: "tag-product-strategy",
    name: "产品策略",
    description: "判断什么最值得优先学习、交付和试点的方法。"
  },
  {
    id: "tag-inference",
    name: "推理与部署",
    description: "大模型推理引擎、部署形态与成本优化相关的信号。"
  },
  {
    id: "tag-frontier-models",
    name: "前沿模型",
    description: "旗舰大模型的代际更新、能力边界与性价比变化。"
  },
  {
    id: "tag-ai-safety",
    name: "安全与对齐",
    description:
      "模型与智能体的安全事件、红队、对齐方法，以及网络安全能力的管控。"
  },
  {
    id: "tag-open-weights",
    name: "开放权重模型",
    description: "公开权重的模型发布、许可条款与开放生态。"
  },
  {
    id: "tag-agent-infra",
    name: "智能体运行时与协议",
    description:
      "智能体的运行时、编排框架、沙箱与 MCP 等协议：智能体跑在哪里、怎样接工具。"
  },
  {
    id: "tag-ai-for-science",
    name: "AI 与科研",
    description: "用 AI 做数学、生物医学等科学研究，以及 AI 加速研究本身。"
  },
  {
    id: "tag-coding-agents",
    name: "编码智能体",
    description: "用智能体写代码、审代码、改代码，以及它给工程流程带来的变化。"
  },
  {
    id: "tag-model-pricing",
    name: "价格与成本",
    description: "模型定价、算力与 token 成本，以及按任务算的真实花费。"
  },
  {
    id: "tag-benchmarks",
    name: "基准与评测",
    description: "基准本身的设计与可信度、第三方评测和评测口径。"
  },
  {
    id: "tag-training",
    name: "训练与后训练",
    description: "预训练、强化学习、微调与合成数据，以及训练框架和环境。"
  },
  {
    id: "tag-efficient-inference",
    name: "量化与推测解码",
    description: "量化、推测解码等让模型更省显存、出字更快的技术。"
  }
];
