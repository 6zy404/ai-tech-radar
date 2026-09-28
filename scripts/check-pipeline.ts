// npm run check:pipeline — pops a Windows notification when the scheduled
// import has stalled or undecided candidates have piled up. Same judgments as
// /workspace/operations (getPipelineAlerts), for the days nobody opens it.
//
//   npm run check:pipeline                 check, notify once per alert per day
//   npm run check:pipeline -- --dry-run    check and print, no toast, no state
//   npm run check:pipeline -- --test       show a sample toast, touch nothing
//
// Exit code: 0 all clear, 1 at least one alert is active (notified now or
// earlier today), 2 the toast could not be shown. Run it from Task Scheduler
// with "Run only when user is logged on" — a task in session 0 has no desktop
// to show a toast on.
import type { OperationsAttentionItem } from "../src/lib/operations-metrics";
import { getPipelineAlerts } from "../src/lib/operations-metrics";
import {
  buildPipelineToast,
  getNotificationDay,
  planPipelineNotifications,
  readPipelineAlertState,
  showWindowsToast,
  writePipelineAlertState
} from "../src/lib/pipeline-alert";

const args = new Set(process.argv.slice(3));
const dryRun = args.has("--dry-run");

function main(): number {
  if (args.has("--test")) {
    const shown = showWindowsToast({
      title: "AI Tech Radar：通知测试",
      body: "看到这条说明桌面通知可用。导入停摆或候选积压时会这样提醒你。"
    });

    console.log(shown.ok ? "测试通知已发出。" : `测试通知失败：${shown.error}`);
    return shown.ok ? 0 : 2;
  }

  const now = new Date();
  const { importStall, candidateBacklog } = getPipelineAlerts({ now });
  const alerts: OperationsAttentionItem[] = [
    ...importStall,
    ...(candidateBacklog ? [candidateBacklog] : [])
  ];

  if (alerts.length === 0) {
    console.log("流水线正常：导入没有停摆，候选没有积压。");

    if (!dryRun) {
      writePipelineAlertState({ notified: {} });
    }

    return 0;
  }

  for (const alert of alerts) {
    console.log(`[${alert.severity}] ${alert.title}：${alert.description}`);
  }

  const day = getNotificationDay(now);
  const { toNotify, nextState } = planPipelineNotifications({
    alerts,
    state: readPipelineAlertState(),
    day
  });

  if (dryRun) {
    console.log(`（--dry-run：本应通知 ${toNotify.length} 条，未弹出。）`);
    return 1;
  }

  if (toNotify.length === 0) {
    console.log(`今天（${day}）已经通知过，不再重复弹出。`);
    return 1;
  }

  const shown = showWindowsToast(buildPipelineToast(toNotify));

  if (!shown.ok) {
    // State is left alone so the next run tries again.
    console.error(`桌面通知失败：${shown.error}`);
    return 2;
  }

  writePipelineAlertState(nextState);
  console.log(`已弹出桌面通知（${toNotify.length} 条）。`);

  return 1;
}

process.exitCode = main();
