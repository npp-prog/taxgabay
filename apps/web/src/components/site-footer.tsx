"use client";

import Link from "next/link";
import { useLocale } from "@/lib/i18n";

export function SiteFooter() {
  const { t } = useLocale();
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:justify-between">
        <p>{t.footer.notice}</p>
        <Link href="/privacy" className="underline">
          {t.footer.privacy}
        </Link>
      </div>
    </footer>
  );
}
