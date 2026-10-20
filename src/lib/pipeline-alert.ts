import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import type { OperationsAttentionItem } from "@/lib/operations-metrics";
import { writeFileAtomically } from "@/lib/repositories/local-json-store";

/**
 * Desktop notification for the import-stall and backlog alerts
 * (`npm run check:pipeline`). The dashboard already shows them, but the public
 * build has no workspace, so nobody looks at that page between editorial
 * rounds — the 2026-09-25..27 lost imports went unnoticed for three days.
 *
 * Each alert pops up at most once per day (Asia/Shanghai). The bookkeeping
 * lives in `.cache/`, not the data directory: it is this machine's memory of
 * what it already showed, not workflow state, and must not reach the SQLite
 * store or git.
 */
export interface PipelineAlertState {
  /** alert id → the day (YYYY-MM-DD) it was last shown */
  notified: Record<string, string>;
}

export const pipelineAlertTimeZone = "Asia/Shanghai";

export function getPipelineAlertStatePath(projectRoot = process.cwd()) {
  return path.join(projectRoot, ".cache", "pipeline-alert-state.json");
}

export function getNotificationDay(
  now: Date,
  timeZone = pipelineAlertTimeZone
): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(now);
}

export function planPipelineNotifications({
  alerts,
  state,
  day
}: {
  alerts: readonly OperationsAttentionItem[];
  state: PipelineAlertState;
  day: string;
}): { toNotify: OperationsAttentionItem[]; nextState: PipelineAlertState } {
  return {
    toNotify: alerts.filter((alert) => state.notified[alert.id] !== day),
    // Only alerts that are still active are remembered, so one that clears and
    // comes back the same day is shown again.
    nextState: {
      notified: Object.fromEntries(alerts.map((alert) => [alert.id, day]))
    }
  };
}

const toastBodyMaxLength = 240;

export function buildPipelineToast(
  alerts: readonly OperationsAttentionItem[]
): { title: string; body: string } {
  const title = `AI Tech Radar：${alerts.map((alert) => alert.title).join("；")}`;
  const detail = alerts.map((alert) => alert.description).join(" ");
  const footer = "打开工作台 → 运维查看。";
  const room = toastBodyMaxLength - footer.length - 1;
  const body = detail.length > room ? `${detail.slice(0, room - 1)}…` : detail;

  return { title, body: `${body} ${footer}` };
}

/**
 * The same alerts for the off-site channel (`src/lib/ops-alert.ts`), which
 * has room for every description where the toast has 240 characters.
 */
export function buildPipelineOpsAlert(
  alerts: readonly OperationsAttentionItem[]
): { title: string; body: string } {
  return {
    title: `AI Tech Radar：${alerts.map((alert) => alert.title).join("；")}`,
    body: [
      ...alerts.map(
        (alert) => `[${alert.severity}] ${alert.title}：${alert.description}`
      ),
      "打开工作台 → 运维查看；第一件事看任务运行器日志首行写的数据目录。"
    ].join("\n")
  };
}

export function readPipelineAlertState(
  statePath = getPipelineAlertStatePath()
): PipelineAlertState {
  if (!existsSync(statePath)) {
    return { notified: {} };
  }

  try {
    const parsed = JSON.parse(readFileSync(statePath, "utf8")) as unknown;
    const notified = (parsed as PipelineAlertState)?.notified;

    return notified && typeof notified === "object"
      ? { notified }
      : { notified: {} };
  } catch {
    // Worst case of a damaged file is one repeated notification.
    return { notified: {} };
  }
}

export function writePipelineAlertState(
  state: PipelineAlertState,
  statePath = getPipelineAlertStatePath()
) {
  writeFileAtomically(statePath, `${JSON.stringify(state, null, 2)}\n`);
}

// Windows PowerShell's own AppUserModelID: an unregistered id is accepted by
// the API but the toast is silently dropped on Windows 10/11.
const powershellAppId =
  "{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\\WindowsPowerShell\\v1.0\\powershell.exe";

/**
 * The text travels in environment variables, never inside the script, so no
 * title or description can break out of the PowerShell source.
 */
export const pipelineToastScript = [
  "$ErrorActionPreference = 'Stop'",
  "[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null",
  "$xml = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)",
  "$texts = $xml.GetElementsByTagName('text')",
  "$texts.Item(0).AppendChild($xml.CreateTextNode($env:RADAR_TOAST_TITLE)) | Out-Null",
  "$texts.Item(1).AppendChild($xml.CreateTextNode($env:RADAR_TOAST_BODY)) | Out-Null",
  "$toast = [Windows.UI.Notifications.ToastNotification]::new($xml)",
  `[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('${powershellAppId}').Show($toast)`
].join("\n");

export function showWindowsToast(toast: { title: string; body: string }): {
  ok: boolean;
  error?: string;
} {
  if (process.platform !== "win32") {
    return { ok: false, error: "桌面通知只支持 Windows。" };
  }

  const result = spawnSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-EncodedCommand",
      Buffer.from(pipelineToastScript, "utf16le").toString("base64")
    ],
    {
      env: {
        ...process.env,
        RADAR_TOAST_TITLE: toast.title,
        RADAR_TOAST_BODY: toast.body
      },
      encoding: "utf8",
      timeout: 20_000,
      windowsHide: true
    }
  );

  if (result.error) {
    return { ok: false, error: result.error.message };
  }

  if (result.status !== 0) {
    return {
      ok: false,
      error: (result.stderr || `powershell exited ${result.status}`).trim()
    };
  }

  return { ok: true };
}
