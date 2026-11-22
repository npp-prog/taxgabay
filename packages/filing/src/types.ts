import type { ISODate, Profile, Step } from "@taxgabay/tax-engine";

/** A person or company on a record. TIN is optional and handled under the client's consent. */
export interface Party {
  name: string;
  tin?: string | null;
  address?: string | null;
}

/** A sale or receipt (invoice issued). Non-VAT: the amount is the gross amount on the invoice. */
export interface SaleRecord {
  kind: "sale";
  id: string;
  date: ISODate;
  document_no: string;
  customer: Party;
  amount: string;
  /**
   * VAT-registered clients only: how the sale is treated for VAT. Vatable sales are recorded at
   * the invoice total including VAT. Defaults to "vatable".
   */
  vat_treatment?: "vatable" | "zero_rated" | "exempt";
  description?: string;
}

export type ExpenseCategory =
  | "cost_of_sales"
  | "rent"
  | "professional_fees"
  | "contractors"
  | "utilities"
  | "supplies"
  | "salaries"
  | "taxes_licenses"
  | "transportation"
  | "communication"
  | "repairs"
  | "equipment"
  | "other";

/** A purchase or expense paid. When the client withheld tax, `withholding` names the ATC. */
export interface ExpenseRecord {
  kind: "expense";
  id: string;
  date: ISODate;
  document_no?: string;
  supplier: Party;
  category: ExpenseCategory;
  /** Full amount of the bill (before tax withheld). */
  amount: string;
  /** Supplier is VAT-registered and the amount includes VAT (EWT is then computed net of VAT). */
  supplier_vat_registered?: boolean;
  withholding?: { atc: string } | null;
  description?: string;
}

/** A BIR Form 2307 received from a customer who withheld tax on the client's income. */
export interface Form2307Received {
  kind: "form_2307_received";
  id: string;
  /** Date the certificate was received. */
  date: ISODate;
  payor: Party;
  period_from: ISODate;
  period_to: ISODate;
  atc: string;
  income_payment: string;
  tax_withheld: string;
}

/**
 * Pay for one employee for one month (enter one record per employee per month; date = the month's
 * last payday). Employee shares of SSS, PhilHealth and Pag-IBIG are computed from basic pay.
 */
export interface PayrollRecord {
  kind: "payroll";
  id: string;
  date: ISODate;
  employee: Party;
  /** Basic pay and taxable allowances for the month. */
  basic_pay: string;
  /** 13th month pay and other benefits (bonuses) paid this month. */
  benefits?: string;
  /** De minimis benefits within the ceilings, paid this month. */
  de_minimis?: string;
  /** Minimum wage earner: exempt on statutory minimum wage. */
  minimum_wage_earner?: boolean;
}

export type ClientRecord = SaleRecord | ExpenseRecord | Form2307Received | PayrollRecord;

export interface ClientInfo {
  name: string;
  trade_name?: string | null;
  tin?: string | null;
  address?: string | null;
  rdo_code?: string | null;
  profile: Profile;
}

export interface QuarterRef {
  year: number;
  /** 1–4. Quarter 4 also prepares the annual return. */
  quarter: 1 | 2 | 3 | 4;
}

export type IssueSeverity = "error" | "warning";

export interface Issue {
  code: string;
  severity: IssueSeverity;
  message: string;
  record_id?: string;
}

/** One box on a return, described in words; `item` is the BIR item number once confirmed. */
export interface PreparedField {
  key: string;
  label: string;
  value: string;
  item: string | null;
}

export interface Schedule {
  columns: { key: string; label: string; align?: "left" | "right" }[];
  rows: Record<string, string>[];
}

export interface PreparedDocument {
  id: string;
  form: string;
  title: string;
  period_label: string;
  period_start: ISODate;
  period_end: ISODate;
  /** Due date from the deadline calendar (after weekend/holiday roll-over), when known. */
  due_date: ISODate | null;
  /** For certificates: who receives it. */
  recipient?: Party;
  fields: PreparedField[];
  steps: Step[];
  schedule?: Schedule;
  /** Amount to pay with this document ("0.00" for none or for schedules). */
  amount_payable: string;
  warnings: string[];
  rules_used: string[];
  /** True while any rule, line map or due date behind it awaits CPA verification. */
  needs_verification: boolean;
}

export interface Packet {
  client: string;
  period: QuarterRef;
  period_label: string;
  issues: Issue[];
  documents: PreparedDocument[];
  total_payable: string;
  /** Documents the engine knows are due but cannot prepare yet. */
  not_supported: { form: string; reason: string }[];
}
