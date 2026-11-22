import { dec, money, type ISODate, type Profile, type Step } from "@taxgabay/tax-engine";
import { makeChart, type Chart } from "./chart";
import { lineNet } from "./journal";
import type { Account, BookCode, EntryLine, JournalEntry } from "./types";

export type Track = "owner" | "student";

export interface SourceDocument {
  type: "sales_invoice" | "official_receipt" | "cash_voucher" | "supplier_invoice" | "payroll_register" | "bank_statement" | "deposit_slip" | "form_2307" | "memo";
  number?: string;
  party?: string;
  /** What the document shows, in one or two lines. */
  details: string;
}

export interface PracticeTransaction {
  id: string;
  date: ISODate;
  /** What happened, as the learner reads it. */
  narrative: string;
  document?: SourceDocument;
  book: BookCode;
  answer: EntryLine[];
  /** Why the entry is made this way. */
  explanation: string;
  /** Extra plain-language tip for business owners (BIR or bookkeeping angle). */
  ownerTip?: string;
}

export interface ReturnLine {
  form: string;
  title: string;
  period: string;
  steps: Step[];
  /** Plain-language summary of what is filed and paid. */
  summary: string;
  notes: string[];
}

export interface PracticeContext {
  set: PracticeSet;
  chart: Chart;
  /** Opening, regular and adjusting entries from the answer key. */
  entries: JournalEntry[];
  /** Net movement (debit positive) of accounts within dates, from the answer key. */
  net: (codes: string[], from?: ISODate, to?: ISODate) => string;
}

export interface PracticeSet {
  slug: string;
  title: string;
  summary: string;
  business: {
    name: string;
    owner: string;
    form: "sole_proprietorship" | "corporation";
    description: string;
    /** Tax profile used for the calendar and returns. */
    profile: Profile;
  };
  period: { from: ISODate; to: ISODate; label: string };
  level: "beginner" | "intermediate";
  learningGoals: string[];
  accounts: Account[];
  opening: { date: ISODate; memo: string; lines: EntryLine[] };
  transactions: PracticeTransaction[];
  adjustments: PracticeTransaction[];
  incomeSummaryAccount: string;
  earningsAccount: string;
  /** Books the business must keep (owner track shows these). */
  books: BookCode[];
  /** Tax returns computed from the books with the tax engine. */
  returns: (ctx: PracticeContext) => ReturnLine[];
  /** Verified by the CPA? All seeded sets start unverified. */
  needs_verification: boolean;
}

export const BOOK_NAMES: Record<BookCode, string> = {
  GJ: "General journal",
  CRB: "Cash receipts book",
  CDB: "Cash disbursements book",
  SJ: "Sales journal",
  PJ: "Purchase journal",
};

/** Answer-key journal entries for a set: opening, transactions, adjustments. */
export function answerEntries(set: PracticeSet): JournalEntry[] {
  return [
    { id: "opening", date: set.opening.date, book: "GJ", kind: "opening", memo: set.opening.memo, lines: set.opening.lines },
    ...set.transactions.map((t) => ({ id: t.id, date: t.date, book: t.book, kind: "regular" as const, memo: t.narrative, lines: t.answer })),
    ...set.adjustments.map((t) => ({ id: t.id, date: t.date, book: t.book, kind: "adjusting" as const, memo: t.narrative, lines: t.answer })),
  ];
}

export function practiceContext(set: PracticeSet): PracticeContext {
  const chart = makeChart(set.accounts);
  const entries = answerEntries(set);
  const net = (codes: string[], from?: ISODate, to?: ISODate) => {
    let n = dec(0);
    for (const e of entries) {
      if (e.kind === "opening") continue;
      if ((from && e.date < from) || (to && e.date > to)) continue;
      for (const l of e.lines) if (codes.includes(l.account)) n = n.plus(lineNet(l));
    }
    return money(n);
  };
  return { set, chart, entries, net };
}

/**
 * Entries a learner has answered, in place of the answer key; unanswered or wrong ones are left
 * out so the learner's ledger shows only their own correct work.
 */
export function learnerEntries(set: PracticeSet, answered: ReadonlySet<string>): JournalEntry[] {
  return answerEntries(set).filter((e) => e.kind === "opening" || answered.has(e.id));
}
