"use client";

import Link from "next/link";
import { useEffect } from "react";

import { UserPageShell } from "@/components/user-page-shell";
import { shellCopy } from "@/lib/i18n/copy/shell";
import { localePath } from "@/lib/i18n/locale";
import { useLocale } from "@/lib/i18n/use-locale";

// Route-level error boundary. It must be a client component (Next requires
// it), it never shows the error text to the reader — that could carry a file
// path or a provider message — and it logs the digest so the server log has
// something to search for.
export default function RouteError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const locale = useLocale();
  const copy = shellCopy[locale].error;

  useEffect(() => {
    console.error("[route error]", error.digest ?? error.message);
  }, [error]);

  return (
    <UserPageShell
      title={copy.title}
      description={copy.description}
      sectionLabel={copy.sectionLabel}
      className="dossier"
    >
      <section className="empty-state empty-state--actionable">
        <strong>{copy.lead}</strong>
        <p>
          <button className="action-link" type="button" onClick={reset}>
            {copy.retry}
          </button>
          {" · "}
          <Link className="action-link" href={localePath(locale, "/")}>
            {copy.home}
          </Link>
        </p>
      </section>
    </UserPageShell>
  );
}
