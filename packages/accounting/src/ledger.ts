import { dec, money, type Dec } from "@taxgabay/tax-engine";
import { getAccount, normalBalance, type Chart } from "./chart";
import { lineNet, sortEntries } from "./journal";
import type { Account, BookCode, EntryKind, JournalEntry } from "./types";

export interface LedgerRow {
  date: string;
  entryId: string;
  book: BookCode;
  memo: string;
  debit: string | null;
  credit: string | null;
  /** Running balance on the account's normal side (negative = abnormal balance). */
  balance: string;
}

export interface LedgerAccount {
  account: Account;
  rows: LedgerRow[];
  totalDebit: string;
  totalCredit: string;
  /** Balance on the normal side. */
  balance: string;
}

export type Ledger = Map<string, LedgerAccount>;

export interface PostOptions {
  kinds?: EntryKind[];
}

/** Posts entries (in date order) to the ledger. Accounts with no activity are included with zero balance. */
export function post(entries: readonly JournalEntry[], chart: Chart, opts: PostOptions = {}): Ledger {
  const ledger: Ledger = new Map();
  const nets = new Map<string, Dec>();
  const dr = new Map<string, Dec>();
  const cr = new Map<string, Dec>();
  for (const a of chart.values()) {
    ledger.set(a.code, { account: a, rows: [], totalDebit: "0.00", totalCredit: "0.00", balance: "0.00" });
    nets.set(a.code, dec(0));
    dr.set(a.code, dec(0));
    cr.set(a.code, dec(0));
  }
  for (const e of sortEntries(entries)) {
    if (opts.kinds && !opts.kinds.includes(e.kind ?? "regular")) continue;
    for (const l of e.lines) {
      const a = getAccount(chart, l.account);
      const n = lineNet(l);
      nets.set(a.code, nets.get(a.code)!.plus(n));
      if (n.isPositive() && !n.isZero()) dr.set(a.code, dr.get(a.code)!.plus(n));
      else cr.set(a.code, cr.get(a.code)!.plus(n.negated()));
      const sign = normalBalance(a) === "debit" ? 1 : -1;
      ledger.get(a.code)!.rows.push({
        date: e.date,
        entryId: e.id,
        book: e.book,
        memo: e.memo,
        debit: l.debit ? money(l.debit) : null,
        credit: l.credit ? money(l.credit) : null,
        balance: money(nets.get(a.code)!.times(sign)),
      });
    }
  }
  for (const [code, la] of ledger) {
    const sign = normalBalance(la.account) === "debit" ? 1 : -1;
    la.totalDebit = money(dr.get(code)!);
    la.totalCredit = money(cr.get(code)!);
    la.balance = money(nets.get(code)!.times(sign));
  }
  return ledger;
}

/** Balance as a signed net (debit positive). */
export function netOf(la: LedgerAccount): Dec {
  const b = dec(la.balance);
  return normalBalance(la.account) === "debit" ? b : b.negated();
}

export interface TrialBalanceRow {
  code: string;
  name: string;
  debit: string | null;
  credit: string | null;
}

export interface TrialBalance {
  rows: TrialBalanceRow[];
  totalDebit: string;
  totalCredit: string;
  balanced: boolean;
}

/** Trial balance of accounts with a non-zero balance, in chart order. */
export function trialBalance(ledger: Ledger): TrialBalance {
  const rows: TrialBalanceRow[] = [];
  let td = dec(0);
  let tc = dec(0);
  for (const la of ledger.values()) {
    const n = netOf(la);
    if (n.isZero()) continue;
    if (n.isPositive()) {
      rows.push({ code: la.account.code, name: la.account.name, debit: money(n), credit: null });
      td = td.plus(n);
    } else {
      rows.push({ code: la.account.code, name: la.account.name, debit: null, credit: money(n.negated()) });
      tc = tc.plus(n.negated());
    }
  }
  return { rows, totalDebit: money(td), totalCredit: money(tc), balanced: td.equals(tc) };
}
