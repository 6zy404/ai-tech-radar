"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const moduleLabels: Record<string, string> = {
  sources: "来源",
  candidates: "候选",
  duplicates: "重复组",
  technologies: "草稿",
  skills: "技能",
  knowledge: "知识",
  digests: "简报",
  delivery: "投递",
  operations: "运维"
};

const detailLabels: Record<string, string> = {
  sources: "来源详情",
  candidates: "候选详情",
  duplicates: "重复组详情",
  technologies: "技术详情",
  skills: "技能详情",
  knowledge: "知识详情",
  digests: "简报详情"
};

const newPageLabels: Record<string, string> = {
  sources: "新建来源",
  skills: "新建技能",
  knowledge: "新建知识"
};

// Named sibling pages (not [id] detail routes) nested under a module.
const namedSubPageLabels: Record<string, Record<string, string>> = {
  delivery: { schedules: "定时投递" },
  operations: { events: "事件" }
};

interface BreadcrumbItem {
  href?: string;
  label: string;
}

function buildBreadcrumbs(pathname: string): BreadcrumbItem[] {
  const segments = pathname.split("/").filter(Boolean);
  const breadcrumbs: BreadcrumbItem[] = [
    { href: "/workspace", label: "工作台" }
  ];

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
    breadcrumbs.push({ label: newPageLabels[moduleSegment] ?? "新建" });
    return breadcrumbs;
  }

  const namedSubPageLabel = namedSubPageLabels[moduleSegment]?.[thirdSegment];
  if (namedSubPageLabel) {
    breadcrumbs.push({ label: namedSubPageLabel });
    return breadcrumbs;
  }

  breadcrumbs.push({
    label: detailLabels[moduleSegment] ?? "详情"
  });

  if (segments[3] === "preview") {
    breadcrumbs.push({ label: "预览" });
  }

  return breadcrumbs;
}

export function WorkspaceBreadcrumbs() {
  const pathname = usePathname();
  const breadcrumbs = buildBreadcrumbs(pathname);

  return (
    <nav className="workspace-breadcrumbs" aria-label="工作台面包屑">
      <ol>
        {breadcrumbs.map((item, index) => {
          const isLast = index === breadcrumbs.length - 1;

          return (
            <li key={`${item.label}-${index}`}>
              {item.href && !isLast ? (
                <Link href={item.href}>{item.label}</Link>
              ) : (
                <span aria-current={isLast ? "page" : undefined}>
                  {item.label}
                </span>
              )}
              {!isLast ? (
                <span
                  className="workspace-breadcrumbs__separator"
                  aria-hidden="true"
                >
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
