import { describe, expect, it } from "vitest";

import {
  PAGE_TOC_MIN_ENTRIES,
  contentDetailTocIds,
  digestTocSections,
  getContentDetailTocCandidates,
  getDigestTocCandidates,
  getTechnologyTocCandidates,
  pickActiveTocId,
  selectPageTocEntries,
  technologyTocIds,
  type ContentDetailTocInput,
  type DigestTocInput,
  type TechnologyTocInput
} from "@/lib/page-toc";

const emptySignal: TechnologyTocInput = {
  hasEvolution: false,
  hasBody: false,
  hasWhyItMatters: false,
  hasTechnicalContext: false,
  hasAudience: false,
  learningPathCount: 0,
  graphNodeCount: 0,
  relatedTechnologyCount: 0,
  similarSignalCount: 0,
  relatedSkillCount: 0,
  relatedKnowledgeCount: 0,
  followUpQuestionCount: 0,
  digestAppearanceCount: 0
};

const fullSignal: TechnologyTocInput = {
  hasEvolution: true,
  hasBody: true,
  hasWhyItMatters: true,
  hasTechnicalContext: true,
  hasAudience: true,
  learningPathCount: 3,
  graphNodeCount: 5,
  relatedTechnologyCount: 1,
  similarSignalCount: 2,
  relatedSkillCount: 2,
  relatedKnowledgeCount: 2,
  followUpQuestionCount: 3,
  digestAppearanceCount: 2
};

function tocFor(input: Partial<TechnologyTocInput>) {
  return selectPageTocEntries(
    getTechnologyTocCandidates({ ...emptySignal, ...input })
  );
}

describe("selectPageTocEntries", () => {
  it("keeps only the rendered sections, in page order", () => {
    expect(
      selectPageTocEntries([
        { id: "a", label: "A", present: true },
        { id: "b", label: "B", present: false },
        { id: "c", label: "C", present: true },
        { id: "d", label: "D", present: true }
      ])
    ).toEqual([
      { id: "a", label: "A" },
      { id: "c", label: "C" },
      { id: "d", label: "D" }
    ]);
  });

  it("shows nothing below the minimum", () => {
    expect(PAGE_TOC_MIN_ENTRIES).toBe(3);
    expect(
      selectPageTocEntries([
        { id: "a", label: "A", present: true },
        { id: "b", label: "B", present: true },
        { id: "c", label: "C", present: false }
      ])
    ).toEqual([]);
  });
});

const skillHeadings: ContentDetailTocInput["headings"] = {
  body: "这项技能能帮你做什么",
  relatedTechnologies: "这项技能有助于评估的技术信号",
  relatedEntries: "与这项技能搭配的知识"
};

const fullSkill: ContentDetailTocInput = {
  kind: "skill",
  prerequisiteCount: 2,
  hasBody: true,
  graphNodeCount: 6,
  relatedTechnologyCount: 3,
  relatedEntryCount: 2,
  headings: skillHeadings
};

function contentTocFor(input: Partial<ContentDetailTocInput>) {
  return selectPageTocEntries(
    getContentDetailTocCandidates({
      ...fullSkill,
      prerequisiteCount: 0,
      hasBody: false,
      graphNodeCount: 0,
      relatedTechnologyCount: 0,
      relatedEntryCount: 0,
      ...input
    })
  );
}

