import Link from "next/link";

import { DigestDeliveryActions } from "@/components/digest-delivery-actions";
import {
  DailyDigestEditForm,
  DailyDigestItemActions,
  DailyDigestManualAdd
} from "@/components/daily-digest-editor-actions";
import { DailyDigestStatusActions } from "@/components/daily-digest-workspace-actions";
import { DeliveryRunActions } from "@/components/delivery-run-actions";
import { DetailInfoCard } from "@/components/detail-info-card";
import { MetadataRow } from "@/components/metadata-row";
import { WorkflowEventList } from "@/components/workflow-event-list";
import { WorkspaceStatusBadge } from "@/components/workspace-status-badge";
import {
  buildDigestShareText,
  getDeliverySurfaceUrls,
  getDigestPublicUrl,
  jsonFeedPath,
  rssFeedPath
} from "@/lib/digest-delivery";
import { getDeliveryChannelTypeLabel } from "@/lib/delivery-labels";
import { evaluateTechnologyPriority } from "@/lib/ranking";
import {
  getPriorityLevelClass,
  getPriorityLevelLabel
} from "@/lib/ranking-display";
import { getPreferredTechnologyTitle } from "@/lib/technology-localization";
import type {
  DailyDigest,
  DeliveryChannel,
  DeliveryRun,
  DigestPublishReadiness,
  KnowledgeItem,
  SkillItem,
  TechnologyItem,
  WorkflowEvent
} from "@/types/content";

interface DailyDigestWorkspaceDetailProps {
  digest: DailyDigest;
  readiness: DigestPublishReadiness;
  highPriorityTechnologies: TechnologyItem[];
  watchTechnologies: TechnologyItem[];
  availableTechnologies: TechnologyItem[];
  deliveryChannels: DeliveryChannel[];
  deliveryRuns: DeliveryRun[];
  skills: SkillItem[];
  knowledge: KnowledgeItem[];
  workflowEvents: WorkflowEvent[];
}

function getStatusTone(status: DailyDigest["status"]) {
  if (status === "published") {
    return "success" as const;
  }

  if (status === "archived") {
    return "neutral" as const;
  }

  return "warning" as const;
}

const digestStatusLabels: Record<DailyDigest["status"], string> = {
  draft: "草稿",
  published: "已发布",
  archived: "已归档"
};

const runStatusLabels: Record<DeliveryRun["status"], string> = {
  pending: "进行中",
  success: "成功",
  failed: "失败"
};

function WorkspaceDigestTechnologyList({
  title,
  description,
  digest,
  technologies
}: {
  title: string;
  description: string;
  digest: DailyDigest;
  technologies: TechnologyItem[];
}) {
  const pinnedIds = new Set(digest.pinnedTechnologyIds);

  return (
    <section className="detail-panel digest-workspace-section">
      <div className="section-heading">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </div>
      {technologies.length > 0 ? (
        <div className="digest-workspace-technology-list">
          {technologies.map((technology) => {
            const ranking = evaluateTechnologyPriority(technology);
            const isPinned = pinnedIds.has(technology.id);

            return (
              <article
                key={technology.id}
                className="digest-workspace-technology"
              >
                <div className="digest-workspace-technology__header">
                  <span
                    className={getPriorityLevelClass(ranking.priorityLevel)}
                  >
                    {getPriorityLevelLabel(ranking.priorityLevel, "zh")}
                  </span>
                  {isPinned ? (
                    <span className="info-pill info-pill--success">已置顶</span>
                  ) : null}
                  {digest.manuallyAddedTechnologyIds.includes(technology.id) ? (
                    <span className="info-pill info-pill--subtle">
                      手动添加
                    </span>
                  ) : null}
                  <MetadataRow
                    items={[
                      { value: technology.sourceName },
                      { value: technology.publishDate }
                    ]}
                  />
                </div>
                <h3>
                  <Link href={`/technologies/${technology.slug}`}>
                    {getPreferredTechnologyTitle(technology)}
                  </Link>
                </h3>
                <p>{ranking.priorityReasons.slice(0, 3).join(" ")}</p>
                <DailyDigestItemActions
                  date={digest.date}
                  technologyId={technology.id}
                  isPinned={isPinned}
                />
              </article>
            );
          })}
        </div>
      ) : (
        <p className="empty-state">本板块未选入任何技术。</p>
      )}
    </section>
  );
}

