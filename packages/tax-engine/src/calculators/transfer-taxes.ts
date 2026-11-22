import { perUnitOrFraction } from "../brackets";
import { dec, max0, money, pct, peso, round2, type MoneyInput } from "../money";
import { findRule } from "../rules";
import type { CalcResult, ISODate, Step, TaxRule } from "../types";

// ---------- Estate tax ----------

export interface EstateTaxInput {
  date_of_death: ISODate;
  /** Exclusive (separate) property of the decedent, at fair market value at death. */
  exclusive_property: MoneyInput;
  /** Conjugal/community property, at fair market value at death (include the family home if conjugal). */
  conjugal_property?: MoneyInput;
  /** Ordinary deductions charged to exclusive property (claims, unpaid mortgages, losses…). */
  exclusive_deductions?: MoneyInput;
  /** Ordinary deductions charged to conjugal/community property. */
  conjugal_deductions?: MoneyInput;
  /** Fair market value of the family home (whole property). */
  family_home_value?: MoneyInput;
  family_home_is_conjugal?: boolean;
}

export interface EstateTaxResult {
  gross_estate: string;
  net_taxable_estate: string;
  estate_tax: string;
}

export function computeEstateTax(input: EstateTaxInput, rules: readonly TaxRule[]): CalcResult<EstateTaxResult> {
  const r = findRule<{ rate: string; standard_deduction: string; family_home_cap: string }>(rules, "estate.tax", input.date_of_death, { category: "individual" });
  const excl = max0(round2(input.exclusive_property));
  const conj = max0(round2(input.conjugal_property ?? 0));
  const exclDed = max0(round2(input.exclusive_deductions ?? 0));
  const conjDed = max0(round2(input.conjugal_deductions ?? 0));
  const fh = max0(round2(input.family_home_value ?? 0));
  const gross = excl.plus(conj);
  const ordinary = exclDed.plus(conjDed);
  const fhShare = input.family_home_is_conjugal ? round2(fh.dividedBy(2)) : fh;
  const fhDeduction = fhShare.greaterThan(r.value.family_home_cap) ? dec(r.value.family_home_cap) : fhShare;
  const standard = dec(r.value.standard_deduction);
  const spouseShare = round2(max0(conj.minus(conjDed)).dividedBy(2));
  const net = max0(gross.minus(ordinary).minus(standard).minus(fhDeduction).minus(spouseShare));
  const tax = round2(net.times(r.value.rate));
  const steps: Step[] = [
    { label: "Gross estate", formula: `${peso(excl)} exclusive + ${peso(conj)} conjugal/community`, amount: money(gross), legal_basis: "NIRC Secs. 85 and 88" },
    { label: "Less ordinary deductions", formula: `${peso(exclDed)} + ${peso(conjDed)}`, amount: money(ordinary), legal_basis: "NIRC Sec. 86(A)(1), as amended by RA 10963" },
    { label: "Less standard deduction", formula: "Fixed amount", amount: money(standard), legal_basis: r.legal_basis },
    {
      label: "Less family home",
      formula: `min(${peso(fhShare)}${input.family_home_is_conjugal ? " (half of the conjugal home)" : ""}, ${peso(r.value.family_home_cap)})`,
      amount: money(fhDeduction),
      legal_basis: "NIRC Sec. 86(A)(4), as amended by RA 10963",
    },
    { label: "Less net share of the surviving spouse", formula: `(${peso(conj)} − ${peso(conjDed)}) ÷ 2`, amount: money(spouseShare), legal_basis: "NIRC Sec. 86(C)" },
    { label: "Net taxable estate", formula: "Gross estate less all deductions (not below zero)", amount: money(net), legal_basis: null },
    { label: "Estate tax due", formula: `${pct(r.value.rate)} × ${peso(net)}`, amount: money(tax), legal_basis: r.legal_basis },
  ];
  return {
    result: { gross_estate: money(gross), net_taxable_estate: money(net), estate_tax: money(tax) },
    steps,
    rules_used: [r.id],
    warnings: [
      "File BIR Form 1801 within one year from the date of death (extensions possible). This calculator covers citizens and residents only.",
      "Values must be the fair market value at the time of death: the higher of the BIR zonal value and the assessor's value for real property.",
    ],
  };
}

