"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { SearchGlyph } from "@/components/search-glyph";
import { ThemeToggle } from "@/components/theme-toggle";

const primaryNavItems = [
  { href: "/", label: "首页" },
  { href: "/digest/today", label: "技术简报" },
  { href: "/technologies", label: "技术信号" },
  { href: "/skills", label: "技能" },
  { href: "/knowledge", label: "知识" },
  { href: "/network", label: "关系网络" },
  { href: "/ask", label: "问雷达" }
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

  const navList = (
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
  );

  // The links render twice and CSS shows one: the inline nav between the brand
  // and the actions above 900px, and the panel below the whole row at 900px
  // and under, whose toggle sits last in the row. A single <nav> moved with
  // `order` would leave the tab order off the visual order at one width or the
  // other (WCAG 2.4.3): after the search and theme buttons on desktop, or
  // before the menu button that opens it on a phone. The hidden copy is
  // display:none, so it is out of both the tab order and the accessibility
  // tree.
  return (
    <header className="top-nav">
      <div
        className={`top-nav__inner${searchOpen ? " top-nav__inner--searching" : ""}`}
      >
        <Link href="/" className="brand" onClick={closeMenu}>
          AI Tech Radar
        </Link>

        <nav className="top-nav__menu" aria-label="主导航">
          {navList}
        </nav>

        <div className="top-nav__actions">
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
                // Collapsed, the box is 0px wide and clipped by its form, so
                // it must not be a tab stop; the toggle focuses it on open.
                tabIndex={searchOpen ? undefined : -1}
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
              <SearchGlyph />
            </button>
          </div>

          <ThemeToggle />

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
        </div>

        <nav
          id="top-nav-menu"
          className={`top-nav__menu top-nav__menu--panel${menuOpen ? " top-nav__menu--open" : ""}`}
          aria-label="主导航"
        >
          {navList}
        </nav>
      </div>
    </header>
  );
}
