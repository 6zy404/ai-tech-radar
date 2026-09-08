"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const primaryNavItems = [
  { href: "/", label: "首页" },
  { href: "/digest/today", label: "每日简报" },
  { href: "/technologies", label: "技术信号" },
  { href: "/skills", label: "技能" },
  { href: "/knowledge", label: "知识" },
  { href: "/network", label: "关系网络" }
];

const workspaceNavItem = { href: "/workspace", label: "内部工作台" };

// `scripts/build-public.mjs` removes every workspace route from the build, so
// the nav entry has to go with them — otherwise the public site ships a link to
// a route that no longer exists. Read at build time (NEXT_PUBLIC_*, inlined),
// and deliberately defaults to showing: a local `next dev` has the workspace,
// and the only cost of getting this wrong is a dead link, not an open door.
// The door is `src/middleware.ts` plus the routes' absence.
const showWorkspaceLink = process.env.NEXT_PUBLIC_WORKSPACE_UI !== "off";

function isActiveNavItem(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }

  if (href === "/digest/today") {
    return pathname.startsWith("/digest");
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function navLinkClassName(
  pathname: string,
  href: string,
  isWorkspace = false
): string {
  return [
    "top-nav__link",
    isActiveNavItem(pathname, href) ? "top-nav__link--active" : "",
    isWorkspace ? "top-nav__link--workspace" : ""
  ]
    .filter(Boolean)
    .join(" ");
}

export function TopNav() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const closeMenu = () => setMenuOpen(false);

  useEffect(() => {
    if (searchOpen) {
      searchInputRef.current?.focus();
    }
  }, [searchOpen]);

  return (
    <header className="top-nav">
      <div className="top-nav__inner">
        <Link href="/" className="brand" onClick={closeMenu}>
          AI Tech Radar
        </Link>

        <button
          type="button"
          className="top-nav__toggle"
          aria-label={menuOpen ? "收起菜单" : "展开菜单"}
          aria-expanded={menuOpen}
          aria-controls="top-nav-menu"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span className="top-nav__toggle-bars" aria-hidden="true" />
        </button>

        <nav
          id="top-nav-menu"
          className={`top-nav__menu${menuOpen ? " top-nav__menu--open" : ""}`}
          aria-label="主导航"
        >
          <ul className="top-nav__list">
            {primaryNavItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={navLinkClassName(pathname, item.href)}
                  aria-current={
                    isActiveNavItem(pathname, item.href) ? "page" : undefined
                  }
                  onClick={closeMenu}
                >
                  {item.label}
                </Link>
              </li>
            ))}
            {showWorkspaceLink ? (
              <>
                <li className="top-nav__separator" aria-hidden="true" />
                <li>
                  <Link
                    href={workspaceNavItem.href}
                    className={navLinkClassName(
                      pathname,
                      workspaceNavItem.href,
                      true
                    )}
                    aria-current={
                      isActiveNavItem(pathname, workspaceNavItem.href)
                        ? "page"
                        : undefined
                    }
                    onClick={closeMenu}
                  >
                    {workspaceNavItem.label}
                  </Link>
                </li>
              </>
            ) : null}
          </ul>
        </nav>

        <div
          className={`top-nav__search${searchOpen ? " top-nav__search--open" : ""}`}
        >
          <form
            action="/search"
            method="get"
            role="search"
            onSubmit={() => setSearchOpen(false)}
          >
            <input
              ref={searchInputRef}
              type="search"
              name="q"
              placeholder="搜索"
              aria-label="搜索关键词"
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setSearchOpen(false);
                }
              }}
            />
          </form>
          <button
            type="button"
            className="top-nav__search-toggle"
            aria-label={searchOpen ? "收起搜索" : "展开搜索"}
            aria-expanded={searchOpen}
            onClick={() => setSearchOpen((open) => !open)}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 15 15"
              fill="none"
              aria-hidden="true"
            >
              <circle
                cx="6.5"
                cy="6.5"
                r="4.5"
                stroke="currentColor"
                strokeWidth="1.4"
              />
              <line
                x1="10"
                y1="10"
                x2="13.5"
                y2="13.5"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