describe("getContentDetailTocCandidates", () => {
  it("lists every section of a skill page, in page order, by its heading", () => {
    expect(
      selectPageTocEntries(getContentDetailTocCandidates(fullSkill))
    ).toEqual([
      { id: "section-prerequisites", label: "先读这些" },
      { id: "section-body", label: "这项技能能帮你做什么" },
      { id: "section-graph", label: "关系网络" },
      {
        id: "section-related-technologies",
        label: "这项技能有助于评估的技术信号"
      },
      { id: "section-related-knowledge", label: "与这项技能搭配的知识" }
    ]);
  });

  it("anchors the other kind's entries by what they are", () => {
    const ids = getContentDetailTocCandidates({
      ...fullSkill,
      kind: "knowledge"
    }).map((candidate) => candidate.id);

    expect(ids).toContain(contentDetailTocIds.relatedEntries.knowledge);
    expect(ids).toContain("section-related-skills");
    expect(ids).not.toContain("section-related-knowledge");
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("lists 正文里提到它的信号 after the related signals, only when it has rows", () => {
    const knowledge = {
      ...fullSkill,
      kind: "knowledge" as const,
      headings: { ...skillHeadings, bodyMentions: "正文里提到它的信号" }
    };
    const ids = (count: number) =>
      selectPageTocEntries(
        getContentDetailTocCandidates({ ...knowledge, bodyMentionCount: count })
      ).map((entry) => entry.id);

    expect(ids(3)).toEqual([
      "section-prerequisites",
      "section-body",
      "section-graph",
      "section-related-technologies",
      contentDetailTocIds.bodyMentions,
      "section-related-skills"
    ]);
    expect(ids(0)).not.toContain(contentDetailTocIds.bodyMentions);
  });

  it("shares the signal page's ids for the sections both have", () => {
    expect(contentDetailTocIds.body).toBe(technologyTocIds.body);
    expect(contentDetailTocIds.graph).toBe(technologyTocIds.graph);
    expect(contentDetailTocIds.relatedTechnologies).toBe(
      technologyTocIds.relatedTechnologies
    );
  });

  it("leaves out a section the page does not render", () => {
    const labels = contentTocFor({
      hasBody: true,
      graphNodeCount: 3,
      relatedTechnologyCount: 3
    }).map((entry) => entry.label);

    expect(labels).toEqual([
      "这项技能能帮你做什么",
      "关系网络",
      "这项技能有助于评估的技术信号"
    ]);
  });

  it("drops the whole table for a page with fewer than three sections", () => {
    // A body and the graph alone: the common short knowledge page.
    expect(contentTocFor({ hasBody: true, graphNodeCount: 2 })).toEqual([]);
    expect(
      contentTocFor({ hasBody: true, graphNodeCount: 2, relatedEntryCount: 1 })
    ).toHaveLength(3);
  });
});

describe("getTechnologyTocCandidates", () => {
  it("lists every reading section of a fully enriched signal, in page order", () => {
    expect(tocFor(fullSignal).map((entry) => entry.label)).toEqual([
      "版本脉络",
      "信号正文",
      "为什么重要",
      "技术背景",
      "谁该关注",
      "学习路径",
      "关系网络",
      "相关技术",
      "内容相近的信号",
      "相关技能",
      "相关知识",
      "后续问题",
      "收录于"
    ]);
  });

  it("gives every entry a distinct id", () => {
    const ids = getTechnologyTocCandidates(fullSignal).map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(Object.values(technologyTocIds))).toEqual(new Set(ids));
  });

  it("leaves out a section the page does not render", () => {
    const labels = tocFor({
      ...fullSignal,
      hasEvolution: false,
      similarSignalCount: 0,
      relatedTechnologyCount: 0
    }).map((entry) => entry.label);

    expect(labels).not.toContain("版本脉络");
    expect(labels).not.toContain("内容相近的信号");
    expect(labels).not.toContain("相关技术");
    expect(labels).toContain("信号正文");
  });

  it("drops the whole table for a signal with fewer than three sections", () => {
    expect(tocFor({ hasBody: true, hasWhyItMatters: true })).toEqual([]);
    expect(
      tocFor({ hasBody: true, hasWhyItMatters: true, graphNodeCount: 1 })
    ).toHaveLength(3);
  });
});

describe("getDigestTocCandidates", () => {
  const fullDigest: DigestTocInput = {
    hasSummary: true,
    visibleHighPriorityCount: 4,
    visibleWatchCount: 6,
    skillCount: 8,
    knowledgeCount: 8,
    sourceCount: 7
  };

  it("lists every section of a full issue in page order, by its h2", () => {
    expect(selectPageTocEntries(getDigestTocCandidates(fullDigest))).toEqual([
      { id: "section-summary", label: "本期概览" },
      { id: "section-high-priority", label: "本期立即关注" },
      { id: "section-watch", label: "值得跟踪" },
      { id: technologyTocIds.relatedSkills, label: "值得关注的技能" },
      { id: technologyTocIds.relatedKnowledge, label: "背景知识" },
      { id: "section-sources", label: "来源参考" }
    ]);
  });

  it("drops a section the 只看我关注的 filter has emptied", () => {
    const ids = selectPageTocEntries(
      getDigestTocCandidates({ ...fullDigest, visibleHighPriorityCount: 0 })
    ).map((entry) => entry.id);

    expect(ids).not.toContain(digestTocSections.highPriority.id);
    expect(ids).toContain(digestTocSections.watch.id);
  });

  it("leaves out sections that only say nothing was selected", () => {
    const ids = selectPageTocEntries(
      getDigestTocCandidates({
        ...fullDigest,
        hasSummary: false,
        skillCount: 0,
        sourceCount: 0
      })
    ).map((entry) => entry.id);

    expect(ids).toEqual([
      digestTocSections.highPriority.id,
      digestTocSections.watch.id,
      digestTocSections.knowledge.id
    ]);
  });

  it("shows no table for an issue with fewer than three sections", () => {
    expect(
      selectPageTocEntries(
        getDigestTocCandidates({
          hasSummary: false,
          visibleHighPriorityCount: 1,
          visibleWatchCount: 0,
          skillCount: 0,
          knowledgeCount: 0,
          sourceCount: 1
        })
      )
    ).toEqual([]);
  });
});

describe("pickActiveTocId", () => {
  const sections = [
    { id: "a", top: -900 },
    { id: "b", top: -200 },
    { id: "c", top: 90 },
    { id: "d", top: 600 }
  ];

  it("is the last section whose top passed the line", () => {
    expect(
      pickActiveTocId(sections, { activationLine: 100, atBottom: false })
    ).toBe("c");
    expect(
      pickActiveTocId(sections, { activationLine: 80, atBottom: false })
    ).toBe("b");
  });

  it("is nothing while the reader is above the first section", () => {
    expect(
      pickActiveTocId(
        [
          { id: "a", top: 400 },
          { id: "b", top: 900 }
        ],
        { activationLine: 100, atBottom: false }
      )
    ).toBeUndefined();
    expect(
      pickActiveTocId([], { activationLine: 100, atBottom: true })
    ).toBeUndefined();
  });

  it("gives the foot of the page to the last section", () => {
    expect(
      pickActiveTocId(sections, { activationLine: 100, atBottom: true })
    ).toBe("d");
  });

  it("keeps a clicked entry that could not scroll up to the line", () => {
    expect(
      pickActiveTocId(sections, {
        activationLine: 100,
        atBottom: true,
        pinnedId: "c"
      })
    ).toBe("c");
    expect(
      pickActiveTocId(sections, {
        activationLine: 100,
        atBottom: false,
        pinnedId: "gone"
      })
    ).toBe("c");
  });
});
