"use client";

import Link from "next/link";
import { Wordmark } from "@/components/logo";
import { useLocale } from "@/lib/i18n";

const COLUMNS = [
  { key: "taxes", links: [["profile", "/profile"], ["calendar", "/calendar"], ["checklists", "/checklists"], ["calculators", "/calculators"], ["guides", "/guides"]] },
  { key: "business", links: [["roadmap", "/roadmap"], ["businessGuide", "/business-guide"], ["practice", "/practice"], ["lifeEvents", "/life-events"], ["clients", "/clients"]] },
  { key: "learn", links: [["articles", "/learn"], ["glossary", "/learn/glossary"], ["faq", "/learn/faq"], ["issuances", "/issuances"], ["assistant", "/assistant"]] },
] as const;

export function SiteFooter() {
  const { t } = useLocale();
  return (
    <footer className="no-print mt-16 border-t border-border bg-card">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-12 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="space-y-4">
          <Wordmark />
          <p className="max-w-[34ch] text-sm leading-relaxed text-muted-foreground">{t.footer.notice}</p>
        </div>
        {COLUMNS.map((c) => (
          <div key={c.key}>
            <p className="mb-3 text-sm font-semibold">{t.menu[c.key]}</p>
            <ul className="space-y-2">
              {c.links.map(([k, href]) => (
                <li key={href}>
                  <Link href={href} className="text-sm text-muted-foreground hover:text-primary">
                    {t.menu.items[k][0]}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-5 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} TaxGabay · For guidance only; not affiliated with the BIR.</p>
          <Link href="/privacy" className="hover:text-primary">
            {t.footer.privacy}
          </Link>
        </div>
      </div>
    </footer>
  );
}
