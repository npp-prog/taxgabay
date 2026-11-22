import type { ISODate } from "@taxgabay/tax-engine";

/**
 * Which computed value goes into which box of a BIR form version. The BIR item numbers are
 * deliberately left empty (`item: null`) until Neil Priolo, CPA confirms them against the
 * current form; the label describes the box in words so the client can find it meanwhile.
 */
export interface FormLine {
  form: string;
  field_key: string;
  label: string;
  item: string | null;
  effective_from: ISODate;
  effective_to: ISODate | null;
  legal_basis: string;
  source_url: string | null;
  last_verified_at: ISODate | null;
  needs_verification: boolean;
}

const line = (form: string, field_key: string, label: string, legal_basis: string): FormLine => ({
  form,
  field_key,
  label,
  item: null,
  effective_from: "2018-01-01",
  effective_to: null,
  legal_basis,
  source_url: null,
  last_verified_at: null,
  needs_verification: true,
});

const PT = "NIRC Sec. 116, as amended; RR 7-2024 (to confirm form version)";
const EWT = "NIRC Sec. 57(B); RR 2-98, as amended";
const IT = "NIRC Secs. 24(A), 74; RR 8-2018";
const VAT = "NIRC Secs. 106, 108, 110 and 114, as amended; RR 16-2005, as amended";

export const formLines: FormLine[] = [
  line("2551Q", "gross_sales", "Total gross sales/receipts for the quarter (taxable at the percentage tax rate)", PT),
  line("2551Q", "rate", "Tax rate", PT),
  line("2551Q", "tax_due", "Percentage tax due", PT),
  line("2551Q", "payable", "Tax still payable", PT),

  line("0619E", "total_withheld", "Total expanded withholding tax withheld for the month", EWT),
  line("0619E", "payable", "Amount of remittance", EWT),

  line("1601EQ", "total_withheld", "Total taxes withheld for the quarter (from the schedule by ATC)", EWT),
  line("1601EQ", "remitted_month1", "Less: remittance made for the first month of the quarter (0619E)", EWT),
  line("1601EQ", "remitted_month2", "Less: remittance made for the second month of the quarter (0619E)", EWT),
  line("1601EQ", "payable", "Tax still due / amount payable", EWT),

  line("2550Q", "vatable_sales", "Vatable sales for the quarter (net of VAT)", VAT),
  line("2550Q", "output_vat", "Output tax on vatable sales", VAT),
  line("2550Q", "zero_rated_sales", "Zero-rated sales", VAT),
  line("2550Q", "exempt_sales", "Exempt sales", VAT),
  line("2550Q", "total_sales", "Total sales for the quarter", VAT),
  line("2550Q", "purchases_capital_goods", "Purchases of capital goods (net of VAT)", VAT),
  line("2550Q", "purchases_goods", "Domestic purchases of goods other than capital goods (net of VAT)", VAT),
  line("2550Q", "purchases_services", "Domestic purchases of services (net of VAT)", VAT),
  line("2550Q", "purchases_no_vat", "Purchases not subject to VAT (from non-VAT suppliers, or exempt)", VAT),
  line("2550Q", "input_vat_current", "Input tax on purchases this quarter", VAT),
  line("2550Q", "input_vat_carried_over", "Add: excess input tax carried over from the previous quarter", VAT),
  line("2550Q", "total_input_vat", "Total available input tax", VAT),
  line("2550Q", "payable", "VAT payable / (excess input tax carried forward)", VAT),

  line("1701Q", "gross_cumulative", "Total sales/revenues/receipts/fees, cumulative to the end of this quarter", IT),
  line("1701Q", "deductions", "Less: allowable deduction (OSD, itemized, or the ₱250,000 under the 8% option)", IT),
  line("1701Q", "taxable_income", "Taxable income to date", IT),
  line("1701Q", "tax_due", "Income tax due to date", IT),
  line("1701Q", "prior_payments", "Less: tax paid in previous quarter(s) of the same year", IT),
  line("1701Q", "cwt", "Less: creditable tax withheld per BIR Form 2307 (to date)", IT),
  line("1701Q", "payable", "Tax payable / (overpayment)", IT),

  line("1701A", "gross", "Total gross sales/receipts/fees for the year", IT),
  line("1701A", "deductions", "Less: allowable deduction (OSD or the ₱250,000 under the 8% option)", IT),
  line("1701A", "taxable_income", "Taxable income", IT),
  line("1701A", "tax_due", "Income tax due", IT),
  line("1701A", "quarterly_payments", "Less: tax paid in the 1701Q returns for the year", IT),
  line("1701A", "cwt", "Less: creditable tax withheld per BIR Form 2307 for the year", IT),
  line("1701A", "payable", "Tax payable / (overpayment)", IT),

  line("2307", "income_month1", "Amount of income payment — 1st month of the quarter", EWT),
  line("2307", "income_month2", "Amount of income payment — 2nd month of the quarter", EWT),
  line("2307", "income_month3", "Amount of income payment — 3rd month of the quarter", EWT),
  line("2307", "total_income", "Total income payments for the quarter", EWT),
  line("2307", "tax_withheld", "Tax withheld for the quarter", EWT),
];

export function linesFor(form: string, on: ISODate): FormLine[] {
  return formLines.filter((l) => l.form === form && l.effective_from <= on && (l.effective_to === null || on <= l.effective_to));
}
