import type { AppliesWhen, EfpsGroup, TaxpayerType } from "../profile";
import type { Provenance } from "../types";

export type Frequency = "monthly" | "quarterly" | "annual" | "one_time" | "event";

export type DueLogic =
  | {
      kind: "monthly_following";
      /** Due on this day of the month after the period month. */
      day: number;
      /** Which calendar months are periods. */
      period_months: "all" | "non_quarter_end";
      /** eFPS group day, overriding `day` for eFPS filers. */
      efps_days?: Partial<Record<EfpsGroup, number>>;
      /** Period-month-specific due date (applies to all channels). */
      exceptions?: { period_month: number; month_offset: number; day: number }[];
    }
  | {
      kind: "quarterly";
      quarter_basis: "calendar" | "taxable_year";
      /** Which quarters of the (taxable) year are periods, 1–4. */
      quarters: number[];
      /** Either N days after quarter end … */
      days_after?: number;
      /** … or a day of the Nth month after the quarter-end month. */
      month_offset?: number;
      day?: number | "last";
    }
  | {
      kind: "annual";
      year_basis: "calendar" | "taxable_year";
      /** Months after the year-end month. */
      month_offset: number;
      day: number | "last";
    }
  | { kind: "event"; event: string; days_after_event: number };

export interface DeadlineRule extends Omit<Provenance, "source_url"> {
  id: string;
  form_code: string;
  title: string;
  frequency: Frequency;
  due_logic: DueLogic;
  applies_when: AppliesWhen;
  filing_channel: "all" | "ebirforms" | "efps";
  source_url: string | null;
}

const EFPS_GROUP_DAYS: Record<EfpsGroup, number> = { A: 15, B: 14, C: 13, D: 12, E: 11 };

const INDIVIDUAL_BIZ: TaxpayerType[] = ["self_employed", "mixed_income", "sole_proprietorship"];
const ALL_BIZ: TaxpayerType[] = [...INDIVIDUAL_BIZ, "partnership", "corporation", "opc", "cooperative"];
const NON_INDIVIDUAL: TaxpayerType[] = ["partnership", "corporation", "opc", "cooperative"];

function dl(r: Omit<DeadlineRule, "last_verified_at" | "needs_verification" | "source_url" | "filing_channel"> & Partial<Pick<DeadlineRule, "source_url" | "filing_channel">>): DeadlineRule {
  return {
    filing_channel: "all",
    source_url: "https://www.bir.gov.ph/",
    last_verified_at: null,
    needs_verification: true,
    ...r,
  };
}

