"use client";

import Link from "next/link";
import { useDeferredValue, useState } from "react";

import { ImportedCandidateCard } from "@/components/imported-candidate-card";
import { ImportedCandidateSyncControls } from "@/components/imported-candidate-sync-controls";
import { WorkspaceListToolbar } from "@/components/workspace-list-toolbar";
import {
  getImportedCandidateNormalizedTypeLabel,
  getImportedCandidateSearchText,
  getImportedCandidateSourceTypeLabel,
  getImportedCandidateStatusLabel
} from "@/lib/imported-candidate-display";
import type {
  CandidateQualitySignals,
  ImportedCandidate,
  TechnologyPriorityRanking
} from "@/types/content";

interface ImportedCandidateBrowserProps {
  candidates: ImportedCandidate[];
  sourceIds: string[];
  syncedAt: string;
  sourceCount: number;
  candidateQualityById?: Record<string, CandidateQualitySignals>;
  candidateRankingById?: Record<string, TechnologyPriorityRanking>;
}

export function ImportedCandidateBrowser({
  candidates,
  sourceIds,
  syncedAt,
  sourceCount,
  candidateQualityById = {},
  candidateRankingById = {}
}: ImportedCandidateBrowserProps) {
  const [searchText, setSearchText] = useState("");
  const [sourceTypeFilter, setSourceTypeFilter] = useState("");
  const [normalizedTypeFilter, setNormalizedTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const deferredSearchText = useDeferredValue(searchText);

  const filteredCandidates = candidates.filter((candidate) => {
    const matchesSearch =
      deferredSearchText.length === 0 ||
      getImportedCandidateSearchText(candidate).includes(
        deferredSearchText.toLowerCase()
      );

    const matchesSourceType =
      sourceTypeFilter.length === 0 ||
      candidate.sourceType === sourceTypeFilter;
    const matchesNormalizedType =
      normalizedTypeFilter.length === 0 ||
      candidate.normalizedType === normalizedTypeFilter;
    const matchesStatus =
      statusFilter.length === 0 || candidate.importStatus === statusFilter;

    return (
      matchesSearch &&
      matchesSourceType &&
      matchesNormalizedType &&
      matchesStatus
    );
  });

  const sourceTypeOptions = Array.from(
    new Set(candidates.map((candidate) => candidate.sourceType))
  );
  const statusOptions = Array.from(
    new Set(candidates.map((candidate) => candidate.importStatus))
  );
  const normalizedTypeOptions = Array.from(
    new Set(candidates.map((candidate) => candidate.normalizedType))
  );

  return (
    <>
      <ImportedCandidateSyncControls
        syncedAt={syncedAt}
        sourceCount={sourceCount}
        candidateCount={candidates.length}
      />

      <div className="search-filter-bar candidate-search-filter-bar">
        <label className="field">
          <span>搜索</span>
          <input
            type="search"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="按导入标题、来源或标签搜索"
          />
        </label>
        <label className="field">
          <span>来源类型</span>
          <select
            value={sourceTypeFilter}
            onChange={(event) => setSourceTypeFilter(event.target.value)}
          >
            <option value="">全部来源类型</option>
            {sourceTypeOptions.map((option) => (
              <option key={option} value={option}>
                {getImportedCandidateSourceTypeLabel(option)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>内容类型</span>
          <select
            value={normalizedTypeFilter}
            onChange={(event) => setNormalizedTypeFilter(event.target.value)}
          >
            <option value="">全部内容类型</option>
            {normalizedTypeOptions.map((option) => (
              <option key={option} value={option}>
                {getImportedCandidateNormalizedTypeLabel(option)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>状态</span>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="">全部状态</option>
            {statusOptions.map((option) => (
              <option key={option} value={option}>
                {getImportedCandidateStatusLabel(option)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <WorkspaceListToolbar
        label={`${filteredCandidates.length} 条导入候选`}
        detail="审核候选、检查重复项，并把合适的内容转换为技术草稿。"
        actions={
          <Link href="/workspace/duplicates" className="action-link">
            打开重复组审核
          </Link>
        }
      />

      <div className="workspace-compact-list candidate-compact-list">
        {filteredCandidates.map((candidate) => (
          <ImportedCandidateCard
            key={candidate.id}
            candidate={candidate}
            quality={candidateQualityById[candidate.id]}
            ranking={candidateRankingById[candidate.id]}
            hasSourceDetail={Boolean(
              candidate.sourceId && sourceIds.includes(candidate.sourceId)
            )}
          />
        ))}
      </div>

      {filteredCandidates.length === 0 ? (
        <p className="empty-state">没有匹配当前搜索和筛选条件的候选。</p>
      ) : null}
    </>
  );
}
