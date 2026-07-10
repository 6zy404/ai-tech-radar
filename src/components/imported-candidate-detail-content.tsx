import Link from "next/link";

import { DetailInfoCard } from "@/components/detail-info-card";
import { ImportedCandidateReviewActions } from "@/components/imported-candidate-review-actions";
import { ImportedCandidateStatusBadge } from "@/components/imported-candidate-status-badge";
import { WorkflowEventList } from "@/components/workflow-event-list";
import {
  getDuplicateReasonLabel,
  getImportedCandidateDuplicateLabel,
  getImportedCandidateNormalizedTypeLabel,
  getImportedCandidateSourceTypeLabel
} from "@/lib/imported-candidate-display";
import {
  getCandidateDraftConversionReadiness,
  type DuplicateComparisonItem
} from "@/lib/candidate-workflow";
import {
  getPriorityLevelClass,
  getPriorityLevelLabel,
  getRankingSourceLabel
} from "@/lib/ranking-display";
import type {
  ExternalSource,
  ImportedCandidate,
  TechnologyPriorityRanking,
  WorkflowEvent
} from "@/types/content";

interface ImportedCandidateDetailContentProps {
  candidate: ImportedCandidate;
  duplicateComparisons: DuplicateComparisonItem[];
  source?: ExternalSource;
  ranking: TechnologyPriorityRanking;
  workflowEvents: WorkflowEvent[];
}

