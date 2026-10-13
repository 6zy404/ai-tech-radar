import type { Locale } from "@/lib/i18n/locale";

/* Interface text of /network and its graph. See copy/shell.ts. */

const zh = {
  title: "关系网络总览",
  description: "一次看清全部已发布技术、技能和背景知识之间的连接。",
  sectionLabel: "关系网络",
  kinds: { technology: "技术", skill: "技能", knowledge: "知识" },
  allKinds: "全部类型",
  searchPlaceholder: "搜索节点标题",
  openDetail: "查看详情",
  noConnections: "暂无已记录的连接。",
  hint: "节点默认只显示彩色圆点；悬停或搜索可以看到名称。点击任意节点查看它的直接连接，拖动节点可以重新摆放；再次点击节点可取消选中。",
  relationTypes: "关系类型",
  matched: (matched: number, total: number) =>
    `匹配 ${matched} / ${total} 个节点`,
  counts: (nodes: number, edges: number) => `${nodes} 个节点 · ${edges} 条连接`,
  chineseOnly: ""
};

const en: typeof zh = {
  title: "Network overview",
  description:
    "Every connection between the published signals, skills and background knowledge, in one view.",
  sectionLabel: "Network",
  kinds: { technology: "Signals", skill: "Skills", knowledge: "Knowledge" },
  allKinds: "All kinds",
  searchPlaceholder: "Search node titles",
  openDetail: "Open page",
  noConnections: "No connections recorded yet.",
  hint: "Nodes show as coloured dots; hover or search to see their names. Click a node to see its direct connections, drag one to move it, and click it again to deselect.",
  relationTypes: "Relation types",
  matched: (matched, total) => `${matched} of ${total} nodes match`,
  counts: (nodes, edges) => `${nodes} nodes · ${edges} links`,
  chineseOnly:
    "Skill and knowledge titles are in Chinese, as are signals from Chinese sources."
};

export const networkCopy: Record<Locale, typeof zh> = { zh, en };
