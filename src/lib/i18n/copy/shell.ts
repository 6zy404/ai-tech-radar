import type { Locale } from "@/lib/i18n/locale";

/*
 * Interface text for the parts of every page: the top nav, the skip link,
 * the theme switch, the search box, the 404 and error pages.
 *
 * Every copy module follows one pattern: the Chinese object is the strings
 * as they were in the components, moved here unchanged, and the English
 * object is typed `typeof zh`, so a key missing from either fails the
 * typecheck. Client components import only the module they need, so a page
 * ships the few strings it shows in both languages, not a site dictionary.
 */

const zh = {
  nav: {
    home: "首页",
    digest: "技术简报",
    technologies: "技术信号",
    radar: "雷达",
    skills: "技能",
    knowledge: "知识",
    network: "关系网络",
    ask: "问雷达",
    workspace: "内部工作台",
    mainNavLabel: "主导航",
    searchPlaceholder: "搜索",
    searchInputLabel: "搜索关键词",
    collapseSearch: "收起搜索",
    expandSearch: "展开搜索",
    collapseMenu: "收起菜单",
    expandMenu: "展开菜单"
  },
  /**
   * The nav link to the same page in the other language. It is written in
   * that language — a reader who cannot read this page reads the link.
   */
  languageSwitch: { text: "EN", label: "Read this page in English" },
  skipLink: "跳到正文",
  themeToggle: "切换深浅色主题",
  searchForm: {
    placeholder: "输入关键词，如：推理、Agent、上下文",
    inputLabel: "搜索关键词",
    submit: "搜索"
  },
  notFound: {
    title: "没有这一页",
    description:
      "这个地址对应的信号、技能或知识不存在，可能已被归档，或者从未发布。",
    sectionLabel: "未收录",
    lead: "可以从这里继续。",
    home: "回到首页",
    technologies: "浏览技术信号",
    search: "站内搜索"
  },
  error: {
    title: "这一页暂时打不开",
    description:
      "服务端处理这个请求时出了问题，已经记录下来。可以重试一次，或者回到首页。",
    sectionLabel: "出错了",
    lead: "请再试一次。",
    retry: "重新加载这一页",
    home: "回到首页"
  }
};

const en: typeof zh = {
  nav: {
    home: "Home",
    digest: "Briefings",
    technologies: "Signals",
    radar: "Radar",
    skills: "Skills",
    knowledge: "Knowledge",
    network: "Network",
    ask: "Ask",
    workspace: "Workspace",
    mainNavLabel: "Main navigation",
    searchPlaceholder: "Search",
    searchInputLabel: "Search terms",
    collapseSearch: "Close search",
    expandSearch: "Open search",
    collapseMenu: "Close menu",
    expandMenu: "Open menu"
  },
  languageSwitch: { text: "中文", label: "阅读本页中文版" },
  skipLink: "Skip to content",
  themeToggle: "Switch light and dark theme",
  searchForm: {
    placeholder: "Search, e.g. inference, agent, context",
    inputLabel: "Search terms",
    submit: "Search"
  },
  notFound: {
    title: "Page not found",
    description:
      "There is no signal, skill or knowledge entry at this address. It may have been archived, or never published.",
    sectionLabel: "Not found",
    lead: "You can carry on from here.",
    home: "Back to the home page",
    technologies: "Browse signals",
    search: "Search the site"
  },
  error: {
    title: "This page could not be loaded",
    description:
      "Something went wrong on the server while handling this request, and it has been logged. Try again, or go back to the home page.",
    sectionLabel: "Error",
    lead: "Please try again.",
    retry: "Reload this page",
    home: "Back to the home page"
  }
};

export const shellCopy: Record<Locale, typeof zh> = { zh, en };
