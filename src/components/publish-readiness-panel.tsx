import type { PublishReadinessResult } from "@/lib/publish-readiness";

interface PublishReadinessPanelProps {
  readiness: PublishReadinessResult;
}

function IssueList({
  title,
  issues,
  emptyText,
  tone
}: {
  title: string;
  issues: PublishReadinessResult["blockingErrors"];
  emptyText: string;
  tone: "error" | "warning";
}) {
  return (
    <div
      className={`publish-readiness__group publish-readiness__group--${tone}`}
    >
      <h3>{title}</h3>
      {issues.length > 0 ? (
        <ul className="publish-readiness__list">
          {issues.map((issue) => (
            <li key={issue.code}>
              <strong>{issue.field}</strong>
              <span>{issue.message}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p>{emptyText}</p>
      )}
    </div>
  );
}

export function PublishReadinessPanel({
  readiness
}: PublishReadinessPanelProps) {
  return (
    <section className="section-panel publish-readiness">
      <div className="publish-readiness__header">
        <div>
          <p className="eyebrow">发布质量门</p>
          <h2>发布就绪状态</h2>
        </div>
        <span
          className={`info-pill${
            readiness.isReady ? "" : " info-pill--warning"
          }`}
        >
          {readiness.isReady ? "可以发布" : "已阻塞"}
        </span>
      </div>

      <div className="publish-readiness__grid">
        <IssueList
          title="阻塞错误"
          issues={readiness.blockingErrors}
          emptyText="没有阻塞错误。"
          tone="error"
        />
        <IssueList
          title="警告"
          issues={readiness.warnings}
          emptyText="没有警告。"
          tone="warning"
        />
      </div>
    </section>
  );
}
