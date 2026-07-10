import {
  getCandidateDraftConversionReadiness,
  getCandidateWorkflowData
} from "@/lib/candidate-workflow";
import { getDeliveryRuns } from "@/lib/delivery-workflow";
import { getDailyDigests } from "@/lib/digest-workflow";
import {
  evaluateCandidateQuality,
  evaluateSourcesQuality
} from "@/lib/quality-signals";
import {
  getScheduledDeliveries,
  getScheduledDeliveryRuns
} from "@/lib/scheduled-delivery-workflow";
import {
  getExternalSourceImportRuns,
  getExternalSources
} from "@/lib/source-workflow";
import { getLatestTaskRunnerRun, getTaskRunnerRuns } from "@/lib/task-runner";
import { getWorkflowEvents } from "@/lib/workflow-events";
import type {
  CandidateQualityFlag,
  DeliveryRun,
  ExternalSource,
  ScheduledDeliveryRun,
  TaskRunnerRun,
  WorkflowEvent
} from "@/types/content";

export type OperationsHealthStatus =
  "healthy" | "warning" | "critical" | "unknown";

export interface OperationsMetric {
  label: string;
  value: string;
  detail: string;
  status: OperationsHealthStatus;
}

export interface OperationsAttentionItem {
  id: string;
  severity: Exclude<OperationsHealthStatus, "unknown">;
  title: string;
  description: string;
  href: string;
  source: string;
  createdAt?: string;
}

export interface FailedImportSummary {
  sourceId: string;
  sourceName: string;
  status: string;
  failedAt?: string;
  message: string;
  consecutiveFailureCount: number;
  href: string;
}

export interface FailedDeliverySummary {
  runId: string;
  digestDate: string;
  channelName: string;
  channelType: string;
  failedAt?: string;
  message: string;
  href: string;
}

export interface FailedScheduledRunSummary {
  runId: string;
  scheduleId: string;
  scheduleName: string;
  status: string;
  runAt?: string;
  failedChannels: number;
  message: string;
  href: string;
}

export interface TaskRunnerSummary {
  latestRun?: TaskRunnerRun;
  totalRuns: number;
  failedRuns: number;
  partialRuns: number;
}

export interface OperationsDashboardData {
  status: OperationsHealthStatus;
  statusReasons: string[];
  metrics: OperationsMetric[];
  attentionItems: OperationsAttentionItem[];
  failedImports: FailedImportSummary[];
  failedDeliveries: FailedDeliverySummary[];
  failedScheduledRuns: FailedScheduledRunSummary[];
  failedWorkflowEvents: WorkflowEvent[];
  recentEvents: WorkflowEvent[];
  taskRunnerSummary: TaskRunnerSummary;
}

const recentActivityActions = new Set([
  "source.imported",
  "candidate.converted_to_draft",
  "draft.published",
  "digest.generated",
  "digest.published",
  "delivery.sent",
  "delivery.failed",
  "schedule.run",
  "schedule.run_failed",
  "task_runner.run"
]);

const blockingCandidateFlags = new Set<CandidateQualityFlag>([
  "missing_summary",
  "missing_content",
  "missing_publisher",
  "invalid_source_url",
  "invalid_publish_date",
  "missing_tags",
  "not_convertible"
]);

