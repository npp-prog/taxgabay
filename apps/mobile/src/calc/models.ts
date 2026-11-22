import {
  computeIndividualIncomeTax,
  computePenalty,
  computePercentageTax,
  computeVat,
  endOfMonth,
  peso,
  taxRules,
  type Step,
} from "@taxgabay/tax-engine";

/**
 * Calculator view models: validate raw text inputs, call tax-engine, and return what a
 * screen renders. All money math stays in tax-engine (decimal.js).
 */

export interface CalcView {
  headline: string;
  subline?: string;
  steps: Step[];
  warnings: string[];
  verified: boolean;
  extra?: { label: string; value: string; note?: string }[];
}

export type CalcOutcome = { ok: true; view: CalcView } | { ok: false; error: string };

const AMOUNT = /^\d{1,13}(\.\d{1,2})?$/;

/** Accepts "250000", "250,000", "250,000.50"; empty counts as missing. */
export function parseAmount(s: string): string | null {
  const t = s.replace(/,/g, "").trim();
  return AMOUNT.test(t) ? t : null;
}

function verifiedFor(ids: readonly string[]): boolean {
  const used = taxRules.filter((r) => ids.includes(r.id));
  return used.length > 0 && used.every((r) => !r.needs_verification && r.last_verified_at);
}

export function runIncomeTax(input: { year: number; gross: string; comp: string; itemized: string; vat: boolean }): CalcOutcome {
  const gross = input.gross.trim() ? parseAmount(input.gross) : "0";
  const comp = input.comp.trim() ? parseAmount(input.comp) : "0";
  const itemized = input.itemized.trim() ? parseAmount(input.itemized) : undefined;
  if (gross === null || comp === null || itemized === null) return { ok: false, error: "Enter amounts like 250000 or 250,000.50." };
  if (gross === "0" && comp === "0") return { ok: false, error: "Enter gross sales/receipts, compensation income, or both." };
  try {
    const r = computeIndividualIncomeTax(
      { taxable_year: input.year, gross_sales_receipts: gross, compensation_income: comp, itemized_deductions: itemized, vat_registered: input.vat },
      taxRules,
    );
    const rec = r.result.options.find((o) => o.key === r.result.recommended);
    return {
      ok: true,
      view: {
        headline: rec ? peso(rec.total_tax) : "No eligible option",
        subline: rec ? `Lowest total tax, with ${rec.label.toLowerCase()}` : undefined,
        steps: r.steps,
        warnings: r.warnings,
        verified: verifiedFor(r.rules_used),
        extra: r.result.options.map((o) => ({
          label: o.label,
          value: o.eligible ? peso(o.total_tax) : "Not eligible",
          note: o.eligible ? (o.percentage_tax !== "0.00" ? `Includes percentage tax ${peso(o.percentage_tax)}` : undefined) : o.ineligible_reasons.join(" "),
        })),
      },
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export function runPercentageTax(input: { year: number; quarter: number; gross: string }): CalcOutcome {
  const gross = parseAmount(input.gross);
  if (gross === null) return { ok: false, error: "Enter your gross sales or receipts for the quarter." };
  try {
    const r = computePercentageTax({ period_end: endOfMonth(input.year, input.quarter * 3), gross_sales_receipts: gross }, taxRules);
    return { ok: true, view: { headline: peso(r.result.tax_due), subline: "Percentage tax due", steps: r.steps, warnings: r.warnings, verified: verifiedFor(r.rules_used) } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export function runVat(input: { year: number; quarter: number; sales: string; salesInclusive: boolean; purchases: string; purchasesInclusive: boolean; carried: string }): CalcOutcome {
  const sales = parseAmount(input.sales);
  const purchases = input.purchases.trim() ? parseAmount(input.purchases) : "0";
  const carried = input.carried.trim() ? parseAmount(input.carried) : "0";
  if (sales === null || purchases === null || carried === null) return { ok: false, error: "Enter your vatable sales and check the amounts." };
  try {
    const r = computeVat(
      {
        period_end: endOfMonth(input.year, input.quarter * 3),
        vatable_sales: sales,
        sales_vat_inclusive: input.salesInclusive,
        vatable_purchases: purchases,
        purchases_vat_inclusive: input.purchasesInclusive,
        input_tax_carried_over: carried,
      },
      taxRules,
    );
    const payable = r.result.vat_payable !== "0.00";
    return {
      ok: true,
      view: {
        headline: peso(payable ? r.result.vat_payable : r.result.excess_input_carried_forward),
        subline: payable ? "VAT payable" : "Excess input VAT to carry forward",
        steps: r.steps,
        warnings: r.warnings,
        verified: verifiedFor(r.rules_used),
      },
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function runPenalty(input: {
  due: string;
  paid: string;
  basic: string;
  size: "micro" | "small" | "medium" | "large";
  lateFiling: boolean;
  latePayment: boolean;
  willful: boolean;
  compromise: boolean;
}): CalcOutcome {
  if (!ISO.test(input.due) || !ISO.test(input.paid)) return { ok: false, error: "Enter dates as YYYY-MM-DD." };
  if (input.paid < input.due) return { ok: false, error: "The payment date is before the due date — no penalty applies." };
  const basic = parseAmount(input.basic);
  if (basic === null) return { ok: false, error: "Enter the basic tax due." };
  try {
    const r = computePenalty(
      {
        due_date: input.due,
        payment_date: input.paid,
        basic_tax_due: basic,
        taxpayer_size: input.size,
        late_filing: input.lateFiling,
        late_payment: input.latePayment,
        willful: input.willful,
        include_compromise: input.compromise,
      },
      taxRules,
    );
    return {
      ok: true,
      view: {
        headline: peso(r.result.total_amount_due),
        subline: `Total amount due (${r.result.days_late} day${r.result.days_late === 1 ? "" : "s"} late) · penalties ${peso(r.result.total_penalties)}`,
        steps: r.steps,
        warnings: r.warnings,
        verified: verifiedFor(r.rules_used),
      },
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
