"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { ImportRun } from "@/types/content";

interface ExternalSourceBatchActionsProps {
  latestImportRun?: ImportRun;
}

interface BatchImportResponse {
  ok: boolean;
  message?: string;
  run?: ImportRun;
}

function formatDateTime(value: string | undefined): string {
  return value ? value.slice(0, 16).replace("T", " ") : "Never run";
}

export function ExternalSourceBatchActions({
  latestImportRun
}: ExternalSourceBatchActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [activeRun, setActiveRun] = useState<ImportRun | undefined>(
    latestImportRun
  );

  function runBatchImport() {
    startTransition(async () => {
      setMessage("");

      try {
        const response = await fetch("/api/workspace/sources/import", {
          method: "POST"
        });
        const result = (await response.json()) as BatchImportResponse;

        if (!response.ok || !result.ok || !result.run) {
          throw new Error(result.message ?? "Batch import failed.");
        }

        setActiveRun(result.run);
        setMessage("Batch import completed.");
        router.refresh();
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "Batch import failed."
        );
      }
    });
  }

  return (
    <section className="source-batch-panel">
      <div>
        <p className="eyebrow">Batch Import</p>
        <h2>Import all enabled sources</h2>
        <p>
          Runs each enabled source independently. Disabled sources are skipped;
          failed sources are recorded without stopping the whole run.
        </p>
      </div>

      <div className="source-batch-panel__actions">
        <button
          type="button"
          className="action-button action-button--accent"
          onClick={runBatchImport}
          disabled={isPending}
        >
          {isPending
            ? "Importing enabled sources..."
            : "Import enabled sources"}
        </button>
        {message ? (
          <p className="candidate-review-actions__message">{message}</p>
        ) : null}
      </div>

      {activeRun ? (
        <div className="source-batch-summary">
          <span>Status: {activeRun.status}</span>
          <span>Total: {activeRun.totalSources}</span>
          <span>Enabled: {activeRun.enabledSources}</span>
          <span>Success: {activeRun.successfulSources}</span>
          <span>Partial: {activeRun.partialSources}</span>
          <span>Failed: {activeRun.failedSources}</span>
          <span>Created: {activeRun.totalCandidatesCreated}</span>
          <span>Skipped: {activeRun.totalCandidatesSkipped}</span>
          <span>Finished: {formatDateTime(activeRun.finishedAt)}</span>
        </div>
      ) : (
        <p className="source-batch-panel__empty">
          No batch import has run yet. Disabled sources will be skipped when
          this action runs.
        </p>
      )}
    </section>
  );
}