function parseTime(value: string | undefined): number {
  if (!value) {
    return 0;
  }

  const timestamp = Date.parse(value);

  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function statusForCount(count: number): OperationsHealthStatus {
  return count > 0 ? "warning" : "healthy";
}

function isFailureEvent(event: WorkflowEvent): boolean {
  const action = event.action.toLowerCase();
  const metadata = event.metadata ?? {};

  return (
    action.includes("failed") ||
    action.includes("fail") ||
    typeof metadata.errorMessage === "string"
  );
}

function getEventMessage(event: WorkflowEvent): string {
  const metadata = event.metadata ?? {};

  return sanitizeOperationsText(
    metadata.errorMessage ?? metadata.message ?? metadata.status ?? event.action
  );
}

function sanitizeWorkflowEventForOperations(
  event: WorkflowEvent
): WorkflowEvent {
  return {
    ...event,
    beforeSnapshot: sanitizeOperationsValue(event.beforeSnapshot),
    afterSnapshot: sanitizeOperationsValue(event.afterSnapshot),
    metadata: event.metadata
      ? (sanitizeOperationsValue(event.metadata) as Record<string, unknown>)
      : undefined
  };
}

export function sanitizeOperationsText(value: unknown): string {
  return String(value ?? "")
    .replace(/https?:\/\/\S+/gi, "[url]")
    .replace(/mock:\/\/(?:success|failed)\S*/gi, (match) =>
      match.startsWith("mock://failed") ? "mock://failed" : "mock://success"
    )
    .replace(/(token|key|secret|signature|auth)=([^&\s]+)/gi, "$1=***")
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer ***");
}

export function sanitizeOperationsValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeOperationsValue(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => {
        if (
          /endpoint|url|token|secret|signature|authorization|password|key/i.test(
            key
          )
        ) {
          return [key, "[redacted]"];
        }

        return [key, sanitizeOperationsValue(item)];
      })
    );
  }

  if (typeof value === "string") {
    return sanitizeOperationsText(value);
  }

  return value;
}

export function formatOperationsJsonPreview(
  value: unknown,
  maxLength = 1600
): string {
  if (value === undefined) {
    return "No data";
  }

  const serialized = JSON.stringify(sanitizeOperationsValue(value), null, 2);

  if (!serialized) {
    return "No data";
  }

  return serialized.length > maxLength
    ? `${serialized.slice(0, maxLength - 3).trimEnd()}...`
    : serialized;
}

function getFailedImportSummary(
  sources: ExternalSource[]
): FailedImportSummary[] {
  return sources
    .filter(
      (source) =>
        source.lastImportStatus === "failed" ||
        source.lastImportStatus === "partial" ||
        (source.consecutiveFailureCount ?? 0) > 0
    )
    .sort(
      (left, right) =>
        parseTime(right.lastFetchedAt) - parseTime(left.lastFetchedAt)
    )
    .map((source) => ({
      sourceId: source.id,
      sourceName: source.name,
      status: source.lastImportStatus,
      failedAt: source.lastFetchedAt,
      message: sanitizeOperationsText(
        source.lastErrorMessage ?? source.lastImportMessage ?? "导入需要复查。"
      ),
      consecutiveFailureCount: source.consecutiveFailureCount ?? 0,
      href: `/workspace/sources/${source.id}`
    }));
}

function getFailedDeliverySummary(
  runs: DeliveryRun[]
): FailedDeliverySummary[] {
  return runs
    .filter((run) => run.status === "failed")
    .sort(
      (left, right) =>
        parseTime(right.finishedAt ?? right.startedAt) -
        parseTime(left.finishedAt ?? left.startedAt)
    )
    .map((run) => ({
      runId: run.id,
      digestDate: run.digestDate,
      channelName: run.channelName,
      channelType: run.channelType,
      failedAt: run.finishedAt ?? run.startedAt,
      message: sanitizeOperationsText(
        run.errorMessage ?? run.responseBodyPreview ?? "投递失败。"
      ),
      href: `/workspace/digests/${run.digestDate}`
    }));
}

function getFailedScheduledRunSummary(
  runs: ScheduledDeliveryRun[]
): FailedScheduledRunSummary[] {
  return runs
    .filter((run) => run.status === "failed" || run.status === "partial")
    .sort(
      (left, right) =>
        parseTime(right.finishedAt ?? right.startedAt) -
        parseTime(left.finishedAt ?? left.startedAt)
    )
    .map((run) => ({
      runId: run.id,
      scheduleId: run.scheduleId,
      scheduleName: run.scheduleName,
      status: run.status,
      runAt: run.finishedAt ?? run.startedAt,
      failedChannels: run.failedChannels,
      message: sanitizeOperationsText(run.message),
      href: "/workspace/delivery/schedules"
    }));
}

