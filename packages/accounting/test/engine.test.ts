import { describe, expect, it } from "vitest";
import {
  checkEntry,
  closingEntries,
  financialStatements,
  getAccount,
  isTemporary,
  makeChart,
  normalBalance,
  post,
  trialBalance,
  validateEntry,
  worksheet,
  type Account,
  type JournalEntry,
} from "../src";

const accounts: Account[] = [
  { code: "101", name: "Cash", type: "asset", section: "current_assets" },
  { code: "110", name: "Accounts Receivable", type: "asset", section: "current_assets" },
  { code: "130", name: "Prepaid Rent", type: "asset", section: "current_assets" },
  { code: "150", name: "Equipment", type: "asset", section: "noncurrent_assets" },
  { code: "151", name: "Accumulated Depreciation", type: "asset", section: "noncurrent_assets", contra: true },
  { code: "201", name: "Accounts Payable", type: "liability", section: "current_liabilities" },
  { code: "301", name: "Ana Cruz, Capital", type: "equity", section: "equity" },
  { code: "302", name: "Ana Cruz, Drawing", type: "equity", section: "equity", contra: true },
  { code: "399", name: "Income Summary", type: "equity", section: "temporary" },
  { code: "401", name: "Service Income", type: "revenue", section: "revenue" },
  { code: "501", name: "Rent Expense", type: "expense", section: "expenses" },
  { code: "502", name: "Depreciation Expense", type: "expense", section: "expenses" },
];
const chart = makeChart(accounts);

// Hand-checked mini month:
// Opening: Cash 50,000; Equipment 30,000 / Capital 80,000
// Services on account 40,000; collected 25,000; prepaid rent 12,000 (3 months); owner drew 5,000
// Adjust: rent used 4,000; depreciation 500.
// NI = 40,000 − 4,000 − 500 = 35,500. Cash = 50,000 + 25,000 − 12,000 − 5,000 = 58,000.
const E: JournalEntry[] = [
  { id: "o1", date: "2026-01-01", book: "GJ", kind: "opening", memo: "Opening", lines: [{ account: "101", debit: "50000" }, { account: "150", debit: "30000" }, { account: "301", credit: "80000" }] },
  { id: "t1", date: "2026-01-05", book: "SJ", memo: "Billed client", lines: [{ account: "110", debit: "40000" }, { account: "401", credit: "40000" }] },
  { id: "t2", date: "2026-01-20", book: "CRB", memo: "Collected", lines: [{ account: "101", debit: "25000" }, { account: "110", credit: "25000" }] },
  { id: "t3", date: "2026-01-02", book: "CDB", memo: "Paid 3 months rent", lines: [{ account: "130", debit: "12000" }, { account: "101", credit: "12000" }] },
  { id: "t4", date: "2026-01-31", book: "CDB", memo: "Owner withdrawal", lines: [{ account: "302", debit: "5000" }, { account: "101", credit: "5000" }] },
  { id: "a1", date: "2026-01-31", book: "GJ", kind: "adjusting", memo: "Rent used", lines: [{ account: "501", debit: "4000" }, { account: "130", credit: "4000" }] },
  { id: "a2", date: "2026-01-31", book: "GJ", kind: "adjusting", memo: "Depreciation", lines: [{ account: "502", debit: "500" }, { account: "151", credit: "500" }] },
];

describe("chart", () => {
  it("knows normal balances and temporary accounts", () => {
    expect(normalBalance(getAccount(chart, "101"))).toBe("debit");
    expect(normalBalance(getAccount(chart, "151"))).toBe("credit");
    expect(normalBalance(getAccount(chart, "302"))).toBe("debit");
    expect(normalBalance(getAccount(chart, "401"))).toBe("credit");
    expect(isTemporary(getAccount(chart, "302"))).toBe(true);
    expect(isTemporary(getAccount(chart, "399"))).toBe(true);
    expect(isTemporary(getAccount(chart, "101"))).toBe(false);
    expect(() => getAccount(chart, "999")).toThrow(/Unknown/);
    expect(() => makeChart([accounts[0]!, accounts[0]!])).toThrow(/Duplicate/);
  });
});

