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

const statementsFor = (slug: string) => {
  const set = getPracticeSet(slug)!;
  const ctx = practiceContext(set);
  return { set, ctx, fs: financialStatements(answerEntries(set), ctx.chart, set.period.to, set.earningsAccount) };
};
const line = (lines: { code: string; amount: string }[], code: string) => lines.find((l) => l.code === code)?.amount;

describe("sari-sari store worked totals (hand-checked)", () => {
  // Sales 18,500 + 21,000 + 19,800 + 20,700 = 80,000; less returns 350 = net sales 79,650.
  // Purchases 45,000 + 30,000 − 1,500 (owner's withdrawal) = 73,500; + freight 800 − returns 1,200 = net purchases 73,100.
  // Cost of sales 60,000 + 73,100 − 69,200 = 63,900; gross profit 15,750.
  // Expenses: wages 8,000 + utilities 2,750 + depreciation 500 = 11,250; net income 4,500.
  // Cash on hand 5,000 − 800 + 18,500 − 15,000 + 21,000 − 4,000 − 350 − 20,000 + 19,800 + 20,700 − 4,000 − 35,000 = 5,850.
  // Cash in bank 40,000 + 15,000 − 43,800 + 20,000 − 2,750 + 35,000 = 63,450.
  // Assets 5,850 + 63,450 + 69,200 + 29,500 = 168,000 = AP 30,000 + equity (135,000 + 4,500 − 1,500 = 138,000).
  const { set, ctx, fs } = statementsFor("sari-sari-store");
  it("matches the hand computation", () => {
    expect(fs.incomeStatement.revenue.total).toBe("79650.00");
    expect(fs.incomeStatement.costOfSales.total).toBe("63900.00");
    expect(fs.incomeStatement.grossProfit).toBe("15750.00");
    expect(fs.incomeStatement.expenses.total).toBe("11250.00");
    expect(fs.incomeStatement.netIncome).toBe("4500.00");
    expect(line(fs.balanceSheet.currentAssets.lines, "101")).toBe("5850.00");
    expect(line(fs.balanceSheet.currentAssets.lines, "102")).toBe("63450.00");
    expect(line(fs.balanceSheet.currentAssets.lines, "120")).toBe("69200.00");
    expect(fs.balanceSheet.totalAssets).toBe("168000.00");
    expect(fs.balanceSheet.totalLiabilities).toBe("30000.00");
    expect(fs.balanceSheet.totalEquity).toBe("138000.00");
  });
  it("computes June's share of the 2551Q from net sales with the engine's rate", () => {
    const [pt] = set.returns(ctx);
    expect(pt!.form).toBe("2551Q");
    expect(pt!.steps[0]!.amount).toBe("79650.00");
    // 79,650 × the engine's percentage tax rate (3% in the seed data, flagged for verification) = 2,389.50.
    expect(pt!.steps.at(-1)!.amount).toBe("2389.50");
  });
});

describe("VAT printing shop worked totals (hand-checked)", () => {
  // At the engine's 12% rate: output VAT 7,200 + 3,000 + 2,160 + 3,840 = 16,200;
  // input VAT 4,800 + 2,880 (laminator) + 720 + 2,640 = 11,040; VAT payable 5,160.
  // Revenue (net of VAT) 60,000 + 25,000 + 18,000 + 32,000 = 135,000.
  // Expenses: supplies 62,000 + delivery 1,200 + utilities 9,000 + depreciation 9,400 = 81,600; net income 53,400.
  // Lakbay pays 67,200 − 2% × 60,000 = 66,000.
  // Cash in bank 120,000 − 9,600 + 66,000 − 44,800 − 26,880 + 26,000 − 6,720 + 20,160 − 20,000 + 35,000 = 159,160.
  // Assets 1,640 + 159,160 + 11,040 + 1,200 + (204,000 − 9,400) = 367,640
  //   = liabilities (24,640 + 16,200 + 3,000 = 43,840) + equity (290,400 + 53,400 − 20,000 = 323,800).
  const { set, ctx, fs } = statementsFor("vat-printing-shop");
  it("matches the hand computation", () => {
    expect(fs.incomeStatement.revenue.total).toBe("135000.00");
    expect(fs.incomeStatement.expenses.total).toBe("81600.00");
    expect(fs.incomeStatement.netIncome).toBe("53400.00");
    expect(line(fs.balanceSheet.currentAssets.lines, "101")).toBe("1640.00");
    expect(line(fs.balanceSheet.currentAssets.lines, "102")).toBe("159160.00");
    expect(line(fs.balanceSheet.currentAssets.lines, "112")).toBe("11040.00");
    expect(line(fs.balanceSheet.currentAssets.lines, "115")).toBe("1200.00");
    expect(fs.balanceSheet.totalAssets).toBe("367640.00");
    expect(fs.balanceSheet.totalLiabilities).toBe("43840.00");
    expect(fs.balanceSheet.totalEquity).toBe("323800.00");
  });
  it("computes the 2550Q tied to the VAT accounts", () => {
    const [vat] = set.returns(ctx);
    expect(vat!.form).toBe("2550Q");
    expect(ctx.net(["210"])).toBe("-16200.00");
    expect(ctx.net(["112"])).toBe("11040.00");
    expect(vat!.summary).toContain("₱5,160.00");
  });
});