function getTaskSummary(): TaskRunnerSummary {
  const runs = getTaskRunnerRuns();

  return {
    latestRun: getLatestTaskRunnerRun(),
    totalRuns: runs.length,
    failedRuns: runs.filter((run) => run.status === "failed").length,
    partialRuns: runs.filter((run) => run.status === "partial").length
  };
}

function getCandidateQualityAttention(): OperationsAttentionItem[] {
  const { candidates } = getCandidateWorkflowData();

  return candidates
    .flatMap((candidate): OperationsAttentionItem[] => {
      const readiness = getCandidateDraftConversionReadiness(candidate.id);
      const quality = evaluateCandidateQuality(candidate, {
        canConvert: readiness.canConvert
      });
      const blockingFlags = quality.flags.filter((flag) =>
        blockingCandidateFlags.has(flag)
      );

      if (quality.hasTitle && blockingFlags.length === 0) {
        return [];
      }

      const title = candidate.originalTitle || "未命名导入候选";
      const reason = quality.hasTitle
        ? blockingFlags.join(", ")
        : "missing_title";

      return [
        {
          id: `candidate-quality-${candidate.id}`,
          severity: "warning" as const,
          title,
          description: `候选质量需要复查：${reason}。`,
          href: `/workspace/candidates/${candidate.id}`,
          source: "候选质量",
          createdAt: candidate.importedAt
        }
      ];
    })
    .slice(0, 12);
}

function getAttentionRequiredItems({
  failedImports,
  failedDeliveries,
  failedScheduledRuns,
  failedWorkflowEvents
}: {
  failedImports: FailedImportSummary[];
  failedDeliveries: FailedDeliverySummary[];
  failedScheduledRuns: FailedScheduledRunSummary[];
  failedWorkflowEvents: WorkflowEvent[];
}): OperationsAttentionItem[] {
  const { duplicateGroups } = getCandidateWorkflowData();
  const latestTaskRunnerRun = getLatestTaskRunnerRun();
  const attentionItems: OperationsAttentionItem[] = [
    ...failedImports.map((item) => ({
      id: `source-${item.sourceId}`,
      severity:
        item.consecutiveFailureCount >= 2 || item.status === "failed"
          ? ("critical" as const)
          : ("warning" as const),
      title: item.sourceName,
      description: `来源导入状态为 ${item.status}。${item.message}`,
      href: item.href,
      source: "来源导入",
      createdAt: item.failedAt
    })),
    ...failedDeliveries.slice(0, 8).map((item) => ({
      id: `delivery-${item.runId}`,
      severity: "warning" as const,
      title: `${item.digestDate} -> ${item.channelName}`,
      description: item.message,
      href: item.href,
      source: "投递",
      createdAt: item.failedAt
    })),
    ...failedScheduledRuns.slice(0, 8).map((item) => ({
      id: `schedule-${item.runId}`,
      severity:
        item.status === "failed" ? ("critical" as const) : ("warning" as const),
      title: item.scheduleName,
      description: `${item.status}: ${item.message}`,
      href: item.href,
      source: "定时投递",
      createdAt: item.runAt
    })),
    ...duplicateGroups
      .filter((group) => group.status === "open")
      .slice(0, 8)
      .map((group) => ({
        id: `duplicate-${group.id}`,
        severity: "warning" as const,
        title: `重复组 ${group.id}`,
        description: `${group.candidateIds.length} 条候选待选定主候选。`,
        href: `/workspace/duplicates/${group.id}`,
        source: "重复组审核",
        createdAt: group.updatedAt
      })),
    ...failedWorkflowEvents.slice(0, 8).map((event) => ({
      id: `event-${event.id}`,
      severity: event.action.includes("publish_failed")
        ? ("critical" as const)
        : ("warning" as const),
      title: event.action,
      description: getEventMessage(event),
      href: "/workspace/operations/events",
      source: "工作流事件",
      createdAt: event.createdAt
    })),
    ...getCandidateQualityAttention()
  ];

  if (
    latestTaskRunnerRun?.status === "failed" ||
    latestTaskRunnerRun?.status === "partial"
  ) {
    attentionItems.unshift({
      id: `task-runner-${latestTaskRunnerRun.id}`,
      severity:
        latestTaskRunnerRun.status === "failed" ? "critical" : "warning",
      title: "最近一次任务运行器运行需要复查",
      description: `${latestTaskRunnerRun.status}: ${latestTaskRunnerRun.messages
        .map(sanitizeOperationsText)
        .join(" ")}`,
      href: "/workspace/delivery/schedules",
      source: "任务运行器",
      createdAt: latestTaskRunnerRun.finishedAt
    });
  }

  return attentionItems
    .sort(
      (left, right) => parseTime(right.createdAt) - parseTime(left.createdAt)
    )
    .slice(0, 24);
}

