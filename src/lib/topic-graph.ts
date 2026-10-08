import type {
  ContentGraphData,
  ContentGraphEdge,
  ContentGraphNode
} from "@/lib/content";
import { clamp, PAD, settleForceLayout, VIEW_SIZE } from "@/lib/network-layout";
import type { RelationType } from "@/types/content";

/**
 * 话题图谱（/topics/[tagId] 的小图）：话题自己的条目加上它们在图谱里的直接
 * 邻居，画成一张静态的小关系图。
 *
 * 不能整片画。2026-10-08 实测（134 节点 / 953 边）：一个话题自己的条目
 * 2–68 条，直接邻居 11–96 个，两者合起来 13–130 个节点、25–926 条边——
 * 十个话题里有八个几乎就是整张 /network。所以有上限：
 *
 * - 话题自己的条目最多 `MAX_TOPIC_NODES` 个，按它和同话题其他条目之间的连接
 *   数排（这个话题里的枢纽），同数按全图连接数、再按标题；
 * - 剩下的名额（总数 `MAX_NODES`）给话题外的邻居，按它连到已选条目的条数
 *   排，连不到已选条目的不画（画出来是一个孤点）。
 *
 * 边是图谱里两端都被选中的全部边。纯派生视图，只用 getContentGraph 的公开
 * 字段（标题、链接、种类、关系类型）。
 */
export const MAX_NODES = 16;
export const MAX_TOPIC_NODES = 10;

export interface TopicGraphNode extends ContentGraphNode {
  /** true：本话题的条目；false：话题外的直接邻居。 */
  inTopic: boolean;
}

export interface TopicGraphData {
  nodes: TopicGraphNode[];
  edges: ContentGraphEdge[];
  /** 本话题条目总数、话题外邻居总数——图下的说明要写「N 条里的 M 条」。 */
  topicNodeTotal: number;
  neighborTotal: number;
}

function compareTitles(left: ContentGraphNode, right: ContentGraphNode) {
  return left.title.localeCompare(right.title, "zh-CN");
}

export function buildTopicGraph(
  topicNodeIds: ReadonlySet<string>,
  graph: ContentGraphData
): TopicGraphData {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const topicNodes = graph.nodes.filter((node) => topicNodeIds.has(node.id));
  const degree = new Map<string, number>();
  const inTopicDegree = new Map<string, number>();
  const neighborIds = new Set<string>();

  const bump = (map: Map<string, number>, id: string) =>
    map.set(id, (map.get(id) ?? 0) + 1);

  for (const edge of graph.edges) {
    bump(degree, edge.sourceId);
    bump(degree, edge.targetId);

    const sourceIn = topicNodeIds.has(edge.sourceId);
    const targetIn = topicNodeIds.has(edge.targetId);

    if (sourceIn && targetIn) {
      bump(inTopicDegree, edge.sourceId);
      bump(inTopicDegree, edge.targetId);
    } else if (sourceIn && nodeById.has(edge.targetId)) {
      neighborIds.add(edge.targetId);
    } else if (targetIn && nodeById.has(edge.sourceId)) {
      neighborIds.add(edge.sourceId);
    }
  }

  const chosenTopic = [...topicNodes]
    .sort(
      (left, right) =>
        (inTopicDegree.get(right.id) ?? 0) -
          (inTopicDegree.get(left.id) ?? 0) ||
        (degree.get(right.id) ?? 0) - (degree.get(left.id) ?? 0) ||
        compareTitles(left, right)
    )
    .slice(0, MAX_TOPIC_NODES);
  const chosenTopicIds = new Set(chosenTopic.map((node) => node.id));

  const linksToChosen = new Map<string, number>();

  for (const edge of graph.edges) {
    if (chosenTopicIds.has(edge.sourceId) && neighborIds.has(edge.targetId)) {
      bump(linksToChosen, edge.targetId);
    } else if (
      chosenTopicIds.has(edge.targetId) &&
      neighborIds.has(edge.sourceId)
    ) {
      bump(linksToChosen, edge.sourceId);
    }
  }

  const chosenNeighbors = [...neighborIds]
    .filter((id) => (linksToChosen.get(id) ?? 0) > 0)
    .map((id) => nodeById.get(id) as ContentGraphNode)
    .sort(
      (left, right) =>
        (linksToChosen.get(right.id) ?? 0) -
          (linksToChosen.get(left.id) ?? 0) ||
        (degree.get(right.id) ?? 0) - (degree.get(left.id) ?? 0) ||
        compareTitles(left, right)
    )
    .slice(0, MAX_NODES - chosenTopic.length);

  const nodes: TopicGraphNode[] = [
    ...chosenTopic.map((node) => ({ ...node, inTopic: true })),
    ...chosenNeighbors.map((node) => ({ ...node, inTopic: false }))
  ];
  const chosenIds = new Set(nodes.map((node) => node.id));

  return {
    nodes,
    edges: graph.edges.filter(
      (edge) => chosenIds.has(edge.sourceId) && chosenIds.has(edge.targetId)
    ),
    topicNodeTotal: topicNodes.length,
    neighborTotal: neighborIds.size
  };
}

/**
 * 八种关系类型归成四族上色——八种颜色在一张小图上分不出来。图例按族列出
 * 每族包含的类型名。
 */
