import Link from "next/link";

import { DossierCard } from "@/components/dossier-card";
import { DossierCatalogNote } from "@/components/dossier-catalog-note";
import { DossierCategoryChips } from "@/components/dossier-category-chips";
import { DossierStampTag } from "@/components/dossier-stamp-tag";
import { UnbreakableTitle } from "@/components/unbreakable-title";
import { UserPageShell } from "@/components/user-page-shell";
import {
  AboutPageEn,
  aboutPageDescriptionEn,
  aboutPageTitleEn
} from "@/components/pages/about-page-en";
import type { Locale } from "@/lib/i18n/locale";
import { aiGeneratedDisclaimer } from "@/lib/ai-disclaimer";
import { importantFreshnessWindowDays } from "@/lib/ranking";
import { getPriorityLevelLabel } from "@/lib/ranking-display";
import { buildPageMetadata } from "@/lib/site-metadata";
import { getRelationTypeLabel } from "@/lib/technology-localization";
import type { RelationType } from "@/types/content";

// Fixed copy, no runtime content: nothing here can go stale between builds.
// Every statement is taken from docs/ (reference, architecture,
// security-boundary); the band names, the relation labels, the disclaimer and
// the 30-day window are read from the code that renders them elsewhere, so
// this page cannot drift from what the rest of the site shows.

const pageTitle = "本站怎么挑信号";
const pageDescription =
  "信号从哪来、编辑怎么挑、优先级怎么定，以及站点存什么、不存什么。";

export function getAboutPageMetadata(locale: Locale) {
  return buildPageMetadata({
    title: locale === "en" ? aboutPageTitleEn : pageTitle,
    description: locale === "en" ? aboutPageDescriptionEn : pageDescription,
    path: "/about",
    locale
  });
}

const sections = [
  { id: "sources", label: "信号从哪来" },
  { id: "editing", label: "编辑怎么挑" },
  { id: "priority", label: "优先级档位" },
  { id: "news", label: "快讯" },
  { id: "relations", label: "八种关系" },
  { id: "ai", label: "AI 功能" },
  { id: "privacy", label: "存什么" }
] as const;

const sourceTypes = ["RSS", "Atom", "GitHub Release", "官方博客页面"];

const editingSteps = [
  {
    title: "去重",
    body: "同一条消息从几个信源进来时，编辑选一条作主条目，其余作为补充来源挂在它下面。"
  },
  {
    title: "转草稿",
    body: "决定发布的候选转成草稿；不发的标为已看或拒绝。"
  },
  {
    title: "补说明",
    body: "写清为什么重要、谁该关注、需要什么背景、怎么继续学，并把它和相关的技能、知识连起来。"
  },
  {
    title: "发布检查",
    body: "缺标题、摘要、正文、来源链接或日期是阻塞项，不清零就发不出去；关联太少、说明不全是警告项，可以发布，但编辑必须看到。"
  },
  {
    title: "发布",
    body: "通过检查后成为技术信号。技术简报从已发布的信号里生成，编辑调整后再发布。"
  }
];

const days = importantFreshnessWindowDays;

const bands = [
  {
    level: "high_priority",
    rules: ["关键：一直在这一档", `重要：发布后 ${days} 天内`],
    note: "技术简报的第一部分。"
  },
  {
    level: "watch",
    rules: [`重要：发布满 ${days} 天后`, "信号级：一直在这一档"],
    note: "技术简报的第二部分。"
  },
  {
    level: "low_priority",
    rules: ["缺摘要、缺正文，或来源链接、日期无效"],
    note: "不论重要程度都落在这一档，技术简报默认不收。"
  }
] as const;

const relations: Array<{ type: RelationType; body: string }> = [
  { type: "builds-on", body: "建立在对方之上，由它发展而来。" },
  { type: "uses", body: "用到了对方。" },
  { type: "explains", body: "解释对方是什么、为什么这样。" },
  {
    type: "requires",
    body: "读这一条之前要先懂对方。八种里唯一有方向的一种，技能和知识页开头的「先读这些」由它生成。"
  },
  { type: "extends", body: "顺着这一条往下读。" },
  {
    type: "supersedes",
    body: "同一产品线的后一个版本。信号页的「版本脉络」只由它生成。"
  },
  { type: "supports", body: "为对方提供佐证。" },
  {
    type: "related-to",
    body: "有关，但不属于以上任何一种。约占全部关系的 12%。"
  }
];