// ---------- Donor's tax ----------

export interface DonorsTaxInput {
  date_of_gift: ISODate;
  /** This gift, net of exempt gifts. */
  gift_amount: MoneyInput;
  /** Earlier taxable gifts in the same calendar year. */
  prior_gifts_this_year?: MoneyInput;
  /** Donor's tax already paid on those earlier gifts. */
  prior_tax_paid_this_year?: MoneyInput;
}

export interface DonorsTaxResult {
  total_gifts_this_year: string;
  tax_on_total: string;
  donors_tax_due: string;
}

export function computeDonorsTax(input: DonorsTaxInput, rules: readonly TaxRule[]): CalcResult<DonorsTaxResult> {
  const r = findRule<{ rate: string; annual_exemption: string }>(rules, "donors.tax", input.date_of_gift);
  const gift = max0(round2(input.gift_amount));
  const prior = max0(round2(input.prior_gifts_this_year ?? 0));
  const paid = max0(round2(input.prior_tax_paid_this_year ?? 0));
  const total = gift.plus(prior);
  const taxable = max0(total.minus(r.value.annual_exemption));
  const taxOnTotal = round2(taxable.times(r.value.rate));
  const due = max0(taxOnTotal.minus(paid));
  return {
    result: { total_gifts_this_year: money(total), tax_on_total: money(taxOnTotal), donors_tax_due: money(due) },
    steps: [
      { label: "This gift", formula: "As entered (net of exempt gifts)", amount: money(gift), legal_basis: null },
      { label: "Total gifts this calendar year", formula: `${peso(gift)} + ${peso(prior)} earlier`, amount: money(total), legal_basis: "NIRC Sec. 99(A) (cumulative within the calendar year)" },
      { label: "Taxable gifts", formula: `${peso(total)} − ${peso(r.value.annual_exemption)} exempt`, amount: money(taxable), legal_basis: r.legal_basis },
      { label: "Donor's tax on total gifts", formula: `${pct(r.value.rate)} × ${peso(taxable)}`, amount: money(taxOnTotal), legal_basis: r.legal_basis },
      { label: "Donor's tax due on this gift", formula: `${peso(taxOnTotal)} − ${peso(paid)} already paid`, amount: money(due), legal_basis: r.legal_basis },
    ],
    rules_used: [r.id],
    warnings: ["File BIR Form 1800 within 30 days after the date of the gift."],
  };
}

// ---------- Capital gains tax ----------

export interface CgtRealPropertyInput {
  date_of_sale: ISODate;
  gross_selling_price: MoneyInput;
  zonal_value: MoneyInput;
  assessor_fair_market_value: MoneyInput;
}

export interface CgtResult {
  tax_base: string;
  capital_gains_tax: string;
}

export function computeCgtRealProperty(input: CgtRealPropertyInput, rules: readonly TaxRule[]): CalcResult<CgtResult> {
  const r = findRule<{ rate: string }>(rules, "cgt.real_property", input.date_of_sale);
  const candidates = [
    { label: "gross selling price", v: max0(round2(input.gross_selling_price)) },
    { label: "BIR zonal value", v: max0(round2(input.zonal_value)) },
    { label: "assessor's fair market value", v: max0(round2(input.assessor_fair_market_value)) },
  ];
  const top = candidates.reduce((a, c) => (c.v.greaterThan(a.v) ? c : a));
  const tax = round2(top.v.times(r.value.rate));
  return {
    result: { tax_base: money(top.v), capital_gains_tax: money(tax) },
    steps: [
      { label: "Tax base (highest value)", formula: `max(${candidates.map((c) => peso(c.v)).join(", ")}) — the ${top.label}`, amount: money(top.v), legal_basis: "NIRC Sec. 24(D)(1); Sec. 6(E)" },
      { label: "Capital gains tax", formula: `${pct(r.value.rate)} × ${peso(top.v)}`, amount: money(tax), legal_basis: r.legal_basis },
    ],
    rules_used: [r.id],
    warnings: ["Applies to real property held as a capital asset. File BIR Form 1706 within 30 days after the sale."],
  };
}

