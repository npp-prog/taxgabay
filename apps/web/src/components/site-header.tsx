"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/profile", label: "My profile" },
  { href: "/calendar", label: "Calendar" },
  { href: "/calculators", label: "Calculators" },
  { href: "/guides", label: "Filing guides" },
  { href: "/roadmap", label: "Start a business" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="text-lg font-bold text-primary">
          TaxGabay
        </Link>
        <button
          type="button"
          className="rounded-md p-2 md:hidden"
          aria-expanded={open}
          aria-controls="main-nav"
          aria-label="Menu"
          onClick={() => setOpen((o) => !o)}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <nav
          id="main-nav"
          aria-label="Main"
          className={cn(
            "absolute left-0 right-0 top-14 border-b border-border bg-background px-4 pb-3 md:static md:block md:border-0 md:p-0",
            open ? "block" : "hidden",
          )}
        >
          <ul className="flex flex-col gap-1 md:flex-row md:gap-1">
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  onClick={() => setOpen(false)}
                  aria-current={pathname.startsWith(l.href) ? "page" : undefined}
                  className={cn(
                    "block rounded-md px-3 py-2 text-sm hover:bg-muted",
                    pathname.startsWith(l.href) && "bg-secondary font-medium text-secondary-foreground",
                  )}
                >
                  {l.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/account" onClick={() => setOpen(false)} className="block rounded-md px-3 py-2 text-sm hover:bg-muted">
                Account
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
