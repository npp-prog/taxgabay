import { dec, max0, money, pct, peso, round2, type MoneyInput } from "../money";
import { findRule } from "../rules";
import type { CalcResult, ISODate, TaxRule } from "../types";

export interface PercentageTaxInput {
  /** Last day of the taxable quarter; picks the rate in force. */
  period_end: ISODate;
  gross_sales_receipts: MoneyInput;
}

export interface PercentageTaxResult {
  rate: string;
  tax_due: string;
}

/** Quarterly percentage tax under NIRC Sec. 116. */
export function computePercentageTax(
  input: PercentageTaxInput,
  rules: readonly TaxRule[],
): CalcResult<PercentageTaxResult> {
  const gross = max0(round2(input.gross_sales_receipts));
  const rule = findRule<{ rate: string }>(rules, "percentage_tax.sec116", input.period_end);
  const tax = round2(gross.times(rule.value.rate));
  const warnings: string[] = [];
  const threshold = findRule<{ amount: string }>(rules, "vat.threshold", input.period_end);
  if (gross.greaterThan(threshold.value.amount)) {
    warnings.push(
      `Quarterly gross sales above ${peso(threshold.value.amount)} already exceed the VAT threshold for the year; VAT registration may be required.`,
    );
  }
  return {
    result: { rate: dec(rule.value.rate).toString(), tax_due: money(tax) },
    steps: [
      { label: "Gross sales/receipts for the quarter", formula: "As entered", amount: money(gross), legal_basis: null },
      {
        label: "Percentage tax due",
        formula: `${pct(rule.value.rate)} × ${peso(gross)}`,
        amount: money(tax),
        legal_basis: rule.legal_basis,
      },
    ],
    rules_used: [rule.id, threshold.id],
    warnings,
  };
}
