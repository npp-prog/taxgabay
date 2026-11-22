import { applyBrackets } from "../brackets";
import type { CompensationTableValue, DeMinimisItem, EwtAtcValue } from "../data/tax-rules-phase2";
import { dec, max0, money, pct, peso, round2, type MoneyInput } from "../money";
import { findRule, inForce } from "../rules";
import type { CalcResult, ISODate, Step, TaxRule } from "../types";
import { graduatedTax } from "./income-tax";
import { splitVat } from "./vat";

export type PayrollPeriod = CompensationTableValue["period"];

export interface CompensationWithholdingInput {
  period: PayrollPeriod;
  /** Payroll date; picks the table in force. */
  pay_date: ISODate;
  gross_compensation: MoneyInput;
  /** Employee share of SSS, PhilHealth, Pag-IBIG and union dues. */
  mandatory_contributions?: MoneyInput;
  /** De minimis benefits and other non-taxable pay included in gross, within ceilings. */
  non_taxable_compensation?: MoneyInput;
}

export interface CompensationWithholdingResult {
  taxable_compensation: string;
  withholding_tax: string;
}

const PERIOD_LABEL: Record<PayrollPeriod, string> = { monthly: "monthly", semi_monthly: "semi-monthly", weekly: "weekly", daily: "daily" };

/** Tax to withhold for one payroll period, from the revised withholding tax table. */
export function computeCompensationWithholding(input: CompensationWithholdingInput, rules: readonly TaxRule[]): CalcResult<CompensationWithholdingResult> {
  const table = findRule<CompensationTableValue>(rules, `withholding.compensation.${input.period}`, input.pay_date, { category: "individual" });
  const gross = max0(round2(input.gross_compensation));
  const contrib = max0(round2(input.mandatory_contributions ?? 0));
  const nonTax = max0(round2(input.non_taxable_compensation ?? 0));
  const taxable = max0(gross.minus(contrib).minus(nonTax));
  const { tax, formula } = applyBrackets(table.value.brackets, taxable);
  const steps: Step[] = [
    { label: "Gross compensation for the period", formula: "As entered", amount: money(gross), legal_basis: null },
    { label: "Less mandatory contributions and non-taxable pay", formula: `${peso(contrib)} + ${peso(nonTax)}`, amount: money(contrib.plus(nonTax)), legal_basis: "NIRC Sec. 32(B)(7)(f); RR 2-98 Sec. 2.78.1" },
    { label: "Taxable compensation", formula: `${peso(gross)} − ${peso(contrib.plus(nonTax))}`, amount: money(taxable), legal_basis: null },
    { label: `Withholding tax (${PERIOD_LABEL[input.period]} table)`, formula, amount: money(tax), legal_basis: table.legal_basis },
  ];
  return {
    result: { taxable_compensation: money(taxable), withholding_tax: money(tax) },
    steps,
    rules_used: [table.id],
    warnings: ["Minimum wage earners are exempt on their statutory minimum wage, holiday, overtime, night-shift and hazard pay; this calculator does not apply that exemption."],
  };
}

export interface AnnualCompensationInput {
  taxable_year: number;
  /** Basic pay and taxable allowances for the year, excluding 13th month and other benefits. */
  gross_compensation: MoneyInput;
  mandatory_contributions?: MoneyInput;
  /** 13th month pay and other benefits (bonuses, etc.). */
  thirteenth_month_and_other_benefits?: MoneyInput;
  /** De minimis benefits within the ceilings. */
  de_minimis?: MoneyInput;
  /** Tax already withheld during the year. */
  tax_withheld?: MoneyInput;
}

export interface AnnualCompensationResult {
  taxable_compensation: string;
  annual_tax: string;
  tax_withheld: string;
  /** Positive = still to withhold/pay; negative = refund due to employee. */
  balance: string;
}

