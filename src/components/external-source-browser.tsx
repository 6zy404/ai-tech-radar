"use client";

import Link from "next/link";
import { useDeferredValue, useState } from "react";

import { ExternalSourceActions } from "@/components/external-source-actions";
import { ExternalSourceBatchActions } from "@/components/external-source-batch-actions";
import { ExternalSourceStatusBadge } from "@/components/external-source-status-badge";
import {
  formatQualityRate,
  getSourceQualityLevelClass,
  getSourceQualityLevelLabel
} from "@/lib/quality-display";
import {
  getExternalSourceSearchText,
  getExternalSourceTypeLabel
} from "@/lib/source-display";
import type {
  ExternalSource,
  ImportRun,
  SourceQualityMetrics
} from "@/types/content";

interface ExternalSourceBrowserProps {
  sources: ExternalSource[];
  latestImportRun?: ImportRun;
  sourceQualityById?: Record<string, SourceQualityMetrics>;
}

function formatDateTime(value: string | undefined): string {
  return value ? value.slice(0, 16).replace("T", " ") : "Never run";
}

function getLatestImportLabel(
  sources: ExternalSource[],
  latestImportRun?: ImportRun
): string {
  if (latestImportRun?.finishedAt) {
    return formatDateTime(latestImportRun.finishedAt);
  }

  const latestFetchedAt = sources
    .map((source) => source.lastFetchedAt)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);

  return latestFetchedAt ? formatDateTime(latestFetchedAt) : "Never run";
}

function isAttentionSource(source: ExternalSource): boolean {
  return (
    source.lastImportStatus === "failed" ||
    source.lastImportStatus === "partial" ||
    (source.consecutiveFailureCount ?? 0) > 0
  );
}

function maskSourceUrl(value: string): string {
  try {
    const url = new URL(value);
    const path =
      url.pathname && url.pathname !== "/"
        ? url.pathname.length > 36
          ? `${url.pathname.slice(0, 36)}...`
          : url.pathname
        : "";

    return `${url.protocol}//${url.host}${path}`;
  } catch {
    return "Invalid source URL";
  }
}

function sanitizeSourceMessage(value: string | undefined): string {
  if (!value) {
    return "No import result yet.";
  }

  const withoutUrls = value.replace(/https?:\/\/[^\s)]+/gi, "[source URL]");
  const withoutSecrets = withoutUrls.replace(
    /([?&](?:token|key|secret|signature|auth|access_token)=)[^&\s]+/gi,
    "$1[redacted]"
  );

  return withoutSecrets.length > 120
    ? `${withoutSecrets.slice(0, 117)}...`
    : withoutSecrets;
}

