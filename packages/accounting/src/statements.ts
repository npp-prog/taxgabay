import { dec, money, type Dec, type ISODate } from "@taxgabay/tax-engine";
import { isTemporary, normalBalance, type Chart } from "./chart";
import { netOf, post, type Ledger } from "./ledger";
import type { Account, JournalEntry, Section } from "./types";

export interface StatementLine {
  code: string;
  name: string;
  /** Amount shown on the statement (positive on the section's normal side; contra accounts shown negative). */
  amount: string;
}

export interface StatementSection {
  key: Section;
  title: string;
  lines: StatementLine[];
  total: string;
}

const TITLES: Record<Section, string> = {
  current_assets: "Current assets",
  noncurrent_assets: "Non-current assets",
  current_liabilities: "Current liabilities",
  noncurrent_liabilities: "Non-current liabilities",
  equity: "Equity",
  revenue: "Revenue",
  cost_of_sales: "Cost of sales",
  expenses: "Operating expenses",
  other_income: "Other income",
  income_tax: "Income tax",
  temporary: "Income summary",
};

/** Amount of an account on its section's natural side. */
function sectionAmount(a: Account, n: Dec): Dec {
  // Section natural side: assets/expenses/cost/tax debit; liabilities/equity/revenue/other income credit.
  const debitSection = a.section === "current_assets" || a.section === "noncurrent_assets" || a.section === "expenses" || a.section === "cost_of_sales" || a.section === "income_tax";
  return debitSection ? n : n.negated();
}

function section(ledger: Ledger, key: Section, filter: (a: Account) => boolean = () => true): StatementSection {
  const lines: StatementLine[] = [];
  let total = dec(0);
  for (const la of ledger.values()) {
    if (la.account.section !== key || !filter(la.account)) continue;
    const amt = sectionAmount(la.account, netOf(la));
    if (amt.isZero()) continue;
    lines.push({ code: la.account.code, name: la.account.name, amount: money(amt) });
    total = total.plus(amt);
  }
  return { key, title: TITLES[key], lines, total: money(total) };
}

export interface IncomeStatement {
  revenue: StatementSection;
  costOfSales: StatementSection;
  grossProfit: string;
  expenses: StatementSection;
  otherIncome: StatementSection;
  incomeBeforeTax: string;
  incomeTax: StatementSection;
  netIncome: string;
}

export function incomeStatement(ledger: Ledger): IncomeStatement {
  const revenue = section(ledger, "revenue");
  const costOfSales = section(ledger, "cost_of_sales");
  const expenses = section(ledger, "expenses");
  const otherIncome = section(ledger, "other_income");
  const incomeTax = section(ledger, "income_tax");
  const gross = dec(revenue.total).minus(costOfSales.total);
  const beforeTax = gross.minus(expenses.total).plus(otherIncome.total);
  return {
    revenue,
    costOfSales,
    grossProfit: money(gross),
    expenses,
    otherIncome,
    incomeBeforeTax: money(beforeTax),
    incomeTax,
    netIncome: money(beforeTax.minus(incomeTax.total)),
  };
}

export interface ChangesInEquity {
  /** Permanent equity accounts at the start (from opening entries). */
  opening: StatementLine[];
  additions: StatementLine[];
  netIncome: string;
  withdrawals: StatementLine[];
  ending: string;
}

export interface BalanceSheet {
  currentAssets: StatementSection;
  noncurrentAssets: StatementSection;
  totalAssets: string;
  currentLiabilities: StatementSection;
  noncurrentLiabilities: StatementSection;
  totalLiabilities: string;
  equity: StatementLine[];
  totalEquity: string;
  totalLiabilitiesAndEquity: string;
  balanced: boolean;
}

export interface FinancialStatements {
  periodEnd: ISODate;
  incomeStatement: IncomeStatement;
  changesInEquity: ChangesInEquity;
  balanceSheet: BalanceSheet;
}

/**
 * Financial statements from opening, regular and adjusting entries (closing entries are ignored,
 * so this works before or after closing). Net income is added to equity on the balance sheet
 * under the retained-earnings or capital account named by `earningsAccount`.
 */
