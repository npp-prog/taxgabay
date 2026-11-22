import type { Bracket, TaxRule } from "../types";
import { rule, TRAIN_URL } from "./rule-helper";

/**
 * Phase 2 seed rules: corporate, withholding on compensation, expanded withholding.
 * EVERY row is needs_verification: true. See docs/VERIFY.md.
 */

export interface RcitValue {
  regular: string;
  /** Reduced rate, or null when no reduced rate exists. */
  reduced: string | null;
  reduced_max_net_taxable_income: string | null;
  reduced_max_total_assets_excl_land: string | null;
}

export interface McitStartValue {
  /** MCIT applies from this many taxable years after the year operations began. */
  years_after_commencement: number;
}

export interface CompensationTableValue {
  period: "monthly" | "semi_monthly" | "weekly" | "daily";
  brackets: Bracket[];
}

export interface DeMinimisItem {
  key: string;
  label: string;
  ceiling: string;
  per: string;
}

export interface EwtAtcValue {
  atc: string;
  description: string;
  payee: "individual" | "non_individual";
  rate: string;
}

const b = (over: string, not_over: string | null, base: string, rate: string): Bracket => ({ over, not_over, base, rate });

export const phase2Rules: TaxRule[] = [
  // ---------- Corporate ----------
  rule<RcitValue>(
    "cit-rcit-pre-create",
    "corporate.rcit",
    "income_tax",
    "corporation",
    { regular: "0.30", reduced: null, reduced_max_net_taxable_income: null, reduced_max_total_assets_excl_land: null },
    "2009-01-01",
    "2020-06-30",
    "NIRC Sec. 27(A), as amended by RA 9337 (30% from 1 Jan 2009)",
    TRAIN_URL,
  ),
  rule<{ rate: string }>(
    "cit-mcit-pre-create",
    "corporate.mcit",
    "income_tax",
    "corporation",
    { rate: "0.02" },
    "1998-01-01",
    "2020-06-30",
    "NIRC Sec. 27(E)(1) — 2% of gross income",
    TRAIN_URL,
  ),
  rule<McitStartValue>(
    "cit-mcit-start",
    "corporate.mcit_start",
    "income_tax",
    "corporation",
    { years_after_commencement: 4 },
    "1998-01-01",
    null,
    "NIRC Sec. 27(E)(1): beginning on the fourth taxable year immediately following the year in which the corporation commenced its business operations",
    TRAIN_URL,
  ),

  // ---------- Withholding on compensation (RR 11-2018 revised tables) ----------
  rule<CompensationTableValue>(
    "wtc-monthly-2018",
    "withholding.compensation.monthly",
    "withholding_compensation",
    "individual",
    {
      period: "monthly",
      brackets: [
        b("0", "20833", "0", "0"),
        b("20833", "33333", "0", "0.20"),
        b("33333", "66667", "2500", "0.25"),
        b("66667", "166667", "10833.33", "0.30"),
        b("166667", "666667", "40833.33", "0.32"),
        b("666667", null, "200833.33", "0.35"),
      ],
    },
    "2018-01-01",
    "2022-12-31",
    "RR 11-2018, Annex 'E' (revised withholding tax table, 1 Jan 2018 to 31 Dec 2022) — monthly",
    TRAIN_URL,
  ),
  rule<CompensationTableValue>(
    "wtc-monthly-2023",
    "withholding.compensation.monthly",
    "withholding_compensation",
    "individual",
    {
      period: "monthly",
      brackets: [
        b("0", "20833", "0", "0"),
        b("20833", "33333", "0", "0.15"),
        b("33333", "66667", "1875", "0.20"),
        b("66667", "166667", "8541.80", "0.25"),
        b("166667", "666667", "33541.80", "0.30"),
        b("666667", null, "183541.80", "0.35"),
      ],
    },
    "2023-01-01",
    null,
    "RR 11-2018, Annex 'E' (revised withholding tax table, 1 Jan 2023 onwards) — monthly",
    TRAIN_URL,
  ),
  rule<CompensationTableValue>(
    "wtc-semimonthly-2023",
    "withholding.compensation.semi_monthly",
    "withholding_compensation",
    "individual",
    {
      period: "semi_monthly",
      brackets: [
        b("0", "10417", "0", "0"),
        b("10417", "16667", "0", "0.15"),
        b("16667", "33333", "937.50", "0.20"),
        b("33333", "83333", "4270.70", "0.25"),
        b("83333", "333333", "16770.70", "0.30"),
        b("333333", null, "91770.70", "0.35"),
      ],
    },
    "2023-01-01",
    null,
    "RR 11-2018, Annex 'E' (1 Jan 2023 onwards) — semi-monthly",
    TRAIN_URL,
  ),
  rule<CompensationTableValue>(
    "wtc-weekly-2023",
    "withholding.compensation.weekly",
    "withholding_compensation",
    "individual",
    {
      period: "weekly",
      brackets: [
        b("0", "4808", "0", "0"),
        b("4808", "7692", "0", "0.15"),
        b("7692", "15385", "432.60", "0.20"),
        b("15385", "38462", "1971.20", "0.25"),
        b("38462", "153846", "7740.45", "0.30"),
        b("153846", null, "42355.65", "0.35"),
      ],
    },
    "2023-01-01",
    null,
    "RR 11-2018, Annex 'E' (1 Jan 2023 onwards) — weekly",
    TRAIN_URL,
  ),
  rule<CompensationTableValue>(
    "wtc-daily-2023",
    "withholding.compensation.daily",
    "withholding_compensation",
    "individual",
    {
      period: "daily",
      brackets: [
        b("0", "685", "0", "0"),
        b("685", "1096", "0", "0.15"),
        b("1096", "2192", "61.65", "0.20"),
        b("2192", "5479", "280.85", "0.25"),
        b("5479", "21918", "1102.60", "0.30"),
        b("21918", null, "6034.30", "0.35"),
      ],
    },
    "2023-01-01",
    null,
    "RR 11-2018, Annex 'E' (1 Jan 2023 onwards) — daily",
    TRAIN_URL,
  ),
  rule<{ amount: string }>(
    "wtc-benefits-exclusion-train",
    "withholding.compensation.benefits_exclusion",
    "withholding_compensation",
    "individual",
    { amount: "90000" },
    "2018-01-01",
    null,
    "NIRC Sec. 32(B)(7)(e), as amended by RA 10963 (TRAIN) — 13th month pay and other benefits up to ₱90,000",
    TRAIN_URL,
  ),
  rule<{ items: DeMinimisItem[] }>(
    "wtc-de-minimis-rr11-2018",
    "withholding.compensation.de_minimis",
    "withholding_compensation",
    "individual",
    {
      items: [
        { key: "rice", label: "Rice subsidy", ceiling: "2000", per: "month" },
        { key: "uniform", label: "Uniform and clothing allowance", ceiling: "6000", per: "year" },
        { key: "medical_cash", label: "Medical cash allowance to dependents", ceiling: "1500", per: "semester" },
        { key: "laundry", label: "Laundry allowance", ceiling: "300", per: "month" },
        { key: "achievement", label: "Employee achievement awards (tangible property)", ceiling: "10000", per: "year" },
        { key: "christmas", label: "Christmas and major anniversary gifts", ceiling: "5000", per: "year" },
        { key: "medical_assistance", label: "Actual medical assistance", ceiling: "10000", per: "year" },
        { key: "cba", label: "CBA and productivity incentive benefits (combined)", ceiling: "10000", per: "year" },
      ],
    },
    "2018-01-01",
    null,
    "RR 2-98 Sec. 2.78.1(A)(3), as amended by RR 11-2018 (de minimis benefits)",
    TRAIN_URL,
    "Ceilings and list to confirm; overtime meal allowance (25% of minimum wage) and monetized leave not modeled.",
  ),

  // ---------- Expanded withholding by ATC ----------
  ...(
    [
      ["WI010", "Professional fees — individual, gross income ₱3M or less and non-VAT", "individual", "0.05"],
      ["WI011", "Professional fees — individual, gross income over ₱3M or VAT-registered", "individual", "0.10"],
      ["WC010", "Professional fees — juridical person, gross income ₱720,000 or less", "non_individual", "0.10"],
      ["WC011", "Professional fees — juridical person, gross income over ₱720,000", "non_individual", "0.15"],
      ["WI100", "Rentals of real or personal property — individual payee", "individual", "0.05"],
      ["WC100", "Rentals of real or personal property — juridical payee", "non_individual", "0.05"],
      ["WI120", "Payments to contractors (services) — individual payee", "individual", "0.02"],
      ["WC120", "Payments to contractors (services) — juridical payee", "non_individual", "0.02"],
      ["WI158", "Purchases of goods by top withholding agents — individual supplier", "individual", "0.01"],
      ["WC158", "Purchases of goods by top withholding agents — juridical supplier", "non_individual", "0.01"],
      ["WI160", "Purchases of services by top withholding agents — individual supplier", "individual", "0.02"],
      ["WC160", "Purchases of services by top withholding agents — juridical supplier", "non_individual", "0.02"],
    ] as const
  ).map(([atc, description, payee, rate]) =>
    rule<EwtAtcValue>(
      `ewt-${atc.toLowerCase()}-2018`,
      `ewt.atc.${atc}`,
      "withholding_expanded",
      "all",
      { atc, description, payee, rate },
      "2018-01-01",
      null,
      "RR 2-98 Sec. 2.57.2, as amended by RR 11-2018",
      TRAIN_URL,
      "ATC code and rate to confirm against the current BIR ATC table.",
    ),
  ),
];
