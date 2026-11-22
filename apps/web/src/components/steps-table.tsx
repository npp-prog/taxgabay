import type { Step } from "@taxgabay/tax-engine";
import { peso } from "@taxgabay/tax-engine";

const RESULT_LABEL = /total|due|payable|balance|refund|carry forward|net taxable/i;

/**
 * The explainable breakdown every calculator shows, laid out like the numbered lines
 * of a BIR return: line number, description with legal basis, computation, amount.
 * A final result line is set as a total.
 */
export function StepsTable({ steps, caption = "How this was computed" }: { steps: readonly Step[]; caption?: string }) {
  return (
    <div className="overflow-x-auto rounded-md border border-border bg-card">
      <table className="w-full text-sm" data-testid="steps-table">
        <caption className="border-b border-border px-4 py-2.5 text-left">
          <span className="form-label">{caption}</span>
        </caption>
        <thead className="sr-only">
          <tr>
            <th scope="col">Line</th>
            <th scope="col">Step</th>
            <th scope="col">Formula</th>
            <th scope="col">Amount</th>
          </tr>
        </thead>
        <tbody>
          {steps.map((s, i) => {
            // Only a final line that is a result ("Total…", "…due", "…payable") is set as a total.
            const last = i === steps.length - 1 && RESULT_LABEL.test(s.label);
            return (
              <tr key={i} className={last ? "border-t-2 border-ink bg-muted/60" : "border-t border-dashed border-border first:border-t-0"}>
                <td className="w-10 py-3 pl-4 pr-2 align-top font-mono text-[0.7rem] font-semibold text-muted-foreground tabular-nums">{String(i + 1).padStart(2, "0")}</td>
                <td className="py-3 pr-4 align-top">
                  <div className={last ? "font-semibold" : "font-medium"}>{s.label}</div>
                  <div className="mt-1 font-mono text-[0.72rem] leading-relaxed text-muted-foreground">{s.formula}</div>
                  {s.legal_basis && <div className="mt-1 text-xs text-muted-foreground/90">Basis: {s.legal_basis}</div>}
                </td>
                <td className={`whitespace-nowrap py-3 pr-4 text-right align-top font-mono tabular-nums ${last ? "text-base font-bold" : ""}`}>{peso(s.amount)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
