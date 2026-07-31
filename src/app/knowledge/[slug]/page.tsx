import Link from "next/link";
import { notFound } from "next/navigation";

import { ContentBody } from "@/components/content-body";
import { DossierCard } from "@/components/dossier-card";
import { DossierCatalogNote } from "@/components/dossier-catalog-note";
import { DossierStampTag } from "@/components/dossier-stamp-tag";
import {
  RelationshipGraph,
  type RelationshipGraphNode
} from "@/components/relationship-graph";
import { FollowableTagList } from "@/components/followable-tag-list";
import { TagList } from "@/components/tag-list";
import { UserPageShell } from "@/components/user-page-shell";
import { UnbreakableTitle } from "@/components/unbreakable-title";
import {
  findRelationBetween,
  getAllKnowledge,
  getAllSkills,
  getAllTechnologies,
  getKnowledgeBySlug,
  getTagsByIds
} from "@/lib/content";
import {
  getPreferredTechnologySummary,
  getPreferredTechnologyTitle,
  getRelationTypeLabel
} from "@/lib/technology-localization";
import type {
  DifficultyLevel,
  HeatLevel,
  KnowledgeCategory,
  KnowledgeItem,
  SkillItem,
  SkillType,
  TechnologyItem
} from "@/types/content";

interface KnowledgeDetailPageProps {
  params: Promise<{ slug: string }>;
}

const categoryLabels: Record<KnowledgeCategory, string> = {
  "machine-learning": "机器学习",
  "software-architecture": "软件架构",
  data: "数据",
  "product-thinking": "产品思维",
  operations: "运维"
};

const difficultyLabels: Record<DifficultyLevel, string> = {
  foundation: "基础",
  intermediate: "进阶",
  advanced: "高级"
};

const skillTypeLabels: Record<SkillType, string> = {
  engineering: "工程落地",
  analysis: "评估与分析",
  product: "产品判断",
  operations: "运维与落地",
  communication: "团队沟通"
};

const heatLabels: Record<HeatLevel, string> = {
  hot: "当前热门",
  active: "活跃",
  emerging: "新兴"
};

function getRelatedTechnologies(
  knowledge: KnowledgeItem,
  technologies: TechnologyItem[]
): TechnologyItem[] {
  return technologies.filter((technology) =>
    knowledge.relatedTechnologyIds.includes(technology.id)
  );
}

function getRelatedSkills(
  knowledge: KnowledgeItem,
  skills: SkillItem[]
): SkillItem[] {
  return skills.filter((skill) => knowledge.relatedSkillIds.includes(skill.id));
}

export function generateStaticParams() {
  return getAllKnowledge().map((item) => ({ slug: item.slug }));
}