describe("validateEntry", () => {
  it("accepts a balanced entry and explains problems", () => {
    expect(validateEntry(E[1]!, chart)).toEqual([]);
    expect(validateEntry({ lines: [{ account: "101", debit: "1" }] }, chart)[0]).toMatch(/at least one debit/);
    expect(validateEntry({ lines: [{ account: "999", debit: "1" }, { account: "101", credit: "1" }] }, chart)[0]).toMatch(/Line 1: choose an account/);
    expect(validateEntry({ lines: [{ account: "101", debit: "1", credit: "1" }, { account: "401", credit: "1" }] }, chart)[0]).toMatch(/either a debit or a credit/);
    expect(validateEntry({ lines: [{ account: "101", debit: "abc" }, { account: "401", credit: "1" }] }, chart)[0]).toMatch(/not a valid amount/);
    expect(validateEntry({ lines: [{ account: "101", debit: "0" }, { account: "401", credit: "0" }] }, chart)[0]).toMatch(/cannot be zero/);
    expect(validateEntry({ lines: [{ account: "101", debit: "100" }, { account: "401", credit: "90" }] }, chart)[0]).toMatch(/not equal/);
  });
});

describe("posting and trial balance", () => {
  it("posts in date order with running balances", () => {
    const l = post(E, chart);
    const cash = l.get("101")!;
    expect(cash.rows.map((r) => r.balance)).toEqual(["50000.00", "38000.00", "63000.00", "58000.00"]);
    expect(cash.balance).toBe("58000.00");
    expect(cash.totalDebit).toBe("75000.00");
    expect(cash.totalCredit).toBe("17000.00");
    expect(l.get("151")!.balance).toBe("500.00");
  });
  it("filters by entry kind and balances", () => {
    const unadjusted = trialBalance(post(E, chart, { kinds: ["opening", "regular"] }));
    expect(unadjusted.balanced).toBe(true);
    expect(unadjusted.totalDebit).toBe("120000.00");
    const adjusted = trialBalance(post(E, chart));
    expect(adjusted.totalDebit).toBe("120500.00");
    expect(adjusted.rows.find((r) => r.code === "151")).toMatchObject({ debit: null, credit: "500.00" });
  });
});

describe("worksheet", () => {
  it("builds the 10 columns and net income", () => {
    const w = worksheet(E, chart);
    expect(w.totals.tb).toEqual(["120000.00", "120000.00"]);
    expect(w.totals.adjustments).toEqual(["4500.00", "4500.00"]);
    expect(w.totals.adjusted).toEqual(["120500.00", "120500.00"]);
    expect(w.netIncome).toBe("35500.00");
    const rent = w.rows.find((r) => r.code === "501")!;
    expect(rent).toMatchObject({ tb: [null, null], adjustments: ["4000.00", null], incomeStatement: ["4000.00", null], balanceSheet: [null, null] });
    expect(w.rows.find((r) => r.code === "130")!.balanceSheet).toEqual(["8000.00", null]);
  });
});

