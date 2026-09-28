"use client";

import { DailyScheduleActions } from "@/components/daily-schedule-actions";

interface ScheduledImportActionsProps {
  enabled: boolean;
  scheduleTime: string;
}

export function ScheduledImportActions(props: ScheduledImportActionsProps) {
  return (
    <DailyScheduleActions
      {...props}
      endpoint="/api/workspace/scheduled-import"
      copy={{
        name: "定时导入",
        verb: "导入",
        disableConfirm:
          "停用定时导入？任务运行器将不再自动导入来源，公开快讯会停止自动更新。"
      }}
    />
  );
}