export function ExternalSourceBrowser({
  sources,
  latestImportRun,
  sourceQualityById = {}
}: ExternalSourceBrowserProps) {
  const [searchText, setSearchText] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [enabledFilter, setEnabledFilter] = useState("");
  const deferredSearchText = useDeferredValue(searchText);
  const typeOptions = Array.from(new Set(sources.map((source) => source.type)));
  const filteredSources = sources.filter((source) => {
    const matchesSearch =
      deferredSearchText.length === 0 ||
      getExternalSourceSearchText(source).includes(
        deferredSearchText.toLowerCase()
      );
    const matchesType = typeFilter.length === 0 || source.type === typeFilter;
    const matchesEnabled =
      enabledFilter.length === 0 ||
      String(source.enabled) === enabledFilter;

    return matchesSearch && matchesType && matchesEnabled;
  });
  const totalSources = sources.length;
  const enabledSources = sources.filter((source) => source.enabled).length;
  const failedImports = sources.filter(isAttentionSource).length;
  const latestImportLabel = getLatestImportLabel(sources, latestImportRun);

  return (
    <>
      <section className="delivery-console-summary source-console-summary" aria-label="Source summary">
        <div className="delivery-console-summary__card">
          <span>Total sources</span>
          <strong>{totalSources}</strong>
          <p>Configured external feeds.</p>
        </div>
        <div className="delivery-console-summary__card">
          <span>Enabled sources</span>
          <strong>{enabledSources}</strong>
          <p>{totalSources - enabledSources} disabled.</p>
        </div>
        <div
          className={[
            "delivery-console-summary__card",
            failedImports > 0 ? "delivery-console-summary__card--attention" : ""
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <span>Failed imports</span>
          <strong>{failedImports}</strong>
          <p>Sources needing review.</p>
        </div>
        <div className="delivery-console-summary__card">
          <span>Last import</span>
          <strong>{latestImportLabel}</strong>
          <p>Latest batch or source fetch.</p>
        </div>
      </section>

      <section className="source-console-import-panel" aria-label="Batch source import">
        <ExternalSourceBatchActions latestImportRun={latestImportRun} />
      </section>

      <div className="search-filter-bar candidate-search-filter-bar source-console-filter">
        <label className="field">
          <span>Search</span>
          <input
            type="search"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Search source name, URL, publisher, or tags"
          />
        </label>

        <label className="field">
          <span>Source type</span>
          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
          >
            <option value="">All source types</option>
            {typeOptions.map((option) => (
              <option key={option} value={option}>
                {getExternalSourceTypeLabel(option)}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Enabled</span>
          <select
            value={enabledFilter}
            onChange={(event) => setEnabledFilter(event.target.value)}
          >
            <option value="">All sources</option>
            <option value="true">Enabled</option>
            <option value="false">Disabled</option>
          </select>
        </label>
      </div>

      <section className="delivery-console-panel source-console-list-panel">
        <div className="delivery-console-panel__header">
          <div>
            <h2>Sources</h2>
            <p>
              Compact operational view for configured source health and import controls.
            </p>
          </div>
          <span className="delivery-console-action">
            {filteredSources.length} shown
          </span>
        </div>

        {sources.length === 0 ? (
          <div className="source-console-empty">
            <h3>No sources yet.</h3>
            <p>Add a source to start importing external AI technology signals.</p>
            <Link href="/workspace/sources/new" className="action-button action-button--accent">
              Add source
            </Link>
          </div>
        ) : filteredSources.length === 0 ? (
          <div className="source-console-empty">
            <h3>No sources matched the current filters.</h3>
            <p>Adjust search, source type, or enabled status to broaden the view.</p>
          </div>
        ) : (
          <div className="source-console-table-scroll">
            <div className="source-console-table" role="table" aria-label="External source health">
              <div className="source-console-table__head" role="row">
                <span>Source name</span>
                <span>Type</span>
                <span>Status</span>
                <span>Last import</span>
                <span>Last result</span>
                <span>Candidates imported</span>
                <span>Actions</span>
              </div>

              {filteredSources.map((source) => {
                const quality = sourceQualityById[source.id];
                const needsAttention = isAttentionSource(source);
                const resultMessage = sanitizeSourceMessage(
                  source.lastErrorMessage ?? source.lastImportMessage
                );

                return (
                  <article
                    key={source.id}
                    className={[
                      "source-console-row",
                      needsAttention ? "source-console-row--attention" : ""
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    role="row"
                  >
                    <div className="source-console-main" role="cell">
                      <h3>
                        <Link
                          href={`/workspace/sources/${source.id}`}
                          className="source-console-source-link"
                        >
                          {source.name}
                        </Link>
                      </h3>
                      <p className="source-console-description">
                        {source.description ?? "No description provided."}
                      </p>
                      <span className="source-console-url">
                        {maskSourceUrl(source.url)}
                      </span>
                    </div>

                    <div className="source-console-type" role="cell">
                      <strong>{getExternalSourceTypeLabel(source.type)}</strong>
                      <span className="source-console-muted">
                        {source.publisherName ?? "No publisher"}
                      </span>
                      <span className="source-console-muted">
                        {source.language.toUpperCase()}
                        {source.defaultTags.length > 0
                          ? ` - ${source.defaultTags.join(", ")}`
                          : ""}
                      </span>
                    </div>

                    <div className="source-console-status" role="cell">
                      <span
                        className={
                          source.enabled
                            ? "info-pill"
                            : "info-pill info-pill--warning"
                        }
                      >
                        {source.enabled ? "Enabled" : "Disabled"}
                      </span>
                      <ExternalSourceStatusBadge status={source.lastImportStatus} />
                      {quality ? (
                        <span className={getSourceQualityLevelClass(quality.qualityLevel)}>
                          Quality: {getSourceQualityLevelLabel(quality.qualityLevel)}
                        </span>
                      ) : null}
                    </div>

                    <div className="source-console-last-import" role="cell">
                      <strong>{formatDateTime(source.lastFetchedAt)}</strong>
                      <span className="source-console-muted">
                        Failures: {source.consecutiveFailureCount ?? 0}
                      </span>
                    </div>

                    <div
                      className={[
                        "source-console-last-result",
                        needsAttention ? "source-console-last-result--attention" : ""
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      role="cell"
                    >
                      <span>{resultMessage}</span>
                      {quality ? (
                        <span className="source-console-muted">
                          Success {formatQualityRate(quality.successRate)} / Duplicate{" "}
                          {formatQualityRate(quality.duplicateRate)} / Conversion{" "}
                          {formatQualityRate(quality.conversionRate)}
                        </span>
                      ) : null}
                    </div>

                    <div className="source-console-candidates" role="cell">
                      <strong>Last: {source.lastImportCount ?? 0}</strong>
                      <span className="source-console-muted">
                        Total: {source.totalImportedCount ?? 0}
                      </span>
                    </div>

                    <div className="source-console-row__actions" role="cell">
                      <ExternalSourceActions
                        sourceId={source.id}
                        enabled={source.enabled}
                        compact
                      />
                      <div className="source-console-row__links">
                        <Link href={`/workspace/sources/${source.id}#edit-source`}>
                          Edit source
                        </Link>
                        <Link href={`/workspace/sources/${source.id}`}>
                          View source detail
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </>
  );
}
