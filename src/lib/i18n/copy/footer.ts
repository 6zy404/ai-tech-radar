import type { Locale } from "@/lib/i18n/locale";

/*
 * Interface text of the footer under every public page (site-footer.tsx).
 * See copy/shell.ts for the pattern. Its own module rather than a key in
 * shell.ts: the footer is a server component, and shell.ts is imported by
 * client components (the top nav), so strings added there ship as JS.
 *
 * The RSS link is the briefing feed, /feed.xml, and says so: the
 * /technologies header already has an 「RSS 订阅」 for a different feed.
 * The note restates the two labels /about describes, nothing more.
 */

const zh = {
  navLabel: "关于本站",
  about: "本站怎么挑信号",
  privacy: "隐私说明",
  sources: "信源一览",
  rss: "RSS 订阅（技术简报）",
  contactLabel: "反馈与联系：",
  contactLink: "在 GitHub 提 issue",
  note: "AI 功能都标着「未经审核」，自动聚合的快讯标着「未经编辑精选」。"
};

const en: typeof zh = {
  navLabel: "About this site",
  about: "How signals are picked",
  privacy: "Privacy",
  sources: "Sources",
  rss: "RSS feed (briefings, in Chinese)",
  contactLabel: "Feedback and contact: ",
  contactLink: "open an issue on GitHub",
  note: "Every AI feature is marked “not reviewed”, and the automatically gathered news is marked “not picked by an editor”."
};

export const footerCopy: Record<Locale, typeof zh> = { zh, en };
