export const TAXPAYER_TYPES = [
  "employee",
  "self_employed",
  "mixed_income",
  "sole_proprietorship",
  "partnership",
  "corporation",
  "opc",
  "cooperative",
  "estate",
  "one_time",
] as const;
export type TaxpayerType = (typeof TAXPAYER_TYPES)[number];

export type VatStatus = "vat" | "non_vat" | "not_sure";
export type IncomeTaxOption =
  | "graduated_osd"
  | "graduated_itemized"
  | "eight_percent"
  | "not_applicable"
  | "not_sure";
export type FilingChannel = "ebirforms" | "efps" | "not_sure";
export type EfpsGroup = "A" | "B" | "C" | "D" | "E";
export type TaxpayerSize = "micro" | "small" | "medium" | "large" | "not_sure";

export interface Profile {
  taxpayer_type: TaxpayerType;
  vat_status: VatStatus;
  income_tax_option: IncomeTaxOption;
  has_employees: boolean;
  /** Pays rent, professional fees, contractors etc. subject to expanded withholding. */
  withholds_expanded: boolean;
  filing_channel: FilingChannel;
  efps_group: EfpsGroup | null;
  /** 1–12. Individuals are always 12 (calendar year). */
  fiscal_year_end_month: number;
  rdo_code: string | null;
  taxpayer_size: TaxpayerSize;
  line_of_business: string | null;
}

export const INDIVIDUAL_BUSINESS_TYPES: readonly TaxpayerType[] = [
  "self_employed",
  "mixed_income",
  "sole_proprietorship",
];
export const JURIDICAL_TYPES: readonly TaxpayerType[] = [
  "partnership",
  "corporation",
  "opc",
  "cooperative",
];
export const BUSINESS_TYPES: readonly TaxpayerType[] = [
  ...INDIVIDUAL_BUSINESS_TYPES,
  ...JURIDICAL_TYPES,
];

export function isIndividual(t: TaxpayerType): boolean {
  return !JURIDICAL_TYPES.includes(t);
}

export function hasBusiness(t: TaxpayerType): boolean {
  return BUSINESS_TYPES.includes(t);
}

/** Business form used by the registration roadmap. */
export function businessForm(t: TaxpayerType): "dti" | "sec" | "cda" | null {
  if (t === "sole_proprietorship") return "dti";
  if (t === "partnership" || t === "corporation" || t === "opc") return "sec";
  if (t === "cooperative") return "cda";
  return null;
}

/** Applies the invariants the wizard enforces, so stored profiles stay consistent. */
export function normalizeProfile(p: Profile): Profile {
  const individual = isIndividual(p.taxpayer_type);
  const business = hasBusiness(p.taxpayer_type);
  return {
    ...p,
    fiscal_year_end_month: individual ? 12 : p.fiscal_year_end_month,
    income_tax_option:
      individual && business
        ? p.income_tax_option === "not_applicable"
          ? "not_sure"
          : p.income_tax_option
        : "not_applicable",
    vat_status: business ? p.vat_status : "non_vat",
    efps_group: p.filing_channel === "efps" ? p.efps_group : null,
  };
}

export const DEFAULT_PROFILE: Profile = {
  taxpayer_type: "sole_proprietorship",
  vat_status: "non_vat",
  income_tax_option: "not_sure",
  has_employees: false,
  withholds_expanded: false,
  filing_channel: "ebirforms",
  efps_group: null,
  fiscal_year_end_month: 12,
  rdo_code: null,
  taxpayer_size: "micro",
  line_of_business: null,
};

// ---------- Applicability ----------

export interface Conditions {
  taxpayer_types?: TaxpayerType[];
  vat_status?: Exclude<VatStatus, "not_sure">[];
  income_tax_options?: Exclude<IncomeTaxOption, "not_sure">[];
  has_employees?: boolean;
  withholds_expanded?: boolean;
}

export interface AppliesWhen extends Conditions {
  /** Excluded if these conditions all match. */
  not?: Conditions;
}

/** Three-valued: "maybe" when the answer depends on a "not sure" profile field. */
export type Applicability = "yes" | "no" | "maybe";

function matchConditions(c: Conditions, p: Profile): Applicability {
  const results: Applicability[] = [];
  if (c.taxpayer_types) results.push(c.taxpayer_types.includes(p.taxpayer_type) ? "yes" : "no");
  if (c.vat_status) {
    results.push(
      p.vat_status === "not_sure" ? "maybe" : c.vat_status.includes(p.vat_status) ? "yes" : "no",
    );
  }
  if (c.income_tax_options) {
    results.push(
      p.income_tax_option === "not_sure"
        ? "maybe"
        : c.income_tax_options.includes(p.income_tax_option)
          ? "yes"
          : "no",
    );
  }
  if (c.has_employees !== undefined) results.push(c.has_employees === p.has_employees ? "yes" : "no");
  if (c.withholds_expanded !== undefined) {
    results.push(c.withholds_expanded === p.withholds_expanded ? "yes" : "no");
  }
  if (results.includes("no")) return "no";
  if (results.includes("maybe")) return "maybe";
  return "yes";
}

export function applies(when: AppliesWhen, profile: Profile): Applicability {
  const p = normalizeProfile(profile);
  const base = matchConditions(when, p);
  if (base === "no" || !when.not) return base;
  const excluded = matchConditions(when.not, p);
  if (excluded === "yes") return "no";
  if (excluded === "maybe") return "maybe";
  return base;
}