describe("small corporation worked totals (hand-checked)", () => {
  // Payroll from the engine's (unverified) contribution and withholding data:
  //   cook 25,000: SSS 1,250 / 2,500, PhilHealth 625 / 625, Pag-IBIG 200 / 200; tax on 22,925 = 313.80.
  //   helper 16,000: SSS 800 / 1,600, PhilHealth 400 / 400, Pag-IBIG 200 / 200; tax 0.
  //   Net pay 41,000 − 2,050 − 1,025 − 400 − 313.80 = 37,211.20; employer share 5,525.
  // Revenue 120,000 + 45,000 + 52,000 = 217,000; percentage tax 3% = 6,510.
  // Costs: ingredients 38,000 + salaries 41,000 + contributions 5,525 + rent 30,000 + fees 20,000
  //   + utilities 8,500 + taxes 6,510 + depreciation 4,000 = 153,535; net income 63,465.
  // Cash in bank 300,000 − 28,500 − 313.80 − 9,000 + 40,000 + 117,600 − 19,000 − 38,000 − 8,500 − 37,211.20 = 317,075.
  // Cash on hand 10,000 + 45,000 − 40,000 + 52,000 = 67,000.
  // Assets 67,000 + 317,075 + 2,400 + 196,000 = 582,475.
  // Liabilities SSS 6,150 + PhilHealth 2,050 + Pag-IBIG 800 + WT comp 313.80 + WT expanded (1,500 + 1,500 + 1,000) + PT 6,510 = 19,823.80.
  // Equity 400,000 + retained earnings (99,186.20 + 63,465) = 562,651.20.
  const { set, ctx, fs } = statementsFor("small-corporation");
  it("matches the hand computation", () => {
    expect(fs.incomeStatement.revenue.total).toBe("217000.00");
    expect(fs.incomeStatement.costOfSales.total).toBe("38000.00");
    expect(fs.incomeStatement.expenses.total).toBe("115535.00");
    expect(fs.incomeStatement.netIncome).toBe("63465.00");
    expect(line(fs.balanceSheet.currentAssets.lines, "102")).toBe("317075.00");
    expect(fs.balanceSheet.totalAssets).toBe("582475.00");
    expect(fs.balanceSheet.totalLiabilities).toBe("19823.80");
    expect(fs.balanceSheet.totalEquity).toBe("562651.20");
    // October movement only (opening excluded): September's 313.80 remitted, October's 313.80 withheld.
    expect(ctx.net(["213"])).toBe("0.00");
  });
  it("computes the 1601C, 0619E, 2551Q and the income tax illustration", () => {
    const returns = set.returns(ctx);
    expect(returns.map((r) => r.form)).toEqual(["1601C", "0619E", "2551Q", "1702Q"]);
    expect(returns[0]!.steps.at(-1)!.amount).toBe("313.80");
    expect(returns[1]!.steps.at(-1)!.amount).toBe("2500.00");
    expect(returns[2]!.steps.at(-1)!.amount).toBe("6510.00");
    // Taxable income 217,000 − 38,000 − 115,535 = 63,465 × 20% (engine rate for small corporations) = 12,693.
    expect(returns[3]!.summary).toContain("₱12,693.00");
  });
});