export function financialStatements(entries: readonly JournalEntry[], chart: Chart, periodEnd: ISODate, earningsAccount: string): FinancialStatements {
  const ledger = post(entries.filter((e) => (e.kind ?? "regular") !== "closing" && e.date <= periodEnd), chart);
  const is = incomeStatement(ledger);
  const openingLedger = post(entries.filter((e) => e.kind === "opening"), chart);

  const perm = [...ledger.values()].filter((la) => la.account.type === "equity" && !isTemporary(la.account));
  const opening: StatementLine[] = [];
  const additions: StatementLine[] = [];
  const equity: StatementLine[] = [];
  let endingTotal = dec(0);
  const drawings = [...ledger.values()].filter((d) => d.account.type === "equity" && d.account.contra);
  const totalDrawings = drawings.reduce((sum, d) => sum.plus(d.balance), dec(0));
  for (const la of perm) {
    const start = dec(openingLedger.get(la.account.code)!.balance);
    const now = dec(la.balance);
    if (!start.isZero()) opening.push({ code: la.account.code, name: la.account.name, amount: money(start) });
    if (!now.minus(start).isZero()) additions.push({ code: la.account.code, name: la.account.name, amount: money(now.minus(start)) });
    // Net income and drawings/dividends are carried into the capital or retained-earnings account.
    const shown = la.account.code === earningsAccount ? now.plus(is.netIncome).minus(totalDrawings) : now;
    if (!shown.isZero()) equity.push({ code: la.account.code, name: la.account.name, amount: money(shown) });
    endingTotal = endingTotal.plus(shown);
  }
  const withdrawals = drawings.filter((d) => !dec(d.balance).isZero()).map((d) => ({ code: d.account.code, name: d.account.name, amount: d.balance }));

  const currentAssets = section(ledger, "current_assets");
  const noncurrentAssets = section(ledger, "noncurrent_assets");
  const currentLiabilities = section(ledger, "current_liabilities");
  const noncurrentLiabilities = section(ledger, "noncurrent_liabilities");
  const totalAssets = dec(currentAssets.total).plus(noncurrentAssets.total);
  const totalLiabilities = dec(currentLiabilities.total).plus(noncurrentLiabilities.total);
  const tle = totalLiabilities.plus(endingTotal);
  return {
    periodEnd,
    incomeStatement: is,
    changesInEquity: { opening, additions, netIncome: is.netIncome, withdrawals, ending: money(endingTotal) },
    balanceSheet: {
      currentAssets,
      noncurrentAssets,
      totalAssets: money(totalAssets),
      currentLiabilities,
      noncurrentLiabilities,
      totalLiabilities: money(totalLiabilities),
      equity,
      totalEquity: money(endingTotal),
      totalLiabilitiesAndEquity: money(tle),
      balanced: totalAssets.equals(tle),
    },
  };
}

/**
 * Closing entries: revenues and expenses to Income Summary, Income Summary to the capital or
 * retained-earnings account, and drawings/dividends to the same account.
 */
export function closingEntries(entries: readonly JournalEntry[], chart: Chart, date: ISODate, incomeSummary: string, earningsAccount: string): JournalEntry[] {
  const ledger = post(entries.filter((e) => (e.kind ?? "regular") !== "closing"), chart);
  const nominal = [...ledger.values()].filter((la) => (la.account.type === "revenue" || la.account.type === "expense") && !netOf(la).isZero());
  const out: JournalEntry[] = [];
  const credits = nominal.filter((la) => netOf(la).isNegative());
  const debits = nominal.filter((la) => netOf(la).isPositive());
  const sumCr = credits.reduce((s, la) => s.plus(netOf(la).negated()), dec(0));
  const sumDr = debits.reduce((s, la) => s.plus(netOf(la)), dec(0));
  if (credits.length) {
    out.push({ id: "close-revenue", date, book: "GJ", kind: "closing", memo: "To close revenue accounts", lines: [...credits.map((la) => ({ account: la.account.code, debit: money(netOf(la).negated()) })), { account: incomeSummary, credit: money(sumCr) }] });
  }
  if (debits.length) {
    out.push({ id: "close-expenses", date, book: "GJ", kind: "closing", memo: "To close expense accounts", lines: [{ account: incomeSummary, debit: money(sumDr) }, ...debits.map((la) => ({ account: la.account.code, credit: money(netOf(la)) }))] });
  }
  const ni = sumCr.minus(sumDr);
  if (!ni.isZero()) {
    out.push({
      id: "close-income-summary",
      date,
      book: "GJ",
      kind: "closing",
      memo: ni.isPositive() ? "To close net income to equity" : "To close net loss to equity",
      lines: ni.isPositive() ? [{ account: incomeSummary, debit: money(ni) }, { account: earningsAccount, credit: money(ni) }] : [{ account: earningsAccount, debit: money(ni.negated()) }, { account: incomeSummary, credit: money(ni.negated()) }],
    });
  }
  for (const la of ledger.values()) {
    if (la.account.type === "equity" && la.account.contra && !dec(la.balance).isZero()) {
      out.push({ id: `close-${la.account.code}`, date, book: "GJ", kind: "closing", memo: `To close ${la.account.name}`, lines: [{ account: earningsAccount, debit: la.balance }, { account: la.account.code, credit: la.balance }] });
    }
  }
  return out;
}

