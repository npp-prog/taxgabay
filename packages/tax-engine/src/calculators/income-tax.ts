import type { EightPercentValue, OsdValue } from "../data/tax-rules";
import { dec, max0, money, pct, peso, round2, type Dec, type MoneyInput } from "../money";
import { findRule } from "../rules";
import type { Bracket, CalcResult, ISODate, Step, TaxRule } from "../types";

export interface GraduatedTax {
  tax: Dec;
  bracket: Bracket;
  step: Step;
}

/** Tax on `taxable` under the graduated table in force on `on`. */
export function graduatedTax(taxable: MoneyInput, on: ISODate, rules: readonly TaxRule[]): GraduatedTax & { rule: TaxRule } {
  const rule = findRule<{ brackets: Bracket[] }>(rules, "income_tax.individual.graduated", on, {
    category: "individual",
  });
  const income = max0(round2(taxable));
  // Brackets are "over X but not over Y"; the first bracket also includes zero.
  const bracket = rule.value.brackets.find((b) => {
    const aboveFloor = income.greaterThan(b.over) || dec(b.over).isZero();
    const belowCeiling = b.not_over === null || income.lessThanOrEqualTo(b.not_over);
    return aboveFloor && belowCeiling;
  });
  /* c8 ignore next -- brackets are contiguous from 0 with an open top; validated in tests */
  if (!bracket) throw new Error(`No bracket for ${income.toString()} in ${rule.id}`);
  const excess = income.minus(bracket.over);
  const tax = round2(dec(bracket.base).plus(excess.times(bracket.rate)));
  const formula = dec(bracket.rate).isZero()
    ? `${peso(income)} is not over ${peso(bracket.not_over ?? "0")}: exempt`
    : `${peso(bracket.base)} + ${pct(bracket.rate)} × (${peso(income)} − ${peso(bracket.over)})`;
  return {
    tax,
    bracket,
    rule,
    step: { label: "Income tax at graduated rates", formula, amount: money(tax), legal_basis: rule.legal_basis },
  };
}

export interface IndividualIncomeTaxInput {
  taxable_year: number;
  /** Taxable compensation (after non-taxable benefits and mandatory contributions). */
  compensation_income?: MoneyInput;
  /** Gross sales or receipts, net of returns, allowances and discounts. */
  gross_sales_receipts?: MoneyInput;
  /** Other non-operating income from the business. */
  other_non_operating_income?: MoneyInput;
  /** Total itemized deductions, if the user wants that option compared. */
  itemized_deductions?: MoneyInput;
  vat_registered: boolean;
}

export type IncomeTaxOptionKey = "graduated_osd" | "graduated_itemized" | "eight_percent";

export interface OptionResult {
  key: IncomeTaxOptionKey;
  label: string;
  eligible: boolean;
  ineligible_reasons: string[];
  income_tax: string;
  percentage_tax: string;
  total_tax: string;
  steps: Step[];
}

export interface IndividualIncomeTaxResult {
  kind: "compensation_only" | "purely_self_employed" | "mixed_income";
  options: OptionResult[];
  /** Lowest total among eligible options (ties: the earlier option). */
  recommended: IncomeTaxOptionKey | null;
}

function step(label: string, formula: string, amount: MoneyInput, legal_basis: string | null): Step {
  return { label, formula, amount: money(amount), legal_basis };
}

/**
 * Annual income tax for an individual: graduated rates (OSD and, if given, itemized)
 * vs the 8% option, side by side. Includes percentage tax for non-VAT taxpayers on
 * graduated rates, since the 8% option is in lieu of it.
 */