export default async function KnowledgeDetailPage({
  params
}: KnowledgeDetailPageProps) {
  const { slug } = await params;
  const knowledge = getKnowledgeBySlug(slug);

  if (!knowledge) {
    notFound();
  }

  const technologies = getAllTechnologies();
  const skills = getAllSkills();
  const tags = getTagsByIds(knowledge.tags);
  const relatedTechnologies = getRelatedTechnologies(knowledge, technologies);
  const relatedSkills = getRelatedSkills(knowledge, skills);
  const technologyRelations = relatedTechnologies.map((technology) =>
    findRelationBetween(knowledge.id, "knowledge", technology.id, "technology")
  );
  const skillRelations = relatedSkills.map((skill) =>
    findRelationBetween(knowledge.id, "knowledge", skill.id, "skill")
  );
  const graphNodes: RelationshipGraphNode[] = [
    ...relatedTechnologies.map((technology, index) => ({
      title: getPreferredTechnologyTitle(technology),
      href: `/technologies/${technology.slug}`,
      kind: "technology" as const,
      relationLabel: getRelationTypeLabel(
        technologyRelations[index].relationType,
        "zh"
      ),
      note: technologyRelations[index].note
    })),
    ...relatedSkills.map((skill, index) => ({
      title: skill.title,
      href: `/skills/${skill.slug}`,
      kind: "skill" as const,
      relationLabel: getRelationTypeLabel(
        skillRelations[index].relationType,
        "zh"
      ),
      note: skillRelations[index].note
    }))
  ];

  return (
    <UserPageShell
      title={knowledge.title}
      description={knowledge.summary}
      sectionLabel="背景知识"
      showHeader={false}
      className="skill-detail-page knowledge-detail-page dossier"
    >
      <div className="skill-detail-layout">
        <section className="skill-detail-hero">
          <p className="skill-detail-kicker">
            {categoryLabels[knowledge.category]}
          </p>
          <h1>
            <UnbreakableTitle text={knowledge.title} />
          </h1>
          <p>{knowledge.summary}</p>
          <div className="skill-detail-hero__meta">
            <DossierStampTag>
              {categoryLabels[knowledge.category]}
            </DossierStampTag>
            <DossierStampTag className="dossier-stamp-tag--muted">
              {difficultyLabels[knowledge.difficulty]}
            </DossierStampTag>
          </div>
          {tags.length > 0 ? <TagList tags={tags} limit={4} /> : null}
        </section>

        <div className="skill-detail-layout__body">
          <main className="skill-detail-main">
            {knowledge.content ? (
              <section className="skill-detail-section skill-detail-section--lead">
                <h2>这个概念是什么意思</h2>
                <ContentBody body={knowledge.content} />
              </section>
            ) : null}

            <RelationshipGraph
              centerTitle={knowledge.title}
              nodes={graphNodes}
              sectionClassName="skill-detail-section"
              hint="这个概念相邻的技术信号与相关技能，点击节点可继续探索。"
            />

            {relatedTechnologies.length > 0 ? (
              <section className="skill-detail-section">
                <div className="skill-detail-section__header">
                  <div>
                    <p>可解释</p>
                    <h2>这个概念能解释的技术信号</h2>
                  </div>
                </div>
                <div className="skill-detail-related-list">
                  {relatedTechnologies.map((technology, index) => {
                    const technologyTags = getTagsByIds(technology.tags);

                    return (
                      <DossierCard
                        className="skill-detail-related-card"
                        key={technology.id}
                      >
                        <div>
                          <div className="skill-detail-related-card__toprow">
                            <p className="skill-detail-related-card__meta">
                              {technology.sourceName} · {technology.publishDate}
                            </p>
                            <DossierStampTag>
                              {getRelationTypeLabel(
                                technologyRelations[index].relationType,
                                "zh"
                              )}
                            </DossierStampTag>
                          </div>
                          <h3>
                            <Link href={`/technologies/${technology.slug}`}>
                              {getPreferredTechnologyTitle(technology)}
                            </Link>
                          </h3>
                          <p>{getPreferredTechnologySummary(technology)}</p>
                          {technology.whyItMatters ? (
                            <DossierCatalogNote label="这个概念在这里如何体现">
                              {technology.whyItMatters}
                            </DossierCatalogNote>
                          ) : null}
                          {technologyTags.length > 0 ? (
                            <TagList tags={technologyTags} limit={2} />
                          ) : null}
                        </div>
                        <Link
                          className="skill-detail-related-card__link"
                          href={`/technologies/${technology.slug}`}
                        >
                          查看相关信号
                        </Link>
                      </DossierCard>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {relatedSkills.length > 0 ? (
              <section className="skill-detail-section">
                <div className="skill-detail-section__header">
                  <div>
                    <p>搭配技能</p>
                    <h2>使用这个概念的技能</h2>
                  </div>
                </div>
                <div className="skill-detail-related-list">
                  {relatedSkills.map((skill, index) => {
                    const skillTags = getTagsByIds(skill.tags);

                    return (
                      <DossierCard
                        className="skill-detail-related-card skill-detail-related-card--knowledge"
                        key={skill.id}
                      >
                        <div>
                          <div className="skill-detail-related-card__toprow">
                            <p className="skill-detail-related-card__meta">
                              {skillTypeLabels[skill.skillType]} ·{" "}
                              {heatLabels[skill.heatLevel]}
                            </p>
                            <DossierStampTag>
                              {getRelationTypeLabel(
                                skillRelations[index].relationType,
                                "zh"
                              )}
                            </DossierStampTag>
                          </div>
                          <h3>
                            <Link href={`/skills/${skill.slug}`}>
                              {skill.title}
                            </Link>
                          </h3>
                          <p>{skill.summary}</p>
                          <DossierCatalogNote>
                            {skillRelations[index].note ??
                              "有了这个概念，这项技能会更容易练习和应用。"}
                          </DossierCatalogNote>
                          {skillTags.length > 0 ? (
                            <TagList tags={skillTags} limit={2} />
                          ) : null}
                        </div>
                        <Link
                          className="skill-detail-related-card__link"
                          href={`/skills/${skill.slug}`}
                        >
                          查看技能
                        </Link>
                      </DossierCard>
                    );
                  })}
                </div>
              </section>
            ) : null}
          </main>

          <aside className="skill-detail-aside" aria-label="知识概览">
            <section className="skill-detail-aside-card">
              <p className="skill-detail-kicker">知识档案</p>
              <dl className="skill-detail-profile">
                <div>
                  <dt>类别</dt>
                  <dd>{categoryLabels[knowledge.category]}</dd>
                </div>
                <div>
                  <dt>难度</dt>
                  <dd>{difficultyLabels[knowledge.difficulty]}</dd>
                </div>
                <div>
                  <dt>技术信号</dt>
                  <dd>{relatedTechnologies.length}</dd>
                </div>
                <div>
                  <dt>关联技能</dt>
                  <dd>{relatedSkills.length}</dd>
                </div>
              </dl>
            </section>

            {tags.length > 0 ? (
              <section className="skill-detail-aside-card">
                <p className="skill-detail-kicker">主题</p>
                <FollowableTagList tags={tags} />
              </section>
            ) : null}

            <section className="skill-detail-aside-card">
              <p className="skill-detail-kicker">阅读路径</p>
              <p>
                先从概念开始，打开一条相关信号，再用关联技能决定接下来评估什么。
              </p>
            </section>
          </aside>
        </div>
      </div>
    </UserPageShell>
  );
}
