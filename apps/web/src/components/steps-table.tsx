import type { Step } from "@taxgabay/tax-engine";
import { peso } from "@taxgabay/tax-engine";

/** The explainable breakdown every calculator shows. */
export function StepsTable({ steps, caption = "How this was computed" }: { steps: readonly Step[]; caption?: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" data-testid="steps-table">
        <caption className="mb-2 text-left font-semibold">{caption}</caption>
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            <th scope="col" className="py-2 pr-3 font-medium">Step</th>
            <th scope="col" className="py-2 pr-3 font-medium">Formula</th>
            <th scope="col" className="py-2 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody>
          {steps.map((s, i) => (
            <tr key={i} className="border-b border-border/60 align-top">
              <td className="py-2 pr-3">
                <div className="font-medium">{s.label}</div>
                {s.legal_basis && <div className="mt-0.5 text-xs text-muted-foreground">Basis: {s.legal_basis}</div>}
              </td>
              <td className="py-2 pr-3 font-mono text-xs">{s.formula}</td>
              <td className="py-2 text-right font-mono tabular-nums">{peso(s.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
