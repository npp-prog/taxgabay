import type { ISODate } from "@taxgabay/tax-engine";

export type AccountType = "asset" | "liability" | "equity" | "revenue" | "expense";

/** Where an account appears in the financial statements. */
export type Section =
  | "current_assets"
  | "noncurrent_assets"
  | "current_liabilities"
  | "noncurrent_liabilities"
  | "equity"
  | "revenue"
  | "cost_of_sales"
  | "expenses"
  | "other_income"
  | "income_tax"
  | "temporary";

export interface Account {
  code: string;
  name: string;
  type: AccountType;
  section: Section;
  /** Contra accounts carry the opposite normal balance (e.g. accumulated depreciation, drawings). */
  contra?: boolean;
  /** Plain-language explanation for learners. */
  description?: string;
}

export type Side = "debit" | "credit";

/**
 * Books of accounts commonly kept by Philippine small businesses:
 * GJ general journal, CRB cash receipts book, CDB cash disbursements book,
 * SJ sales journal (credit sales), PJ purchase journal (credit purchases).
 */
export type BookCode = "GJ" | "CRB" | "CDB" | "SJ" | "PJ";

export interface EntryLine {
  account: string;
  /** Decimal string, e.g. "1500.00". Exactly one of debit/credit per line. */
  debit?: string;
  credit?: string;
}

export type EntryKind = "opening" | "regular" | "adjusting" | "closing";

export interface JournalEntry {
  id: string;
  date: ISODate;
  book: BookCode;
  memo: string;
  lines: EntryLine[];
  kind?: EntryKind;
}