const aiFeatures = [
  {
    title: "对比两条技术",
    body: "在信号页选另一条已发布的信号，生成相同点、不同点和各自适用的场合。"
  },
  {
    title: "按你的水平讲解",
    body: "选入门、进阶或资深，生成对应深度的解释。"
  },
  {
    title: "学习路径",
    body: "以这条信号关联的技能和知识为材料，生成学习步骤和自查问题。"
  },
  {
    title: "问雷达",
    body: "只用站内已发布的信号、技能和知识回答，每个说法标出处；站内没有相关内容时，回答以「站内没有直接相关的内容」开头。"
  }
];

function SectionHeader({ id, title }: { id: string; title: string }) {
  return (
    <div className="skills-library-section__header">
      <h2 id={id}>
        <UnbreakableTitle text={title} />
      </h2>
    </div>
  );
}

// The /skills list skeleton — header label, one-line lede, sections under a
// hairline — through its classes rather than a copy, as /sources and /topics
// do. The page is prose, so its sections hold paragraphs as well as cards.
// The English page is its own component (about-page-en.tsx), so this
// Chinese markup is untouched by the English edition.
export function AboutPage({ locale }: { locale: Locale }) {
  if (locale === "en") {
    return <AboutPageEn />;
  }

  return (
    <UserPageShell
      title={pageTitle}
      description={pageDescription}
      sectionLabel="关于本站"
      className="skills-library-page about-page dossier"
    >
      <section className="skills-library-intro">
        {/* One line on purpose: JSX joins wrapped text lines with a space,
            which lands in the middle of a Chinese sentence. */}
        <p>
          这里的每条技术信号都经过编辑处理；没经过编辑的内容，会在出现的地方标出来。下面按一条消息进站的顺序说明。
        </p>
        <DossierCategoryChips
          className="about-jump"
          ariaLabel="本页章节"
          active=""
          options={sections.map((section) => ({
            value: section.id,
            label: section.label,
            href: `#${section.id}`
          }))}
        />
      </section>

      <div className="skills-library-groups">
        <section className="skills-library-section" aria-labelledby="sources">
          <SectionHeader id="sources" title="信号从哪来" />
          <div className="about-prose">
            <p>技术信号来自一组固定的外部信源，类型有四种：</p>
            <ul className="about-stamps" aria-label="信源类型">
              {sourceTypes.map((type) => (
                <li key={type}>
                  <DossierStampTag>{type}</DossierStampTag>
                </li>
              ))}
            </ul>
            <p>每天定时导入一次。新条目先进入候选池，这时它还不是信号。</p>
            <p>
              发布方是公告背后的组织，分为大型科技公司、创业公司、研究实验室、开源社区和媒体五类；信源是它经由的那个订阅源。每条信号页都标出发布方类型，方便你分清这是厂商公告、开源发布还是研究成果。
            </p>
            <Link href="/sources" className="skill-library-card__link">
              全部发布方和信源见信源一览 →
            </Link>
          </div>
          <DossierCard className="about-note">
            <DossierCatalogNote label="附注 · 导入后先剔除三类">
              <p>
                预发布版本（版本号带 rc、beta
                之类）、站内已经发布过的同一条公告、网页被篡改后留下的「hacked
                by
                …」标题。这三类由程序直接拒掉，其余候选都等编辑处理。只有标题、没有摘要的条目不会被自动拒。
              </p>
            </DossierCatalogNote>
          </DossierCard>
        </section>

        <section className="skills-library-section" aria-labelledby="editing">
          <SectionHeader id="editing" title="编辑怎么挑" />
          <DossierCard className="about-steps-card">
            <ol className="about-steps">
              {editingSteps.map((step, index) => (
                <li key={step.title}>
                  <span className="about-steps__n" aria-hidden="true">
                    {index + 1}
                  </span>
                  <p>
                    <strong>{step.title}。</strong>
                    {step.body}
                  </p>
                </li>
              ))}
            </ol>
          </DossierCard>
          <div className="about-prose">
            <p className="about-prose__aside">
              编辑工作台里有一个模型会给候选提建议（发布、标记已看或拒绝）。它只给建议，不改变候选的状态，决定仍由编辑做。
            </p>
          </div>
        </section>

        <section className="skills-library-section" aria-labelledby="priority">
          <SectionHeader id="priority" title="优先级档位" />
          <div className="about-prose">
            <p>
              编辑给每条信号标一个重要程度：关键、重要或信号级。档位由它决定，发布时间只会让档位下降，不会让它上升。
            </p>
          </div>
          <div className="about-band-grid">
            {bands.map((band) => (
              <DossierCard className="skill-library-card" key={band.level}>
                <DossierStampTag>
                  {getPriorityLevelLabel(band.level, "zh")}
                </DossierStampTag>
                <ul className="about-band-rules">
                  {band.rules.map((rule) => (
                    <li key={rule}>{rule}</li>
                  ))}
                </ul>
                <p className="skill-library-card__summary">{band.note}</p>
              </DossierCard>
            ))}
          </div>
          <div className="about-prose">
            <p>
              记录本身有严重问题时，即使标为关键，也最多到
              {getPriorityLevelLabel("watch", "zh")}。
            </p>
            <p>
              档位不来自综合打分，对所有读者都一样。此前按记录完整度打分分档，实测把
              31 条信号全部归进了同一档，所以改成了现在的规则。
            </p>
            <p>
              「我关注的」只是按你关注的话题筛选，并注明命中了哪个话题，不改变档位，也不改变别人看到的顺序。
            </p>
          </div>
        </section>

        <section className="skills-library-section" aria-labelledby="news">
          <SectionHeader
            id="news"
            title="快讯为什么「自动聚合，未经编辑精选」"
          />
          <div className="about-prose">
            <p>
              <Link href="/technologies?view=news">全部快讯</Link>
              显示最近 7
              天导入的候选，只有标题、截短的摘要、来源、日期和话题标签。它们没有经过编辑挑选，所以每处都标着「自动聚合，未经编辑精选」。
            </p>
            <p>
              被拒的条目、导入失败时的占位条目、重复条目里的非主条目不会出现。还没处理的候选会出现，一直到编辑处理它为止。所以快讯里各信源的比例跟着发布频率走，而不是跟着质量走：在编辑处理之前，日更的媒体会占大头。
            </p>
            <p>
              已经发布为信号的快讯会链接到信号页。精选信号和技术简报只包含编辑发布的内容。
            </p>
          </div>
        </section>

        <section className="skills-library-section" aria-labelledby="relations">
          <SectionHeader
            id="relations"
            title="技术、技能、知识之间的八种关系"
          />
          <div className="about-prose">
            <p>
              站内有三类条目：技术信号是新发生的事，技能是评估和使用新技术用得上的能力，知识是理解它们需要的经典概念。条目之间的每条关系都带一个类型和一段附注，说明它们为什么相连。
            </p>
          </div>
          <div className="skills-library-card-grid about-relation-grid">
            {relations.map((relation) => (
              <DossierCard className="skill-library-card" key={relation.type}>
                <DossierStampTag>
                  {getRelationTypeLabel(relation.type, "zh")}
                </DossierStampTag>
                <p className="skill-library-card__summary">{relation.body}</p>
              </DossierCard>
            ))}
          </div>
          <Link href="/network" className="skill-library-card__link">
            在关系网络里看全图 →
          </Link>
        </section>

        <section className="skills-library-section" aria-labelledby="ai">
          <SectionHeader id="ai" title="AI 功能都标着「未经审核」" />
          <div className="skills-library-card-grid">
            {aiFeatures.map((feature) => (
              <DossierCard className="skill-library-card" key={feature.title}>
                <h3>{feature.title}</h3>
                <p className="skill-library-card__summary">{feature.body}</p>
              </DossierCard>
            ))}
          </div>
          <div className="about-prose">
            <p>
              这些内容由模型现场生成，不经过编辑审核，结果旁边总带着「
              {aiGeneratedDisclaimer.replace(/。$/, "")}
              」。前三种的结果会缓存，同样的请求不会重复生成。
            </p>
            <p>
              搜索里的「语义相近」和信号页的「内容相近的信号」用的是在服务器本机运行的向量模型，不调用外部接口；后者标着「按内容自动匹配、未经编辑挑选」。档位、简报和快讯都不由
              AI 决定。
            </p>
            <Link href="/ask" className="skill-library-card__link">
              去问雷达 →
            </Link>
          </div>
        </section>

        <section className="skills-library-section" aria-labelledby="privacy">
          <SectionHeader id="privacy" title="站点存什么、不存什么" />
          <div className="about-prose">
            <ul className="about-list">
              <li>没有账户，不需要登录。</li>
              <li>
                关注的话题、已读、稍后读、上次来访时看过哪些信号（用于「新」标记）、深浅色和快捷键开关，只存在你这个浏览器的本地存储里，服务器不知道。唯一的例外是下面的「新信号提醒」，只有你打开它才会发生。
              </li>
              <li>
                首页和稍后读里的「和你读过的相近」在你的浏览器里计算，用到的已读、稍后读记录和关注的话题不会因此发给服务器（关注的话题只在你打开新信号提醒后才存到服务器，见下面的附注）。有阅读记录时，浏览器会下载一份所有人都一样的推荐数据文件（已发布信号的向量和公开卡片信息）；这个请求不带任何阅读记录，只说明这台浏览器有过阅读记录。
              </li>
              <li>
                存进「稍后读」的信号，这个浏览器会另存一份页面副本，离线时也能打开。为了找到这些页面，浏览器会下载一张全部已发布信号的地址表，每个人拿到的都一样，所以服务器不知道你存了哪几条。
              </li>
              <li>
                换设备时，可以用关注码、阅读码自己带过去；导出和导入都在浏览器里完成。
              </li>
              <li>每个人拿到的页面都一样，个性化只发生在你的浏览器里。</li>
            </ul>
          </div>
          <DossierCard className="about-note">
            <DossierCatalogNote label="附注 · 打开「有新信号时提醒我」之后">
              <p>
                提醒默认是关的。你在「我关注的」里打开它，服务器会存一条记录：浏览器的推送服务（Chrome
                和 Edge 用 Google 的，Firefox 用 Mozilla 的，Safari 用 Apple
                的）发给这个浏览器的推送地址、两把用来加密通知的密钥、你关注的话题，以及创建时间。不存访问地址、浏览器型号，也不存你读过什么。之后你在任何页面改了关注的话题，记录里的话题跟着更新。
              </p>
              <p>
                通知在服务器上加密后经推送服务送到你的浏览器，推送服务看不到内容，只知道有一条消息发给了这个浏览器。提醒只在编辑手动推送时发出，同一条信号只推一次。
              </p>
              <p>
                怎么删：在「我关注的」里关掉提醒，或者取消关注全部话题，服务器上的记录立即删除；在浏览器设置里撤销本站的通知权限，下次推送时推送服务会告诉服务器这个地址已失效，记录随之删除。
              </p>
            </DossierCatalogNote>
          </DossierCard>
          <DossierCard className="about-note">
            <DossierCatalogNote label="附注 · 会离开你浏览器的部分">
              <p>
                你在问雷达里输入的问题，以及在信号页请求的对比、讲解和学习路径，会发到服务器，再转给模型服务商生成答案。站点不保存问雷达的问题。
              </p>
              <p>
                为了限制请求频率，服务器按访问地址在进程内存里计数，不写进任何文件，重启即清空。
              </p>
              <p>整站经 Cloudflare 转发，它能看到访问地址。</p>
            </DossierCatalogNote>
          </DossierCard>
        </section>
      </div>
    </UserPageShell>
  );
}
