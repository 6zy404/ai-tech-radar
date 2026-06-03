import type {
  CandidateImportStatus,
  CandidateNormalizedType,
  SourceLanguage
} from "@/types/content";

export interface MockRssEntryPayload {
  guid: string;
  title: string;
  link: string;
  summary: string;
  content?: string;
  isoDate: string;
  publisherName: string;
  language: SourceLanguage;
  categories: string[];
  normalizedTypeHint: CandidateNormalizedType;
  importStatus: CandidateImportStatus;
}

export interface MockRssFeedPayload {
  feedTitle: string;
  feedUrl: string;
  entries: MockRssEntryPayload[];
}

export interface MockGithubReleasePayload {
  repository: string;
  repositoryUrl: string;
  releases: Array<{
    id: number;
    tagName: string;
    name: string;
    htmlUrl: string;
    body: string;
    publishedAt: string;
    authorLogin: string;
    language: SourceLanguage;
    topics: string[];
    normalizedTypeHint: CandidateNormalizedType;
    importStatus: CandidateImportStatus;
  }>;
}

export interface MockOfficialBlogPayload {
  siteName: string;
  siteUrl: string;
  posts: Array<{
    id: string;
    title: string;
    url: string;
    excerpt: string;
    content: string;
    publishedAt: string;
    authorName: string;
    language: SourceLanguage;
    tags: string[];
    normalizedTypeHint: CandidateNormalizedType;
    importStatus: CandidateImportStatus;
  }>;
}

export const rssFeedPayloads: MockRssFeedPayload[] = [
  {
    feedTitle: "OpenAI Blog RSS",
    feedUrl: "https://example.com/openai-blog/rss",
    entries: [
      {
        guid: "openai-rss-responses-tools",
        title: "New tools for building agent workflows in the Responses API",
        link: "https://example.com/openai-blog/responses-agent-tools",
        summary:
          "A product-style update describing how tool orchestration, file search, and tracing can be combined in one workflow surface.",
        content:
          "The post positions agent tooling as an application layer rather than only a model release. It highlights why tracing, tool state, and iterative orchestration matter when teams move from demos to repeatable workflows.",
        isoDate: "2026-04-11",
        publisherName: "OpenAI",
        language: "en",
        categories: ["agents", "workflow", "api"],
        normalizedTypeHint: "workflow",
        importStatus: "new"
      },
      {
        guid: "openai-rss-sdk-protocol-bridges",
        title: "Protocol bridges for tool-using SDKs",
        link: "https://example.com/openai-blog/sdk-protocol-bridges",
        summary:
          "A feed item focused on how SDKs can expose tools through more portable protocol boundaries.",
        content:
          "This entry is useful because it sits between product marketing and deeper implementation guidance. It exposes whether the platform needs room for protocol-level items that are not just model announcements.",
        isoDate: "2026-04-08",
        publisherName: "OpenAI",
        language: "en",
        categories: ["protocol", "sdk", "tooling"],
        normalizedTypeHint: "protocol",
        importStatus: "reviewed"
      }
    ]
  }
];

export const githubReleasePayloads: MockGithubReleasePayload[] = [
  {
    repository: "modelcontextprotocol/typescript-sdk",
    repositoryUrl: "https://github.com/modelcontextprotocol/typescript-sdk",
    releases: [
      {
        id: 1204,
        tagName: "v0.8.0",
        name: "v0.8.0 - streaming transport and richer tool annotations",
        htmlUrl:
          "https://github.com/modelcontextprotocol/typescript-sdk/releases/tag/v0.8.0",
        body:
          "Adds streaming transport updates, richer tool annotations, and more complete examples for client and server implementers.",
        publishedAt: "2026-04-10",
        authorLogin: "mcp-maintainers",
        language: "en",
        topics: ["protocol", "sdk", "developer-tools"],
        normalizedTypeHint: "tool",
        importStatus: "reviewed"
      },
      {
        id: 1188,
        tagName: "v0.7.3",
        name: "v0.7.3 - dependency and build maintenance",
        htmlUrl:
          "https://github.com/modelcontextprotocol/typescript-sdk/releases/tag/v0.7.3",
        body:
          "Maintenance-only release with dependency bumps, CI cleanup, and packaging fixes. Useful to test whether repository updates sometimes enter the pool even when they should later be rejected.",
        publishedAt: "2026-04-03",
        authorLogin: "mcp-maintainers",
        language: "en",
        topics: ["maintenance", "sdk"],
        normalizedTypeHint: "tool",
        importStatus: "rejected"
      }
    ]
  }
];

export const officialBlogPayloads: MockOfficialBlogPayload[] = [
  {
    siteName: "Anthropic Engineering",
    siteUrl: "https://example.com/anthropic-engineering",
    posts: [
      {
        id: "anthropic-evals-rollout",
        title: "Designing evaluation loops for agent rollouts",
        url: "https://example.com/anthropic-engineering/evals-for-agent-rollouts",
        excerpt:
          "An engineering-style article on how rollout reviews, instrumentation, and failure analysis shape the way teams ship agents.",
        content:
          "This style of source is useful because it is closer to operational practice than to launch marketing. It helps test whether the candidate pool needs to preserve original content that may be longer, denser, and more process-oriented than ordinary news items.",
        publishedAt: "2026-04-06",
        authorName: "Anthropic Engineering",
        language: "en",
        tags: ["evaluation", "operations", "agents"],
        normalizedTypeHint: "workflow",
        importStatus: "converted"
      }
    ]
  }
];
