"use client";

import Link from "next/link";
import { useDeferredValue, useState } from "react";

import { ExternalSourceActions } from "@/components/external-source-actions";
import { ExternalSourceBatchActions } from "@/components/external-source-batch-actions";
import { ExternalSourceStatusBadge } from "@/components/external-source-status-badge";
import { WorkspaceListToolbar } from "@/components/workspace-list-toolbar";
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

  return (
    <>
      <ExternalSourceBatchActions latestImportRun={latestImportRun} />

      <div className="search-filter-bar candidate-search-filter-bar">
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

      <WorkspaceListToolbar
        label={`${filteredSources.length} external sources`}
        detail="Enabled sources can be imported; disabled sources are kept for reference but skipped by batch import."
      />

      <div className="source-table">
        {filteredSources.map((source) => {
          const quality = sourceQualityById[source.id];

          return (
            <article key={source.id} className="source-row">
              <div className="source-row__main">
                <div className="source-row__title-line">
                  <h2>
                    <Link href={`/workspace/sources/${source.id}`}>
                      {source.name}
                    </Link>
                  </h2>
                  <span
                    className={
                      source.enabled
                        ? "info-pill"
                        : "info-pill info-pill--warning"
                    }
                  >
                    {source.enabled ? "Enabled" : "Disabled"}
                  </span>
                </div>
                <p>{source.description ?? "No description provided."}</p>
                <span className="source-row__url">{source.url}</span>
              </div>

              <div className="source-row__meta">
                <span>{getExternalSourceTypeLabel(source.type)}</span>
                <span>{source.publisherName ?? "No publisher"}</span>
                <span>{source.language.toUpperCase()}</span>
                <span>
                  {source.defaultTags.length > 0
                    ? source.defaultTags.join(", ")
                    : "No default tags"}
                </span>
              </div>

              <div className="source-row__status">
                <ExternalSourceStatusBadge status={source.lastImportStatus} />
                {quality ? (
                  <span
                    className={getSourceQualityLevelClass(quality.qualityLevel)}
                  >
                    Quality: {getSourceQualityLevelLabel(quality.qualityLevel)}
                  </span>
                ) : null}
                <span>
                  {source.lastFetchedAt
                    ? source.lastFetchedAt.slice(0, 16).replace("T", " ")
                    : "Never fetched"}
                </span>
                <span>Last count: {source.lastImportCount ?? 0}</span>
                <span>Failures: {source.consecutiveFailureCount ?? 0}</span>
                {quality ? (
                  <span className="source-row__quality-line">
                    Success {formatQualityRate(quality.successRate)} / Duplicate{" "}
                    {formatQualityRate(quality.duplicateRate)} / Conversion{" "}
                    {formatQualityRate(quality.conversionRate)}
                  </span>
                ) : null}
                <span className="source-row__message">
                  {source.lastImportMessage ?? "No import message yet"}
                </span>
                <ExternalSourceActions
                  sourceId={source.id}
                  enabled={source.enabled}
                  compact
                />
              </div>
            </article>
          );
        })}
      </div>

      {filteredSources.length === 0 ? (
        <p className="empty-state">No sources matched the current filters.</p>
      ) : null}
    </>
  );
}
