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
  TechnologyItem,
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

/**
 * 话题总览（/topics）：列出每一个专题页存在的话题——与 getTopicHub 的
 * notFound 规则一致，至少有一条已发布信号、技能或知识——附带三类内容各
 * 几条。按信号数降序，同数按名称排。纯派生视图，只读公开池。
 */
export interface TopicIndexEntry {
  id: string;
  name: string;
  description: string;
  technologyCount: number;
  skillCount: number;
  knowledgeCount: number;
}

export interface TopicIndexData {
  topics: TopicIndexEntry[];
  /** 至少挂在一个已列出话题下的内容条数（去重），用于页头的计数行。 */
  coverage: {
    technologies: number;
    skills: number;
    knowledge: number;
  };
}

type TaggedItem = Pick<
  TechnologyItem | SkillItem | KnowledgeItem,
  "id" | "tags"
>;

export function buildTopicIndex(
  tags: TopicTag[],
  technologies: TaggedItem[],
  skills: TaggedItem[],
  knowledge: TaggedItem[]
): TopicIndexData {
  const tagIds = new Set(tags.map((tag) => tag.id));
  const countByTag = (items: TaggedItem[]) => {
    const counts = new Map<string, number>();

    for (const item of items) {
      for (const tagId of new Set(item.tags)) {
        counts.set(tagId, (counts.get(tagId) ?? 0) + 1);
      }
    }

    return counts;
  };
  const coveredCount = (items: TaggedItem[]) =>
    items.filter((item) => item.tags.some((tagId) => tagIds.has(tagId))).length;

  const technologyCounts = countByTag(technologies);
  const skillCounts = countByTag(skills);
  const knowledgeCounts = countByTag(knowledge);

  const topics = tags
    .map((tag) => ({
      id: tag.id,
      name: tag.name,
      description: tag.description,
      technologyCount: technologyCounts.get(tag.id) ?? 0,
      skillCount: skillCounts.get(tag.id) ?? 0,
      knowledgeCount: knowledgeCounts.get(tag.id) ?? 0
    }))
    .filter(
      (entry) =>
        entry.technologyCount + entry.skillCount + entry.knowledgeCount > 0
    )
    .sort(
      (left, right) =>
        right.technologyCount - left.technologyCount ||
        left.name.localeCompare(right.name, "zh-CN")
    );

  return {
    topics,
    coverage: {
      technologies: coveredCount(technologies),
      skills: coveredCount(skills),
      knowledge: coveredCount(knowledge)
    }
  };
}

export function getTopicIndex(): TopicIndexData {
  return buildTopicIndex(
    getAllTags(),
    getAllTechnologies(),
    getAllSkills(),
    getAllKnowledge()
  );
}