export type RelationFamily = "lineage" | "dependency" | "evidence" | "plain";

export const relationFamilyOrder: RelationFamily[] = [
  "lineage",
  "dependency",
  "evidence",
  "plain"
];

export const relationFamilyTypes: Record<RelationFamily, RelationType[]> = {
  lineage: ["builds-on", "supersedes", "extends"],
  dependency: ["requires", "uses"],
  evidence: ["explains", "supports"],
  plain: ["related-to"]
};

export function getRelationFamily(relationType: RelationType): RelationFamily {
  return (
    relationFamilyOrder.find((family) =>
      relationFamilyTypes[family].includes(relationType)
    ) ?? "plain"
  );
}

export type TopicGraphPositions = Record<string, { x: number; y: number }>;

/**
 * 画布按 560px 宽估算（`.topic-graph__canvas` 的上限；860px 以下画布更宽，
 * 640px 以下不显示节点名），节点名 11.5px、最宽 8.5em、最多两行，与
 * topic-mini-graph.css 一致。
 */
const CANVAS_PX = 560;
const FONT_PX = 11.5;
const LABEL_MAX_PX = 8.5 * FONT_PX;
const LINE_PX = 15;
const GAP_PX = 4;

interface Footprint {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** 节点（点 + 下方的名字）相对节点中心占的矩形，单位是画布的 0–100。 */
export function estimateFootprint(title: string): Footprint {
  let width = 0;

  for (const char of title) {
    width += (char.codePointAt(0) ?? 0) >= 0x2e80 ? FONT_PX : FONT_PX * 0.56;
  }

  const lines = width > LABEL_MAX_PX ? 2 : 1;
  const half = Math.max(Math.min(width, LABEL_MAX_PX), 15) / 2 + GAP_PX / 2;
  const toUnits = VIEW_SIZE / CANVAS_PX;

  return {
    left: -half * toUnits,
    right: half * toUnits,
    top: -(8 + GAP_PX / 2) * toUnits,
    bottom: (10 + LINE_PX * lines + GAP_PX / 2) * toUnits
  };
}

/**
 * 力导布局只把点分开，不管点下面的名字；2026-10-08 在十个话题上实测，
 * 1440px 下每个话题有 0–4 对名字互相压住。这里在布局之后把相交的矩形沿
 * 重叠较小的方向推开，直到没有相交或到达迭代上限。确定性，不用随机数。
 */
export function separateFootprints(
  positions: TopicGraphPositions,
  footprints: Record<string, Footprint>,
  min: number,
  max: number,
  iterations = 200
): TopicGraphPositions {
  const ids = Object.keys(positions).sort();
  const next: TopicGraphPositions = {};

  for (const id of ids) {
    next[id] = { ...positions[id] };
  }

  for (let round = 0; round < iterations; round += 1) {
    let moved = false;

    for (let i = 0; i < ids.length; i += 1) {
      for (let j = i + 1; j < ids.length; j += 1) {
        const a = next[ids[i]];
        const b = next[ids[j]];
        const fa = footprints[ids[i]];
        const fb = footprints[ids[j]];
        const overlapX =
          Math.min(a.x + fa.right, b.x + fb.right) -
          Math.max(a.x + fa.left, b.x + fb.left);
        const overlapY =
          Math.min(a.y + fa.bottom, b.y + fb.bottom) -
          Math.max(a.y + fa.top, b.y + fb.top);

        if (overlapX <= 0 || overlapY <= 0) {
          continue;
        }

        moved = true;

        if (overlapX < overlapY) {
          const push = overlapX / 2 + 0.05;
          const direction = a.x <= b.x ? -1 : 1;

          a.x = clamp(a.x + direction * push, min, max);
          b.x = clamp(b.x - direction * push, min, max);
        } else {
          const push = overlapY / 2 + 0.05;
          const direction = a.y <= b.y ? -1 : 1;

          a.y = clamp(a.y + direction * push, min, max);
          b.y = clamp(b.y - direction * push, min, max);
        }
      }
    }

    if (!moved) {
      break;
    }
  }

  return next;
}

/**
 * 跑完 /network 的同一套力导布局（只在服务端跑一次，不逐帧绘制），把坐标收进
 * 画布中间 `inset`–(100 − inset) 的范围（贴边的节点名会被画布裁掉），再把
 * 互相压住的节点名推开。
 */
export function layoutTopicGraph(
  data: Pick<TopicGraphData, "nodes" | "edges">,
  inset = 12
): TopicGraphPositions {
  const settled = settleForceLayout(data.nodes, data.edges);
  const span = VIEW_SIZE - PAD * 2;
  const target = VIEW_SIZE - inset * 2;
  const positions: TopicGraphPositions = {};
  const footprints: Record<string, Footprint> = {};

  for (const node of data.nodes) {
    const point = settled[node.id];

    if (!point) {
      continue;
    }

    positions[node.id] = {
      x: inset + ((point.x - PAD) / span) * target,
      y: inset + ((point.y - PAD) / span) * target
    };
    footprints[node.id] = estimateFootprint(node.title);
  }

  return separateFootprints(positions, footprints, inset, VIEW_SIZE - inset);
}
