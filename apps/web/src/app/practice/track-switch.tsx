"use client";

import type { Track } from "@taxgabay/accounting";
import { useTrack } from "@/lib/practice-progress";
import { cn } from "@/lib/utils";

const TRACKS: { key: Track; label: string; blurb: string }[] = [
  { key: "owner", label: "Business owner", blurb: "Keep the books BIR requires and see how they become your tax returns. Plain language, no accounting background needed." },
  { key: "student", label: "Accounting student", blurb: "The full accounting cycle: journalize, post, trial balance, adjusting entries, worksheet, financial statements and closing." },
];

export function TrackSwitch() {
  const [track, setTrack] = useTrack();
  return (
    <div role="radiogroup" aria-label="Choose your track" className="grid gap-3 sm:grid-cols-2">
      {TRACKS.map((t) => (
        <button
          key={t.key}
          type="button"
          role="radio"
          aria-checked={track === t.key}
          onClick={() => setTrack(t.key)}
          className={cn(
            "rounded-md border bg-card p-4 text-left transition-colors",
            track === t.key ? "border-primary border-t-[3px] bg-secondary/40" : "border-border hover:border-input",
          )}
        >
          <span className="flex items-center justify-between gap-2">
            <span className="font-display text-lg font-bold">{t.label}</span>
            <span className={cn("h-4 w-4 rounded-full border-2", track === t.key ? "border-primary bg-primary shadow-[inset_0_0_0_3px_var(--color-card)]" : "border-input")} aria-hidden="true" />
          </span>
          <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">{t.blurb}</span>
        </button>
      ))}
    </div>
  );
}
