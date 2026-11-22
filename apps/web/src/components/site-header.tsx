"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { Wordmark } from "@/components/logo";
import { setLocale, useLocale } from "@/lib/i18n";
import type { Messages } from "@/lib/i18n/en";
import { cn } from "@/lib/utils";

type ItemKey = keyof Messages["menu"]["items"];
type GroupKey = keyof Messages["menu"]["groups"];
type MenuKey = "taxes" | "business" | "learn";

/** Menus: each has two columns of links, like a small mega-menu. */
const MENUS: { key: MenuKey; groups: { key: GroupKey; items: { key: ItemKey; href: string }[] }[] }[] = [
  {
    key: "taxes",
    groups: [
      {
        key: "plan",
        items: [
          { key: "profile", href: "/profile" },
          { key: "calendar", href: "/calendar" },
          { key: "checklists", href: "/checklists" },
        ],
      },
      {
        key: "compute",
        items: [
          { key: "calculators", href: "/calculators" },
          { key: "guides", href: "/guides" },
          { key: "issuances", href: "/issuances" },
        ],
      },
    ],
  },
  {
    key: "business",
    groups: [
      {
        key: "run",
        items: [
          { key: "roadmap", href: "/roadmap" },
          { key: "businessGuide", href: "/business-guide" },
          { key: "lifeEvents", href: "/life-events" },
        ],
      },
      {
        key: "practice",
        items: [
          { key: "practice", href: "/practice" },
          { key: "clients", href: "/clients" },
        ],
      },
    ],
  },
  {
    key: "learn",
    groups: [
      {
        key: "learn",
        items: [
          { key: "articles", href: "/learn" },
          { key: "glossary", href: "/learn/glossary" },
          { key: "faq", href: "/learn/faq" },
        ],
      },
      {
        key: "help",
        items: [
          { key: "assistant", href: "/assistant" },
          { key: "search", href: "/search" },
        ],
      },
    ],
  },
];

const isActive = (pathname: string, href: string) => (href === "/learn" ? pathname === "/learn" || /^\/learn\/(?!glossary|faq)/.test(pathname) : pathname === href || pathname.startsWith(`${href}/`));
const menuActive = (pathname: string, m: (typeof MENUS)[number]) => m.groups.some((g) => g.items.some((i) => isActive(pathname, i.href)));

// Scroll state without effects: the bar turns into a white floating pill once the page scrolls.
function subscribeScroll(cb: () => void) {
  window.addEventListener("scroll", cb, { passive: true });
  return () => window.removeEventListener("scroll", cb);
}
const useScrolled = () => React.useSyncExternalStore(subscribeScroll, () => window.scrollY > 8, () => false);

