import type { Metadata } from "next";
import Link from "next/link";

import { SiteSearchForm } from "@/components/site-search-form";
import { UserPageShell } from "@/components/user-page-shell";
import { shellCopy } from "@/lib/i18n/copy/shell";
import { localePath } from "@/lib/i18n/locale";
import { getRequestLocale } from "@/lib/i18n/request-locale";

// Until 2026-09-24 every notFound() on the site — an unknown signal slug, a
// topic with no content, a non-Monday week key — showed Next's default English
// page. This is the Chinese one, in the same dossier register as the rest of
// the public site; under /en it speaks English. A not-found page receives no
// route props, so it reads the interface language from the request.
export async function generateMetadata(): Promise<Metadata> {
  const copy = shellCopy[await getRequestLocale()].notFound;

  return {
    title: copy.title,
    robots: { index: false, follow: false }
  };
}

export default async function NotFound() {
  const locale = await getRequestLocale();
  const copy = shellCopy[locale].notFound;

  return (
    <UserPageShell
      title={copy.title}
      description={copy.description}
      sectionLabel={copy.sectionLabel}
      className="dossier"
    >
      <SiteSearchForm locale={locale} />
      <section className="empty-state empty-state--actionable">
        <strong>{copy.lead}</strong>
        <p>
          <Link className="action-link" href={localePath(locale, "/")}>
            {copy.home}
          </Link>
          {" · "}
          <Link
            className="action-link"
            href={localePath(locale, "/technologies")}
          >
            {copy.technologies}
          </Link>
          {" · "}
          <Link className="action-link" href={localePath(locale, "/search")}>
            {copy.search}
          </Link>
        </p>
      </section>
    </UserPageShell>
  );
}