export function computeIndividualIncomeTax(
  input: IndividualIncomeTaxInput,
  rules: readonly TaxRule[],
): CalcResult<IndividualIncomeTaxResult> {
  const on = `${input.taxable_year}-12-31`;
  const comp = max0(round2(input.compensation_income ?? 0));
  const gross = max0(round2(input.gross_sales_receipts ?? 0));
  const other = max0(round2(input.other_non_operating_income ?? 0));
  const hasBusiness = gross.plus(other).greaterThan(0);
  const kind: IndividualIncomeTaxResult["kind"] = !hasBusiness
    ? "compensation_only"
    : comp.isZero()
      ? "purely_self_employed"
      : "mixed_income";

  const rulesUsed = new Set<string>();
  const warnings: string[] = [];
  const commonSteps: Step[] = [];
  if (!comp.isZero()) {
    commonSteps.push(step("Taxable compensation income", "As entered", comp, null));
  }
  if (hasBusiness) {
    commonSteps.push(step("Gross sales/receipts", "As entered", gross, null));
    if (!other.isZero()) commonSteps.push(step("Other non-operating income", "As entered", other, null));
  }

  // Percentage tax (only relevant for non-VAT on graduated rates).
  let ptAmount = dec(0);
  const ptSteps: Step[] = [];
  if (hasBusiness && !input.vat_registered) {
    const pt = findRule<{ rate: string }>(rules, "percentage_tax.sec116", on);
    const jan1 = findRule<{ rate: string }>(rules, "percentage_tax.sec116", `${input.taxable_year}-01-01`);
    rulesUsed.add(pt.id);
    if (jan1.id !== pt.id) {
      rulesUsed.add(jan1.id);
      warnings.push(
        `The percentage tax rate changed during ${input.taxable_year}. This estimate uses the year-end rate of ${pct(pt.value.rate)}; use the quarterly percentage tax calculator for exact figures.`,
      );
    }
    ptAmount = round2(gross.times(pt.value.rate));
    ptSteps.push(
      step("Percentage tax (non-VAT)", `${pct(pt.value.rate)} × ${peso(gross)}`, ptAmount, pt.legal_basis),
    );
  }

  const options: OptionResult[] = [];

  const graduated = (key: IncomeTaxOptionKey, label: string, deduction: Dec, deductionStep: Step | null): OptionResult => {
    const steps: Step[] = [...commonSteps];
    let taxable = comp;
    if (hasBusiness) {
      if (deductionStep) steps.push(deductionStep);
      const bizTaxable = max0(gross.plus(other).minus(deduction));
      steps.push(
        step(
          "Taxable income from business",
          `${peso(gross)}${other.isZero() ? "" : ` + ${peso(other)}`} − ${peso(deduction)}`,
          bizTaxable,
          null,
        ),
      );
      taxable = comp.plus(bizTaxable);
      if (!comp.isZero()) {
        steps.push(step("Total taxable income", `${peso(comp)} + ${peso(bizTaxable)}`, taxable, null));
      }
    }
    const g = graduatedTax(taxable, on, rules);
    rulesUsed.add(g.rule.id);
    steps.push(g.step, ...ptSteps);
    const total = g.tax.plus(ptAmount);
    if (ptSteps.length) {
      steps.push(step("Total tax", `${peso(g.tax)} + ${peso(ptAmount)}`, total, null));
    }
    return {
      key,
      label,
      eligible: true,
      ineligible_reasons: [],
      income_tax: money(g.tax),
      percentage_tax: money(ptAmount),
      total_tax: money(total),
      steps,
    };
  };

  if (!hasBusiness) {
    options.push(graduated("graduated_osd", "Graduated rates", dec(0), null));
    return {
      result: { kind, options, recommended: "graduated_osd" },
      steps: options[0]!.steps,
      rules_used: [...rulesUsed],
      warnings,
    };
  }

  // Graduated with OSD
  const osd = findRule<OsdValue>(rules, "income_tax.individual.osd", on, { category: "individual" });
  rulesUsed.add(osd.id);
  const osdAmount = round2(gross.times(osd.value.rate));
  options.push(
    graduated(
      "graduated_osd",
      "Graduated rates with 40% OSD",
      osdAmount,
      step("Optional standard deduction (OSD)", `${pct(osd.value.rate)} × ${peso(gross)}`, osdAmount, osd.legal_basis),
    ),
  );

  // Graduated with itemized
  if (input.itemized_deductions !== undefined && String(input.itemized_deductions).trim() !== "") {
    const itemized = max0(round2(input.itemized_deductions));
    options.push(
      graduated(
        "graduated_itemized",
        "Graduated rates with itemized deductions",
        itemized,
        step("Itemized deductions", "As entered (must be supported by receipts and books)", itemized, "NIRC Sec. 34(A)–(K)"),
      ),
    );
  }

  // 8% option
  const eight = findRule<EightPercentValue>(rules, "income_tax.individual.eight_percent", on, {
    category: "individual",
  });
  rulesUsed.add(eight.id);
  const reasons: string[] = [];
  const grossPlusOther = gross.plus(other);
  if (input.vat_registered) reasons.push("Only non-VAT-registered taxpayers can use the 8% option.");
  if (grossPlusOther.greaterThan(eight.value.gross_threshold)) {
    reasons.push(
      `Gross sales/receipts and other non-operating income (${peso(grossPlusOther)}) exceed ${peso(eight.value.gross_threshold)}.`,
    );
  }
  const steps8: Step[] = [...commonSteps];
  let compTax = dec(0);
  if (!comp.isZero()) {
    const g = graduatedTax(comp, on, rules);
    rulesUsed.add(g.rule.id);
    compTax = g.tax;
    steps8.push({ ...g.step, label: "Income tax on compensation (graduated rates)" });
  }
  const reduction = kind === "purely_self_employed" ? dec(eight.value.purely_self_employed_deduction) : dec(0);
  const base8 = max0(grossPlusOther.minus(reduction));
  const bizTax8 = round2(base8.times(eight.value.rate));
  steps8.push(
    step(
      "Income tax on business at 8%",
      reduction.isZero()
        ? `${pct(eight.value.rate)} × ${peso(grossPlusOther)} (no ₱250,000 reduction for mixed-income earners)`
        : `${pct(eight.value.rate)} × (${peso(grossPlusOther)} − ${peso(reduction)})`,
      bizTax8,
      eight.legal_basis,
    ),
  );
  const total8 = compTax.plus(bizTax8);
  if (!comp.isZero()) {
    steps8.push(step("Total income tax", `${peso(compTax)} + ${peso(bizTax8)}`, total8, null));
  }
  steps8.push(step("Percentage tax", "Not due: the 8% rate is in lieu of percentage tax", 0, eight.legal_basis));
  options.push({
    key: "eight_percent",
    label: "8% on gross sales/receipts",
    eligible: reasons.length === 0,
    ineligible_reasons: reasons,
    income_tax: money(total8),
    percentage_tax: money(0),
    total_tax: money(total8),
    steps: steps8,
  });

  if (input.vat_registered) {
    warnings.push("VAT is not included in this comparison; it is computed separately on the VAT calculator.");
  }
  warnings.push(
    "The 8% option must be elected in the first quarterly return (or registration) of the year and is irrevocable for that year.",
  );

  let recommended: IncomeTaxOptionKey | null = null;
  let best: Dec | null = null;
  for (const o of options) {
    if (!o.eligible) continue;
    const t = dec(o.total_tax);
    if (best === null || t.lessThan(best)) {
      best = t;
      recommended = o.key;
    }
  }

  const rec = options.find((o) => o.key === recommended)!;
  return {
    result: { kind, options, recommended },
    steps: rec.steps,
    rules_used: [...rulesUsed],
    warnings,
  };
}
