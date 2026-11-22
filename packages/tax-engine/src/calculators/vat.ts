import { dec, max0, money, pct, peso, round2, type Dec, type MoneyInput } from "../money";
import { findRule } from "../rules";
import type { CalcResult, ISODate, Step, TaxRule } from "../types";

export interface VatSplit {
  net: Dec;
  vat: Dec;
  gross: Dec;
}

/** Splits an amount into net and VAT. `inclusive` = the amount already includes VAT. */
export function splitVat(amount: MoneyInput, rate: MoneyInput, inclusive: boolean): VatSplit {
  const a = round2(amount);
  const r = dec(rate);
  if (inclusive) {
    const net = round2(a.dividedBy(r.plus(1)));
    return { net, vat: a.minus(net), gross: a };
  }
  const vat = round2(a.times(r));
  return { net: a, vat, gross: a.plus(vat) };
}

export interface VatInput {
  /** Last day of the taxable quarter; picks the rate in force. */
  period_end: ISODate;
  vatable_sales: MoneyInput;
  sales_vat_inclusive: boolean;
  vatable_purchases: MoneyInput;
  purchases_vat_inclusive: boolean;
  /** Excess input tax carried over from the previous quarter. */
  input_tax_carried_over?: MoneyInput;
}

export interface VatResult {
  rate: string;
  output_vat: string;
  input_vat: string;
  vat_payable: string;
  excess_input_carried_forward: string;
}

export function computeVat(input: VatInput, rules: readonly TaxRule[]): CalcResult<VatResult> {
  const rule = findRule<{ rate: string }>(rules, "vat.rate", input.period_end);
  const rate = rule.value.rate;
  const sales = splitVat(max0(dec(input.vatable_sales)), rate, input.sales_vat_inclusive);
  const purchases = splitVat(max0(dec(input.vatable_purchases)), rate, input.purchases_vat_inclusive);
  const carried = max0(round2(input.input_tax_carried_over ?? 0));
  const totalInput = purchases.vat.plus(carried);
  const diff = sales.vat.minus(totalInput);
  const payable = max0(diff);
  const excess = diff.isNegative() ? diff.negated() : dec(0);

  const steps: Step[] = [];
  if (input.sales_vat_inclusive) {
    steps.push({
      label: "Sales net of VAT",
      formula: `${peso(sales.gross)} ÷ (1 + ${pct(rate)})`,
      amount: money(sales.net),
      legal_basis: rule.legal_basis,
    });
  }
  steps.push({
    label: "Output VAT",
    formula: input.sales_vat_inclusive
      ? `${peso(sales.gross)} − ${peso(sales.net)}`
      : `${pct(rate)} × ${peso(sales.net)}`,
    amount: money(sales.vat),
    legal_basis: rule.legal_basis,
  });
  steps.push({
    label: "Input VAT on purchases",
    formula: input.purchases_vat_inclusive
      ? `${peso(purchases.gross)} − ${peso(purchases.gross)} ÷ (1 + ${pct(rate)})`
      : `${pct(rate)} × ${peso(purchases.net)}`,
    amount: money(purchases.vat),
    legal_basis: "NIRC Sec. 110",
  });
  if (!carried.isZero()) {
    steps.push({ label: "Input VAT carried over", formula: "As entered", amount: money(carried), legal_basis: "NIRC Sec. 110(B)" });
  }
  steps.push({
    label: diff.isNegative() ? "Excess input VAT to carry forward" : "VAT payable",
    formula: `${peso(sales.vat)} − ${peso(totalInput)}`,
    amount: money(diff.isNegative() ? excess : payable),
    legal_basis: "NIRC Sec. 110(B)",
  });

  return {
    result: {
      rate: dec(rate).toString(),
      output_vat: money(sales.vat),
      input_vat: money(totalInput),
      vat_payable: money(payable),
      excess_input_carried_forward: money(excess),
    },
    steps,
    rules_used: [rule.id],
    warnings: [
      "Input VAT is creditable only if supported by valid VAT invoices. Zero-rated and exempt sales are not handled here.",
    ],
  };
}
