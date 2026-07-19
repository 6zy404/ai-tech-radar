import Link from "next/link";

import { DetailInfoCard } from "@/components/detail-info-card";
import { PublishReadinessPanel } from "@/components/publish-readiness-panel";
import { TechnologyEditorialEnrichmentPanel } from "@/components/technology-editorial-enrichment-panel";
import { TechnologyWorkspaceActions } from "@/components/technology-workspace-actions";
import { TechnologyWorkspaceEditForm } from "@/components/technology-workspace-edit-form";
import { WorkflowEventList } from "@/components/workflow-event-list";
import { WorkspaceStatusBadge } from "@/components/workspace-status-badge";
import type { PublishReadinessResult } from "@/lib/publish-readiness";
import { evaluateTechnologyPriority } from "@/lib/ranking";
import type { RelationDefaultsMap } from "@/lib/relation-defaults";
import {
  getPriorityLevelClass,
  getPriorityLevelLabel,
  getRankingSourceLabel
} from "@/lib/ranking-display";
import type {
  KnowledgeItem,
  EditorialEnrichmentSuggestion,
  SkillItem,
  TechnologyDraft,
  TopicTag,
  WorkflowEvent
} from "@/types/content";

interface TechnologyDraftDetailContentProps {
  draft: TechnologyDraft;
  tagOptions: TopicTag[];
  skillOptions: SkillItem[];
  knowledgeOptions: KnowledgeItem[];
  readiness: PublishReadinessResult;
  workflowEvents: WorkflowEvent[];
  enrichmentSuggestions: EditorialEnrichmentSuggestion[];
  relationDefaults?: RelationDefaultsMap;
}

function getDraftDisplayTitle(draft: TechnologyDraft): string {
  return draft.title.zh ?? draft.title.original;
}

function getStatusTone(
  status: TechnologyDraft["status"]
): "neutral" | "success" | "warning" {
  if (status === "published") {
    return "success";
  }

  if (status === "archived") {
    return "warning";
  }

  return "neutral";
}

const draftStatusLabels: Record<TechnologyDraft["status"], string> = {
  draft: "草稿",
  published: "已发布",
  archived: "已归档"
};

export function TechnologyDraftDetailContent({
  draft,
  tagOptions,
  skillOptions,
  knowledgeOptions,
  readiness,
  workflowEvents,
  enrichmentSuggestions,
  relationDefaults
}: TechnologyDraftDetailContentProps) {
  const ranking = evaluateTechnologyPriority(draft);

  return (
    <div className="detail-layout">
      <div className="detail-main">
        <section className="detail-panel technology-detail-panel workspace-object-hero">
          <p className="eyebrow">技术工作台</p>
          <h1>{getDraftDisplayTitle(draft)}</h1>
          <p className="technology-detail-panel__summary">
            {draft.summary.zh ?? draft.summary.original}
          </p>
          <p className="translation-note">
            这条记录由导入候选生成，在面向用户发布前会一直留在内部工作台中。
          </p>
          <div className="candidate-detail-hero__meta">
            <WorkspaceStatusBadge
              label={draftStatusLabels[draft.status]}
              tone={getStatusTone(draft.status)}
            />
            <span className="info-pill">
              {draft.sourceLanguage.toUpperCase()}
            </span>
            <span className="info-pill">{draft.translationStatus}</span>
            <span className={getPriorityLevelClass(ranking.priorityLevel)}>
              {getPriorityLevelLabel(ranking.priorityLevel, "zh")}
            </span>
          </div>
          <TechnologyWorkspaceActions
            recordId={draft.id}
            status={draft.status}
            readiness={readiness}
          />
        </section>

        <PublishReadinessPanel readiness={readiness} />

        <TechnologyEditorialEnrichmentPanel
          record={draft}
          suggestions={enrichmentSuggestions}
        />

        <section className="section-panel technology-detail-panel__content">
          <h2>记录正文</h2>
          <p className="detail-copy">
            {draft.content.zh ?? draft.content.original}
          </p>
        </section>

        <section className="section-panel">
          <h2>编辑备注</h2>
          <ul className="relation-list">
            {draft.editorialNotes.map((note) => (
              <li key={note} className="relation-list__item">
                <div>
                  <p>{note}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="section-panel">
          <TechnologyWorkspaceEditForm
            record={draft}
            tagOptions={tagOptions}
            skillOptions={skillOptions}
            knowledgeOptions={knowledgeOptions}
            relationDefaults={relationDefaults}
          />
        </section>

        <WorkflowEventList
          events={workflowEvents}
          title="草稿工作流事件"
          description="这条工作台记录最近的发布、编辑与转换事件。"
        />
      </div>

      <aside className="detail-side">
        <DetailInfoCard
          title="草稿参考"
          rows={[
            {
              label: "优先级",
              value: (
                <span className={getPriorityLevelClass(ranking.priorityLevel)}>
                  {getPriorityLevelLabel(ranking.priorityLevel, "zh")}
                </span>
              )
            },
            {
              label: "判定方式",
              value: getRankingSourceLabel(ranking.rankingSource)
            },
            {
              label: "优先级理由",
              value: ranking.priorityReasons.slice(0, 3).join(" ")
            },
            {
              label: "优先级警告",
              value:
                ranking.priorityWarnings.length > 0
                  ? ranking.priorityWarnings.slice(0, 3).join(" ")
                  : "无优先级警告"
            },
            {
              label: "来源候选",
              value: draft.sourceCandidateId ? (
                <Link
                  href={`/workspace/candidates/${draft.sourceCandidateId}`}
                  className="detail-info-card__link"
                >
                  打开导入候选
                </Link>
              ) : (
                "无来源候选关联"
              )
            },
            {
              label: "状态",
              value: draftStatusLabels[draft.status]
            },
            {
              label: "用户端页面",
              value:
                draft.status === "published" ? (
                  <Link
                    href={`/technologies/${draft.slug}`}
                    className="detail-info-card__link"
                  >
                    打开已发布技术页面
                  </Link>
                ) : (
                  "尚未在用户产品中可见"
                )
            },
            {
              label: "预览",
              value: (
                <Link
                  href={`/workspace/technologies/${draft.id}/preview`}
                  className="detail-info-card__link"
                >
                  打开用户端预览
                </Link>
              )
            },
            {
              label: "来源",
              value: draft.sourceName
            },
            {
              label: "来源 URL",
              value: (
                <a
                  className="detail-info-card__link"
                  href={draft.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {draft.sourceUrl}
                </a>
              )
            },
            {
              label: "附加引用",
              value:
                draft.sourceReferences && draft.sourceReferences.length > 0 ? (
                  <div className="candidate-source-link">
                    {draft.sourceReferences.map((reference) => (
                      <Link
                        key={`${reference.candidateId}-${reference.sourceUrl}`}
                        href={`/workspace/candidates/${reference.candidateId}`}
                        className="detail-info-card__link"
                      >
                        {reference.sourceName}
                      </Link>
                    ))}
                  </div>
                ) : (
                  "无附加重复引用"
                )
            },
            {
              label: "类型",
              value: draft.type
            },
            {
              label: "发布方",
              value: draft.publisherName
            },
            {
              label: "语言",
              value: draft.sourceLanguage.toUpperCase()
            },
            {
              label: "翻译状态",
              value: draft.translationStatus
            },
            {
              label: "标签",
              value: draft.tags.length > 0 ? draft.tags.join(", ") : "无"
            },
            {
              label: "更新于",
              value: draft.updatedAt.slice(0, 10)
            }
          ]}
        />
      </aside>
    </div>
  );
}
