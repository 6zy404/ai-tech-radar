// Sends one plain-text operations alert through the delivery channel named by
// OPS_ALERT_CHANNEL_ID (src/lib/ops-alert.ts). Launched through the proxy
// wrapper, because Telegram and Discord are only reachable from this machine
// through it:
//
//   node scripts/with-proxy-env.mjs node scripts/run-ts.cjs scripts/send-ops-alert.ts --title "标题" --body "正文"
//   npm run ops:alert -- --title "标题" --body "正文"          (the same command)
//
//   --json <file>        a UTF-8 JSON file {"title": "...", "body": "...", "at": "<ISO time>"?};
//                        the way to pass Chinese from PowerShell without going
//                        through the console code page
//   --body-file <file>   the body from a UTF-8 text file
//   --channel <id>       use this channel instead of OPS_ALERT_CHANNEL_ID
//   --dry-run            build the message and print it, send nothing
//
// Exit code: 0 sent, or nothing to do (no channel configured); 1 the send
// failed, or the channel is missing, disabled or unsupported; 2 bad arguments.
import { readFileSync } from "node:fs";

import {
  buildOpsAlertText,
  opsAlertChannelEnvName,
  sendOpsAlert,
  toOpsAlertPlainText,
  type OpsAlert
} from "../src/lib/ops-alert";

interface ParsedArgs {
  title?: string;
  body?: string;
  at?: string;
  json?: string;
  bodyFile?: string;
  channel?: string;
  dryRun: boolean;
}

const usage = `用法：node scripts/run-ts.cjs scripts/send-ops-alert.ts --title "标题" --body "正文" [--json 文件] [--body-file 文件] [--channel 渠道 id] [--dry-run]`;

function readUtf8(file: string): string {
  // PowerShell's Out-File writes a BOM; JSON.parse does not accept one.
  return readFileSync(file, "utf8").replace(/^﻿/, "");
}

function parseArgs(argv: string[]): ParsedArgs | undefined {
  const parsed: ParsedArgs = { dryRun: false };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      const value = argv[index + 1];

      if (value === undefined) {
        throw new Error(`${arg} 后面缺少值。`);
      }

      index += 1;

      return value;
    };

    switch (arg) {
      case "--title":
        parsed.title = next();
        break;
      case "--body":
        parsed.body = next();
        break;
      case "--at":
        parsed.at = next();
        break;
      case "--json":
        parsed.json = next();
        break;
      case "--body-file":
        parsed.bodyFile = next();
        break;
      case "--channel":
        parsed.channel = next();
        break;
      case "--dry-run":
        parsed.dryRun = true;
        break;
      case "--help":
      case "-h":
        return undefined;
      default:
        throw new Error(`不认识的参数：${arg}`);
    }
  }

  return parsed;
}

function buildAlert(parsed: ParsedArgs): OpsAlert {
  let title = parsed.title;
  let body = parsed.body;
  let at = parsed.at;

  if (parsed.json) {
    const record = JSON.parse(readUtf8(parsed.json)) as Record<string, unknown>;

    title ??= typeof record.title === "string" ? record.title : undefined;
    body ??= typeof record.body === "string" ? record.body : undefined;
    at ??= typeof record.at === "string" ? record.at : undefined;
  }

  if (parsed.bodyFile) {
    body = readUtf8(parsed.bodyFile);
  }

  if (!title?.trim()) {
    throw new Error("缺少标题（--title，或 --json 文件里的 title）。");
  }

  if (!body?.trim()) {
    throw new Error(
      "缺少正文（--body、--body-file，或 --json 文件里的 body）。"
    );
  }

  const when = at ? new Date(at) : undefined;

  if (when && Number.isNaN(when.getTime())) {
    throw new Error(`时间无法解析：${at}`);
  }

  return { title, body, at: when };
}

async function main(): Promise<number> {
  let parsed: ParsedArgs | undefined;
  let alert: OpsAlert;

  try {
    parsed = parseArgs(process.argv.slice(3));

    if (!parsed) {
      console.log(usage);
      return 0;
    }

    alert = buildAlert(parsed);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error(usage);
    return 2;
  }

  const result = await sendOpsAlert(alert, {
    channelId: parsed.channel,
    dryRun: parsed.dryRun
  });

  if (parsed.dryRun && result.status === "sent") {
    console.log(toOpsAlertPlainText(buildOpsAlertText(alert)));
    console.log("");
  }

  console.log(result.message);

  switch (result.status) {
    case "sent":
      return 0;
    case "not_configured":
      // Nothing is wrong: the owner has not chosen a channel. The line above
      // names the variable to set.
      return 0;
    default:
      console.error(
        `检查 ${opsAlertChannelEnvName} 指向的渠道是否存在并已启用（/workspace/delivery）。`
      );
      return 1;
  }
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
);