export interface WorksheetRow {
  code: string;
  name: string;
  tb: [string | null, string | null];
  adjustments: [string | null, string | null];
  adjusted: [string | null, string | null];
  incomeStatement: [string | null, string | null];
  balanceSheet: [string | null, string | null];
}

export interface Worksheet {
  rows: WorksheetRow[];
  totals: Record<"tb" | "adjustments" | "adjusted" | "incomeStatement" | "balanceSheet", [string, string]>;
  netIncome: string;
}

const pair = (n: Dec): [string | null, string | null] => (n.isZero() ? [null, null] : n.isPositive() ? [money(n), null] : [null, money(n.negated())]);

/** 10-column worksheet: trial balance, adjustments, adjusted TB, income statement, balance sheet. */
export function worksheet(entries: readonly JournalEntry[], chart: Chart): Worksheet {
  const base = post(entries.filter((e) => e.kind !== "adjusting" && e.kind !== "closing"), chart);
  const adj = post(entries.filter((e) => e.kind === "adjusting"), chart);
  const rows: WorksheetRow[] = [];
  const t = { tb: [dec(0), dec(0)], adjustments: [dec(0), dec(0)], adjusted: [dec(0), dec(0)], incomeStatement: [dec(0), dec(0)], balanceSheet: [dec(0), dec(0)] };
  const add = (k: keyof typeof t, n: Dec) => {
    if (n.isPositive()) t[k][0] = t[k][0]!.plus(n);
    else t[k][1] = t[k][1]!.plus(n.negated());
  };
  for (const a of chart.values()) {
    const b = netOf(base.get(a.code)!);
    const ad = adj.get(a.code)!;
    const adDr = dec(ad.totalDebit);
    const adCr = dec(ad.totalCredit);
    const adjusted = b.plus(adDr).minus(adCr);
    if (b.isZero() && adDr.isZero() && adCr.isZero()) continue;
    const toIS = a.type === "revenue" || a.type === "expense";
    rows.push({
      code: a.code,
      name: a.name,
      tb: pair(b),
      adjustments: [adDr.isZero() ? null : money(adDr), adCr.isZero() ? null : money(adCr)],
      adjusted: pair(adjusted),
      incomeStatement: toIS ? pair(adjusted) : [null, null],
      balanceSheet: toIS ? [null, null] : pair(adjusted),
    });
    add("tb", b);
    t.adjustments[0] = t.adjustments[0]!.plus(adDr);
    t.adjustments[1] = t.adjustments[1]!.plus(adCr);
    add("adjusted", adjusted);
    add(toIS ? "incomeStatement" : "balanceSheet", adjusted);
  }
  const ni = t.incomeStatement[1]!.minus(t.incomeStatement[0]!);
  const fmt = (k: keyof typeof t): [string, string] => [money(t[k][0]!), money(t[k][1]!)];
  return { rows, totals: { tb: fmt("tb"), adjustments: fmt("adjustments"), adjusted: fmt("adjusted"), incomeStatement: fmt("incomeStatement"), balanceSheet: fmt("balanceSheet") }, netIncome: money(ni) };
}

export { normalBalance };
