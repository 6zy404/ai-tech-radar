"use client";

import { DailyScheduleActions } from "@/components/daily-schedule-actions";

interface ScheduledDigestActionsProps {
  enabled: boolean;
  scheduleTime: string;
}

export function ScheduledDigestActions(props: ScheduledDigestActionsProps) {
  return (
    <DailyScheduleActions
      {...props}
      endpoint="/api/workspace/scheduled-digest"
      copy={{
        name: "定时简报草稿",
        verb: "生成",
        disableConfirm:
          "停用定时简报草稿？任务运行器将不再自动生成每日简报草稿，编辑轮需要手动生成。"
      }}
    />
  );
}
