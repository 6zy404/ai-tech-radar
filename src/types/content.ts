export type ContentKind = "technology" | "skill" | "knowledge";

export type TechnologyType =
  | "platform"
  | "tool"
  | "model"
  | "protocol"
  | "workflow";

export type PublisherType =
  | "big-tech"
  | "startup"
  | "research-lab"
  | "open-source-community"
  | "media";

export type ImportanceLevel = "signal" | "important" | "critical";

export type TechnologyStatus = "watch" | "learn-first" | "pilot-later";

export type SkillType =
  | "engineering"
  | "analysis"
  | "product"
  | "operations"
  | "communication";

export type HeatLevel = "emerging" | "active" | "hot";

export type LearningCost = "low" | "medium" | "high";

export type KnowledgeCategory =
  | "machine-learning"
  | "software-architecture"
  | "data"
  | "product-thinking"
  | "operations";

export type DifficultyLevel = "foundation" | "intermediate" | "advanced";

export type RelationType =
  | "builds-on"
  | "uses"
  | "explains"
  | "requires"
  | "extends"
  | "supports"
  | "related-to";

export interface TopicTag {
  id: string;
  name: string;
  description: string;
}

export interface TechnologyItem {
  id: string;
  title: string;
  slug: string;
  summary: string;
  content: string;
  type: TechnologyType;
  publishDate: string;
  sourceName: string;
  sourceUrl: string;
  publisherName: string;
  publisherType: PublisherType;
  importanceLevel: ImportanceLevel;
  status: TechnologyStatus;
  tags: string[];
  relatedKnowledgeIds: string[];
  relatedSkillIds: string[];
}

export interface SkillItem {
  id: string;
  title: string;
  slug: string;
  summary: string;
  content: string;
  skillType: SkillType;
  heatLevel: HeatLevel;
  learningCost: LearningCost;
  tags: string[];
  relatedTechnologyIds: string[];
  relatedKnowledgeIds: string[];
}

export interface KnowledgeItem {
  id: string;
  title: string;
  slug: string;
  summary: string;
  content: string;
  category: KnowledgeCategory;
  difficulty: DifficultyLevel;
  tags: string[];
  relatedTechnologyIds: string[];
  relatedSkillIds: string[];
}

export interface LinkRelation {
  id: string;
  fromId: string;
  fromType: ContentKind;
  toId: string;
  toType: ContentKind;
  relationType: RelationType;
  note: string;
}

export interface RelationListItem {
  id: string;
  title: string;
  href: string;
  relationType: RelationType;
  note: string;
}
