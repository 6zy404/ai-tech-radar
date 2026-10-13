import Link from "next/link";

import { DossierCard } from "@/components/dossier-card";
import { DossierCatalogNote } from "@/components/dossier-catalog-note";
import { DossierCategoryChips } from "@/components/dossier-category-chips";
import { DossierStampTag } from "@/components/dossier-stamp-tag";
import { UserPageShell } from "@/components/user-page-shell";
import { technologyDetailCopy } from "@/lib/i18n/copy/technology-detail";
import { importantFreshnessWindowDays } from "@/lib/ranking";
import { getPriorityLevelLabel } from "@/lib/ranking-display";
import { getRelationTypeLabel } from "@/lib/technology-localization";
import type { RelationType } from "@/types/content";

// The English /about. The Chinese page (about-page.tsx) is long prose whose
// sentences are written as JSX text, so the English one is its own tree with
// the same sections, ids and classes rather than a copy table threaded
// through it — the Chinese markup stays exactly as it was. Same facts, same
// sources (docs/reference, architecture, security-boundary); band names,
// relation labels, the disclaimer and the 30-day window come from the code
// that renders them elsewhere. Keep the two pages in step when either
// changes.

export const aboutPageTitleEn = "How signals are picked";
export const aboutPageDescriptionEn =
  "Where signals come from, how editors pick them, how priority is set, and what the site stores and what it does not.";

const sections = [
  { id: "sources", label: "Sources" },
  { id: "editing", label: "Editing" },
  { id: "priority", label: "Priority bands" },
  { id: "news", label: "News" },
  { id: "relations", label: "Eight relations" },
  { id: "ai", label: "AI features" },
  { id: "privacy", label: "What is stored" }
] as const;

const sourceTypes = ["RSS", "Atom", "GitHub Release", "Official blog pages"];

const editingSteps = [
  {
    title: "Deduplicate",
    body: "When the same news arrives from several sources, the editor picks one as the main entry and hangs the rest under it as further sources."
  },
  {
    title: "Draft",
    body: "Candidates worth publishing become drafts; the rest are marked as seen or rejected."
  },
  {
    title: "Explain",
    body: "The editor writes why it matters, who should care, what background it needs and how to learn more, and links it to the related skills and knowledge."
  },
  {
    title: "Check",
    body: "A missing title, summary, body, source link or date blocks publication until it is fixed; too few links or incomplete explanations are warnings — it can be published, but the editor has to see them."
  },
  {
    title: "Publish",
    body: "Once the checks pass it becomes a signal. Briefings are generated from published signals, adjusted by an editor, then published."
  }
];

const days = importantFreshnessWindowDays;

const bands = [
  {
    level: "high_priority",
    rules: [
      "Critical: always in this band",
      `Important: for ${days} days after publication`
    ],
    note: "The first part of a briefing."
  },
  {
    level: "watch",
    rules: [
      `Important: once ${days} days have passed`,
      "Signal: always in this band"
    ],
    note: "The second part of a briefing."
  },
  {
    level: "low_priority",
    rules: ["No summary or body, or an invalid source link or date"],
    note: "Lands here whatever its importance; briefings leave it out by default."
  }
] as const;

const relations: Array<{ type: RelationType; body: string }> = [
  { type: "builds-on", body: "Grew out of the other; built on top of it." },
  { type: "uses", body: "Makes use of the other." },
  {
    type: "explains",
    body: "Explains what the other is, or why it works that way."
  },
  {
    type: "requires",
    body: "You need the other before this one. The only one of the eight with a direction; the “Read these first” list on skill and knowledge pages is built from it."
  },
  { type: "extends", body: "Read on from this one." },
  {
    type: "supersedes",
    body: "A later release of the same product line. A signal page’s release line is built from it alone."
  },
  { type: "supports", body: "Gives evidence for the other." },
  {
    type: "related-to",
    body: "Related, but none of the above. About 12% of all relations."
  }
];

const aiFeatures = [
  {
    title: "Compare two technologies",
    body: "On a signal page, pick another published signal and get what they share, how they differ and when to use each."
  },
  {
    title: "Explain at your level",
    body: "Pick beginner, intermediate or advanced and get an explanation at that depth."
  },
  {
    title: "Learning path",
    body: "Using the skills and knowledge linked to the signal as material, it drafts learning steps and self-checks."
  },
  {
    title: "Ask the radar",
    body: "Answers only from the site’s published signals, skills and knowledge, citing each claim; when the site has nothing relevant, the answer says so first."
  }
];

function SectionHeader({ id, title }: { id: string; title: string }) {
  return (
    <div className="skills-library-section__header">
      <h2 id={id}>{title}</h2>
    </div>
  );
}

