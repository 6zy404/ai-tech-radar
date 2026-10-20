// npm run check:pipeline — pops a Windows notification when the scheduled
// import has stalled or undecided candidates have piled up. Same judgments as
// /workspace/operations (getPipelineAlerts), for the days nobody opens it.
// Since 2026-10-20 the same alerts also go off-site through the delivery
// channel named by OPS_ALERT_CHANNEL_ID (src/lib/ops-alert.ts) — a toast is
// only seen by someone at the desk.
//
//   npm run check:pipeline                 check, notify once per alert per day
//   npm run check:pipeline -- --dry-run    check and print, no toast, no alert, no state
//   npm run check:pipeline -- --test       show a sample toast and send a sample
//                                          off-site alert, touch nothing else
//
// Exit code: 0 all clear, 1 at least one alert is active (notified now or
// earlier today), 2 the toast could not be shown. Run it from Task Scheduler
// with "Run only when user is logged on" — a task in session 0 has no desktop
// to show a toast on. The npm script launches it through with-proxy-env.mjs,
// because Telegram and Discord are only reachable from this machine through
// the proxy.
import type { OperationsAttentionItem } from "../src/lib/operations-metrics";
import { getPipelineAlerts } from "../src/lib/operations-metrics";
import { formatOpsAlertTime, sendOpsAlert } from "../src/lib/ops-alert";
import {
  buildPipelineOpsAlert,
  buildPipelineToast,
  getNotificationDay,
  planPipelineNotifications,
  readPipelineAlertState,
  showWindowsToast,
  writePipelineAlertState
} from "../src/lib/pipeline-alert";

const args = new Set(process.argv.slice(3));
const dryRun = args.has("--dry-run");

async function main(): Promise<number> {
  const now = new Date();

  // The task appends this script's output to config/pipeline-alert.log, and
  // until 2026-10-21 nothing in it said when a line was written, so a
  // 「定时导入逾期未运行」 could not be dated without counting entries back.
  console.log(`运行时间：${formatOpsAlertTime(now)}`);

  if (args.has("--test")) {
    const shown = showWindowsToast({
      title: "AI Tech Radar：通知测试",
      body: "看到这条说明桌面通知可用。导入停摆或候选积压时会这样提醒你。"
    });

    console.log(shown.ok ? "测试通知已发出。" : `测试通知失败：${shown.error}`);

    const offSite = await sendOpsAlert({
      title: "AI Tech Radar：站外告警测试",
      body: "看到这条说明站外告警可用。导入停摆、候选积压或隧道重启时会这样提醒你。"
    });

    console.log(offSite.message);

    return shown.ok ? 0 : 2;
  }

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
  // The off-site alert goes out whether or not the toast could be shown; its
  // outcome is logged and never changes the exit code.
  const offSite = await sendOpsAlert(buildPipelineOpsAlert(toNotify));

  console.log(offSite.message);

  if (!shown.ok) {
    // State is left alone so the next run tries again.
    console.error(`桌面通知失败：${shown.error}`);
    return 2;
  }

  writePipelineAlertState(nextState);
  console.log(`已弹出桌面通知（${toNotify.length} 条）。`);

  return 1;
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  }
);
