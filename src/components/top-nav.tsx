"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { SearchGlyph } from "@/components/search-glyph";
import { ThemeToggle } from "@/components/theme-toggle";
import { shellCopy } from "@/lib/i18n/copy/shell";
import {
  documentLangs,
  hasEnglishTwin,
  hreflangs,
  localePath,
  stripLocalePrefix
} from "@/lib/i18n/locale";
import { useLocale } from "@/lib/i18n/use-locale";

type NavLabelKey = keyof (typeof shellCopy)["zh"]["nav"];

// Chinese-site paths; the English nav prefixes them with /en.
const primaryNavItems: { href: string; labelKey: NavLabelKey }[] = [
  { href: "/", labelKey: "home" },
  { href: "/digest/today", labelKey: "digest" },
  { href: "/technologies", labelKey: "technologies" },
  { href: "/radar", labelKey: "radar" },
  { href: "/skills", labelKey: "skills" },
  { href: "/knowledge", labelKey: "knowledge" },
  { href: "/network", labelKey: "network" },
  { href: "/ask", labelKey: "ask" }
];

// The workspace has no English version, so this link never takes /en.
const workspaceNavItem = { href: "/workspace", labelKey: "workspace" as const };

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

/**
 * The same page in the other language. A plain document navigation, not a
 * client-side one: the root layout (and with it `<html lang>`) is shared by
 * both sites and is only rendered again on a full load. Without JS the link
 * still works, minus the query string.
 */
function LanguageSwitch({
  path,
  target
}: {
  path: string;
  target: "zh" | "en";
}) {
  const href = localePath(target, path);
  // The label is in the language it switches to.
  const copy = shellCopy[target === "en" ? "zh" : "en"].languageSwitch;

  return (
    <a
      className="top-nav__locale"
      href={href}
      hrefLang={hreflangs[target]}
      lang={documentLangs[target]}
      aria-label={copy.label}
      title={copy.label}
      onClick={(event) => {
        event.preventDefault();
        window.location.assign(
          `${href}${window.location.search}${window.location.hash}`
        );
      }}
    >
      {copy.text}
    </a>
  );
}

export function TopNav() {
  const locale = useLocale();
  const copy = shellCopy[locale].nav;
  // Matched against the Chinese-site paths above, on either site.
  const pathname = stripLocalePrefix(usePathname() ?? "/");
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchToggleRef = useRef<HTMLButtonElement>(null);
  const menuToggleRef = useRef<HTMLButtonElement>(null);
  const menuPanelRef = useRef<HTMLElement>(null);

  const closeMenu = () => setMenuOpen(false);

  // While the panel is open, Esc closes it and hands focus back to the button
  // that opened it, and a click anywhere outside the panel and the button
  // closes it. The listeners exist only while it is open. Above 900px the
  // button is display:none and the panel cannot be open, but a window resized
  // mid-way could leave the state set — so both handlers do nothing unless the
  // button is actually rendered, and the desktop nav never reacts.
  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const toggleIsShown = () =>
      (menuToggleRef.current?.getClientRects().length ?? 0) > 0;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !toggleIsShown()) {
        return;
      }
      // Esc in the search box belongs to the search box.
      if (event.target === searchInputRef.current) {
        return;
      }
      setMenuOpen(false);
      menuToggleRef.current?.focus();
    };

    // "click", not "pointerdown": closing on press would collapse the panel
    // and move the page under the pointer before the click lands.
    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node) || !toggleIsShown()) {
        return;
      }
      if (
        menuPanelRef.current?.contains(target) ||
        menuToggleRef.current?.contains(target)
      ) {
        return;
      }
      setMenuOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("click", onClick);
    };
  }, [menuOpen]);

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
            href={localePath(locale, item.href)}
            className={navLinkClassName(pathname, item.href)}
            aria-current={
              isActiveNavItem(pathname, item.href) ? "page" : undefined
            }
            onClick={closeMenu}
          >
            {copy[item.labelKey]}
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
              {copy[workspaceNavItem.labelKey]}
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
        <Link
          href={localePath(locale, "/")}
          className="brand"
          onClick={closeMenu}
        >
          AI Tech Radar
        </Link>

        <nav className="top-nav__menu" aria-label={copy.mainNavLabel}>
          {navList}
        </nav>

        <div className="top-nav__actions">
          <div
            className={`top-nav__search${searchOpen ? " top-nav__search--open" : ""}`}
          >
            <form
              action={localePath(locale, "/search")}
              method="get"
              role="search"
              onSubmit={() => setSearchOpen(false)}
            >
              <input
                ref={searchInputRef}
                type="search"
                name="q"
                placeholder={copy.searchPlaceholder}
                aria-label={copy.searchInputLabel}
                // Collapsed, the box is 0px wide and clipped by its form, so
                // it must not be a tab stop; the toggle focuses it on open.
                tabIndex={searchOpen ? undefined : -1}
                // Collapsing does not blur the box, so Esc hands focus back to
                // the toggle — as the menu panel's Esc does — or the caret
                // would sit in a box nobody can see.
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    setSearchOpen(false);
                    searchToggleRef.current?.focus();
                  }
                }}
              />
            </form>
            <button
              ref={searchToggleRef}
              type="button"
              className="top-nav__search-toggle"
              aria-label={searchOpen ? copy.collapseSearch : copy.expandSearch}
              aria-expanded={searchOpen}
              onClick={() => setSearchOpen((open) => !open)}
            >
              <SearchGlyph />
            </button>
          </div>

          {hasEnglishTwin(pathname) ? (
            <LanguageSwitch
              path={pathname}
              target={locale === "zh" ? "en" : "zh"}
            />
          ) : null}

          <ThemeToggle />

          <button
            ref={menuToggleRef}
            type="button"
            className="top-nav__toggle"
            aria-label={menuOpen ? copy.collapseMenu : copy.expandMenu}
            aria-expanded={menuOpen}
            aria-controls="top-nav-menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className="top-nav__toggle-bars" aria-hidden="true" />
          </button>
        </div>

        <nav
          ref={menuPanelRef}
          id="top-nav-menu"
          className={`top-nav__menu top-nav__menu--panel${menuOpen ? " top-nav__menu--open" : ""}`}
          aria-label={copy.mainNavLabel}
        >
          {navList}
        </nav>
      </div>
    </header>
  );
}
