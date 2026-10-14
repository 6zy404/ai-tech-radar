import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from "vitest";

import { makeWorkspaceRecord } from "@/lib/test-factories";

/**
 * Pins the 2026-10-14 change to `buildRelationItems` and `getContentGraph`:
 * each resolves its targets from one read of the pool and of the merged
 * relations, instead of re-reading both per target, and each list item
 * carries the id it resolved, so per-target data is looked up by id.
 *
 * The counter is `getAllLinkRelations`: every call parses the override store,
 * which is the work being avoided.
 */

const relationReads = { count: 0 };

vi.mock("@/lib/link-relation-workflow", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/link-relation-workflow")>();

  return {
    ...actual,
    getAllLinkRelations: () => {
      relationReads.count += 1;
      return actual.getAllLinkRelations();
    }
  };
});

let dataDir: string;
let previousDataDir: string | undefined;
let previousDriver: string | undefined;

// One directory for the whole file: the original module behind the mock is
// loaded once and keeps the store path it saw first.
beforeAll(() => {
  dataDir = mkdtempSync(path.join(tmpdir(), "content-relations-"));
  previousDataDir = process.env.LOCAL_DATA_DIR;
  previousDriver = process.env.PERSISTENCE_DRIVER;
  process.env.LOCAL_DATA_DIR = dataDir;
  process.env.PERSISTENCE_DRIVER = "json";

  writeFileSync(
    path.join(dataDir, "technology-workspace.json"),
    JSON.stringify({
      updatedAt: "2026-10-14T00:00:00.000Z",
      records: [
        makeWorkspaceRecord({
          id: "tech-a",
          slug: "tech-a",
          status: "published",
          publishDate: "2026-10-10",
          relatedSkillIds: [
            "skill-agent-design",
            "skill-taken-offline",
            "skill-tool-integration"
          ],
          relatedKnowledgeIds: ["knowledge-tool-use"],
          relatedTechnologyIds: ["tech-b"]
        }),
        makeWorkspaceRecord({
          id: "tech-b",
          slug: "tech-b",
          title: { original: "Second", zh: "第二条" },
          status: "published",
          publishDate: "2026-10-09",
          relatedSkillIds: [],
          relatedKnowledgeIds: []
        })
      ]
    })
  );
  writeFileSync(
    path.join(dataDir, "link-relation-workspace.json"),
    JSON.stringify({
      updatedAt: "2026-10-14T00:00:00.000Z",
      relations: [
        {
          id: "rel-ws-test",
          fromId: "tech-a",
          fromType: "technology",
          toId: "skill-tool-integration",
          toType: "skill",
          relationType: "uses",
          note: "覆盖层里的附注"
        }
      ]
    })
  );
});

beforeEach(() => {
  relationReads.count = 0;
  vi.resetModules();
});

afterAll(() => {
  if (previousDataDir === undefined) delete process.env.LOCAL_DATA_DIR;
  else process.env.LOCAL_DATA_DIR = previousDataDir;

  if (previousDriver === undefined) delete process.env.PERSISTENCE_DRIVER;
  else process.env.PERSISTENCE_DRIVER = previousDriver;

  rmSync(dataDir, { recursive: true, force: true });
});

const loadContent = () => import("@/lib/content");

describe("buildRelationItems", () => {
  it("skips a target that no longer resolves and keeps every other item on its own id", async () => {
    const content = await loadContent();

    const items = content.buildRelationItems({
      fromId: "tech-a",
      fromType: "technology",
      targetType: "skill",
      targetIds: [
        "skill-agent-design",
        "skill-taken-offline",
        "skill-tool-integration"
      ],
      defaultNote: "默认附注"
    });

    // The third item is second in the list now: anything read by position
    // in `relatedSkillIds` would land on the wrong card.
    expect(items.map((item) => item.targetId)).toEqual([
      "skill-agent-design",
      "skill-tool-integration"
    ]);
    expect(items[1]).toMatchObject({
      id: "tech-a-skill-tool-integration",
      title: "工具集成模式",
      href: "/skills/tool-integration-patterns",
      relationType: "uses",
      note: "覆盖层里的附注"
    });
  });

  it("reads the merged relations once per call, however many targets", async () => {
    const content = await loadContent();

    content.buildRelationItems({
      fromId: "tech-a",
      fromType: "technology",
      targetType: "skill",
      targetIds: [
        "skill-agent-design",
        "skill-tool-integration",
        "skill-retrieval-tuning"
      ]
    });

    expect(relationReads.count).toBe(1);
  });

  it("uses a relation list passed in instead of reading its own", async () => {
    const content = await loadContent();
    const { getAllLinkRelations } =
      await import("@/lib/link-relation-workflow");
    const relations = getAllLinkRelations();
    relationReads.count = 0;

    const items = content.buildRelationItems({
      fromId: "tech-a",
      fromType: "technology",
      targetType: "skill",
      targetIds: ["skill-tool-integration"],
      relations
    });

    expect(relationReads.count).toBe(0);
    expect(items[0].relationType).toBe("uses");
  });

  it("reads nothing for an empty list or a list with no source", async () => {
    const content = await loadContent();

    expect(
      content.buildRelationItems({
        fromId: "tech-a",
        fromType: "technology",
        targetType: "skill",
        targetIds: []
      })
    ).toEqual([]);
    content.buildRelationItems({
      targetType: "knowledge",
      targetIds: ["knowledge-tool-use"]
    });

    expect(relationReads.count).toBe(0);
  });
});

describe("getContentGraph", () => {
  it("resolves the same nodes a per-id lookup into each pool would", async () => {
    const content = await loadContent();
    const { getPreferredTechnologyTitle } =
      await import("@/lib/technology-localization");

    const reference = [
      ...content.getAllTechnologies().map((item) => ({
        id: item.id,
        title: getPreferredTechnologyTitle(item),
        href: `/technologies/${item.slug}`,
        kind: "technology"
      })),
      ...content.getAllSkills().map((item) => ({
        id: item.id,
        title: item.title,
        href: `/skills/${item.slug}`,
        kind: "skill"
      })),
      ...content.getAllKnowledge().map((item) => ({
        id: item.id,
        title: item.title,
        href: `/knowledge/${item.slug}`,
        kind: "knowledge"
      }))
    ];
    relationReads.count = 0;

    const graph = content.getContentGraph();

    expect(graph.nodes).toEqual(reference);
    expect(graph.nodes.find((node) => node.id === "tech-b")?.title).toBe(
      "第二条"
    );
    expect(
      graph.edges.find((edge) => edge.id === "skill-tool-integration|tech-a")
    ).toMatchObject({ relationType: "uses", note: "覆盖层里的附注" });
    expect(relationReads.count).toBe(1);
  });
});
