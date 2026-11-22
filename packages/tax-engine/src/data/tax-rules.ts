import type { Bracket, TaxRule } from "../types";
import { phase2Rules } from "./tax-rules-phase2";
import { rule, TRAIN_URL } from "./rule-helper";

/**
 * Seed tax rules. EVERY row is needs_verification: true until the CPA confirms it
 * against the current issuance and sets last_verified_at. See docs/VERIFY.md.
 *
 * Amounts and rates are decimal strings (never JS floats).
 */


// ---------- Income tax: individuals ----------

export interface EightPercentValue {
  rate: string;
  /** Gross sales/receipts + other non-operating income must not exceed this. */
  gross_threshold: string;
  /** Amount deductible from gross for purely self-employed individuals. */
  purely_self_employed_deduction: string;
}

export interface OsdValue {
  /** OSD rate on gross sales/receipts for individuals. */
  rate: string;
}


const brackets2018: Bracket[] = [
  { over: "0", not_over: "250000", base: "0", rate: "0" },
  { over: "250000", not_over: "400000", base: "0", rate: "0.20" },
  { over: "400000", not_over: "800000", base: "30000", rate: "0.25" },
  { over: "800000", not_over: "2000000", base: "130000", rate: "0.30" },
  { over: "2000000", not_over: "8000000", base: "490000", rate: "0.32" },
  { over: "8000000", not_over: null, base: "2410000", rate: "0.35" },
];

const brackets2023: Bracket[] = [
  { over: "0", not_over: "250000", base: "0", rate: "0" },
  { over: "250000", not_over: "400000", base: "0", rate: "0.15" },
  { over: "400000", not_over: "800000", base: "22500", rate: "0.20" },
  { over: "800000", not_over: "2000000", base: "102500", rate: "0.25" },
  { over: "2000000", not_over: "8000000", base: "402500", rate: "0.30" },
  { over: "8000000", not_over: null, base: "2202500", rate: "0.35" },
];

// ---------- Penalties ----------

export interface SurchargeValue {
  /** Sec. 248(A) failure to file / pay on time. */
  standard: string;
  /** Same violations, micro and small taxpayers (EOPT). */
  micro_small: string;
  /** Sec. 248(B) willful neglect / false or fraudulent return. */
  willful: string;
}

export interface InterestValue {
  /** Annual rate, simple interest, prorated per day over 365. */
  standard: string;
  micro_small: string;
}

export interface CompromiseBracket {
  over: string;
  not_over: string | null;
  amount: string;
}

export interface CompromiseValue {
  brackets: CompromiseBracket[];
}

export interface TaxpayerSizeValue {
  /** Classes by gross sales, lower bound inclusive, upper bound exclusive. */
  classes: { size: "micro" | "small" | "medium" | "large"; from: string; below: string | null }[];
}