export interface CgtSharesInput {
  date_of_sale: ISODate;
  selling_price: MoneyInput;
  cost_basis: MoneyInput;
  selling_expenses?: MoneyInput;
}

export function computeCgtUnlistedShares(input: CgtSharesInput, rules: readonly TaxRule[]): CalcResult<CgtResult> {
  const r = findRule<{ rate: string }>(rules, "cgt.unlisted_shares", input.date_of_sale);
  const price = max0(round2(input.selling_price));
  const cost = max0(round2(input.cost_basis));
  const exp = max0(round2(input.selling_expenses ?? 0));
  const gain = max0(price.minus(cost).minus(exp));
  const tax = round2(gain.times(r.value.rate));
  return {
    result: { tax_base: money(gain), capital_gains_tax: money(tax) },
    steps: [
      { label: "Net capital gain", formula: `${peso(price)} − ${peso(cost)} − ${peso(exp)}`, amount: money(gain), legal_basis: "NIRC Sec. 24(C)" },
      { label: "Capital gains tax", formula: `${pct(r.value.rate)} × ${peso(gain)}`, amount: money(tax), legal_basis: r.legal_basis },
    ],
    rules_used: [r.id],
    warnings: [
      "The selling price must not be lower than the fair market value of the shares (adjusted net asset value); a shortfall is treated as a gift.",
      "File BIR Form 1707 within 30 days after the sale.",
    ],
  };
}

// ---------- Documentary stamp tax ----------

export type DstTransaction = "sale_real_property" | "original_issue_shares" | "debt_instrument";

export interface DstInput {
  transaction: DstTransaction;
  date: ISODate;
  /** Real property: consideration (selling price). Shares: par value. Debt: issue price / loan amount. */
  amount: MoneyInput;
  /** Real property only: fair market value (higher of zonal and assessor's). */
  fair_market_value?: MoneyInput;
  /** Debt instruments only: term in days, if less than one year. */
  term_days?: number;
}

export interface DstResult {
  tax_base: string;
  dst: string;
}

const DST_KEY: Record<DstTransaction, string> = {
  sale_real_property: "dst.sale_real_property",
  original_issue_shares: "dst.original_issue_shares",
  debt_instrument: "dst.debt_instruments",
};

export function computeDst(input: DstInput, rules: readonly TaxRule[]): CalcResult<DstResult> {
  const r = findRule<{ per: string; amount: string }>(rules, DST_KEY[input.transaction], input.date);
  const steps: Step[] = [];
  const warnings: string[] = [];
  let base = max0(round2(input.amount));
  if (input.transaction === "sale_real_property") {
    const fmv = max0(round2(input.fair_market_value ?? 0));
    if (fmv.greaterThan(base)) base = fmv;
    steps.push({ label: "Tax base (higher of consideration and fair market value)", formula: `max(${peso(input.amount)}, ${peso(fmv)})`, amount: money(base), legal_basis: "NIRC Sec. 196" });
    warnings.push("File BIR Form 2000-OT and pay within five days after the close of the month of the sale.");
  } else {
    steps.push({ label: input.transaction === "original_issue_shares" ? "Par value of shares issued" : "Issue price of the debt instrument", formula: "As entered", amount: money(base), legal_basis: null });
    warnings.push("File BIR Form 2000 and pay within five days after the close of the month the document was made, signed or issued.");
  }
  const { units, tax: full } = perUnitOrFraction(base, r.value.per, r.value.amount);
  steps.push({
    label: "Documentary stamp tax",
    formula: `${peso(r.value.amount)} × ${units.toString()} (each ${peso(r.value.per)} or fraction of it)`,
    amount: money(full),
    legal_basis: r.legal_basis,
  });
  let tax = full;
  if (input.transaction === "debt_instrument" && input.term_days !== undefined && input.term_days > 0 && input.term_days < 365) {
    tax = round2(full.times(input.term_days).dividedBy(365));
    steps.push({ label: "Pro-rated for a term under one year", formula: `${peso(full)} × ${input.term_days}/365`, amount: money(tax), legal_basis: "NIRC Sec. 179 (proviso on terms of less than one year)" });
  }
  return { result: { tax_base: money(base), dst: money(tax) }, steps, rules_used: [r.id], warnings };
}