export function AboutPageEn() {
  const label = (level: (typeof bands)[number]["level"]) =>
    getPriorityLevelLabel(level, "zh", "en");

  return (
    <UserPageShell
      title={aboutPageTitleEn}
      description={aboutPageDescriptionEn}
      sectionLabel="About"
      className="skills-library-page about-page dossier"
    >
      <section className="skills-library-intro">
        <p>
          Every signal here has been through an editor; anything that has not is
          labelled where it appears. This page follows a piece of news in the
          order it enters the site. The site itself is written in Chinese; this
          English edition translates the interface, not the content.
        </p>
        <DossierCategoryChips
          className="about-jump"
          ariaLabel="Sections of this page"
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
          <SectionHeader id="sources" title="Where signals come from" />
          <div className="about-prose">
            <p>
              Signals come from a fixed set of outside sources, of four kinds:
            </p>
            <ul className="about-stamps" aria-label="Source types">
              {sourceTypes.map((type) => (
                <li key={type}>
                  <DossierStampTag>{type}</DossierStampTag>
                </li>
              ))}
            </ul>
            <p>
              They are imported once a day. A new item first enters the
              candidate pool; at that point it is not a signal yet.
            </p>
            <p>
              The publisher is the organisation behind an announcement — big
              tech, startup, research lab, open-source community or media — and
              the source is the feed it came through. Every signal page names
              the publisher type, so you can tell a vendor announcement from an
              open-source release or a research result.
            </p>
            <Link href="/en/sources" className="skill-library-card__link">
              All publishers and sources →
            </Link>
          </div>
          <DossierCard className="about-note">
            <DossierCatalogNote label="Note · three kinds are dropped on import">
              <p>
                Pre-release versions (version numbers with rc, beta and the
                like), an announcement the site has already published, and
                “hacked by …” titles left by defaced web pages. These three are
                rejected automatically; every other candidate waits for an
                editor. An item with a title and no summary is not rejected
                automatically.
              </p>
            </DossierCatalogNote>
          </DossierCard>
        </section>

        <section className="skills-library-section" aria-labelledby="editing">
          <SectionHeader id="editing" title="How editors pick" />
          <DossierCard className="about-steps-card">
            <ol className="about-steps">
              {editingSteps.map((step, index) => (
                <li key={step.title}>
                  <span className="about-steps__n" aria-hidden="true">
                    {index + 1}
                  </span>
                  <p>
                    <strong>{step.title}.</strong> {step.body}
                  </p>
                </li>
              ))}
            </ol>
          </DossierCard>
          <div className="about-prose">
            <p className="about-prose__aside">
              In the editors’ workspace a model suggests what to do with each
              candidate (publish, mark as seen, or reject). It only suggests; it
              never changes a candidate’s state, and the editor decides.
            </p>
          </div>
        </section>

        <section className="skills-library-section" aria-labelledby="priority">
          <SectionHeader id="priority" title="Priority bands" />
          <div className="about-prose">
            <p>
              The editor marks each signal critical, important or signal. That
              decides the band; time since publication can only move a signal
              down, never up.
            </p>
          </div>
          <div className="about-band-grid">
            {bands.map((band) => (
              <DossierCard className="skill-library-card" key={band.level}>
                <DossierStampTag>{label(band.level)}</DossierStampTag>
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
              When the record itself has a serious problem, it goes no higher
              than {label("watch")}, even if marked critical.
            </p>
            <p>
              The bands do not come from a combined score, and they are the same
              for every reader. An earlier version banded signals by how
              complete their records were; measured, it put all 31 signals in
              the same band, so it was replaced by the rules above.
            </p>
            <p>
              “Following” only filters by the topics you follow and says which
              topic matched. It does not change the band, or the order anyone
              else sees.
            </p>
          </div>
        </section>

        <section className="skills-library-section" aria-labelledby="news">
          <SectionHeader
            id="news"
            title="Why the news is “gathered automatically, not picked by an editor”"
          />
          <div className="about-prose">
            <p>
              <Link href="/en/technologies?view=news">All news</Link> shows the
              candidates imported in the last 7 days, with only a title, a
              shortened summary, the source, the date and topic tags. No editor
              has picked them, so every place they appear says so.
            </p>
            <p>
              Rejected items, placeholders from failed imports and the secondary
              copies of duplicates are left out. Candidates no editor has
              handled yet do appear, until an editor handles them. So the mix of
              sources in the news follows how often each one publishes, not how
              good it is: before an editor gets to them, daily media outlets
              make up most of it.
            </p>
            <p>
              News items already published as signals link to the signal page.
              Curated signals and briefings contain only what editors published.
            </p>
          </div>
        </section>

        <section className="skills-library-section" aria-labelledby="relations">
          <SectionHeader
            id="relations"
            title="Eight relations between signals, skills and knowledge"
          />
          <div className="about-prose">
            <p>
              The site holds three kinds of entry: a signal is something new
              that happened, a skill is an ability that helps you evaluate and
              use new technology, and knowledge is a lasting concept you need to
              understand them. Every relation between entries carries a type and
              a note saying why they are connected.
            </p>
          </div>
          <div className="skills-library-card-grid about-relation-grid">
            {relations.map((relation) => (
              <DossierCard className="skill-library-card" key={relation.type}>
                <DossierStampTag>
                  {getRelationTypeLabel(relation.type, "zh", "en")}
                </DossierStampTag>
                <p className="skill-library-card__summary">{relation.body}</p>
              </DossierCard>
            ))}
          </div>
          <Link href="/en/network" className="skill-library-card__link">
            See the whole graph in the network →
          </Link>
        </section>

        <section className="skills-library-section" aria-labelledby="ai">
          <SectionHeader
            id="ai"
            title="Every AI feature is marked “not reviewed”"
          />
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
              A model writes these on the spot, without an editor’s review, and
              the result always carries “
              {technologyDetailCopy.en.ai.disclaimer.split(".")[0]}”. The first
              three are cached, so the same request is not generated twice. The
              answers are written in Chinese.
            </p>
            <p>
              “Similar meaning” in search and “Similar signals” on a signal page
              use a vector model that runs on the server itself and calls no
              outside service; the latter is marked “matched by content, not
              picked by an editor”. Bands, briefings and news are not decided by
              AI.
            </p>
            <Link href="/en/ask" className="skill-library-card__link">
              Ask the radar →
            </Link>
          </div>
        </section>

        <section className="skills-library-section" aria-labelledby="privacy">
          <SectionHeader
            id="privacy"
            title="What the site stores, and what it does not"
          />
          <div className="about-prose">
            <ul className="about-list">
              <li>There are no accounts and nothing to sign in to.</li>
              <li>
                The topics you follow, what you have read or saved for later,
                which signals you had seen on your last visit (for the “New”
                stamps), the light or dark theme and the shortcut switch are
                kept only in your browser’s local storage; the server does not
                know them. The one exception is the new-signal alert below, and
                only if you turn it on.
              </li>
              <li>
                “Close to what you read” on the home page and under Read later
                is worked out in your browser; the read and saved marks and
                followed topics it uses are not sent to the server for it
                (followed topics reach the server only if you turn on alerts,
                see the note below). Once you have marks, the browser downloads
                one recommendation file that is the same for everyone — the
                published signals’ vectors and public card fields. The request
                carries none of your marks; it only says that this browser has
                some reading history.
              </li>
              <li>
                For each signal you save for later, this browser keeps a copy of
                the page so it opens offline. To find those pages it downloads a
                list of every published signal’s address, the same for everyone,
                so the server does not learn which ones you saved.
              </li>
              <li>
                To move to another device, carry your follows and reading marks
                over with a follow code or reading code; both are exported and
                imported entirely in the browser.
              </li>
              <li>
                Everyone gets the same pages; any personalisation happens in
                your browser.
              </li>
            </ul>
          </div>
          <DossierCard className="about-note">
            <DossierCatalogNote label="Note · once you turn on “Alert me to new signals”">
              <p>
                Alerts are off by default. When you turn them on under
                “Following”, the server stores one record: the push address your
                browser’s push service gave this browser (Chrome and Edge use
                Google’s, Firefox uses Mozilla’s, Safari uses Apple’s), two keys
                used to encrypt notifications, the topics you follow, and when
                it was created. It does not store your address, your browser
                model, or anything about what you read. If you later change your
                followed topics on any page, the record’s topics change with
                them.
              </p>
              <p>
                Notifications are encrypted on the server and delivered to your
                browser through the push service, which cannot read them and
                only knows that a message went to this browser. Alerts go out
                only when an editor sends them by hand, and each signal is sent
                once.
              </p>
              <p>
                To delete it: turn alerts off under “Following”, or unfollow
                every topic, and the record is deleted on the server at once. If
                you revoke the site’s notification permission in your browser
                settings, the push service tells the server on the next send
                that the address is gone, and the record is deleted then.
              </p>
            </DossierCatalogNote>
          </DossierCard>
          <DossierCard className="about-note">
            <DossierCatalogNote label="Note · what does leave your browser">
              <p>
                The questions you type into Ask the radar, and the comparisons,
                explanations and learning paths you request on a signal page, go
                to the server and on to the model provider that generates the
                answer. The site does not keep your questions.
              </p>
              <p>
                To limit how often requests can be made, the server counts them
                per address in process memory; nothing is written to a file, and
                a restart clears it.
              </p>
              <p>
                The whole site is served through Cloudflare, which sees your
                address.
              </p>
            </DossierCatalogNote>
          </DossierCard>
        </section>
      </div>
    </UserPageShell>
  );
}
