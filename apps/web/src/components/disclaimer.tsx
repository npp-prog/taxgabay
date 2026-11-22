"use client";

import { format, useLocale } from "@/lib/i18n";
import { en } from "@/lib/i18n/en";
import { cn } from "@/lib/utils";

/** English text, for places outside React (PDFs, emails). */
export const DISCLAIMER_TEXT = en.disclaimer.text;

export function Disclaimer({ lastVerified, className }: { lastVerified: string | null; className?: string }) {
  const { t } = useLocale();
  return (
    <aside
      role="note"
      aria-label="Disclaimer"
      data-testid="disclaimer"
      className={cn("rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-warning-foreground", className)}
    >
      <p className="font-medium">{t.disclaimer.text}</p>
      <p className="mt-1">{lastVerified ? format(t.disclaimer.verified, { date: lastVerified }) : t.disclaimer.notVerified}</p>
    </aside>
  );
}
