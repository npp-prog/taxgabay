import { describe, expect, it } from "vitest";
import {
  BOOK_NAMES,
  answerEntries,
  checkEntry,
  closingEntries,
  financialStatements,
  getPracticeSet,
  learnerEntries,
  post,
  practiceContext,
  practiceSets,
  trialBalance,
  validateEntry,
  worksheet,
} from "../src";

describe.each(practiceSets.map((s) => [s.slug, s] as const))("practice set %s", (_slug, set) => {
  const ctx = practiceContext(set);
  const all = [...set.transactions, ...set.adjustments];

  it("has unique ids, dates inside the period and books the set keeps", () => {
    expect(new Set(all.map((t) => t.id)).size).toBe(all.length);
    for (const t of all) {
      expect(t.date >= set.period.from && t.date <= set.period.to, t.id).toBe(true);
      expect(set.books, t.id).toContain(t.book);
      expect(t.narrative.length, t.id).toBeGreaterThan(10);
      expect(t.explanation.length, t.id).toBeGreaterThan(10);
    }
    expect(set.needs_verification).toBe(true);
  });

  it("has answer keys that are valid, balanced entries", () => {
    expect(validateEntry({ lines: set.opening.lines }, ctx.chart)).toEqual([]);
    for (const t of all) expect(validateEntry({ lines: t.answer }, ctx.chart), t.id).toEqual([]);
  });

  it("accepts its own answer key", () => {
    for (const t of all) expect(checkEntry(t.answer, { lines: t.answer }, ctx.chart).correct, t.id).toBe(true);
  });

  it("produces balanced books, worksheet and statements, and closes cleanly", () => {
    const entries = answerEntries(set);
    expect(trialBalance(post(entries, ctx.chart)).balanced).toBe(true);
    const w = worksheet(entries, ctx.chart);
    expect(w.totals.adjusted[0]).toBe(w.totals.adjusted[1]);
    const fs = financialStatements(entries, ctx.chart, set.period.to, set.earningsAccount);
    expect(fs.balanceSheet.balanced).toBe(true);
    expect(fs.incomeStatement.netIncome).toBe(w.netIncome);
    const closing = closingEntries(entries, ctx.chart, set.period.to, set.incomeSummaryAccount, set.earningsAccount);
    const after = post([...entries, ...closing], ctx.chart);
    for (const la of after.values()) {
      if (la.account.type === "revenue" || la.account.type === "expense" || la.account.contra && la.account.type === "equity" || la.account.section === "temporary") {
        expect(la.balance, la.account.code).toBe("0.00");
      }
    }
  });

  it("computes its tax returns from the books", () => {
    const returns = set.returns(ctx);
    expect(returns.length).toBeGreaterThan(0);
    for (const r of returns) {
      expect(r.steps.length).toBeGreaterThan(0);
      for (const s of r.steps) expect(s.amount).toMatch(/^-?\d+\.\d{2}$/);
      expect(r.summary.length).toBeGreaterThan(10);
    }
  });
});

describe("freelance designer worked totals (hand-checked)", () => {
  const set = getPracticeSet("freelance-designer")!;
  const ctx = practiceContext(set);
  const fs = financialStatements(answerEntries(set), ctx.chart, set.period.to, set.earningsAccount);
  it("matches the hand computation", () => {
    expect(fs.incomeStatement.revenue.total).toBe("136000.00");
    expect(fs.incomeStatement.expenses.total).toBe("48900.00");
    expect(fs.incomeStatement.netIncome).toBe("87100.00");
    const cash = fs.balanceSheet.currentAssets.lines.find((l) => l.code === "102")!;
    expect(cash.amount).toBe("118750.00");
    expect(fs.balanceSheet.totalAssets).toBe("227100.00");
    expect(fs.changesInEquity.ending).toBe("227100.00");
  });
  it("uses the tax engine's 5% withholding and computes the 1701Q", () => {
    expect(set.transactions.find((t) => t.id === "t06")!.answer).toContainEqual({ account: "115", debit: "1500.00" });
    const [q1] = set.returns(ctx);
    expect(q1!.form).toBe("1701Q");
    expect(q1!.steps.at(-1)).toMatchObject({ label: "Excess credits carried to the next quarter", amount: "5500.00" });
  });
  it("builds a learner ledger from answered entries only", () => {
    const partial = learnerEntries(set, new Set(["t01", "t03"]));
    expect(partial.map((e) => e.id)).toEqual(["opening", "t01", "t03"]);
    expect(BOOK_NAMES.CRB).toBe("Cash receipts book");
    expect(getPracticeSet("nope")).toBeUndefined();
  });
});
