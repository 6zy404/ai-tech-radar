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
  return value ? value.slice(0, 16).replace("T", " ") : "未运行";
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

  return latestFetchedAt ? formatDateTime(latestFetchedAt) : "未运行";
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
    return "无效的来源 URL";
  }
}

function sanitizeSourceMessage(value: string | undefined): string {
  if (!value) {
    return "暂无导入结果。";
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
      enabledFilter.length === 0 || String(source.enabled) === enabledFilter;

    return matchesSearch && matchesType && matchesEnabled;
  });
  const totalSources = sources.length;
  const enabledSources = sources.filter((source) => source.enabled).length;
  const failedImports = sources.filter(isAttentionSource).length;
  const latestImportLabel = getLatestImportLabel(sources, latestImportRun);

  return (
    <>
      <section
        className="delivery-console-summary source-console-summary"
        aria-label="来源摘要"
      >
        <div className="delivery-console-summary__card">
          <span>来源总数</span>
          <strong>{totalSources}</strong>
          <p>已配置的外部订阅源。</p>
        </div>
        <div className="delivery-console-summary__card">
          <span>已启用来源</span>
          <strong>{enabledSources}</strong>
          <p>{totalSources - enabledSources} 个已停用。</p>
        </div>
        <div
          className={[
            "delivery-console-summary__card",
            failedImports > 0 ? "delivery-console-summary__card--attention" : ""
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <span>导入失败</span>
          <strong>{failedImports}</strong>
          <p>需要复查的来源。</p>
        </div>
        <div className="delivery-console-summary__card">
          <span>最近导入</span>
          <strong>{latestImportLabel}</strong>
          <p>最近一次批量或单源抓取。</p>
        </div>
      </section>

      <section
        className="source-console-import-panel"
        aria-label="批量来源导入"
      >
        <ExternalSourceBatchActions latestImportRun={latestImportRun} />
      </section>

      <div className="search-filter-bar candidate-search-filter-bar source-console-filter">
        <label className="field">
          <span>搜索</span>
          <input
            type="search"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="按来源名称、URL、发布方或标签搜索"
          />
        </label>

        <label className="field">
          <span>来源类型</span>
          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
          >
            <option value="">全部类型</option>
            {typeOptions.map((option) => (
              <option key={option} value={option}>
                {getExternalSourceTypeLabel(option)}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>启用状态</span>
          <select
            value={enabledFilter}
            onChange={(event) => setEnabledFilter(event.target.value)}
          >
            <option value="">全部来源</option>
            <option value="true">已启用</option>
            <option value="false">已停用</option>
          </select>
        </label>
      </div>

      <section className="delivery-console-panel source-console-list-panel">
        <div className="delivery-console-panel__header">
          <div>
            <h2>来源</h2>
            <p>已配置来源的健康状态与导入控制的紧凑运维视图。</p>
          </div>
          <span className="delivery-console-action">
            当前显示 {filteredSources.length} 个
          </span>
        </div>

        {sources.length === 0 ? (
          <div className="source-console-empty">
            <h3>还没有来源。</h3>
            <p>新增一个来源，开始导入外部 AI 技术信号。</p>
            <Link
              href="/workspace/sources/new"
              className="action-button action-button--accent"
            >
              新增来源
            </Link>
          </div>
        ) : filteredSources.length === 0 ? (
          <div className="source-console-empty">
            <h3>没有匹配当前筛选条件的来源。</h3>
            <p>调整搜索、来源类型或启用状态以扩大范围。</p>
          </div>
        ) : (
          <div className="source-console-table-scroll">
            <div
              className="source-console-table"
              role="table"
              aria-label="外部来源健康状态"
            >
              <div className="source-console-table__head" role="row">
                <span>来源名称</span>
                <span>类型</span>
                <span>状态</span>
                <span>最近导入</span>
                <span>最近结果</span>
                <span>导入候选数</span>
                <span>操作</span>
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
                        {source.description ?? "暂无描述。"}
                      </p>
                      <span className="source-console-url">
                        {maskSourceUrl(source.url)}
                      </span>
                    </div>

                    <div className="source-console-type" role="cell">
                      <strong>{getExternalSourceTypeLabel(source.type)}</strong>
                      <span className="source-console-muted">
                        {source.publisherName ?? "未填写发布方"}
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
                        {source.enabled ? "已启用" : "已停用"}
                      </span>
                      <ExternalSourceStatusBadge
                        status={source.lastImportStatus}
                      />
                      {quality ? (
                        <span
                          className={getSourceQualityLevelClass(
                            quality.qualityLevel
                          )}
                        >
                          质量：
                          {getSourceQualityLevelLabel(quality.qualityLevel)}
                        </span>
                      ) : null}
                    </div>

                    <div className="source-console-last-import" role="cell">
                      <strong>{formatDateTime(source.lastFetchedAt)}</strong>
                      <span className="source-console-muted">
                        连续失败：{source.consecutiveFailureCount ?? 0}
                      </span>
                    </div>

                    <div
                      className={[
                        "source-console-last-result",
                        needsAttention
                          ? "source-console-last-result--attention"
                          : ""
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      role="cell"
                    >
                      <span>{resultMessage}</span>
                      {quality ? (
                        <span className="source-console-muted">
                          成功 {formatQualityRate(quality.successRate)} / 重复{" "}
                          {formatQualityRate(quality.duplicateRate)} / 转化{" "}
                          {formatQualityRate(quality.conversionRate)}
                        </span>
                      ) : null}
                    </div>

                    <div className="source-console-candidates" role="cell">
                      <strong>本次：{source.lastImportCount ?? 0}</strong>
                      <span className="source-console-muted">
                        累计：{source.totalImportedCount ?? 0}
                      </span>
                    </div>

                    <div className="source-console-row__actions" role="cell">
                      <ExternalSourceActions
                        sourceId={source.id}
                        enabled={source.enabled}
                        compact
                      />
                      <div className="source-console-row__links">
                        <Link
                          href={`/workspace/sources/${source.id}#edit-source`}
                        >
                          编辑来源
                        </Link>
                        <Link href={`/workspace/sources/${source.id}`}>
                          查看来源详情
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
