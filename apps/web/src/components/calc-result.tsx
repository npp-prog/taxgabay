"use client";

import { peso, type Step } from "@taxgabay/tax-engine";
import { Disclaimer, DISCLAIMER_TEXT } from "@/components/disclaimer";
import { PdfButton } from "@/components/pdf-button";
import { slugifyFilename, stepsToTable, type PdfBlock } from "@/lib/pdf";
import { todayPH } from "@/lib/utils";
import { StepsTable } from "@/components/steps-table";
import { verificationFor } from "@/lib/rules";

export function CalcResultPanel({
  headline,
  steps,
  rulesUsed,
  warnings,
  children,
  pdfTitle,
  pdfHeadline,
  pdfInputs,
}: {
  headline: React.ReactNode;
  steps: readonly Step[];
  rulesUsed: readonly string[];
  warnings: readonly string[];
  children?: React.ReactNode;
  /** When set, a "Download PDF" button exports this result. */
  pdfTitle?: string;
  /** Plain-text version of the headline for the PDF. */
  pdfHeadline?: string;
  /** What the user entered, as label/value pairs. */
  pdfInputs?: [string, string][];
}) {
  const v = verificationFor(rulesUsed);
  const buildDoc = () => {
    const today = todayPH();
    const blocks: PdfBlock[] = [];
    if (pdfInputs?.length) blocks.push({ kind: "heading", text: "What you entered" }, { kind: "keyValue", rows: pdfInputs });
    blocks.push({ kind: "heading", text: "Result" });
    if (pdfHeadline) blocks.push({ kind: "paragraph", text: pdfHeadline });
    blocks.push(stepsToTable(steps));
    for (const w of warnings) blocks.push({ kind: "paragraph", text: `Note: ${w}` });
    blocks.push(
      { kind: "heading", text: "Disclaimer" },
      { kind: "paragraph", text: DISCLAIMER_TEXT },
      { kind: "paragraph", text: v.lastVerified ? `Verified by Neil Priolo, CPA on ${v.lastVerified}.` : "Not yet verified — the rates and dates are seed data awaiting review by Neil Priolo, CPA." },
    );
    return { title: pdfTitle!, subtitle: `Computed on ${today}`, generatedOn: today, blocks };
  };
  return (
    <section aria-live="polite" aria-label="Result" className="space-y-5" data-testid="calc-result">
      <div className="form-box relative flex flex-wrap items-end justify-between gap-4 overflow-hidden p-5 pl-6">
        <span className="absolute inset-y-0 left-0 w-1.5 bg-sun" aria-hidden="true" />
        <div className="min-w-0 [&_[data-testid=headline-amount]]:mt-1 [&_[data-testid=headline-amount]]:block [&_[data-testid=headline-amount]]:font-mono [&_[data-testid=headline-amount]]:text-3xl [&_[data-testid=headline-amount]]:font-bold [&_[data-testid=headline-amount]]:tracking-tight [&_[data-testid=headline-amount]]:tabular-nums sm:[&_[data-testid=headline-amount]]:text-4xl">
          {headline}
        </div>
        {pdfTitle && <PdfButton filename={slugifyFilename(pdfTitle)} build={buildDoc} />}
      </div>
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

/** Formats an entered amount for PDF inputs ("—" when blank). */
export function pdfMoney(v: string): string {
  return v.trim() ? peso(v) : "—";
}
