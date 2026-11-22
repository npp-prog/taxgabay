import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { financialStatements, post, trialBalance } from "@taxgabay/accounting";
import { dec, money } from "@taxgabay/tax-engine";
import { buildBooks, preparePacket, type ClientInfo, type ClientRecord, type QuarterRef } from "../src";

interface Fixture {
  description: string;
  client: ClientInfo;
  period: QuarterRef;
  records: ClientRecord[];
  expected: {
    forms: string[];
    issue_codes: string[];
    values: Record<string, Record<string, string>>;
    total_payable: string;
    /** Books posted from the records: balances are debit positive, credit negative. */
    books?: { from: string; to: string; trial_balance_total: string; net_income: string; total_assets: string; balances: Record<string, string> };
  };
}

const dir = join(import.meta.dirname, "fixtures");
const fixtures = readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => [f, JSON.parse(readFileSync(join(dir, f), "utf8")) as Fixture] as const);

describe.each(fixtures)("worked example %s", (_name, fx) => {
  const packet = preparePacket({ client: fx.client, records: fx.records, period: fx.period });
  it("prepares the expected documents", () => {
    expect(packet.documents.map((d) => d.form)).toEqual(fx.expected.forms);
    expect(packet.issues.map((i) => i.code)).toEqual(fx.expected.issue_codes);
  });
  it("fills every expected box", () => {
    for (const [id, values] of Object.entries(fx.expected.values)) {
      const d = packet.documents.find((x) => x.id === id);
      expect(d, id).toBeDefined();
      for (const [k, v] of Object.entries(values)) expect(d!.fields.find((f) => f.key === k)?.value, `${id}.${k}`).toBe(v);
    }
    expect(packet.total_payable).toBe(fx.expected.total_payable);
  });
  it("gives every return a due date and explains every amount", () => {
    for (const d of packet.documents.filter((x) => !["QAP", "SAWT", "2307", "SLS", "SLP", "2316", "SSS/PhilHealth/Pag-IBIG"].includes(x.form))) expect(d.due_date, d.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    for (const d of packet.documents) {
      expect(d.steps.length).toBeGreaterThan(0);
      expect(d.needs_verification).toBe(true);
    }
  });
});

describe.each(fixtures.filter(([, fx]) => fx.expected.books))("books for %s", (_name, fx) => {
  const exp = fx.expected.books!;
  const books = buildBooks({ client: fx.client, records: fx.records, from: exp.from, to: exp.to });
  const ledger = post(books.entries, books.chart);
  it("posts balanced entries with the expected account balances", () => {
    const tb = trialBalance(ledger);
    expect(tb.balanced).toBe(true);
    expect(tb.totalDebit).toBe(exp.trial_balance_total);
    for (const [code, bal] of Object.entries(exp.balances)) {
      const la = ledger.get(code)!;
      const net = money(dec(la.totalDebit).minus(la.totalCredit));
      expect(net, code).toBe(bal);
    }
  });
  it("builds statements that balance", () => {
    const fs = financialStatements(books.entries, books.chart, exp.to, books.earningsAccount);
    expect(fs.incomeStatement.netIncome).toBe(exp.net_income);
    expect(fs.balanceSheet.totalAssets).toBe(exp.total_assets);
    expect(fs.balanceSheet.balanced).toBe(true);
  });
});
