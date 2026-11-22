import { cn } from "@/lib/utils";

export const DISCLAIMER_TEXT = "For guidance only. Verify with BIR issuances or consult a CPA.";

export function Disclaimer({ lastVerified, className }: { lastVerified: string | null; className?: string }) {
  return (
    <aside
      role="note"
      aria-label="Disclaimer"
      data-testid="disclaimer"
      className={cn("rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-warning-foreground", className)}
    >
      <p className="font-medium">{DISCLAIMER_TEXT}</p>
      <p className="mt-1">
        {lastVerified
          ? `Last verified: ${lastVerified}.`
          : "Last verified: not yet — the rates and dates here are seed data awaiting CPA review."}
      </p>
    </aside>
  );
}
