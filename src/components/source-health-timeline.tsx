import { getExternalSourceImportStatusLabel } from "@/lib/source-display";
import {
  getRecentImportSuccess,
  recentSuccessWindowDays,
  sourceImportHistoryLimit
} from "@/lib/source-health-history";
import type { SourceImportHistoryEntry } from "@/types/content";

// The last 30 import attempts of one source as a row of cells, oldest on
// the left. The picture is aria-hidden; the table under it is the text
// version, with every entry.

const cellWidth = 10;
const cellGap = 4;
const cellHeight = 28;
const width = sourceImportHistoryLimit * (cellWidth + cellGap) - cellGap;

function formatTime(value: string): string {
  return value.slice(0, 16).replace("T", " ");
}

function describeEntry(entry: SourceImportHistoryEntry): string {
  return `${formatTime(entry.at)} · ${getExternalSourceImportStatusLabel(entry.status)} · 新增 ${entry.candidatesCreated} / 跳过 ${entry.candidatesSkipped}`;
}

interface SourceHealthTimelineProps {
  history: SourceImportHistoryEntry[];
}

export function SourceHealthTimeline({ history }: SourceHealthTimelineProps) {
  if (history.length === 0) {
    return (
      <p className="empty-state">
        还没有导入记录。运行一次导入后，这里会按时间排出每次的结果。
      </p>
    );
  }

  // Oldest first, right-aligned, so the newest attempt is always the last
  // cell and empty slots sit on the left.
  const ordered = [...history].reverse();
  const emptySlots = sourceImportHistoryLimit - ordered.length;
  const counts = {
    success: history.filter((entry) => entry.status === "success").length,
    partial: history.filter((entry) => entry.status === "partial").length,
    failed: history.filter((entry) => entry.status === "failed").length
  };
  const recent = getRecentImportSuccess(history);

  return (
    <div className="source-health-timeline">
      <p className="source-health-timeline__summary">
        最近 {history.length} 次：成功 {counts.success} · 部分成功{" "}
        {counts.partial} · 失败 {counts.failed}
        {recent.total > 0
          ? `；近 ${recentSuccessWindowDays} 天成功率 ${Math.round(
              (recent.rate ?? 0) * 100
            )}%（${recent.successful}/${recent.total}）`
          : `；近 ${recentSuccessWindowDays} 天没有导入`}
      </p>

      <svg
        className="source-health-timeline__chart"
        viewBox={`0 0 ${width} ${cellHeight}`}
        preserveAspectRatio="xMinYMid meet"
        aria-hidden="true"
        focusable="false"
      >
        {Array.from({ length: emptySlots }, (_, index) => (
          <rect
            key={`empty-${index}`}
            className="source-health-timeline__cell source-health-timeline__cell--empty"
            x={index * (cellWidth + cellGap) + 0.5}
            y={0.5}
            width={cellWidth - 1}
            height={cellHeight - 1}
            rx={2}
          />
        ))}
        {ordered.map((entry, index) => (
          <rect
            key={`${entry.at}-${index}`}
            className={`source-health-timeline__cell source-health-timeline__cell--${entry.status}`}
            x={(emptySlots + index) * (cellWidth + cellGap)}
            y={entry.status === "success" ? 6 : 0}
            width={cellWidth}
            height={entry.status === "success" ? cellHeight - 6 : cellHeight}
            rx={2}
          >
            <title>{describeEntry(entry)}</title>
          </rect>
        ))}
      </svg>

      <div className="source-health-timeline__legend" aria-hidden="true">
        <span>
          <i className="source-health-timeline__swatch source-health-timeline__swatch--success" />
          成功
        </span>
        <span>
          <i className="source-health-timeline__swatch source-health-timeline__swatch--partial" />
          部分成功
        </span>
        <span>
          <i className="source-health-timeline__swatch source-health-timeline__swatch--failed" />
          失败
        </span>
        <span className="source-health-timeline__axis">左旧 → 右新</span>
      </div>

      <details className="source-health-timeline__details">
        <summary>逐次记录（{history.length}）</summary>
        <table className="source-health-timeline__table">
          <thead>
            <tr>
              <th scope="col">时间</th>
              <th scope="col">结果</th>
              <th scope="col">新增</th>
              <th scope="col">跳过</th>
              <th scope="col">错误摘要</th>
            </tr>
          </thead>
          <tbody>
            {history.map((entry, index) => (
              <tr key={`${entry.at}-${index}`}>
                <td>{formatTime(entry.at)}</td>
                <td>{getExternalSourceImportStatusLabel(entry.status)}</td>
                <td>{entry.candidatesCreated}</td>
                <td>{entry.candidatesSkipped}</td>
                <td>{entry.errorSummary ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
