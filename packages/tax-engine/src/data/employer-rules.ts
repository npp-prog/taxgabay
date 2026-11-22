import type { TaxRule } from "../types";
import { rule } from "./rule-helper";

/**
 * Employer, bookkeeping and LGU rules used by the business guide and payroll examples.
 * EVERY row is needs_verification: true. See docs/VERIFY.md.
 */

export interface SssValue {
  /** Total contribution rate on the monthly salary credit (MSC). */
  rate: string;
  employer_rate: string;
  employee_rate: string;
  msc_floor: string;
  msc_ceiling: string;
  /** MSC steps: salary is rounded to the nearest step (half up). */
  msc_step: string;
}

export interface PhilHealthValue {
  rate: string;
  /** Share of the premium paid by the employee (rest by the employer). */
  employee_share: string;
  income_floor: string;
  income_ceiling: string;
}

export interface PagIbigValue {
  employee_rate: string;
  /** Employee rate when monthly compensation is at or below `low_income_limit`. */
  employee_rate_low: string;
  low_income_limit: string;
  employer_rate: string;
  max_compensation: string;
}

export interface ThirteenthMonthValue {
  /** Fraction of total basic salary earned in the calendar year. */
  fraction_of_basic_salary: string;
  pay_by_month: number;
  pay_by_day: number;
}

const SSS_URL = "https://www.sss.gov.ph/";
const PH_URL = "https://www.philhealth.gov.ph/";
const HDMF_URL = "https://www.pagibigfund.gov.ph/";
const BIR_URL = "https://www.bir.gov.ph/";

export const employerRules: TaxRule[] = [
  rule<SssValue>(
    "sss-2023",
    "employer.sss",
    "employer_contributions",
    "all",
    { rate: "0.14", employer_rate: "0.095", employee_rate: "0.045", msc_floor: "4000", msc_ceiling: "30000", msc_step: "500" },
    "2023-01-01",
    "2024-12-31",
    "RA 11199 (Social Security Act of 2018) Sec. 19 schedule; SSS circulars on the 2023 contribution table",
    SSS_URL,
    "Rates, split and MSC range to confirm against the SSS circular. Employees' Compensation (EC) and WISP portions not modeled.",
  ),
  rule<SssValue>(
    "sss-2025",
    "employer.sss",
    "employer_contributions",
    "all",
    { rate: "0.15", employer_rate: "0.10", employee_rate: "0.05", msc_floor: "5000", msc_ceiling: "35000", msc_step: "500" },
    "2025-01-01",
    null,
    "RA 11199 (Social Security Act of 2018) Sec. 19 schedule; SSS circular on the 2025 contribution table",
    SSS_URL,
    "To confirm: rate, split and MSC range for 2025 onwards. EC contribution and WISP (provident fund) split not modeled.",
  ),
  rule<PhilHealthValue>(
    "philhealth-2024",
    "employer.philhealth",
    "employer_contributions",
    "all",
    { rate: "0.05", employee_share: "0.5", income_floor: "10000", income_ceiling: "100000" },
    "2024-01-01",
    null,
    "RA 11223 (Universal Health Care Act) Sec. 10 premium schedule; PhilHealth circulars",
    PH_URL,
    "To confirm: 5% premium, equal sharing, and the ₱10,000 floor / ₱100,000 ceiling.",
  ),
  rule<PagIbigValue>(
    "pagibig-pre-2024",
    "employer.pagibig",
    "employer_contributions",
    "all",
    { employee_rate: "0.02", employee_rate_low: "0.01", low_income_limit: "1500", employer_rate: "0.02", max_compensation: "5000" },
    "2009-07-21",
    "2024-01-31",
    "RA 9679 (Home Development Mutual Fund Law of 2009) Sec. 7; HDMF rules",
    HDMF_URL,
    "LOW CONFIDENCE: effectivity date and ₱5,000 maximum compensation base to confirm.",
  ),
  rule<PagIbigValue>(
    "pagibig-2024",
    "employer.pagibig",
    "employer_contributions",
    "all",
    { employee_rate: "0.02", employee_rate_low: "0.01", low_income_limit: "1500", employer_rate: "0.02", max_compensation: "10000" },
    "2024-02-01",
    null,
    "RA 9679 Sec. 7; HDMF circular raising the maximum fund salary to ₱10,000 (number to confirm)",
    HDMF_URL,
    "To confirm: ₱10,000 maximum monthly compensation (₱200 maximum each from employee and employer).",
  ),
  rule<ThirteenthMonthValue>(
    "thirteenth-month-pd851",
    "employer.thirteenth_month",
    "employer_contributions",
    "all",
    { fraction_of_basic_salary: "0.0833333333", pay_by_month: 12, pay_by_day: 24 },
    "1975-12-16",
    null,
    "PD 851 (13th Month Pay Law) and its implementing rules: 1/12 of the total basic salary earned within the calendar year, paid on or before 24 December",
    "https://www.dole.gov.ph/",
    "To confirm: coverage (rank-and-file employees) and exemptions under the implementing rules.",
  ),
  rule<{ years: number }>(
    "books-retention",
    "bookkeeping.retention_years",
    "bookkeeping",
    "all",
    { years: 5 },
    "2018-01-01",
    null,
    "NIRC Sec. 235, as amended (preservation of books of accounts and records)",
    BIR_URL,
    "LOW CONFIDENCE: retention period and when it starts to run (to confirm, including any change under RA 11976).",
  ),
  rule<{ quarterly_gross_over: string }>(
    "books-audit-threshold-train",
    "bookkeeping.audit_threshold",
    "bookkeeping",
    "all",
    { quarterly_gross_over: "3000000" },
    "2018-01-01",
    null,
    "NIRC Sec. 232(A), as amended by RA 10963 (TRAIN): books audited by an independent CPA when gross quarterly sales, earnings, receipts or output exceed the threshold",
    BIR_URL,
    "To confirm: the ₱3,000,000 threshold, whether it is per quarter, and how it applies to corporations (which attach audited statements under other rules).",
  ),
  rule<{ month: number; by_day: number }>(
    "lgu-permit-renewal",
    "lgu.permit_renewal",
    "lgu",
    "all",
    { month: 1, by_day: 20 },
    "1992-01-01",
    null,
    "RA 7160 (Local Government Code) Secs. 165 and 167: renewal and payment within the first 20 days of January",
    null,
    "To confirm: LGUs may extend the deadline by ordinance.",
  ),
  rule<{ options: string[]; quarterly_due_within_days: number }>(
    "lgu-business-tax-payment",
    "lgu.business_tax_payment",
    "lgu",
    "all",
    { options: ["annual", "quarterly"], quarterly_due_within_days: 20 },
    "1992-01-01",
    null,
    "RA 7160 Sec. 165: local taxes may be paid annually or in quarterly installments within the first 20 days of each quarter",
    null,
    "To confirm: installment rules and surcharges are set by each LGU's revenue code.",
  ),
];
