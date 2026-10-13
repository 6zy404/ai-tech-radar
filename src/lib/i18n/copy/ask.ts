import type { Locale } from "@/lib/i18n/locale";

/* Interface text of /ask (问雷达): the page, the conversation, the copied
   text and the example questions. The answers themselves are written in
   Chinese — the prompt is fixed and measured — so the English site says so
   next to the disclaimer. See copy/shell.ts for the pattern. */

const zh = {
  page: {
    title: "问雷达",
    description:
      "只根据本站已发布的技术信号、技能和知识回答，每句话标出出处。站里没有的内容，它会直说。",
    sectionLabel: "问雷达"
  },
  kinds: { technology: "技术信号", skill: "技能", knowledge: "知识" },
  disclaimer: "",
  invalidCite: "这个编号不对应任何检索到的条目",
  firstQuestion: "问",
  followUpLabel: (n: number) => `追问 ${n}`,
  pending: "正在查找站内内容…",
  cited: "引用",
  uncited: (n: number) => `检索到但没有引用（${n}）`,
  copiedWhole: (n: number) => `已复制：${n} 轮问答、出处链接和免责声明。`,
  copiedOne: "已复制：问题、答案、出处链接和免责声明。",
  copyBlocked:
    "浏览器没有允许写入剪贴板。内容已在下面的文本框里选中，按 Ctrl+C（Mac 上 ⌘C）复制。",
  copyWhole: "复制整段对话",
  copyOne: "复制答案",
  fallbackWhole: "整段对话，选中后复制",
  fallbackOne: "答案全文，选中后复制",
  answering: "回答中…",
  failed: "回答生成失败，请稍后再试。",
  disconnected: "连接中断，请稍后再试。",
  questionLabel: "你的问题",
  questionPlaceholder: "例如：本地跑大模型要注意什么？",
  ask: "提问",
  examplesHeading: "可以这样问",
  startOver: "开新对话",
  limit: (n: number) => `这段对话已经问了 ${n} 次。想继续问，请开新对话。`,
  followUpBoxLabel: "继续追问",
  followUpPlaceholder: (left: number) => `继续追问（还可以问 ${left} 次）`,
  followUp: "追问",
  /** Rewords a status line the server sent (it speaks Chinese). */
  status: (text: string) => text,
  copyText: {
    question: "问",
    followUp: "追问",
    labelSeparator: "：",
    sources: "出处：",
    sourceLine: (ref: number, title: string, kind: string, url: string) =>
      `[${ref}] ${title}（${kind}） ${url}`,
    invalidNote: (refs: string) =>
      `注：${refs} 不对应任何检索到的条目，是无效编号。`,
    refJoin: "、"
  },
  examples: {
    signal: (name: string) => `「${name}」讲了什么，为什么值得关注？`,
    comparison: (a: string, b: string) => `「${a}」和「${b}」有什么区别？`,
    knowledge: (title: string) => `「${title}」是什么？最近哪些信号和它有关？`,
    topic: (name: string) => `最近「${name}」方向有哪些值得关注的信号？`,
    skill: (title: string) => `想掌握「${title}」，应该先读哪些内容？`
  }
};

const searchingPattern = /^检索「(.*)」$/;
const readingPattern = /^阅读「(.*)」$/;

const en: typeof zh = {
  page: {
    title: "Ask the radar",
    description:
      "Answers come only from the site's published signals, skills and knowledge, with every claim cited. When the site has nothing on it, it says so. Answers are written in Chinese.",
    sectionLabel: "Ask"
  },
  kinds: { technology: "Signal", skill: "Skill", knowledge: "Knowledge" },
  disclaimer:
    "AI-generated, not reviewed by an editor, for reference only. The answer is written in Chinese; you can ask in English.",
  invalidCite: "This number does not match any retrieved item",
  firstQuestion: "Q",
  followUpLabel: (n) => `Follow-up ${n}`,
  pending: "Looking through the site…",
  cited: "Cited",
  uncited: (n) => `Retrieved but not cited (${n})`,
  copiedWhole: (n) =>
    `Copied: ${n} questions and answers, source links and the disclaimer.`,
  copiedOne:
    "Copied: the question, the answer, source links and the disclaimer.",
  copyBlocked:
    "The browser did not allow writing to the clipboard. The text is selected in the box below; press Ctrl+C (⌘C on a Mac) to copy it.",
  copyWhole: "Copy the conversation",
  copyOne: "Copy the answer",
  fallbackWhole: "The whole conversation, select to copy",
  fallbackOne: "The full answer, select to copy",
  answering: "Answering…",
  failed: "The answer could not be generated; try again later.",
  disconnected: "The connection dropped; try again later.",
  questionLabel: "Your question",
  questionPlaceholder:
    "e.g. What should I watch out for when running a model locally?",
  ask: "Ask",
  examplesHeading: "Try asking",
  startOver: "New conversation",
  limit: (n) =>
    `This conversation has used its ${n} questions. Start a new conversation to keep asking.`,
  followUpBoxLabel: "Ask a follow-up",
  followUpPlaceholder: (left) =>
    `Ask a follow-up (${left} ${left === 1 ? "question" : "questions"} left)`,
  followUp: "Ask",
  status: (text) => {
    const searching = searchingPattern.exec(text);

    if (searching) {
      return `Searching “${searching[1]}”`;
    }

    const reading = readingPattern.exec(text);

    return reading ? `Reading “${reading[1]}”` : text;
  },
  copyText: {
    question: "Q",
    followUp: "Follow-up",
    labelSeparator: ": ",
    sources: "Sources:",
    sourceLine: (ref, title, kind, url) => `[${ref}] ${title} (${kind}) ${url}`,
    invalidNote: (refs) =>
      `Note: ${refs} ${refs.includes(",") ? "do" : "does"} not match any retrieved item and ${refs.includes(",") ? "are invalid numbers" : "is an invalid number"}.`,
    refJoin: ", "
  },
  examples: {
    signal: (name) => `What is “${name}” about, and why does it matter?`,
    comparison: (a, b) => `How do “${a}” and “${b}” differ?`,
    knowledge: (title) =>
      `What is “${title}”, and which recent signals relate to it?`,
    topic: (name) => `What recent signals in “${name}” are worth attention?`,
    skill: (title) => `What should I read first to learn “${title}”?`
  }
};

export const askCopy: Record<Locale, typeof zh> = { zh, en };
