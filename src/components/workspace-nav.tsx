"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const workspaceNavItems = [
  { href: "/workspace", label: "总览", group: "控制台" },
  { href: "/workspace/sources", label: "来源", group: "内容" },
  { href: "/workspace/candidates", label: "候选", group: "内容" },
  { href: "/workspace/duplicates", label: "重复组", group: "内容" },
  { href: "/workspace/technologies", label: "草稿", group: "内容" },
  { href: "/workspace/skills", label: "技能", group: "内容" },
  { href: "/workspace/knowledge", label: "知识", group: "内容" },
  { href: "/workspace/digests", label: "简报", group: "发布" },
  { href: "/workspace/delivery", label: "投递", group: "发布" },
  {
    href: "/workspace/delivery/schedules",
    label: "定时投递",
    group: "发布"
  },
  { href: "/workspace/operations", label: "运维", group: "系统" }
];

function isActivePath(pathname: string, href: string): boolean {
  if (href === "/workspace") {
    return pathname === href;
  }

  if (href === "/workspace/delivery") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function WorkspaceNav() {
  const pathname = usePathname();
  let currentGroup = "";

  return (
    <nav className="workspace-nav" aria-label="工作台导航">
      <div className="workspace-nav__brand">
        <span>内部</span>
        <strong>工作台</strong>
      </div>
      <ul className="workspace-nav__list">
        {workspaceNavItems.map((item) => {
          const isActive = isActivePath(pathname, item.href);
          const showGroup = currentGroup !== item.group;
          currentGroup = item.group;

          return (
            <li key={item.href} className="workspace-nav__item">
              {showGroup ? (
                <span className="workspace-nav__group">{item.group}</span>
              ) : null}
              <Link
                href={item.href}
                className={`workspace-nav__link${
                  isActive ? " workspace-nav__link--active" : ""
                }`}
                aria-current={isActive ? "page" : undefined}
              >
                <span className="workspace-nav__dot" aria-hidden="true" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