const coreRules: TaxRule[] = [
  rule<{ brackets: Bracket[] }>(
    "it-grad-2018",
    "income_tax.individual.graduated",
    "income_tax",
    "individual",
    { brackets: brackets2018 },
    "2018-01-01",
    "2022-12-31",
    "NIRC Sec. 24(A)(2)(a), as amended by RA 10963 (TRAIN) Sec. 5 — schedule for 1 Jan 2018 to 31 Dec 2022",
    TRAIN_URL,
  ),
  rule<{ brackets: Bracket[] }>(
    "it-grad-2023",
    "income_tax.individual.graduated",
    "income_tax",
    "individual",
    { brackets: brackets2023 },
    "2023-01-01",
    null,
    "NIRC Sec. 24(A)(2)(a), as amended by RA 10963 (TRAIN) Sec. 5 — schedule for 1 Jan 2023 onwards",
    TRAIN_URL,
  ),
  rule<EightPercentValue>(
    "it-8pct-2018",
    "income_tax.individual.eight_percent",
    "income_tax",
    "individual",
    { rate: "0.08", gross_threshold: "3000000", purely_self_employed_deduction: "250000" },
    "2018-01-01",
    null,
    "NIRC Sec. 24(A)(2)(b) and (c)(2), as amended by RA 10963 (TRAIN); RR 8-2018",
    TRAIN_URL,
    "₱250,000 reduction applies only to purely self-employed/professionals, not mixed-income earners.",
  ),
  rule<OsdValue>(
    "it-osd-ind-2008",
    "income_tax.individual.osd",
    "income_tax",
    "individual",
    { rate: "0.40" },
    "2008-07-06",
    null,
    "NIRC Sec. 34(L), as amended by RA 9504; RR 16-2008 (OSD base for individuals is gross sales/receipts)",
    TRAIN_URL,
    "Effectivity date of RA 9504 to confirm.",
  ),

  // ---------- Percentage tax ----------
  rule<{ rate: string }>(
    "pt-116-2018",
    "percentage_tax.sec116",
    "percentage_tax",
    "all",
    { rate: "0.03" },
    "2018-01-01",
    "2020-06-30",
    "NIRC Sec. 116, as amended by RA 10963 (TRAIN)",
    TRAIN_URL,
  ),
  rule<{ rate: string }>(
    "pt-116-create",
    "percentage_tax.sec116",
    "percentage_tax",
    "all",
    { rate: "0.01" },
    "2020-07-01",
    "2023-06-30",
    "NIRC Sec. 116, as amended by RA 11534 (CREATE) Sec. 10 — temporary 1% from 1 Jul 2020 to 30 Jun 2023",
    TRAIN_URL,
  ),
  rule<{ rate: string }>(
    "pt-116-2023",
    "percentage_tax.sec116",
    "percentage_tax",
    "all",
    { rate: "0.03" },
    "2023-07-01",
    null,
    "NIRC Sec. 116, as amended by RA 11534 (CREATE) — reverts to 3% from 1 Jul 2023",
    TRAIN_URL,
  ),

  // ---------- VAT ----------
  rule<{ rate: string }>(
    "vat-rate-2006",
    "vat.rate",
    "vat",
    "all",
    { rate: "0.12" },
    "2006-02-01",
    null,
    "NIRC Secs. 106 and 108, as amended by RA 9337",
    TRAIN_URL,
  ),
  rule<{ amount: string }>(
    "vat-threshold-2018",
    "vat.threshold",
    "vat",
    "all",
    { amount: "3000000" },
    "2018-01-01",
    null,
    "NIRC Sec. 109(1)(CC), as amended by RA 10963 (TRAIN); RR 13-2018",
    TRAIN_URL,
    "Paragraph letter of Sec. 109(1) to confirm.",
  ),

  // ---------- Registration / EOPT ----------
  rule<{ amount: string }>(
    "reg-arf-pre-eopt",
    "registration.annual_fee",
    "registration",
    "all",
    { amount: "500" },
    "1998-01-01",
    "2024-01-21",
    "NIRC Sec. 236(B) (annual registration fee)",
    TRAIN_URL,
  ),
  rule<{ amount: string }>(
    "reg-arf-eopt",
    "registration.annual_fee",
    "registration",
    "all",
    { amount: "0" },
    "2024-01-22",
    null,
    "RA 11976 (Ease of Paying Taxes Act), repealing the annual registration fee under NIRC Sec. 236(B); RMC 14-2024",
    TRAIN_URL,
    "EOPT effectivity (22 Jan 2024) and RMC number to confirm.",
  ),
  rule<TaxpayerSizeValue>(
    "size-eopt",
    "taxpayer_size.classes",
    "registration",
    "all",
    {
      classes: [
        { size: "micro", from: "0", below: "3000000" },
        { size: "small", from: "3000000", below: "20000000" },
        { size: "medium", from: "20000000", below: "1000000000" },
        { size: "large", from: "1000000000", below: null },
      ],
    },
    "2024-01-22",
    null,
    "RA 11976 (EOPT); RR 8-2024 (classification of taxpayers by gross sales)",
    TRAIN_URL,
    "Section citation and RR effectivity to confirm.",
  ),

  // ---------- Penalties ----------
  rule<SurchargeValue>(
    "pen-surcharge-pre-eopt",
    "penalty.surcharge",
    "penalty",
    "all",
    { standard: "0.25", micro_small: "0.25", willful: "0.50" },
    "1998-01-01",
    "2024-01-21",
    "NIRC Sec. 248",
    TRAIN_URL,
  ),
  rule<SurchargeValue>(
    "pen-surcharge-eopt",
    "penalty.surcharge",
    "penalty",
    "all",
    { standard: "0.25", micro_small: "0.10", willful: "0.50" },
    "2024-01-22",
    null,
    "NIRC Sec. 248, as amended by RA 11976 (EOPT); RR 6-2024",
    TRAIN_URL,
    "Confirm whether the willful (50%) surcharge is also reduced for micro/small taxpayers — modeled as NOT reduced.",
  ),
  rule<InterestValue>(
    "pen-interest-pre-train",
    "penalty.interest",
    "penalty",
    "all",
    { standard: "0.20", micro_small: "0.20" },
    "1998-01-01",
    "2017-12-31",
    "NIRC Sec. 249(A) prior to RA 10963 (20% per annum)",
    TRAIN_URL,
  ),
  rule<InterestValue>(
    "pen-interest-train",
    "penalty.interest",
    "penalty",
    "all",
    { standard: "0.12", micro_small: "0.12" },
    "2018-01-01",
    "2024-01-21",
    "NIRC Sec. 249(A), as amended by RA 10963 (TRAIN): double the legal interest rate (6% under BSP MB Circular 799, s. 2013) = 12% per annum",
    TRAIN_URL,
  ),
  rule<InterestValue>(
    "pen-interest-eopt",
    "penalty.interest",
    "penalty",
    "all",
    { standard: "0.12", micro_small: "0.06" },
    "2024-01-22",
    null,
    "NIRC Sec. 249(A), as amended by RA 11976 (EOPT): micro and small taxpayers at 50% of the standard rate; RR 6-2024",
    TRAIN_URL,
  ),
  rule<CompromiseValue>(
    "pen-compromise-rmo7-2015",
    "penalty.compromise.failure_to_file_pay",
    "penalty",
    "all",
    {
      brackets: [
        { over: "0", not_over: "500", amount: "200" },
        { over: "500", not_over: "1000", amount: "400" },
        { over: "1000", not_over: "2000", amount: "700" },
        { over: "2000", not_over: "5000", amount: "1000" },
        { over: "5000", not_over: "10000", amount: "1500" },
        { over: "10000", not_over: "20000", amount: "3000" },
        { over: "20000", not_over: "50000", amount: "5000" },
        { over: "50000", not_over: "100000", amount: "10000" },
        { over: "100000", not_over: "500000", amount: "20000" },
        { over: "500000", not_over: "1000000", amount: "30000" },
        { over: "1000000", not_over: "5000000", amount: "40000" },
        { over: "5000000", not_over: null, amount: "50000" },
      ],
    },
    "2015-01-01",
    null,
    "RMO 7-2015, Annex A (schedule of compromise penalties, NIRC Sec. 255 violations)",
    TRAIN_URL,
    "LOW CONFIDENCE: bracket amounts and effectivity reconstructed from memory. Replace from the current RMO annex before launch.",
  ),

  // ---------- Phase 2 calculators: data seeded now for review ----------
  rule<{ regular: string; reduced: string; reduced_max_net_taxable_income: string; reduced_max_total_assets_excl_land: string }>(
    "cit-rcit-create",
    "corporate.rcit",
    "income_tax",
    "corporation",
    { regular: "0.25", reduced: "0.20", reduced_max_net_taxable_income: "5000000", reduced_max_total_assets_excl_land: "100000000" },
    "2020-07-01",
    null,
    "NIRC Sec. 27(A), as amended by RA 11534 (CREATE)",
    TRAIN_URL,
  ),
  rule<{ rate: string }>(
    "cit-mcit-create-temp",
    "corporate.mcit",
    "income_tax",
    "corporation",
    { rate: "0.01" },
    "2020-07-01",
    "2023-06-30",
    "NIRC Sec. 27(E), as amended by RA 11534 (CREATE) — temporary 1%",
    TRAIN_URL,
  ),
  rule<{ rate: string }>(
    "cit-mcit-2023",
    "corporate.mcit",
    "income_tax",
    "corporation",
    { rate: "0.02" },
    "2023-07-01",
    null,
    "NIRC Sec. 27(E), as amended by RA 11534 (CREATE) — reverts to 2% of gross income",
    TRAIN_URL,
  ),
  rule<{ rate: string }>(
    "cit-rbe-edr-createmore",
    "corporate.rbe_enhanced_deductions",
    "income_tax",
    "corporation",
    { rate: "0.20" },
    "2024-11-28",
    null,
    "RA 12066 (CREATE MORE) — 20% CIT for registered business enterprises under the enhanced deductions regime",
    TRAIN_URL,
    "CREATE MORE effectivity date to confirm.",
  ),
  rule<{ rate: string; standard_deduction: string; family_home_cap: string }>(
    "estate-train",
    "estate.tax",
    "estate_tax",
    "individual",
    { rate: "0.06", standard_deduction: "5000000", family_home_cap: "10000000" },
    "2018-01-01",
    null,
    "NIRC Secs. 84 and 86(A), as amended by RA 10963 (TRAIN) — decedents dying on or after 1 Jan 2018",
    TRAIN_URL,
  ),
  rule<{ rate: string; annual_exemption: string }>(
    "donors-train",
    "donors.tax",
    "donors_tax",
    "all",
    { rate: "0.06", annual_exemption: "250000" },
    "2018-01-01",
    null,
    "NIRC Sec. 99(A), as amended by RA 10963 (TRAIN)",
    TRAIN_URL,
  ),
  rule<{ rate: string }>(
    "cgt-real-property",
    "cgt.real_property",
    "capital_gains_tax",
    "all",
    { rate: "0.06" },
    "1998-01-01",
    null,
    "NIRC Secs. 24(D)(1) and 27(D)(5) — 6% of the higher of gross selling price or fair market value",
    TRAIN_URL,
  ),
  rule<{ rate: string }>(
    "cgt-unlisted-shares-train",
    "cgt.unlisted_shares",
    "capital_gains_tax",
    "all",
    { rate: "0.15" },
    "2018-01-01",
    null,
    "NIRC Sec. 24(C), as amended by RA 10963 (TRAIN) — 15% of net capital gains",
    TRAIN_URL,
  ),
  rule<{ per: string; amount: string }>(
    "dst-real-property-train",
    "dst.sale_real_property",
    "documentary_stamp_tax",
    "all",
    { per: "1000", amount: "15" },
    "2018-01-01",
    null,
    "NIRC Sec. 196, as amended by RA 10963 (TRAIN) — ₱15 per ₱1,000 of consideration or value",
    TRAIN_URL,
  ),
  rule<{ per: string; amount: string }>(
    "dst-original-issue-shares-train",
    "dst.original_issue_shares",
    "documentary_stamp_tax",
    "all",
    { per: "200", amount: "2" },
    "2018-01-01",
    null,
    "NIRC Sec. 174, as amended by RA 10963 (TRAIN) — ₱2 per ₱200 of par value",
    TRAIN_URL,
  ),
  rule<{ per: string; amount: string }>(
    "dst-loan-train",
    "dst.debt_instruments",
    "documentary_stamp_tax",
    "all",
    { per: "200", amount: "1.50" },
    "2018-01-01",
    null,
    "NIRC Sec. 179, as amended by RA 10963 (TRAIN) — ₱1.50 per ₱200 of issue price",
    TRAIN_URL,
  ),
];

export const taxRules: TaxRule[] = [...coreRules, ...phase2Rules];
