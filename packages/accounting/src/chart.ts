import type { Account, Side } from "./types";

export function normalBalance(a: Pick<Account, "type" | "contra">): Side {
  const debitNormal = a.type === "asset" || a.type === "expense";
  return debitNormal !== Boolean(a.contra) ? "debit" : "credit";
}

export type Chart = ReadonlyMap<string, Account>;

export function makeChart(accounts: readonly Account[]): Chart {
  const m = new Map<string, Account>();
  for (const a of accounts) {
    if (m.has(a.code)) throw new Error(`Duplicate account code ${a.code}`);
    m.set(a.code, a);
  }
  return m;
}

export function getAccount(chart: Chart, code: string): Account {
  const a = chart.get(code);
  if (!a) throw new Error(`Unknown account ${code}`);
  return a;
}

/** Accounts closed at period end (revenue, expenses, drawings/dividends, income summary). */
export function isTemporary(a: Account): boolean {
  return a.type === "revenue" || a.type === "expense" || a.section === "temporary" || (a.type === "equity" && Boolean(a.contra));
}
