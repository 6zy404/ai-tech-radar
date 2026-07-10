import Link from "next/link";

import { DetailInfoCard } from "@/components/detail-info-card";
import { DuplicateGroupActions } from "@/components/duplicate-group-actions";
import { ImportedCandidateStatusBadge } from "@/components/imported-candidate-status-badge";
import { WorkspaceStatusBadge } from "@/components/workspace-status-badge";
import {
  getDuplicateReasonLabel,
  getImportedCandidateNormalizedTypeLabel,
  getImportedCandidateSourceTypeLabel
} from "@/lib/imported-candidate-display";
import type {
  DuplicateGroup,
  DuplicateReason,
  ImportedCandidate
} from "@/types/content";

interface DuplicateGroupDetailContentProps {
  group: DuplicateGroup;
  candidates: ImportedCandidate[];
  reasonsByCandidateId: Record<string, DuplicateReason[]>;
}

function getStatusTone(status: DuplicateGroup["status"]) {
  if (status === "resolved") {
    return "success" as const;
  }

  if (status === "ignored") {
    return "neutral" as const;
  }

  return "warning" as const;
}

const groupStatusLabels: Record<DuplicateGroup["status"], string> = {
  open: "待处理",
  resolved: "已解决",
  ignored: "已忽略"
};

export function DuplicateGroupDetailContent({
  group,
  candidates,
  reasonsByCandidateId
}: DuplicateGroupDetailContentProps) {
  const primaryCandidate =
    candidates.find((candidate) => candidate.id === group.primaryCandidateId) ??
    candidates[0];
  const convertedTechnologyId = candidates.find(
    (candidate) => candidate.convertedTechnologyId
  )?.convertedTechnologyId;

  return (
    <div className="candidate-review-page duplicate-review-page">
      <section className="detail-panel candidate-review-hero workspace-object-hero">
        <p className="eyebrow">重复组审核</p>
        <h1>{primaryCandidate?.originalTitle ?? group.id}</h1>
        <p className="candidate-detail-hero__summary">
          把这些导入候选当作同一个技术事件来审核。在转换为技术草稿前先选定主候选。
        </p>
        <div className="candidate-detail-hero__meta">
          <WorkspaceStatusBadge
            label={groupStatusLabels[group.status]}
            tone={getStatusTone(group.status)}
          />
          <span className="info-pill">{group.candidateIds.length} 条候选</span>
          {group.reasons.map((reason) => (
            <span key={reason} className="info-pill info-pill--warning">
              {getDuplicateReasonLabel(reason)}
            </span>
          ))}
        </div>
        <DuplicateGroupActions
          groupId={group.id}
          primaryCandidateId={group.primaryCandidateId}
          status={group.status}
          candidates={candidates}
        />
      </section>

      <div className="candidate-review-layout">
        <div className="candidate-review-main">
          <section className="section-panel candidate-detail-section">
            <div className="section-heading">
              <div>
                <h2>候选比较</h2>
                <p>在解决重复组前，比较标题、来源、日期、摘要与状态。</p>
              </div>
            </div>
            <div className="candidate-duplicate-list duplicate-review-list">
              {candidates.map((candidate) => {
                const candidateReasons =
                  reasonsByCandidateId[candidate.id] ?? [];
                const isPrimary = candidate.id === group.primaryCandidateId;

                return (
                  <article
                    key={candidate.id}
                    className={`candidate-duplicate-item duplicate-review-item${
                      isPrimary ? " duplicate-review-item--primary" : ""
                    }`}
                  >
                    <div className="candidate-duplicate-item__meta">
                      {isPrimary ? (
                        <span className="info-pill info-pill--warning">
                          主候选
                        </span>
                      ) : null}
                      <ImportedCandidateStatusBadge
                        status={candidate.importStatus}
                      />
                      <span>{candidate.publisherName}</span>
                      <span>{candidate.publishDate}</span>
                      <span>
                        {getImportedCandidateSourceTypeLabel(
                          candidate.sourceType
                        )}
                      </span>
                    </div>
                    <h3>
                      <Link href={`/workspace/candidates/${candidate.id}`}>
                        {candidate.originalTitle}
                      </Link>
                    </h3>
                    <p>{candidate.originalSummary ?? "暂无摘要。"}</p>
                    <div className="candidate-duplicate-item__meta">
                      <span>
                        类型：
                        {getImportedCandidateNormalizedTypeLabel(
                          candidate.normalizedType
                        )}
                      </span>
                      <a
                        href={candidate.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="detail-info-card__link"
                      >
                        打开来源
                      </a>
                    </div>
                    <div className="candidate-duplicate-item__reasons">
                      {candidateReasons.map((reason) => (
                        <span
                          key={reason}
                          className="info-pill info-pill--subtle"
                        >
                          {getDuplicateReasonLabel(reason)}
                        </span>
                      ))}
                      {candidate.tags.map((tag) => (
                        <span key={tag} className="info-pill">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </div>

        <aside className="candidate-review-aside">
          <DetailInfoCard
            title="重复组工作流"
            className="detail-info-card--compact"
            rows={[
              {
                label: "重复组 ID",
                value: group.id
              },
              {
                label: "状态",
                value: (
                  <WorkspaceStatusBadge
                    label={groupStatusLabels[group.status]}
                    tone={getStatusTone(group.status)}
                  />
                )
              },
              {
                label: "主候选",
                value: (
                  <Link
                    href={`/workspace/candidates/${group.primaryCandidateId}`}
                    className="detail-info-card__link"
                  >
                    {group.primaryCandidateId}
                  </Link>
                )
              },
              {
                label: "已转换草稿",
                value: convertedTechnologyId ? (
                  <Link
                    href={`/workspace/technologies/${convertedTechnologyId}`}
                    className="detail-info-card__link"
                  >
                    打开工作台记录
                  </Link>
                ) : (
                  "尚未生成草稿"
                )
              },
              {
                label: "创建时间",
                value: group.createdAt.slice(0, 10)
              },
              {
                label: "更新时间",
                value: group.updatedAt.slice(0, 10)
              }
            ]}
          />

          <section className="section-panel candidate-detail-section">
            <h2>转换规则</h2>
            <p className="detail-copy">
              已解决的重复组只应转换主候选。其余候选会成为生成的技术草稿上的附加来源引用。
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