function Chevron({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 10 10" className={cn("h-2.5 w-2.5 flex-none transition-transform duration-200", open && "rotate-180")} aria-hidden="true">
      <path d="m1.5 3.5 3.5 3.5 3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const { locale, t } = useLocale();
  const scrolled = useScrolled();
  const [openMenu, setOpenMenu] = React.useState<MenuKey | null>(null);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [mobileSection, setMobileSection] = React.useState<MenuKey | null>(null);
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const navRef = React.useRef<HTMLElement>(null);

  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpenMenu(null), 140);
  };
  const closeAll = () => {
    cancelClose();
    setOpenMenu(null);
    setMobileOpen(false);
  };

  // Escape closes; a click outside the desktop nav closes its menu.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpenMenu(null);
        setMobileOpen(false);
      }
    };
    const onDown = (e: PointerEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpenMenu(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, []);

  // No page scroll behind the full-screen mobile menu.
  React.useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const solid = scrolled || mobileOpen;
  const langButton = (
    <button
      type="button"
      onClick={() => setLocale(locale === "en" ? "fil" : "en")}
      className="rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:bg-secondary hover:text-secondary-foreground"
      aria-label={`${t.meta.switchLabel}: ${t.meta.switchTo}`}
      lang={locale === "en" ? "fil" : "en"}
    >
      {locale === "en" ? "FIL" : "EN"}
    </button>
  );

  return (
    <header className="no-print sticky top-0 z-40 px-3 pt-3 sm:px-4">
      <div
        className={cn(
          "relative mx-auto flex max-w-6xl items-center gap-3 rounded-full border px-3 py-2 transition-[background-color,border-color,box-shadow] duration-300",
          solid ? "border-border bg-card shadow-[0_1px_2px_rgb(15_31_75/0.04),0_14px_34px_-20px_rgb(15_31_75/0.3)]" : "border-transparent bg-transparent",
        )}
      >
        <Link href="/" aria-label="TaxGabay home" className="mr-auto rounded-full px-1" onClick={closeAll}>
          <Wordmark />
        </Link>

        {/* Desktop navigation */}
        <nav ref={navRef} aria-label="Main" className="hidden items-center gap-1 lg:flex">
          {MENUS.map((m) => {
            const open = openMenu === m.key;
            const active = menuActive(pathname, m);
            return (
              <div key={m.key} className="relative" onPointerEnter={(e) => {
                  if (e.pointerType === "mouse") {
                    cancelClose();
                    setOpenMenu(m.key);
                  }
                }}
                onPointerLeave={(e) => {
                  if (e.pointerType === "mouse") scheduleClose();
                }}>
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={`menu-${m.key}`}
                  onClick={() => setOpenMenu(open ? null : m.key)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[0.94rem] font-medium transition-colors",
                    open ? "bg-secondary text-primary" : "hover:bg-secondary hover:text-primary",
                    active && !open && "text-primary",
                  )}
                >
                  {t.menu[m.key]}
                  <Chevron open={open} />
                </button>
                <div
                  id={`menu-${m.key}`}
                  className={cn(
                    "absolute left-1/2 top-[calc(100%+10px)] w-max max-w-[min(640px,calc(100vw-32px))] -translate-x-1/2 rounded-lg border border-border bg-card p-4 shadow-[var(--shadow-pop)] transition-[opacity,transform,visibility] duration-200",
                    open ? "visible translate-y-0 opacity-100" : "invisible -translate-y-1.5 opacity-0",
                  )}
                >
                  {/* hover bridge so the pointer can travel from the button to the panel */}
                  <span className="absolute -top-3 left-0 h-3 w-full" aria-hidden="true" />
                  <div className="grid grid-cols-2 gap-5">
                    {m.groups.map((g) => (
                      <div key={g.key} className="min-w-[15rem]">
                        <p className="mx-3 mb-2 border-b border-border pb-2 text-[0.72rem] font-semibold uppercase tracking-[0.08em]">{t.menu.groups[g.key]}</p>
                        <ul className="grid gap-0.5">
                          {g.items.map((i) => {
                            const [title, desc] = t.menu.items[i.key];
                            return (
                              <li key={i.key}>
                                <Link
                                  href={i.href}
                                  onClick={closeAll}
                                  tabIndex={open ? undefined : -1}
                                  aria-current={isActive(pathname, i.href) ? "page" : undefined}
                                  className="block rounded-md px-3 py-2 transition-colors hover:bg-lavender aria-[current=page]:bg-lavender"
                                >
                                  <span className="block text-sm font-semibold">{title}</span>
                                  <span className="block text-[0.8rem] leading-snug text-muted-foreground">{desc}</span>
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
          <Link
            href="/assistant"
            onClick={closeAll}
            aria-current={pathname.startsWith("/assistant") ? "page" : undefined}
            className="rounded-full px-3.5 py-2 text-[0.94rem] font-medium transition-colors hover:bg-secondary hover:text-primary aria-[current=page]:text-primary"
          >
            {t.menu.ask}
          </Link>
          <span className="mx-2 h-5 w-px bg-border" aria-hidden="true" />
          {langButton}
          <Link href="/search" aria-label={t.nav.search} className="rounded-full p-2.5 hover:bg-secondary hover:text-primary" onClick={closeAll}>
            <SearchIcon />
          </Link>
          <Link href="/account" onClick={closeAll} className="rounded-full px-3.5 py-2 text-[0.94rem] font-medium hover:bg-secondary hover:text-primary">
            {t.menu.logIn}
          </Link>
          <Link href="/profile" onClick={closeAll} className="ml-1 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-shadow hover:shadow-[0_10px_22px_-8px_color-mix(in_oklab,var(--color-primary)_70%,transparent)]">
            {t.menu.getStarted}
          </Link>
        </nav>

        {/* Mobile: CTA + round menu button */}
        <div className="flex items-center gap-2 lg:hidden">
          <Link href="/search" aria-label={t.nav.search} className="hidden rounded-full p-2.5 hover:bg-secondary sm:block" onClick={closeAll}>
            <SearchIcon />
          </Link>
          <Link href="/profile" onClick={closeAll} className="whitespace-nowrap rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">
            {t.menu.getStarted}
          </Link>
          <button
            type="button"
            className="grid h-11 w-11 place-items-center rounded-full border border-border bg-card"
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
            aria-label={mobileOpen ? t.menu.close : t.nav.menu}
            onClick={() => setMobileOpen((o) => !o)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              {mobileOpen ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile full-screen menu with accordion sections */}
      <nav
        id="mobile-nav"
        aria-label="Main"
        hidden={!mobileOpen}
        className="fixed inset-x-0 bottom-0 top-[4.6rem] overflow-y-auto overscroll-contain bg-card px-5 pb-10 pt-2 lg:hidden"
      >
        <ul className="divide-y divide-border">
          {MENUS.map((m) => {
            const open = mobileSection === m.key;
            return (
              <li key={m.key}>
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setMobileSection(open ? null : m.key)}
                  className={cn("flex w-full items-center justify-between py-4 text-left text-lg font-semibold", open && "text-primary")}
                >
                  {t.menu[m.key]}
                  <Chevron open={open} />
                </button>
                {open && (
                  <div className="space-y-4 pb-4 pl-2">
                    {m.groups.map((g) => (
                      <div key={g.key}>
                        <p className="mb-1 border-b border-border pb-2 text-[0.72rem] font-semibold uppercase tracking-[0.08em]">{t.menu.groups[g.key]}</p>
                        <ul>
                          {g.items.map((i) => (
                            <li key={i.key}>
                              <Link href={i.href} onClick={closeAll} aria-current={isActive(pathname, i.href) ? "page" : undefined} className="block py-2.5 text-[0.98rem] aria-[current=page]:font-semibold aria-[current=page]:text-primary">
                                {t.menu.items[i.key][0]}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
          <li>
            <Link href="/assistant" onClick={closeAll} className="block py-4 text-lg font-semibold">
              {t.menu.ask}
            </Link>
          </li>
          <li>
            <Link href="/search" onClick={closeAll} className="block py-4 text-lg font-semibold">
              {t.nav.search}
            </Link>
          </li>
        </ul>
        <div className="mt-6 flex items-center gap-3">
          <Link href="/account" onClick={closeAll} className="flex-1 rounded-full border border-border px-5 py-3 text-center font-medium">
            {t.menu.logIn}
          </Link>
          {langButton}
        </div>
      </nav>
    </header>
  );
}
