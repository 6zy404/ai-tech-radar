import type { Locale } from "@/lib/i18n/locale";

/* Interface text of /radar and its picture/list. Ring and quadrant names
   are in radar-labels.ts. See copy/shell.ts for the pattern. */

const zh = {
  title: "技术雷达",
  description:
    "站内信号里反复出现的技术，按四个象限、四个环位放好，每一项都附上它所依据的信号。",
  sectionLabel: "雷达",
  emptyEyebrow: "暂无条目",
  emptyTitle: "雷达上还没有技术。",
  emptyBody: "条目发布并关联已发布的信号后，会在这里按象限和环位排开。",
  intro:
    "环位越靠里越值得现在就用；点开一项，能看到它为什么在这一环、依据哪几条信号、环位怎么变过。",
  statsLabel: "雷达概览",
  statEntries: "项技术",
  firstEdition: "首期",
  updatedWithChanges: (n: number) => `更新，本期 ${n} 项新进或移动`,
  updated: "更新",
  ringsHeading: "四个环位",
  ringsNote:
    "本期指雷达最近一次改动之前的 30 天；首期的条目都算基线，不标新进。",
  evidence: "依据信号",
  relatedKnowledge: "相关知识",
  relatedSkills: "相关技能",
  listSeparator: "、",
  history: "环位历史",
  addedTo: (ring: string) => `收录进${ring}`,
  historyReason: (reason: string) => `：${reason}`,
  newStamp: "新进",
  keySteady: "环位未变",
  keyChanged: "本期新进或移动",
  quadrantCount: (n: number) => `${n} 项`,
  chineseOnly: ""
};

const en: typeof zh = {
  title: "Technology radar",
  description:
    "The technologies that keep coming up in the site's signals, placed in four quadrants and four rings, each with the signals it rests on.",
  sectionLabel: "Radar",
  emptyEyebrow: "No entries yet",
  emptyTitle: "There is nothing on the radar yet.",
  emptyBody:
    "Entries appear here by quadrant and ring once they are published and linked to published signals.",
  intro:
    "The closer to the centre, the more it is worth using now. Open an entry to see why it sits in its ring, which signals it rests on and how its ring has changed.",
  statsLabel: "Radar at a glance",
  statEntries: "technologies",
  firstEdition: "first edition",
  updatedWithChanges: (n) =>
    `updated; ${n} ${n === 1 ? "entry" : "entries"} new or moved`,
  updated: "updated",
  ringsHeading: "The four rings",
  ringsNote:
    "“New or moved” covers the 30 days before the radar's latest change. Entries in the first edition are the baseline and are not marked new.",
  evidence: "Evidence",
  relatedKnowledge: "Related knowledge",
  relatedSkills: "Related skills",
  listSeparator: ", ",
  history: "Ring history",
  addedTo: (ring) => `Added in ${ring}`,
  historyReason: (reason) => `: ${reason}`,
  newStamp: "New",
  keySteady: "Ring unchanged",
  keyChanged: "New or moved in this edition",
  quadrantCount: (n) => `${n} ${n === 1 ? "entry" : "entries"}`,
  chineseOnly:
    "Most entry names, the editors' reasons and the ring history are written in Chinese; signal titles are in English where the source is."
};

export const radarCopy: Record<Locale, typeof zh> = { zh, en };
