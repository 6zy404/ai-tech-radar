"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const primaryNavItems = [
  { href: "/", label: "首页" },
  { href: "/digest/today", label: "每日简报" },
  { href: "/technologies", label: "技术信号" },
  { href: "/skills", label: "技能" },
  { href: "/knowledge", label: "知识" },
  { href: "/network", label: "关系网络" },
  { href: "/radar", label: "我的雷达" }
];

const workspaceNavItem = { href: "/workspace", label: "内部工作台" };

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

  const closeMenu = () => setMenuOpen(false);

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
          </ul>
        </nav>
      </div>
    </header>
  );
}
