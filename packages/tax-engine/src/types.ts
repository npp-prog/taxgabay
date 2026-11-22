/** ISO calendar date, `YYYY-MM-DD`. No time zone; all PH dates. */
export type ISODate = string;

/** Fields every effective-dated data row carries (spec principle 1). */
export interface Provenance {
  effective_from: ISODate;
  /** Inclusive. `null` means still in force. */
  effective_to: ISODate | null;
  legal_basis: string;
  source_url: string | null;
  last_verified_at: ISODate | null;
  needs_verification: boolean;
  /** Free-text reviewer note, e.g. why a value is low confidence. */
  note?: string;
}

export type TaxType =
  | "income_tax"
  | "percentage_tax"
  | "vat"
  | "withholding_compensation"
  | "withholding_expanded"
  | "estate_tax"
  | "donors_tax"
  | "capital_gains_tax"
  | "documentary_stamp_tax"
  | "penalty"
  | "registration";

export type TaxpayerCategory =
  | "individual"
  | "corporation"
  | "micro_small"
  | "all";

export interface TaxRule<V = unknown> extends Provenance {
  id: string;
  rule_key: string;
  tax_type: TaxType;
  taxpayer_category: TaxpayerCategory;
  value: V;
}

/** A graduated bracket: tax = base + rate × (income − over). */
export interface Bracket {
  over: string;
  /** Exclusive upper bound of the bracket (`null` = no ceiling). */
  not_over: string | null;
  base: string;
  rate: string;
}

export interface Step {
  label: string;
  formula: string;
  /** Amount in pesos, 2 decimals, as a string. */
  amount: string;
  legal_basis: string | null;
}

export interface CalcResult<R> {
  result: R;
  steps: Step[];
  /** Rule ids used, so the UI can show last-verified status. */
  rules_used: string[];
  warnings: string[];
}