export function ImportedCandidateDetailContent({
  candidate,
  duplicateComparisons,
  source,
  ranking,
  workflowEvents
}: ImportedCandidateDetailContentProps) {
  const conversionReadiness = getCandidateDraftConversionReadiness(
    candidate.id
  );

  return (
    <div className="candidate-review-page">
      <section className="detail-panel candidate-review-hero workspace-object-hero">
        <p className="eyebrow">
          {getImportedCandidateSourceTypeLabel(candidate.sourceType)}
        </p>
        <h1>{candidate.originalTitle}</h1>
        {candidate.originalSummary ? (
          <p className="candidate-detail-hero__summary">
            {candidate.originalSummary}
          </p>
        ) : null}

        <div className="candidate-detail-hero__meta">
          <ImportedCandidateStatusBadge status={candidate.importStatus} />
          <span className="info-pill">
            {getImportedCandidateNormalizedTypeLabel(candidate.normalizedType)}
          </span>
          <span className="info-pill">{candidate.publisherName}</span>
          <span className="info-pill">{candidate.publishDate}</span>
          <span className="info-pill">
            {candidate.originalLanguage.toUpperCase()}
          </span>
          <span className={getPriorityLevelClass(ranking.priorityLevel)}>
            {getPriorityLevelLabel(ranking.priorityLevel, "zh")}
          </span>
          {candidate.relatedCandidateIds.length > 0 ? (
            <span className="info-pill info-pill--warning">
              {getImportedCandidateDuplicateLabel(candidate)}
            </span>
          ) : null}
        </div>

        <ImportedCandidateReviewActions
          candidateId={candidate.id}
          importStatus={candidate.importStatus}
          convertedTechnologyId={candidate.convertedTechnologyId}
          canConvert={conversionReadiness.canConvert}
          conversionBlockedMessage={conversionReadiness.message}
        />
      </section>

      <div className="candidate-review-layout">
        <div className="candidate-review-main">
          {candidate.originalContent ? (
            <section className="section-panel candidate-detail-section">
              <h2>原始内容</h2>
              <p className="detail-copy">{candidate.originalContent}</p>
            </section>
          ) : null}

          {duplicateComparisons.length > 0 ? (
            <section className="section-panel candidate-detail-section">
              <div className="section-heading">
                <div>
                  <h2>疑似重复</h2>
                  <p>在把这条内容转换为工作台草稿前，先比较疑似重复项。</p>
                </div>
                {candidate.duplicateGroupId ? (
                  <Link
                    href={`/workspace/duplicates/${candidate.duplicateGroupId}`}
                    className="action-link"
                  >
                    审核重复组
                  </Link>
                ) : null}
              </div>
              <div className="candidate-duplicate-list">
                {duplicateComparisons.map((comparison) => (
                  <article
                    key={comparison.candidate.id}
                    className="candidate-duplicate-item"
                  >
                    <div className="candidate-duplicate-item__meta">
                      <span>{comparison.candidate.publisherName}</span>
                      <span>{comparison.candidate.publishDate}</span>
                      <ImportedCandidateStatusBadge
                        status={comparison.candidate.importStatus}
                      />
                    </div>
                    <h3>
                      <Link
                        href={`/workspace/candidates/${comparison.candidate.id}`}
                      >
                        {comparison.candidate.originalTitle}
                      </Link>
                    </h3>
                    <p>
                      {comparison.candidate.originalSummary ?? "暂无摘要。"}
                    </p>
                    <div className="candidate-duplicate-item__reasons">
                      {comparison.reasons.map((reason) => (
                        <span
                          key={reason}
                          className="info-pill info-pill--subtle"
                        >
                          {getDuplicateReasonLabel(reason)}
                        </span>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          <section className="section-panel candidate-detail-section raw-payload-panel">
            <h2>原始载荷快照</h2>
            <div className="raw-payload-shell">
              <pre className="raw-payload">
                {JSON.stringify(candidate.rawPayload, null, 2)}
              </pre>
            </div>
          </section>

          <WorkflowEventList
            events={workflowEvents}
            title="候选工作流事件"
            description="这条导入候选最近的内部状态变化。"
          />
        </div>

        <aside className="candidate-review-aside">
          <DetailInfoCard
            title="参考信息"
            className="detail-info-card--compact"
            rows={[
              {
                label: "来源",
                value: source ? (
                  <Link
                    href={`/workspace/sources/${source.id}`}
                    className="detail-info-card__link"
                  >
                    {candidate.sourceName}
                  </Link>
                ) : (
                  candidate.sourceName
                )
              },
              {
                label: "来源 ID",
                value: candidate.sourceId ?? "无来源 ID"
              },
              {
                label: "来源类型",
                value: getImportedCandidateSourceTypeLabel(candidate.sourceType)
              },
              {
                label: "原始来源链接",
                value: (
                  <div className="candidate-source-link">
                    <a
                      className="detail-info-card__link"
                      href={candidate.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      打开原始来源
                    </a>
                    <span className="candidate-source-link__url">
                      {candidate.sourceUrl}
                    </span>
                  </div>
                )
              },
              {
                label: "发布方",
                value: candidate.publisherName
              }
            ]}
          />

          <DetailInfoCard
            title="审核快照"
            className="detail-info-card--compact"
            rows={[
              {
                label: "优先级",
                value: (
                  <span
                    className={getPriorityLevelClass(ranking.priorityLevel)}
                  >
                    {getPriorityLevelLabel(ranking.priorityLevel, "zh")}
                  </span>
                )
              },
              {
                label: "判定方式",
                value: getRankingSourceLabel(ranking.rankingSource)
              },
              {
                label: "理由",
                value: ranking.priorityReasons.slice(0, 3).join(" ")
              },
              {
                label: "警告",
                value:
                  ranking.priorityWarnings.length > 0
                    ? ranking.priorityWarnings.slice(0, 3).join(" ")
                    : "无优先级警告"
              },
              {
                label: "内容类型",
                value: getImportedCandidateNormalizedTypeLabel(
                  candidate.normalizedType
                )
              },
              {
                label: "当前状态",
                value: (
                  <ImportedCandidateStatusBadge
                    status={candidate.importStatus}
                  />
                )
              },
              {
                label: "审核时间",
                value: candidate.reviewedAt
                  ? candidate.reviewedAt.slice(0, 10)
                  : "尚未审核"
              },
              {
                label: "重复组",
                value: candidate.duplicateGroupId ? (
                  <Link
                    href={`/workspace/duplicates/${candidate.duplicateGroupId}`}
                    className="detail-info-card__link"
                  >
                    {candidate.duplicateGroupId}
                  </Link>
                ) : (
                  "无重复组"
                )
              },
              {
                label: "工作台记录",
                value: candidate.convertedTechnologyId ? (
                  <Link
                    href={`/workspace/technologies/${candidate.convertedTechnologyId}`}
                    className="detail-info-card__link"
                  >
                    打开生成的工作台记录
                  </Link>
                ) : (
                  "尚未生成工作台记录"
                )
              },
              {
                label: "标签",
                value:
                  candidate.tags.length > 0 ? candidate.tags.join(", ") : "无"
              }
            ]}
          />
        </aside>
      </div>
    </div>
  );
}
