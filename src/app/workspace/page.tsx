import Link from "next/link";

import { WorkspacePageShell } from "@/components/workspace-page-shell";
import { getCandidateWorkflowData } from "@/lib/candidate-workflow";
import { getTechnologyWorkspaceRecords } from "@/lib/technology-draft-workflow";
import { getDeliveryChannels, getDeliveryRuns } from "@/lib/delivery-workflow";
import { getDailyDigests } from "@/lib/digest-workflow";
import { getSystemHealthSummary } from "@/lib/operations-metrics";
import {
  getScheduledDeliveries,
  getScheduledDeliveryRuns
} from "@/lib/scheduled-delivery-workflow";
import {
  getExternalSources,
  getLatestExternalSourceImportRun
} from "@/lib/source-workflow";

export const dynamic = "force-dynamic";

interface DashboardActivity {
  label: string;
  title: string;
  meta: string;
  href: string;
}

function parseTime(value: string | undefined): number {
  if (!value) {
    return 0;
  }

  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function formatDateTime(value: string | undefined): string {
  if (!value) {
    return "未记录";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

const statusDisplayLabels: Record<string, string> = {
  success: "成功",
  failed: "失败",
  partial: "部分成功",
  pending: "进行中",
  draft: "草稿",
  published: "已发布",
  archived: "已归档",
  never_run: "未运行",
  healthy: "健康",
  warning: "警告",
  critical: "严重",
  unknown: "未知"
};

function formatStatus(value: string | undefined): string {
  if (!value) {
    return "未记录";
  }

  return statusDisplayLabels[value] ?? value;
}

export default function WorkspaceHomePage() {
  const { candidates, duplicateGroups, snapshot } = getCandidateWorkflowData();
  const sources = getExternalSources();
  const workspaceRecords = getTechnologyWorkspaceRecords();
  const digests = getDailyDigests();
  const deliveryChannels = getDeliveryChannels();
  const deliveryRuns = getDeliveryRuns();
  const deliverySchedules = getScheduledDeliveries();
  const scheduledRuns = getScheduledDeliveryRuns();
  const latestImportRun = getLatestExternalSourceImportRun();
  const operations = getSystemHealthSummary();

  const enabledSources = sources.filter((source) => source.enabled).length;
  const newCandidates = candidates.filter(
    (candidate) => candidate.importStatus === "new"
  ).length;
  const openDuplicateGroups = duplicateGroups.filter(
    (group) => group.status === "open"
  ).length;
  const draftRecords = workspaceRecords.filter(
    (record) => record.status === "draft"
  ).length;
  const publishedRecords = workspaceRecords.filter(
    (record) => record.status === "published"
  ).length;
  const digestDrafts = digests.filter(
    (digest) => digest.status === "draft"
  ).length;
  const publishedDigests = digests.filter(
    (digest) => digest.status === "published"
  ).length;
  const enabledDeliveryChannels = deliveryChannels.filter(
    (channel) => channel.enabled
  ).length;
  const failedDeliveryRuns = deliveryRuns.filter(
    (run) => run.status === "failed"
  ).length;
  const enabledDeliverySchedules = deliverySchedules.filter(
    (schedule) => schedule.enabled
  ).length;

  const latestWorkspaceRecord = [...workspaceRecords].sort(
    (a, b) => parseTime(b.updatedAt) - parseTime(a.updatedAt)
  )[0];
  const latestDigest = [...digests].sort(
    (a, b) =>
      parseTime(b.updatedAt ?? b.generatedAt) -
      parseTime(a.updatedAt ?? a.generatedAt)
  )[0];
  const latestDeliveryRun = deliveryRuns[0];
  const latestScheduledRun = scheduledRuns[0];

  const recentActivity: DashboardActivity[] = [
    latestImportRun
      ? {
          label: "最近一次批量导入",
          title: formatStatus(latestImportRun.status),
          meta: `新增 ${latestImportRun.totalCandidatesCreated} 条，跳过 ${latestImportRun.totalCandidatesSkipped} 条 · ${formatDateTime(
            latestImportRun.finishedAt
          )}`,
          href: "/workspace/sources"
        }
      : null,
    latestWorkspaceRecord
      ? {
          label: "最近更新的技术记录",
          title: latestWorkspaceRecord.title.original || "未命名技术记录",
          meta: `${formatStatus(latestWorkspaceRecord.status)} · ${formatDateTime(
            latestWorkspaceRecord.updatedAt
          )}`,
          href: `/workspace/technologies/${latestWorkspaceRecord.id}`
        }
      : null,
    latestDigest
      ? {
          label: "最近更新的简报",
          title: latestDigest.title || "未命名简报",
          meta: `${formatStatus(latestDigest.status)} · ${formatDateTime(latestDigest.updatedAt)}`,
          href: `/workspace/digests/${latestDigest.date}`
        }
      : null,
    latestDeliveryRun
      ? {
          label: "最近一次投递",
          title: latestDeliveryRun.channelName,
          meta: `${formatStatus(latestDeliveryRun.status)} · ${formatDateTime(
            latestDeliveryRun.finishedAt ?? latestDeliveryRun.startedAt
          )}`,
          href: "/workspace/delivery"
        }
      : null,
    latestScheduledRun
      ? {
          label: "最近一次定时投递",
          title: latestScheduledRun.scheduleName,
          meta: `${formatStatus(latestScheduledRun.status)} - ${formatDateTime(
            latestScheduledRun.finishedAt ?? latestScheduledRun.startedAt
          )}`,
          href: "/workspace/delivery/schedules"
        }
      : null
  ].filter((activity): activity is DashboardActivity => activity !== null);

  const workflowSteps = [
    {
      label: "来源",
      href: "/workspace/sources",
      count: `${enabledSources}/${sources.length} 已启用`,
      description: "配置 RSS、版本发布和官方更新页来源。"
    },
    {
      label: "导入",
      href: "/workspace/sources",
      count: latestImportRun ? formatStatus(latestImportRun.status) : "未运行",
      description: "运行已启用来源，把内容导入候选池。"
    },
    {
      label: "候选",
      href: "/workspace/candidates",
      count: `${newCandidates} 条新候选`,
      description: "在导入内容成为正式草稿前进行审核。"
    },
    {
      label: "重复组",
      href: "/workspace/duplicates",
      count: `${openDuplicateGroups} 组待处理`,
      description: "选择主候选，把重复来源保留为参考引用。"
    },
    {
      label: "草稿",
      href: "/workspace/technologies",
      count: `${draftRecords} 条草稿`,
      description: "编辑正式技术记录并运行发布检查。"
    },
    {
      label: "发布",
      href: "/workspace/technologies",
      count: `${publishedRecords} 条已发布`,
      description: "把就绪的技术记录发布到用户产品。"
    },
    {
      label: "简报",
      href: "/workspace/digests",
      count: `${digestDrafts} 条草稿`,
      description: "生成、编辑、预览并发布每日简报。"
    },
    {
      label: "投递",
      href: "/workspace/delivery",
      count: `${enabledDeliveryChannels} 个渠道`,
      description: "把已发布简报手动发送到配置的渠道。"
    },
    {
      label: "定时投递",
      href: "/workspace/delivery/schedules",
      count: `${enabledDeliverySchedules} 个已启用`,
      description: "为已发布简报运行本地定时投递。"
    },
    {
      label: "运维",
      href: "/workspace/operations",
      count: formatStatus(operations.status),
      description: "检查系统健康、失败项、任务运行器状态与审计事件。"
    }
  ];

  const summaryCards = [
    {
      label: "已启用来源",
      value: enabledSources,
      hint: `共配置 ${sources.length} 个`
    },
    {
      label: "新候选",
      value: newCandidates,
      hint: `累计导入 ${candidates.length} 条`
    },
    {
      label: "待处理重复组",
      value: openDuplicateGroups,
      hint: `共 ${duplicateGroups.length} 组`
    },
    {
      label: "待编辑草稿",
      value: draftRecords,
      hint: `共 ${workspaceRecords.length} 条工作台记录`
    },
    {
      label: "已发布技术",
      value: publishedRecords,
      hint: "对用户可见"
    },
    {
      label: "简报草稿",
      value: digestDrafts,
      hint: `已发布 ${publishedDigests} 期简报`
    },
    {
      label: "投递渠道",
      value: enabledDeliveryChannels,
      hint: `${failedDeliveryRuns} 次投递失败`
    },
    {
      label: "投递计划",
      value: enabledDeliverySchedules,
      hint: `${scheduledRuns.length} 次定时运行`
    }
  ];

  const primaryActions = [
    {
      label: "导入已启用来源",
      href: "/workspace/sources",
      description: "运行批量导入。"
    },
    {
      label: "审核候选",
      href: "/workspace/candidates",
      description: "处理新导入的内容。"
    },
    {
      label: "处理重复组",
      href: "/workspace/duplicates",
      description: "选择主候选。"
    },
    {
      label: "编辑草稿",
      href: "/workspace/technologies",
      description: "完善正式技术记录。"
    },
    {
      label: "管理简报",
      href: "/workspace/digests",
      description: "编辑并发布每日简报。"
    },
    {
      label: "打开运维",
      href: "/workspace/operations",
      description: "检查失败项、近期事件与系统健康。"
    }
  ];

  return (
    <WorkspacePageShell
      title="内部编辑工作台"
      description="覆盖来源导入、候选审核、重复处理、技术草稿、发布、简报编辑、投递与运维的内部控制面板。"
      sectionLabel="审核 / 编辑"
    >
      <section className="workspace-dashboard">
        <div className="workspace-dashboard__intro">
          <p className="eyebrow workspace-eyebrow">内部工作流</p>
          <h2>把外部技术信号变成经过审核的公开内容。</h2>
          <p>
            导入的数据会一直留在工作台内，直到审核者确认来源质量、重复组、草稿就绪状态和简报发布。公开产品只接收已发布的技术与简报内容。
          </p>
        </div>

        <div className="workspace-status-summary" aria-label="工作台状态摘要">
          {summaryCards.map((card) => (
            <article
              className="workspace-status-summary__card"
              key={card.label}
            >
              <strong>{card.value}</strong>
              <span>{card.label}</span>
              <small>{card.hint}</small>
            </article>
          ))}
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <h2>运维摘要</h2>
            <p>
              来源、投递、定时运行、任务运行器状态与工作流事件的轻量健康视图。
            </p>
          </div>
          <Link className="action-link" href="/workspace/operations">
            打开运维
          </Link>
        </div>
        <div className="workspace-operations-summary">
          <article
            className={`workspace-operations-summary__card workspace-operations-summary__card--${operations.status}`}
          >
            <span>系统健康</span>
            <strong>{formatStatus(operations.status)}</strong>
            <small>{operations.statusReasons[0]}</small>
          </article>
          <article className="workspace-operations-summary__card">
            <span>需要关注</span>
            <strong>{operations.attentionItems.length}</strong>
            <small>当前可见的待关注项</small>
          </article>
          <article className="workspace-operations-summary__card">
            <span>投递失败</span>
            <strong>{operations.failedDeliveries.length}</strong>
            <small>次投递需要复查</small>
          </article>
          <article className="workspace-operations-summary__card">
            <span>来源失败</span>
            <strong>{operations.failedImports.length}</strong>
            <small>个来源导入需要复查</small>
          </article>
          <article className="workspace-operations-summary__card">
            <span>最近任务运行器</span>
            <strong>
              {formatStatus(operations.taskRunnerSummary.latestRun?.status)}
            </strong>
            <small>
              {operations.taskRunnerSummary.latestRun
                ? `${operations.taskRunnerSummary.latestRun.deliveryLogsCreated} 条投递日志`
                : "暂无本地运行记录"}
            </small>
          </article>
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <h2>工作流总览</h2>
          <p>每个步骤都链接到负责该阶段的工作台模块。</p>
        </div>
        <div className="workflow-overview" aria-label="工作台工作流总览">
          {workflowSteps.map((step, index) => (
            <Link className="workflow-step" href={step.href} key={step.label}>
              <span className="workflow-step__index">{index + 1}</span>
              <span className="workflow-step__label">{step.label}</span>
              <strong>{step.count}</strong>
              <p>{step.description}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <h2>常用操作</h2>
          <p>从与当前工作匹配的步骤开始。</p>
        </div>
        <div className="workspace-action-grid">
          {primaryActions.map((action) => (
            <Link
              className="workspace-action-card"
              href={action.href}
              key={action.label}
            >
              <strong>{action.label}</strong>
              <span>{action.description}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <h2>近期活动</h2>
          <p>这里只展示真实的本地工作流记录。</p>
        </div>
        {recentActivity.length > 0 ? (
          <div className="workspace-activity-list">
            {recentActivity.map((activity) => (
              <Link
                className="workspace-activity-card"
                href={activity.href}
                key={`${activity.label}-${activity.title}`}
              >
                <span>{activity.label}</span>
                <strong>{activity.title}</strong>
                <small>{activity.meta}</small>
              </Link>
            ))}
          </div>
        ) : (
          <p className="empty-state">
            还没有记录任何导入、草稿、简报或投递活动。
          </p>
        )}
      </section>

      <section className="section-block section-block--subtle">
        <div className="section-heading">
          <h2>来源快照</h2>
          <p>
            {snapshot.sources.length > 0
              ? `${snapshot.sources.length} 个导入来源快照可用于候选溯源。`
              : "暂无可用的导入来源快照。"}
          </p>
        </div>
      </section>
    </WorkspacePageShell>
  );
}