export function getOperationsRecentWorkflowEvents(limit = 16): WorkflowEvent[] {
  return getWorkflowEvents()
    .filter((event) => recentActivityActions.has(event.action))
    .map(sanitizeWorkflowEventForOperations)
    .slice(0, limit);
}

export function getSystemHealthSummary(): OperationsDashboardData {
  const sources = getExternalSources();
  const importRuns = getExternalSourceImportRuns();
  const { candidates, duplicateGroups } = getCandidateWorkflowData();
  const sourceQualityById = evaluateSourcesQuality(
    sources,
    candidates,
    importRuns
  );
  const deliveryRuns = getDeliveryRuns();
  const scheduledDeliveries = getScheduledDeliveries();
  const scheduledRuns = getScheduledDeliveryRuns();
  const digests = getDailyDigests();
  const taskRunnerSummary = getTaskSummary();
  const workflowEvents = getWorkflowEvents();
  const failedImports = getFailedImportSummary(sources);
  const failedDeliveries = getFailedDeliverySummary(deliveryRuns);
  const failedScheduledRuns = getFailedScheduledRunSummary(scheduledRuns);
  const failedWorkflowEvents = workflowEvents
    .filter(isFailureEvent)
    .map(sanitizeWorkflowEventForOperations)
    .slice(0, 20);
  const attentionItems = getAttentionRequiredItems({
    failedImports,
    failedDeliveries,
    failedScheduledRuns,
    failedWorkflowEvents
  });
  const goodSources = Object.values(sourceQualityById).filter(
    (metrics) => metrics.qualityLevel === "good"
  ).length;
  const latestImportRun = importRuns[0];
  const latestDigest = [...digests].sort(
    (left, right) =>
      parseTime(right.updatedAt ?? right.generatedAt) -
      parseTime(left.updatedAt ?? left.generatedAt)
  )[0];
  const latestScheduledRun = scheduledRuns[0];
  const latestTaskRunnerRun = taskRunnerSummary.latestRun;
  const openDuplicateGroups = duplicateGroups.filter(
    (group) => group.status === "open"
  ).length;
  const criticalReasons: string[] = [];
  const warningReasons: string[] = [];

  if (latestTaskRunnerRun?.status === "failed") {
    criticalReasons.push("最近一次任务运行器运行失败。");
  }

  if (failedScheduledRuns.some((run) => run.status === "failed")) {
    criticalReasons.push("A scheduled delivery run failed.");
  }

  if (
    failedImports.some(
      (source) =>
        source.status === "failed" || source.consecutiveFailureCount >= 2
    )
  ) {
    criticalReasons.push("有来源导入失败。");
  }

  if (
    failedWorkflowEvents.some((event) =>
      event.action.includes("publish_failed")
    )
  ) {
    criticalReasons.push("A publish workflow failed.");
  }

  if (latestTaskRunnerRun?.status === "partial") {
    warningReasons.push("最近一次任务运行器运行为部分成功。");
  }

  if (failedDeliveries.length > 0) {
    warningReasons.push("有投递运行失败。");
  }

  if (failedImports.some((source) => source.status === "partial")) {
    warningReasons.push("有来源使用了回退导入。");
  }

  if (failedScheduledRuns.some((run) => run.status === "partial")) {
    warningReasons.push("A scheduled delivery run was partial.");
  }

  if (openDuplicateGroups > 0) {
    warningReasons.push("有待处理的重复组需要审核。");
  }

  if (getCandidateQualityAttention().length > 0) {
    warningReasons.push("部分候选存在阻塞性质量问题。");
  }

  const hasNoSignals =
    sources.length === 0 &&
    importRuns.length === 0 &&
    deliveryRuns.length === 0 &&
    scheduledDeliveries.length === 0 &&
    scheduledRuns.length === 0 &&
    digests.length === 0 &&
    workflowEvents.length === 0 &&
    taskRunnerSummary.totalRuns === 0;
  const status: OperationsHealthStatus = hasNoSignals
    ? "unknown"
    : criticalReasons.length > 0
      ? "critical"
      : warningReasons.length > 0
        ? "warning"
        : "healthy";
  const statusReasons =
    status === "healthy"
      ? ["当前没有可见的来源、投递、计划、任务运行器或工作流失败。"]
      : status === "unknown"
        ? ["还没有记录任何运维历史。"]
        : [...criticalReasons, ...warningReasons];

  return {
    status,
    statusReasons,
    metrics: [
      {
        label: "来源健康",
        value: `${goodSources}/${sources.length}`,
        detail: "个来源评估为良好",
        status:
          sources.length === 0
            ? "unknown"
            : goodSources === sources.length
              ? "healthy"
              : failedImports.length > 0
                ? "warning"
                : "warning"
      },
      {
        label: "最近导入",
        value: latestImportRun?.status ?? "未运行",
        detail: latestImportRun
          ? `新增 ${latestImportRun.totalCandidatesCreated}，跳过 ${latestImportRun.totalCandidatesSkipped}`
          : "暂无导入运行记录",
        status: latestImportRun
          ? latestImportRun.status === "failed"
            ? "critical"
            : latestImportRun.status === "partial"
              ? "warning"
              : "healthy"
          : "unknown"
      },
      {
        label: "任务运行器",
        value: latestTaskRunnerRun?.status ?? "未运行",
        detail: latestTaskRunnerRun
          ? `到期 ${latestTaskRunnerRun.dueScheduleCount}，投递日志 ${latestTaskRunnerRun.deliveryLogsCreated}`
          : "暂无任务运行器审计记录",
        status: latestTaskRunnerRun
          ? latestTaskRunnerRun.status === "failed"
            ? "critical"
            : latestTaskRunnerRun.status === "partial"
              ? "warning"
              : "healthy"
          : "unknown"
      },
      {
        label: "定时投递",
        value: latestScheduledRun?.status ?? "未运行",
        detail: `${scheduledDeliveries.filter((schedule) => schedule.enabled).length}/${scheduledDeliveries.length} 个计划已启用`,
        status: latestScheduledRun
          ? latestScheduledRun.status === "failed"
            ? "critical"
            : latestScheduledRun.status === "partial"
              ? "warning"
              : "healthy"
          : "unknown"
      },
      {
        label: "最近简报",
        value: latestDigest?.status ?? "无",
        detail: latestDigest ? latestDigest.date : "暂无简报记录",
        status: latestDigest
          ? latestDigest.status === "published"
            ? "healthy"
            : "warning"
          : "unknown"
      },
      {
        label: "投递失败",
        value: String(failedDeliveries.length),
        detail: "次投递需要复查",
        status: statusForCount(failedDeliveries.length)
      },
      {
        label: "工作流失败事件",
        value: String(failedWorkflowEvents.length),
        detail: "条带失败信号的审计事件",
        status: statusForCount(failedWorkflowEvents.length)
      }
    ],
    attentionItems,
    failedImports,
    failedDeliveries,
    failedScheduledRuns,
    failedWorkflowEvents,
    recentEvents: getOperationsRecentWorkflowEvents(),
    taskRunnerSummary
  };
}
