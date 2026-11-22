"use client";

import type { Step } from "@taxgabay/tax-engine";
import { Disclaimer } from "@/components/disclaimer";
import { StepsTable } from "@/components/steps-table";
import { verificationFor } from "@/lib/rules";

export function CalcResultPanel({
  headline,
  steps,
  rulesUsed,
  warnings,
  children,
}: {
  headline: React.ReactNode;
  steps: readonly Step[];
  rulesUsed: readonly string[];
  warnings: readonly string[];
  children?: React.ReactNode;
}) {
  const v = verificationFor(rulesUsed);
  return (
    <section aria-live="polite" aria-label="Result" className="space-y-5" data-testid="calc-result">
      <div className="rounded-lg bg-secondary p-4 text-secondary-foreground">{headline}</div>
      {children}
      <div data-testid="main-steps">
        <StepsTable steps={steps} />
      </div>
      {warnings.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
      <Disclaimer lastVerified={v.lastVerified} />
    </section>
  );
}

export function CalcError({ message }: { message: string }) {
  return (
    <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
      {message}
    </p>
  );
}

const AMOUNT_RE = /^\d{1,13}(,\d{3})*(\.\d{0,2})?$|^\d+(\.\d{0,2})?$/;

export function isAmount(s: string): boolean {
  return s.trim() === "" || AMOUNT_RE.test(s.trim());
}