export const deadlineRules: DeadlineRule[] = [
  dl({
    id: "dl-1701q",
    form_code: "1701Q",
    title: "Quarterly income tax return (individuals)",
    frequency: "quarterly",
    due_logic: { kind: "quarterly", quarter_basis: "calendar", quarters: [1, 2, 3], month_offset: 2, day: 15 },
    applies_when: { taxpayer_types: INDIVIDUAL_BIZ },
    effective_from: "2018-01-01",
    effective_to: null,
    legal_basis: "NIRC Sec. 74(A), as amended by RA 10963 (TRAIN): 15 May, 15 Aug, 15 Nov",
  }),
  dl({
    id: "dl-1701a",
    form_code: "1701A",
    title: "Annual income tax return (purely business/profession, 8% or OSD)",
    frequency: "annual",
    due_logic: { kind: "annual", year_basis: "calendar", month_offset: 4, day: 15 },
    applies_when: {
      taxpayer_types: ["self_employed", "sole_proprietorship"],
      income_tax_options: ["eight_percent", "graduated_osd"],
    },
    effective_from: "2018-01-01",
    effective_to: null,
    legal_basis: "NIRC Sec. 51(C)(1); RR 8-2018; RMC 37-2019 (1701A)",
    note: "RMC number for the 1701A form version to confirm.",
  }),
  dl({
    id: "dl-1701",
    form_code: "1701",
    title: "Annual income tax return (mixed income or itemized deductions)",
    frequency: "annual",
    due_logic: { kind: "annual", year_basis: "calendar", month_offset: 4, day: 15 },
    applies_when: { taxpayer_types: INDIVIDUAL_BIZ, not: { taxpayer_types: ["self_employed", "sole_proprietorship"], income_tax_options: ["eight_percent", "graduated_osd"] } },
    effective_from: "2018-01-01",
    effective_to: null,
    legal_basis: "NIRC Sec. 51(C)(1): on or before 15 April of the following year",
  }),
  dl({
    id: "dl-2551q",
    form_code: "2551Q",
    title: "Quarterly percentage tax return",
    frequency: "quarterly",
    due_logic: { kind: "quarterly", quarter_basis: "taxable_year", quarters: [1, 2, 3, 4], days_after: 25 },
    applies_when: { taxpayer_types: ALL_BIZ, vat_status: ["non_vat"], not: { income_tax_options: ["eight_percent"] } },
    effective_from: "2018-01-01",
    effective_to: null,
    legal_basis: "NIRC Sec. 128(A)(1), as amended by RA 10963 (TRAIN): within 25 days after the end of each taxable quarter",
    note: "8% income tax option is in lieu of percentage tax. Cooperatives may be exempt under RA 9520 — to confirm.",
  }),
  dl({
    id: "dl-2550q",
    form_code: "2550Q",
    title: "Quarterly VAT return",
    frequency: "quarterly",
    due_logic: { kind: "quarterly", quarter_basis: "taxable_year", quarters: [1, 2, 3, 4], days_after: 25 },
    applies_when: { taxpayer_types: ALL_BIZ, vat_status: ["vat"] },
    effective_from: "2023-01-01",
    effective_to: null,
    legal_basis: "NIRC Sec. 114(A), as amended by RA 10963 (TRAIN): quarterly filing within 25 days after the close of the taxable quarter (monthly 2550M no longer required from 1 Jan 2023)",
  }),
  dl({
    id: "dl-1601c",
    form_code: "1601C",
    title: "Monthly remittance of tax withheld on compensation",
    frequency: "monthly",
    due_logic: {
      kind: "monthly_following",
      day: 10,
      period_months: "all",
      efps_days: EFPS_GROUP_DAYS,
      exceptions: [{ period_month: 12, month_offset: 1, day: 15 }],
    },
    applies_when: { has_employees: true },
    effective_from: "2018-01-01",
    effective_to: null,
    legal_basis: "NIRC Sec. 58(A) and 81; RR 2-98 as amended; RR 26-2002 (eFPS staggered filing): 10th day of the following month, December return by 15 January",
    note: "eFPS group days (A=15 … E=11) and whether the December 15 January date also applies to eFPS filers to confirm.",
  }),
  dl({
    id: "dl-0619e",
    form_code: "0619E",
    title: "Monthly remittance of creditable (expanded) withholding tax",
    frequency: "monthly",
    due_logic: { kind: "monthly_following", day: 10, period_months: "non_quarter_end", efps_days: EFPS_GROUP_DAYS },
    applies_when: { withholds_expanded: true },
    effective_from: "2018-01-01",
    effective_to: null,
    legal_basis: "NIRC Sec. 58(A); RR 2-98 as amended by RR 11-2018: first two months of each quarter, 10th day of the following month",
  }),
  dl({
    id: "dl-1601eq",
    form_code: "1601EQ",
    title: "Quarterly remittance return of creditable (expanded) withholding tax",
    frequency: "quarterly",
    due_logic: { kind: "quarterly", quarter_basis: "calendar", quarters: [1, 2, 3, 4], month_offset: 1, day: "last" },
    applies_when: { withholds_expanded: true },
    effective_from: "2018-01-01",
    effective_to: null,
    legal_basis: "NIRC Sec. 58(A); RR 2-98 as amended by RR 11-2018: last day of the month following the close of the quarter",
  }),
  dl({
    id: "dl-1604c",
    form_code: "1604C",
    title: "Annual information return of income taxes withheld on compensation",
    frequency: "annual",
    due_logic: { kind: "annual", year_basis: "calendar", month_offset: 1, day: 31 },
    applies_when: { has_employees: true },
    effective_from: "2018-01-01",
    effective_to: null,
    legal_basis: "NIRC Sec. 58(C), as amended by RA 10963 (TRAIN): on or before 31 January of the following year",
  }),
  dl({
    id: "dl-1604e",
    form_code: "1604E",
    title: "Annual information return of creditable income taxes withheld (expanded)",
    frequency: "annual",
    due_logic: { kind: "annual", year_basis: "calendar", month_offset: 3, day: 1 },
    applies_when: { withholds_expanded: true },
    effective_from: "2018-01-01",
    effective_to: null,
    legal_basis: "NIRC Sec. 58(C); RR 2-98 as amended: on or before 1 March of the following year",
  }),
  dl({
    id: "dl-1702q",
    form_code: "1702Q",
    title: "Quarterly income tax return (corporations and partnerships)",
    frequency: "quarterly",
    due_logic: { kind: "quarterly", quarter_basis: "taxable_year", quarters: [1, 2, 3], days_after: 60 },
    applies_when: { taxpayer_types: NON_INDIVIDUAL },
    effective_from: "2018-01-01",
    effective_to: null,
    legal_basis: "NIRC Sec. 77(B): within 60 days after the close of each of the first three quarters of the taxable year",
    note: "Filing guide not yet written.",
  }),
  dl({
    id: "dl-1702rt",
    form_code: "1702-RT",
    title: "Annual income tax return (corporations, regular rate)",
    frequency: "annual",
    due_logic: { kind: "annual", year_basis: "taxable_year", month_offset: 4, day: 15 },
    applies_when: { taxpayer_types: NON_INDIVIDUAL },
    effective_from: "2018-01-01",
    effective_to: null,
    legal_basis: "NIRC Sec. 77(B): on or before the 15th day of the fourth month following the close of the taxable year",
    note: "Exempt (1702-EX) and mixed (1702-MX) variants not yet distinguished. Filing guide not yet written.",
  }),
];
