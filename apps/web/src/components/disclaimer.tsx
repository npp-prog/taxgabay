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
      className={cn("flex gap-3 rounded-md border border-dashed border-input bg-card p-3.5 text-sm", className)}
    >
      <span
        className={cn(
          "mt-0.5 h-fit shrink-0 rounded-sm border px-1.5 py-0.5 font-mono text-[0.62rem] font-bold uppercase tracking-wider",
          lastVerified ? "border-success/50 text-success" : "border-sun bg-sun-soft text-sun-foreground dark:text-sun",
        )}
        aria-hidden="true"
      >
        {lastVerified ? "Verified" : "Unverified"}
      </span>
      <div>
        <p className="font-semibold">{t.disclaimer.text}</p>
        <p className="mt-1 text-muted-foreground">{lastVerified ? format(t.disclaimer.verified, { date: lastVerified }) : t.disclaimer.notVerified}</p>
      </div>
    </aside>
  );
}
