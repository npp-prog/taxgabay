"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { Wordmark } from "@/components/logo";
import { setLocale, useLocale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/profile", key: "profile" },
  { href: "/calendar", key: "calendar" },
  { href: "/checklists", key: "checklists" },
  { href: "/calculators", key: "calculators" },
  { href: "/guides", key: "guides" },
  { href: "/business-guide", key: "business" },
  { href: "/practice", key: "practice" },
  { href: "/learn", key: "learn" },
  { href: "/issuances", key: "issuances" },
  { href: "/life-events", key: "lifeEvents" },
  { href: "/roadmap", key: "register" },
] as const;

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const { locale, t } = useLocale();
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
      <div className="h-[3px] bg-sun" aria-hidden="true" />
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-2 px-4">
        <Link href="/" aria-label="TaxGabay home">
          <Wordmark />
        </Link>
        <div className="flex items-center gap-1 xl:order-last">
        <Link
          href="/assistant"
          onClick={() => setOpen(false)}
          className={cn("rounded-sm bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground shadow-[inset_0_-2px_0_rgb(0_0_0/0.22)] hover:bg-primary/92", pathname.startsWith("/assistant") && "ring-2 ring-sun ring-offset-1 ring-offset-card")}
        >
          {t.nav.ask}
        </Link>
        <button
          type="button"
          onClick={() => setLocale(locale === "en" ? "fil" : "en")}
          className="rounded-md px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:bg-muted"
          aria-label={`${t.meta.switchLabel}: ${t.meta.switchTo}`}
          lang={locale === "en" ? "fil" : "en"}
        >
          {locale === "en" ? "FIL" : "EN"}
        </button>
        <Link href="/search" aria-label={t.nav.search} className="rounded-md p-2 hover:bg-muted" onClick={() => setOpen(false)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
        </Link>
        <button
          type="button"
          className="rounded-md p-2 xl:hidden"
          aria-expanded={open}
          aria-controls="main-nav"
          aria-label={t.nav.menu}
          onClick={() => setOpen((o) => !o)}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        </div>
        <nav
          id="main-nav"
          aria-label="Main"
          className={cn(
            "absolute left-0 right-0 top-[3.6rem] border-b border-border bg-card px-4 pb-3 xl:static xl:block xl:border-0 xl:p-0",
            open ? "block" : "hidden",
          )}
        >
          <ul className="flex flex-col gap-1 xl:flex-row xl:gap-0.5">
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  onClick={() => setOpen(false)}
                  aria-current={pathname.startsWith(l.href) ? "page" : undefined}
                  className={cn(
                    "block border-l-2 border-transparent px-3 py-2 text-sm text-muted-foreground hover:text-foreground xl:border-b-2 xl:border-l-0 xl:px-2.5 xl:py-[1.05rem]",
                    pathname.startsWith(l.href) && "border-ink font-semibold text-foreground",
                  )}
                >
                  {t.nav[l.key]}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/account" onClick={() => setOpen(false)} className="block border-l-2 border-transparent px-3 py-2 text-sm text-muted-foreground hover:text-foreground xl:border-b-2 xl:border-l-0 xl:px-2.5 xl:py-[1.05rem]">
                {t.nav.account}
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
