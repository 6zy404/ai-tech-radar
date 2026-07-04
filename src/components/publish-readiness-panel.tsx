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
          <p className="eyebrow">Publish Quality Gate</p>
          <h2>Publish readiness</h2>
        </div>
        <span
          className={`info-pill${
            readiness.isReady ? "" : " info-pill--warning"
          }`}
        >
          {readiness.isReady ? "Ready to publish" : "Blocked"}
        </span>
      </div>

      <div className="publish-readiness__grid">
        <IssueList
          title="Blocking errors"
          issues={readiness.blockingErrors}
          emptyText="No blocking errors."
          tone="error"
        />
        <IssueList
          title="Warnings"
          issues={readiness.warnings}
          emptyText="No warnings."
          tone="warning"
        />
      </div>
    </section>
  );
}