describe("financial statements and closing", () => {
  it("prepares statements that balance", () => {
    const fs = financialStatements(E, chart, "2026-01-31", "301");
    expect(fs.incomeStatement.revenue.total).toBe("40000.00");
    expect(fs.incomeStatement.expenses.total).toBe("4500.00");
    expect(fs.incomeStatement.netIncome).toBe("35500.00");
    expect(fs.changesInEquity).toMatchObject({ netIncome: "35500.00", ending: "110500.00" });
    expect(fs.changesInEquity.withdrawals).toEqual([{ code: "302", name: "Ana Cruz, Drawing", amount: "5000.00" }]);
    expect(fs.balanceSheet.noncurrentAssets.lines).toEqual([
      { code: "150", name: "Equipment", amount: "30000.00" },
      { code: "151", name: "Accumulated Depreciation", amount: "-500.00" },
    ]);
    expect(fs.balanceSheet.totalAssets).toBe("110500.00");
    expect(fs.balanceSheet.balanced).toBe(true);
  });
  it("closes temporary accounts and the books still balance", () => {
    const closing = closingEntries(E, chart, "2026-01-31", "399", "301");
    expect(closing.map((c) => c.id)).toEqual(["close-revenue", "close-expenses", "close-income-summary", "close-302"]);
    const after = post([...E, ...closing], chart);
    for (const code of ["401", "501", "502", "302", "399"]) expect(after.get(code)!.balance).toBe("0.00");
    expect(after.get("301")!.balance).toBe("110500.00");
    expect(trialBalance(after).balanced).toBe(true);
    // Statements ignore closing entries, so they are the same before and after closing.
    expect(financialStatements([...E, ...closing], chart, "2026-01-31", "301").incomeStatement.netIncome).toBe("35500.00");
  });
  it("closes a net loss", () => {
    const loss: JournalEntry[] = [E[0]!, { id: "x", date: "2026-01-10", book: "CDB", memo: "Rent", lines: [{ account: "501", debit: "1000" }, { account: "101", credit: "1000" }] }];
    const c = closingEntries(loss, chart, "2026-01-31", "399", "301");
    expect(c.map((x) => x.id)).toEqual(["close-expenses", "close-income-summary"]);
    expect(c[1]!.lines[0]).toEqual({ account: "301", debit: "1000.00" });
  });
});

describe("checkEntry", () => {
  const key = { lines: [{ account: "130", debit: "12000" }, { account: "101", credit: "12000" }] };
  it("accepts a correct answer in any order and with commas", () => {
    expect(checkEntry([{ account: "101", credit: "12,000.00" }, { account: "130", debit: "12000" }], key, chart)).toEqual({ correct: true, feedback: [] });
  });
  it("ignores blank rows and accepts amounts split across lines of one account", () => {
    expect(checkEntry([{ account: "130", debit: "6000" }, { account: "130", debit: "6000" }, { account: "101", credit: "12000" }, { account: "", debit: "", credit: "" }], key, chart).correct).toBe(true);
  });
  it("explains wrong account, side, amount and missing lines", () => {
    expect(checkEntry([{ account: "501", debit: "12000" }, { account: "101", credit: "12000" }], key, chart).feedback.map((f) => f.kind)).toEqual(["extra", "missing"]);
    expect(checkEntry([{ account: "101", debit: "12000" }, { account: "130", credit: "12000" }], key, chart).feedback.map((f) => f.kind)).toEqual(["wrong_side", "wrong_side"]);
    const amt = checkEntry([{ account: "130", debit: "1200" }, { account: "101", credit: "1200" }], key, chart).feedback;
    expect(amt.map((f) => f.message)).toEqual(["The amount for Prepaid Rent is too low (you entered ₱1,200.00).", "The amount for Cash is too low (you entered ₱1,200.00)."]);
    const three = { lines: [{ account: "501", debit: "4000" }, { account: "502", debit: "500" }, { account: "130", credit: "4000" }, { account: "151", credit: "500" }] };
    expect(checkEntry([{ account: "501", debit: "4000" }, { account: "130", credit: "4000" }], three, chart).feedback.map((f) => f.message)).toEqual([
      "One account that should be debited is missing.",
      "One account that should be credited is missing.",
    ]);
    expect(checkEntry([{ account: "130", debit: "12000" }, { account: "101", credit: "11000" }], key, chart).feedback[0]!.kind).toBe("unbalanced");
    expect(checkEntry([{ account: "", debit: "5" }], key, chart).feedback[0]!.kind).toBe("form");
  });
  it("reports several missing accounts", () => {
    const k = { lines: [{ account: "501", debit: "1" }, { account: "502", debit: "1" }, { account: "130", credit: "1" }, { account: "151", credit: "1" }] };
    const r = checkEntry([{ account: "110", debit: "2" }, { account: "201", credit: "2" }], k, chart);
    expect(r.feedback.filter((f) => f.kind === "missing").map((f) => f.message)).toEqual(["2 accounts that should be debited are missing.", "2 accounts that should be credited are missing."]);
  });
});
