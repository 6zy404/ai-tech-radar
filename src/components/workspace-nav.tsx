"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const workspaceNavItems = [
  { href: "/workspace", label: "Overview", group: "Control" },
  { href: "/workspace/sources", label: "Sources", group: "Content" },
  { href: "/workspace/candidates", label: "Candidates", group: "Content" },
  { href: "/workspace/duplicates", label: "Duplicates", group: "Content" },
  { href: "/workspace/technologies", label: "Drafts", group: "Content" },
  { href: "/workspace/digests", label: "Digests", group: "Publishing" },
  { href: "/workspace/delivery", label: "Delivery", group: "Publishing" },
  { href: "/workspace/delivery/schedules", label: "Schedules", group: "Publishing" },
  { href: "/workspace/operations", label: "Operations", group: "System" }
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
    <nav className="workspace-nav" aria-label="Workspace navigation">
      <div className="workspace-nav__brand">
        <span>Internal</span>
        <strong>Workspace</strong>
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
