import Link from "next/link";

import { DetailInfoCard } from "@/components/detail-info-card";
import { ExternalSourceActions } from "@/components/external-source-actions";
import { ExternalSourceForm } from "@/components/external-source-form";
import { ExternalSourceStatusBadge } from "@/components/external-source-status-badge";
import { ImportedCandidateStatusBadge } from "@/components/imported-candidate-status-badge";
import { getExternalSourceTypeLabel } from "@/lib/source-display";
import {
  getImportedCandidateNormalizedTypeLabel,
  getImportedCandidateSourceTypeLabel
} from "@/lib/imported-candidate-display";
import {
  formatQualityRate,
  getSourceQualityLevelClass,
  getSourceQualityLevelLabel
} from "@/lib/quality-display";
import type {
  ExternalSource,
  ImportedCandidate,
  SourceQualityMetrics
} from "@/types/content";

interface ExternalSourceDetailContentProps {
  source: ExternalSource;
  candidates: ImportedCandidate[];
  quality: SourceQualityMetrics;
}

export function ExternalSourceDetailContent({
  source,
  candidates,
  quality
}: ExternalSourceDetailContentProps) {
  return (
    <div className="detail-layout">
      <div className="detail-main">
        <section className="detail-panel technology-detail-panel workspace-object-hero">
          <p className="eyebrow">外部来源</p>
          <h1>{source.name}</h1>
          <p className="technology-detail-panel__summary">
            {source.description ?? "用于把外部内容导入候选池的内部来源配置。"}
          </p>
          <div className="candidate-detail-hero__meta">
            <span
              className={
                source.enabled ? "info-pill" : "info-pill info-pill--warning"
              }
            >
              {source.enabled ? "已启用" : "已停用"}
            </span>
            <span className="info-pill">
              {getExternalSourceTypeLabel(source.type)}
            </span>
            <span className="info-pill">{source.language.toUpperCase()}</span>
            <ExternalSourceStatusBadge status={source.lastImportStatus} />
            <span className={getSourceQualityLevelClass(quality.qualityLevel)}>
              质量：{getSourceQualityLevelLabel(quality.qualityLevel)}
            </span>
          </div>
          <ExternalSourceActions
            sourceId={source.id}
            enabled={source.enabled}
          />
        </section>

        <section className="section-panel">
          <h2>编辑来源</h2>
          <ExternalSourceForm source={source} />
        </section>

        <section className="section-panel candidate-detail-section">
          <h2>最近导入的候选</h2>
          {candidates.length > 0 ? (
            <div className="candidate-duplicate-list">
              {candidates.map((candidate) => (
                <article
                  key={candidate.id}
                  className="candidate-duplicate-item"
                >
                  <div className="candidate-duplicate-item__meta">
                    <span>
                      {getImportedCandidateSourceTypeLabel(
                        candidate.sourceType
                      )}
                    </span>
                    <span>{candidate.publishDate}</span>
                    <span>
                      导入于{" "}
                      {candidate.importedAt
                        ? candidate.importedAt.slice(0, 16).replace("T", " ")
                        : "追踪开始之前"}
                    </span>
                    <ImportedCandidateStatusBadge
                      status={candidate.importStatus}
                    />
                  </div>
                  <h3>
                    <Link href={`/workspace/candidates/${candidate.id}`}>
                      {candidate.originalTitle}
                    </Link>
                  </h3>
                  <p>{candidate.originalSummary ?? "暂无摘要。"}</p>
                  <div className="candidate-duplicate-item__reasons">
                    <span className="info-pill info-pill--subtle">
                      {getImportedCandidateNormalizedTypeLabel(
                        candidate.normalizedType
                      )}
                    </span>
                    {candidate.tags.map((tag) => (
                      <span key={tag} className="info-pill info-pill--subtle">
                        {tag}
                      </span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="empty-state">
              暂无关联到这个来源的候选。运行来源导入即可生成候选记录。
            </p>
          )}
        </section>
      </div>

      <aside className="detail-side">
        <DetailInfoCard
          title="来源配置"
          rows={[
            {
              label: "类型",
              value: getExternalSourceTypeLabel(source.type)
            },
            {
              label: "URL",
              value: (
                <a
                  className="detail-info-card__link"
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {source.url}
                </a>
              )
            },
            {
              label: "发布方",
              value: source.publisherName ?? "未填写发布方"
            },
            {
              label: "发布方类型",
              value: source.publisherType
            },
            {
              label: "默认内容类型",
              value: source.defaultNormalizedType
            },
            {
              label: "默认标签",
              value:
                source.defaultTags.length > 0
                  ? source.defaultTags.join(", ")
                  : "无"
            }
          ]}
        />

        <DetailInfoCard
          title="最近导入"
          rows={[
            {
              label: "状态",
              value: (
                <ExternalSourceStatusBadge status={source.lastImportStatus} />
              )
            },
            {
              label: "抓取时间",
              value: source.lastFetchedAt
                ? source.lastFetchedAt.slice(0, 16).replace("T", " ")
                : "从未抓取"
            },
            {
              label: "本次数量",
              value: String(source.lastImportCount ?? 0)
            },
            {
              label: "连续失败",
              value: String(source.consecutiveFailureCount ?? 0)
            },
            {
              label: "累计导入",
              value: String(source.totalImportedCount ?? 0)
            },
            {
              label: "最近成功",
              value: source.lastSuccessfulImportAt
                ? source.lastSuccessfulImportAt.slice(0, 16).replace("T", " ")
                : "尚无成功导入"
            },
            {
              label: "最近消息",
              value: source.lastImportMessage ?? "尚未运行导入"
            },
            {
              label: "最近错误",
              value: source.lastErrorMessage ?? "近期无错误"
            },
            {
              label: "候选数量",
              value: String(candidates.length)
            }
          ]}
        />

        <DetailInfoCard
          title="来源质量"
          rows={[
            {
              label: "质量等级",
              value: (
                <span
                  className={getSourceQualityLevelClass(quality.qualityLevel)}
                >
                  {getSourceQualityLevelLabel(quality.qualityLevel)}
                </span>
              )
            },
            {
              label: "成功率",
              value: `${formatQualityRate(quality.successRate)} (${quality.successfulImportRuns}/${quality.totalImportRuns})`
            },
            {
              label: "重复率",
              value: `${formatQualityRate(quality.duplicateRate)} (${quality.duplicateCandidateCount}/${quality.totalCandidatesImported})`
            },
            {
              label: "转化率",
              value: `${formatQualityRate(quality.conversionRate)} (${quality.convertedCandidateCount}/${quality.totalCandidatesImported})`
            },
            {
              label: "拒绝率",
              value: `${formatQualityRate(quality.rejectionRate)} (${quality.rejectedCandidateCount}/${quality.totalCandidatesImported})`
            },
            {
              label: "失败轮次",
              value: String(quality.failedImportRuns)
            },
            {
              label: "连续失败",
              value: String(quality.consecutiveFailureCount)
            }
          ]}
        />
      </aside>
    </div>
  );
}