/** Year-end annualization of compensation income tax. */
export function computeAnnualCompensationTax(input: AnnualCompensationInput, rules: readonly TaxRule[]): CalcResult<AnnualCompensationResult> {
  const on = `${input.taxable_year}-12-31`;
  const excl = findRule<{ amount: string }>(rules, "withholding.compensation.benefits_exclusion", on, { category: "individual" });
  const gross = max0(round2(input.gross_compensation));
  const contrib = max0(round2(input.mandatory_contributions ?? 0));
  const benefits = max0(round2(input.thirteenth_month_and_other_benefits ?? 0));
  const deMin = max0(round2(input.de_minimis ?? 0));
  const withheld = max0(round2(input.tax_withheld ?? 0));
  const taxableBenefits = max0(benefits.minus(excl.value.amount));
  const taxable = max0(gross.minus(contrib)).plus(taxableBenefits);
  const g = graduatedTax(taxable, on, rules);
  const balance = g.tax.minus(withheld);
  const steps: Step[] = [
    { label: "Basic pay and taxable allowances", formula: "As entered (excluding 13th month, other benefits and de minimis)", amount: money(gross), legal_basis: null },
    { label: "Less mandatory contributions", formula: "Employee share of SSS, PhilHealth, Pag-IBIG, union dues", amount: money(contrib), legal_basis: "NIRC Sec. 32(B)(7)(f)" },
    {
      label: "Taxable portion of 13th month and other benefits",
      formula: `max(0, ${peso(benefits)} − ${peso(excl.value.amount)})`,
      amount: money(taxableBenefits),
      legal_basis: excl.legal_basis,
    },
    { label: "De minimis benefits (not taxable)", formula: "Excluded within ceilings", amount: money(deMin), legal_basis: "RR 2-98 Sec. 2.78.1(A)(3), as amended" },
    { label: "Taxable compensation", formula: `${peso(gross)} − ${peso(contrib)} + ${peso(taxableBenefits)}`, amount: money(taxable), legal_basis: null },
    { ...g.step, label: "Annual income tax on compensation" },
    { label: "Less tax withheld during the year", formula: "As entered", amount: money(withheld), legal_basis: null },
    {
      label: balance.isNegative() ? "Over-withheld: refund to employee" : "Balance to withhold",
      formula: `${peso(g.tax)} − ${peso(withheld)}`,
      amount: money(balance.abs()),
      legal_basis: "RR 2-98 Sec. 2.79(B)(5) (year-end adjustment)",
    },
  ];
  return {
    result: { taxable_compensation: money(taxable), annual_tax: money(g.tax), tax_withheld: money(withheld), balance: money(balance) },
    steps,
    rules_used: [excl.id, g.rule.id],
    warnings: [],
  };
}

export function deMinimisCeilings(rules: readonly TaxRule[], on: ISODate): { items: DeMinimisItem[]; rule_id: string; legal_basis: string } {
  const r = findRule<{ items: DeMinimisItem[] }>(rules, "withholding.compensation.de_minimis", on, { category: "individual" });
  return { items: r.value.items, rule_id: r.id, legal_basis: r.legal_basis };
}

/** ATCs in force on a date, sorted by code. */
export function listAtcs(rules: readonly TaxRule[], on: ISODate): (EwtAtcValue & { rule_id: string })[] {
  return rules
    .filter((r) => r.rule_key.startsWith("ewt.atc.") && inForce(r, on))
    .map((r) => ({ ...(r.value as EwtAtcValue), rule_id: r.id }))
    .sort((a, b) => a.atc.localeCompare(b.atc));
}

export interface EwtInput {
  atc: string;
  payment_date: ISODate;
  amount: MoneyInput;
  /** Amount includes 12% VAT (payee is VAT-registered); EWT is computed on the amount net of VAT. */
  vat_inclusive: boolean;
}

export interface EwtResult {
  tax_base: string;
  rate: string;
  ewt: string;
  net_payment: string;
}

export function computeEwt(input: EwtInput, rules: readonly TaxRule[]): CalcResult<EwtResult> {
  const r = findRule<EwtAtcValue>(rules, `ewt.atc.${input.atc}`, input.payment_date);
  const amount = max0(round2(input.amount));
  const steps: Step[] = [{ label: "Amount of the payment", formula: "As entered", amount: money(amount), legal_basis: null }];
  const rulesUsed = [r.id];
  let base = amount;
  if (input.vat_inclusive) {
    const vat = findRule<{ rate: string }>(rules, "vat.rate", input.payment_date);
    rulesUsed.push(vat.id);
    base = splitVat(amount, vat.value.rate, true).net;
    steps.push({ label: "Tax base (net of VAT)", formula: `${peso(amount)} ÷ (1 + ${pct(vat.value.rate)})`, amount: money(base), legal_basis: "RR 2-98 Sec. 2.57.2 (EWT base excludes VAT)" });
  }
  const ewt = round2(base.times(r.value.rate));
  steps.push({ label: `Expanded withholding tax (${r.value.atc})`, formula: `${pct(r.value.rate)} × ${peso(base)}`, amount: money(ewt), legal_basis: r.legal_basis });
  steps.push({ label: "Net amount to pay the payee", formula: `${peso(amount)} − ${peso(ewt)}`, amount: money(amount.minus(ewt)), legal_basis: null });
  return {
    result: { tax_base: money(base), rate: dec(r.value.rate).toString(), ewt: money(ewt), net_payment: money(amount.minus(ewt)) },
    steps,
    rules_used: rulesUsed,
    warnings: ["Issue BIR Form 2307 to the payee and remit using 0619E (months 1–2) or 1601EQ (quarter)."],
  };
}
