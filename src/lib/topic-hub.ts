import {
  getAllKnowledge,
  getAllSkills,
  getAllTags,
  getAllTechnologies,
  getContentGraph
} from "@/lib/content";
import {
  getPreferredTechnologySummary,
  getPreferredTechnologyTitle
} from "@/lib/technology-localization";
import type {
  ContentKind,
  KnowledgeItem,
  RelationType,
  SkillItem,
  TopicTag
} from "@/types/content";

/**
 * 专题聚合页数据（/topics/[tagId]）：把 /network、/timeline、/search 各自展示
 * 某一话题的碎片合并成一个页面——该话题下的已发布技术信号、相关技能、背景
 * 知识，以及图谱里的直接邻居（来自 getContentGraph，排除已经在上面三组里的
 * 节点）。纯派生视图，不引入新的持久化字段或 AI 调用。
 */
export interface TopicHubTechnologyEntry {
  slug: string;
  title: string;
  summary: string;
  publishDate: string;
  sourceName: string;
}

export interface TopicHubRelatedNode {
  id: string;
  title: string;
  href: string;
  kind: ContentKind;
  relationType: RelationType;
  note?: string;
}

export interface TopicHubData {
  tag: TopicTag;
  technologies: TopicHubTechnologyEntry[];
  skills: SkillItem[];
  knowledge: KnowledgeItem[];
  relatedNodes: TopicHubRelatedNode[];
}

export function getTopicHub(tagId: string): TopicHubData | undefined {
  const tag = getAllTags().find((item) => item.id === tagId);

  if (!tag) {
    return undefined;
  }

  const technologies = getAllTechnologies()
    .filter((item) => item.tags.includes(tagId))
    .sort((left, right) => right.publishDate.localeCompare(left.publishDate));
  const skills = getAllSkills().filter((item) => item.tags.includes(tagId));
  const knowledge = getAllKnowledge().filter((item) =>
    item.tags.includes(tagId)
  );

  if (
    technologies.length === 0 &&
    skills.length === 0 &&
    knowledge.length === 0
  ) {
    return undefined;
  }

  const topicNodeIds = new Set<string>([
    ...technologies.map((item) => item.id),
    ...skills.map((item) => item.id),
    ...knowledge.map((item) => item.id)
  ]);

  const graph = getContentGraph();
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const relatedNodes: TopicHubRelatedNode[] = [];
  const seenNeighborIds = new Set<string>();

  for (const edge of graph.edges) {
    const isSourceInTopic = topicNodeIds.has(edge.sourceId);
    const isTargetInTopic = topicNodeIds.has(edge.targetId);

    if (!isSourceInTopic && !isTargetInTopic) {
      continue;
    }

    const neighborId = isSourceInTopic ? edge.targetId : edge.sourceId;

    if (topicNodeIds.has(neighborId) || seenNeighborIds.has(neighborId)) {
      continue;
    }

    const neighborNode = nodeById.get(neighborId);

    if (!neighborNode) {
      continue;
    }

    seenNeighborIds.add(neighborId);
    relatedNodes.push({
      id: neighborNode.id,
      title: neighborNode.title,
      href: neighborNode.href,
      kind: neighborNode.kind,
      relationType: edge.relationType,
      note: edge.note
    });
  }

  return {
    tag,
    technologies: technologies.map((item) => ({
      slug: item.slug,
      title: getPreferredTechnologyTitle(item),
      summary: getPreferredTechnologySummary(item),
      publishDate: item.publishDate,
      sourceName: item.sourceName
    })),
    skills,
    knowledge,
    relatedNodes
  };
}
