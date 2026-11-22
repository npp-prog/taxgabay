import { addDays } from "../dates";
import type { McitStartValue, RcitValue } from "../data/tax-rules-phase2";
import { dec, max0, money, pct, peso, round2, type MoneyInput } from "../money";
import { findRule } from "../rules";
import type { CalcResult, ISODate, Step, TaxRule } from "../types";

export interface CorporateIncomeTaxInput {
  /** Last day of the taxable year (calendar or fiscal). */
  taxable_year_end: ISODate;
  /** Year the corporation commenced business operations. */
  year_commenced: number;
  gross_sales: MoneyInput;
  cost_of_sales: MoneyInput;
  /** Other taxable income not subject to final tax. */
  other_income?: MoneyInput;
  /** Allowable itemized deductions. (The 40% OSD for corporations is not modeled.) */
  deductions: MoneyInput;
  /** Total assets excluding the land where the office, plant and equipment are situated. */
  total_assets_excl_land: MoneyInput;
}

export interface CorporateIncomeTaxResult {
  gross_income: string;
  taxable_income: string;
  rcit_rate: string;
  rcit: string;
  mcit_applies: boolean;
  mcit: string;
  tax_due: string;
  basis: "rcit" | "mcit";
}

export function computeCorporateIncomeTax(input: CorporateIncomeTaxInput, rules: readonly TaxRule[]): CalcResult<CorporateIncomeTaxResult> {
  const on = input.taxable_year_end;
  const warnings: string[] = [];
  const steps: Step[] = [];
  const sales = max0(round2(input.gross_sales));
  const cos = max0(round2(input.cost_of_sales));
  const other = max0(round2(input.other_income ?? 0));
  const grossIncome = sales.minus(cos).plus(other);
  steps.push({
    label: "Gross income",
    formula: `${peso(sales)} − ${peso(cos)}${other.isZero() ? "" : ` + ${peso(other)}`}`,
    amount: money(grossIncome),
    legal_basis: "NIRC Sec. 27(E)(4) (gross income for MCIT purposes)",
  });
  const deductions = max0(round2(input.deductions));
  const taxable = max0(grossIncome.minus(deductions));
  steps.push({ label: "Taxable income", formula: `${peso(grossIncome)} − ${peso(deductions)}`, amount: money(taxable), legal_basis: "NIRC Sec. 34" });

  const rcitRule = findRule<RcitValue>(rules, "corporate.rcit", on, { category: "corporation" });
  // First day of the taxable year = day after the previous year end.
  const yearStart = addDays(`${Number(on.slice(0, 4)) - 1}${on.slice(4)}`, 1);
  try {
    const startRule = findRule<RcitValue>(rules, "corporate.rcit", yearStart, { category: "corporation" });
    if (startRule.id !== rcitRule.id) {
      warnings.push("The corporate rate changed during this taxable year. This uses the rate in force at year end; a fiscal-year taxpayer may need to pro-rate.");
    }
  } catch {
    /* no earlier rule: nothing to compare */
  }
  const v = rcitRule.value;
  const assets = max0(round2(input.total_assets_excl_land));
  const reducedEligible =
    v.reduced !== null &&
    v.reduced_max_net_taxable_income !== null &&
    v.reduced_max_total_assets_excl_land !== null &&
    taxable.lessThanOrEqualTo(v.reduced_max_net_taxable_income) &&
    assets.lessThanOrEqualTo(v.reduced_max_total_assets_excl_land);
  const rate = reducedEligible ? v.reduced! : v.regular;
  const rcit = round2(taxable.times(rate));
  steps.push({
    label: reducedEligible ? "Regular corporate income tax (reduced rate)" : "Regular corporate income tax",
    formula: `${pct(rate)} × ${peso(taxable)}${
      reducedEligible
        ? ` (taxable income ≤ ${peso(v.reduced_max_net_taxable_income!)} and assets ≤ ${peso(v.reduced_max_total_assets_excl_land!)})`
        : ""
    }`,
    amount: money(rcit),
    legal_basis: rcitRule.legal_basis,
  });
  if (v.reduced !== null && !reducedEligible) {
    warnings.push(`The reduced ${pct(v.reduced)} rate needs taxable income of ${peso(v.reduced_max_net_taxable_income!)} or less and total assets (excluding land) of ${peso(v.reduced_max_total_assets_excl_land!)} or less.`);
  }

  const start = findRule<McitStartValue>(rules, "corporate.mcit_start", on, { category: "corporation" });
  const firstMcitYear = input.year_commenced + start.value.years_after_commencement;
  const taxYear = Number(on.slice(0, 4));
  const mcitApplies = taxYear >= firstMcitYear;
  const mcitRule = findRule<{ rate: string }>(rules, "corporate.mcit", on, { category: "corporation" });
  const mcit = mcitApplies ? round2(max0(grossIncome).times(mcitRule.value.rate)) : dec(0);
  steps.push({
    label: "Minimum corporate income tax (MCIT)",
    formula: mcitApplies
      ? `${pct(mcitRule.value.rate)} × ${peso(max0(grossIncome))}`
      : `Not yet applicable: MCIT starts in taxable year ${firstMcitYear} (operations began ${input.year_commenced})`,
    amount: money(mcit),
    legal_basis: mcitApplies ? mcitRule.legal_basis : start.legal_basis,
  });

  const basis = mcit.greaterThan(rcit) ? "mcit" : "rcit";
  const due = basis === "mcit" ? mcit : rcit;
  steps.push({
    label: "Income tax due (higher of RCIT and MCIT)",
    formula: `max(${peso(rcit)}, ${peso(mcit)})`,
    amount: money(due),
    legal_basis: "NIRC Sec. 27(E)(1)",
  });
  if (basis === "mcit") {
    warnings.push("The excess of MCIT over RCIT can be carried forward and credited against RCIT in the next three years.");
  }

  return {
    result: {
      gross_income: money(grossIncome),
      taxable_income: money(taxable),
      rcit_rate: dec(rate).toString(),
      rcit: money(rcit),
      mcit_applies: mcitApplies,
      mcit: money(mcit),
      tax_due: money(due),
      basis,
    },
    steps,
    rules_used: [rcitRule.id, start.id, mcitRule.id],
    warnings,
  };
}
