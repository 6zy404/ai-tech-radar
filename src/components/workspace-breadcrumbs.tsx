"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const moduleLabels: Record<string, string> = {
  sources: "Sources",
  candidates: "Candidates",
  duplicates: "Duplicates",
  technologies: "Drafts",
  digests: "Digests"
};

const detailLabels: Record<string, string> = {
  sources: "Source detail",
  candidates: "Candidate detail",
  duplicates: "Duplicate group",
  technologies: "Technology detail",
  digests: "Digest detail"
};

interface BreadcrumbItem {
  href?: string;
  label: string;
}

function buildBreadcrumbs(pathname: string): BreadcrumbItem[] {
  const segments = pathname.split("/").filter(Boolean);
  const breadcrumbs: BreadcrumbItem[] = [{ href: "/workspace", label: "Workspace" }];

  if (segments[0] !== "workspace") {
    return breadcrumbs;
  }

  const moduleSegment = segments[1];
  if (!moduleSegment) {
    return breadcrumbs;
  }

  breadcrumbs.push({
    href: `/workspace/${moduleSegment}`,
    label: moduleLabels[moduleSegment] ?? moduleSegment
  });

  const thirdSegment = segments[2];
  if (!thirdSegment) {
    return breadcrumbs;
  }

  if (thirdSegment === "new") {
    breadcrumbs.push({ label: "New source" });
    return breadcrumbs;
  }

  breadcrumbs.push({
    label: detailLabels[moduleSegment] ?? "Detail"
  });

  if (segments[3] === "preview") {
    breadcrumbs.push({ label: "Preview" });
  }

  return breadcrumbs;
}

export function WorkspaceBreadcrumbs() {
  const pathname = usePathname();
  const breadcrumbs = buildBreadcrumbs(pathname);

  return (
    <nav className="workspace-breadcrumbs" aria-label="Workspace breadcrumbs">
      <ol>
        {breadcrumbs.map((item, index) => {
          const isLast = index === breadcrumbs.length - 1;

          return (
            <li key={`${item.label}-${index}`}>
              {item.href && !isLast ? (
                <Link href={item.href}>{item.label}</Link>
              ) : (
                <span aria-current={isLast ? "page" : undefined}>{item.label}</span>
              )}
              {!isLast ? (
                <span className="workspace-breadcrumbs__separator" aria-hidden="true">
                  /
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