function PublishReadinessPanel({
  readiness
}: {
  readiness: DigestPublishReadiness;
}) {
  return (
    <section className="detail-panel digest-readiness-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">发布就绪</p>
          <h2>{readiness.isReady ? "可以发布" : "已阻塞"}</h2>
          <p>阻塞错误会阻止发布；警告不阻止发布，但应在发布前复查。</p>
        </div>
      </div>

      {readiness.blockingErrors.length > 0 ? (
        <div className="digest-readiness-list digest-readiness-list--blocking">
          <strong>阻塞错误</strong>
          <ul>
            {readiness.blockingErrors.map((issue) => (
              <li key={`${issue.code}-${issue.message}`}>{issue.message}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="digest-readiness-ok">没有阻塞错误。</p>
      )}

      {readiness.warnings.length > 0 ? (
        <div className="digest-readiness-list">
          <strong>警告</strong>
          <ul>
            {readiness.warnings.map((issue) => (
              <li key={`${issue.code}-${issue.message}`}>{issue.message}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="empty-state">没有警告。</p>
      )}
    </section>
  );
}

function DigestDeliveryPanel({ digest }: { digest: DailyDigest }) {
  const isPublished = digest.status === "published";
  const publicDigestUrl = getDigestPublicUrl(digest.date);
  const { rssFeedUrl, jsonFeedUrl } = getDeliverySurfaceUrls();

  return (
    <section className="detail-panel digest-delivery-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">投递</p>
          <h2>{isPublished ? "已公开投递" : "尚未公开投递"}</h2>
          <p>投递面只会由已发布的简报记录生成。</p>
        </div>
      </div>

      <dl className="digest-delivery-list">
        <div>
          <dt>状态</dt>
          <dd>
            <span
              className={`info-pill ${
                isPublished ? "info-pill--success" : "info-pill--warning"
              }`}
            >
              {isPublished ? "已发布" : "仅工作台可见"}
            </span>
          </dd>
        </div>
        <div>
          <dt>最近更新</dt>
          <dd>{digest.updatedAt.slice(0, 16)}</dd>
        </div>
        {isPublished ? (
          <>
            <div>
              <dt>公开简报 URL</dt>
              <dd>
                <Link href={`/digest/${digest.date}`} className="delivery-url">
                  {publicDigestUrl}
                </Link>
              </dd>
            </div>
            <div>
              <dt>RSS 订阅源 URL</dt>
              <dd>
                <Link href={rssFeedPath} className="delivery-url">
                  {rssFeedUrl}
                </Link>
              </dd>
            </div>
            <div>
              <dt>JSON 订阅源 URL</dt>
              <dd>
                <Link href={jsonFeedPath} className="delivery-url">
                  {jsonFeedUrl}
                </Link>
              </dd>
            </div>
          </>
        ) : (
          <div>
            <dt>公开链接</dt>
            <dd>先发布这期简报，之后才会显示公开订阅和分享链接。</dd>
          </div>
        )}
      </dl>

      <div className="digest-share-panel">
        <h3>分享文本预览</h3>
        {isPublished ? (
          <textarea
            className="digest-share-preview"
            readOnly
            value={buildDigestShareText(digest)}
            aria-label="简报分享文本预览"
          />
        ) : (
          <p className="empty-state">
            尚未公开投递。发布这期简报后会生成带公开 URL 的分享文本。
          </p>
        )}
      </div>
    </section>
  );
}

function DigestDeliveryLogPanel({ runs }: { runs: DeliveryRun[] }) {
  return (
    <section className="detail-panel digest-delivery-log-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">投递日志</p>
          <h2>近期发送</h2>
          <p>仅显示这期简报的手动投递记录。</p>
        </div>
      </div>

      {runs.length > 0 ? (
        <div className="digest-delivery-log-list">
          {runs.slice(0, 5).map((run) => (
            <article className="digest-delivery-log" key={run.id}>
              <div className="digest-delivery-log__header">
                <strong>
                  {run.channelName} ·{" "}
                  {getDeliveryChannelTypeLabel(run.channelType)}
                </strong>
                <WorkspaceStatusBadge
                  label={runStatusLabels[run.status]}
                  tone={
                    run.status === "success"
                      ? "success"
                      : run.status === "failed"
                        ? "danger"
                        : "warning"
                  }
                />
              </div>
              <MetadataRow
                items={[
                  { label: "开始于", value: run.startedAt.slice(0, 16) },
                  {
                    label: "HTTP",
                    value: run.responseStatus?.toString() ?? "无"
                  }
                ]}
              />
              {run.errorMessage ? (
                <p className="delivery-error-message">{run.errorMessage}</p>
              ) : null}
              <DeliveryRunActions runId={run.id} status={run.status} />
            </article>
          ))}
        </div>
      ) : (
        <p className="empty-state">还没有尝试过投递发送。</p>
      )}
    </section>
  );
}

export function DailyDigestWorkspaceDetail({
  digest,
  readiness,
  highPriorityTechnologies,
  watchTechnologies,
  availableTechnologies,
  deliveryChannels,
  deliveryRuns,
  skills,
  knowledge,
  workflowEvents
}: DailyDigestWorkspaceDetailProps) {
  return (
    <div className="candidate-review-layout digest-workspace-detail">
      <main className="candidate-review-layout__main">
        <section className="workspace-object-hero">
          <div>
            <p className="eyebrow">简报审核</p>
            <h1>{digest.title}</h1>
            <p>{digest.editorialSummary || digest.summary}</p>
            <MetadataRow
              items={[
                { label: "日期", value: digest.date },
                { label: "生成于", value: digest.generatedAt.slice(0, 16) },
                { label: "更新于", value: digest.updatedAt.slice(0, 16) },
                {
                  label: "重新生成",
                  value: digest.lastRegeneratedAt?.slice(0, 16)
                },
                { label: "发布于", value: digest.publishedAt?.slice(0, 16) }
              ]}
            />
          </div>
          <WorkspaceStatusBadge
            label={digestStatusLabels[digest.status]}
            tone={getStatusTone(digest.status)}
          />
        </section>

        <DailyDigestStatusActions
          date={digest.date}
          status={digest.status}
          readiness={readiness}
        />

        <DailyDigestEditForm digest={digest} />

        <PublishReadinessPanel readiness={readiness} />

        <WorkspaceDigestTechnologyList
          title="今日立即关注"
          description="高优先级排序结果，以及手动置顶的高优先级条目。"
          digest={digest}
          technologies={highPriorityTechnologies}
        />

        <WorkspaceDigestTechnologyList
          title="值得跟踪"
          description="跟踪级排序结果，以及未达高优先级的手动添加条目。"
          digest={digest}
          technologies={watchTechnologies}
        />

        <WorkflowEventList
          events={workflowEvents}
          title="简报工作流事件"
          description="这期简报最近的生成、编辑、发布与投递相关事件。"
        />
      </main>

      <aside className="candidate-review-layout__aside">
        <DigestDeliveryPanel digest={digest} />

        <DigestDeliveryActions
          digestDate={digest.date}
          digestStatus={digest.status}
          channels={deliveryChannels}
        />

        <DigestDeliveryLogPanel runs={deliveryRuns} />

        <DetailInfoCard
          title="简报结构"
          rows={[
            {
              label: "立即关注",
              value: highPriorityTechnologies.length
            },
            { label: "值得跟踪", value: watchTechnologies.length },
            {
              label: "手动添加",
              value: digest.manuallyAddedTechnologyIds.length
            },
            { label: "已排除", value: digest.excludedTechnologyIds.length },
            { label: "已置顶", value: digest.pinnedTechnologyIds.length },
            { label: "技能", value: skills.length },
            { label: "知识", value: knowledge.length },
            { label: "来源", value: digest.sourceNames.length }
          ]}
        />

        <DetailInfoCard
          title="重新生成规则"
          rows={[
            {
              label: "规则",
              value:
                "重新生成会刷新基于排序的板块，同时保留手动添加、排除、置顶、排序和编辑概览。"
            },
            {
              label: "编辑备注",
              value: digest.editorialNotes.join(" ")
            }
          ]}
        />

        <DailyDigestManualAdd
          date={digest.date}
          technologies={availableTechnologies}
        />

        <section className="detail-panel">
          <h2>预览</h2>
          <div className="digest-workspace-card__links">
            <Link
              href={`/workspace/digests/${digest.date}/preview`}
              className="action-link"
            >
              预览用户端简报
            </Link>
            {digest.status === "published" ? (
              <Link href={`/digest/${digest.date}`} className="action-link">
                打开已发布简报
              </Link>
            ) : null}
          </div>
        </section>
      </aside>
    </div>
  );
}
