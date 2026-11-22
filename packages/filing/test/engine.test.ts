import { DEFAULT_PROFILE, type Profile } from "@taxgabay/tax-engine";
import { describe, expect, it } from "vitest";
import { checkRecords, linesFor, preparePacket, quarterLabel, quarterMonths, quarterRange, redactTins, taxRulesFor, type ClientRecord } from "../src";

const profile = (p: Partial<Profile>): Profile => ({ ...DEFAULT_PROFILE, taxpayer_type: "self_employed", vat_status: "non_vat", income_tax_option: "eight_percent", ...p });
const sale = (id: string, date: string, amount: string, no = id, name = "Client A"): ClientRecord => ({ kind: "sale", id, date, document_no: no, customer: { name }, amount });
const rules = taxRulesFor();

describe("periods", () => {
  it("computes quarter ranges and months", () => {
    expect(quarterRange({ year: 2026, quarter: 4 })).toEqual({ start: "2026-10-01", end: "2026-12-31" });
    expect(quarterMonths({ year: 2026, quarter: 1 }).map((m) => m.end)).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
    expect(quarterLabel({ year: 2026, quarter: 2 })).toBe("Q2 2026");
  });
});

describe("checkRecords", () => {
  const q = { year: 2026, quarter: 1 as const };
  it("flags bad amounts, duplicate invoices and missing months", () => {
    const issues = checkRecords([sale("a", "2026-01-05", "100", "INV-1"), sale("b", "2026-01-06", "100", "inv-1"), sale("c", "2026-01-07", "abc", "X"), sale("d", "2026-01-08", "0", "Y")], q, rules);
    const codes = issues.map((i) => i.code);
    expect(codes.filter((c) => c === "invalid_amount")).toHaveLength(2);
    expect(codes).toContain("duplicate_invoice");
    expect(codes.filter((c) => c === "no_sales_month")).toHaveLength(2);
  });
  it("summarizes long invoice gaps", () => {
    const issues = checkRecords([sale("a", "2026-01-05", "100", "1"), sale("b", "2026-02-05", "100", "10"), sale("c", "2026-03-05", "100", "11")], q, rules);
    expect(issues.find((i) => i.code === "invoice_gap")!.message).toContain("and 3 more");
  });
  it("checks withholding records and 2307s", () => {
    const recs: ClientRecord[] = [
      sale("a", "2026-01-05", "10000", "1", "Kape Co."),
      sale("b", "2026-02-05", "10000", "2", "Kape Co."),
      sale("c", "2026-03-05", "10000", "3", "Kape Co."),
      { kind: "expense", id: "e1", date: "2026-01-10", supplier: { name: "Landlord" }, category: "rent", amount: "1000", withholding: { atc: "WI100" } },
      { kind: "expense", id: "e2", date: "2026-01-11", supplier: { name: "X", tin: "1" }, category: "other", amount: "1000", withholding: { atc: "ZZ999" } },
      { kind: "form_2307_received", id: "c1", date: "2026-04-01", payor: { name: "Other Co." }, period_from: "2026-01-01", period_to: "2026-03-31", atc: "WI010", income_payment: "10000", tax_withheld: "400" },
      { kind: "form_2307_received", id: "c2", date: "2026-04-01", payor: { name: "Kape Co.", tin: "2" }, period_from: "2026-01-01", period_to: "2026-03-31", atc: "QQ000", income_payment: "10000", tax_withheld: "500" },
      { kind: "form_2307_received", id: "c3", date: "2025-04-01", payor: { name: "Old" }, period_from: "2025-01-01", period_to: "2025-03-31", atc: "WI010", income_payment: "1", tax_withheld: "0" },
    ];
    const codes = checkRecords(recs, q, rules).map((i) => `${i.code}:${i.record_id ?? ""}`);
    expect(codes).toEqual(expect.arrayContaining(["missing_payee_tin:e1", "unknown_atc:e2", "2307_without_sale:c1", "2307_amount_mismatch:c1", "missing_payor_tin:c1", "unknown_atc:c2"]));
    expect(codes.some((c) => c.endsWith(":c3"))).toBe(false);
  });
});

describe("preparePacket", () => {
  const year = ["2026-03-01", "2026-06-01", "2026-09-01", "2026-12-01"].map((d, i) => sale(`s${i}`, d, "250000.00", String(i + 1)));

  it("prepares the annual 1701A in Q4 with quarterly payments deducted (8%)", () => {
    const p = preparePacket({ client: { name: "A", profile: profile({}) }, records: year, period: { year: 2026, quarter: 4 } });
    expect(p.documents.map((d) => d.form)).toEqual(["1701A"]);
    const f = Object.fromEntries(p.documents[0]!.fields.map((x) => [x.key, x.value]));
    expect(f).toMatchObject({ gross: "1000000.00", taxable_income: "750000.00", tax_due: "60000.00", quarterly_payments: "40000.00", payable: "20000.00" });
    expect(p.documents[0]!.due_date).toBe("2027-04-15");
  });

  it("Q3 1701Q deducts the Q1 and Q2 payments", () => {
    const p = preparePacket({ client: { name: "A", profile: profile({}) }, records: year, period: { year: 2026, quarter: 3 } });
    const f = Object.fromEntries(p.documents.find((d) => d.form === "1701Q")!.fields.map((x) => [x.key, x.value]));
    expect(f).toMatchObject({ gross_cumulative: "750000.00", tax_due: "40000.00", prior_payments: "20000.00", payable: "20000.00" });
  });

  it("uses itemized deductions and sends the annual return to the 1701 (not yet supported)", () => {
    const recs: ClientRecord[] = [...year, { kind: "expense", id: "e", date: "2026-02-01", supplier: { name: "S" }, category: "supplies", amount: "100000.00" }];
    const q1 = preparePacket({ client: { name: "A", profile: profile({ income_tax_option: "graduated_itemized" }) }, records: recs, period: { year: 2026, quarter: 1 } });
    expect(q1.documents.find((d) => d.form === "1701Q")!.fields.find((f) => f.key === "deductions")!.value).toBe("100000.00");
    expect(q1.documents.some((d) => d.form === "2551Q")).toBe(true);
    const q4 = preparePacket({ client: { name: "A", profile: profile({ income_tax_option: "graduated_itemized" }) }, records: recs, period: { year: 2026, quarter: 4 } });
    expect(q4.not_supported.map((n) => n.form)).toContain("1701");
  });

  it("reports what it cannot prepare yet", () => {
    const p = preparePacket({ client: { name: "C", profile: profile({ taxpayer_type: "corporation", vat_status: "vat", has_employees: true }) }, records: [], period: { year: 2026, quarter: 1 } });
    expect(p.documents).toEqual([]);
    expect(p.not_supported.map((n) => n.form)).toEqual(["—", "2550Q", "1601C"]);
  });

  it("asks for the income tax option and blocks an ineligible 8%", () => {
    const p = preparePacket({ client: { name: "A", profile: profile({ income_tax_option: "not_sure" }) }, records: year, period: { year: 2026, quarter: 1 } });
    expect(p.issues.map((i) => i.code)).toContain("income_tax_option");
    const big = [sale("x", "2026-02-01", "4000000.00", "9")];
    const p2 = preparePacket({ client: { name: "A", profile: profile({}) }, records: big, period: { year: 2026, quarter: 1 } });
    expect(p2.issues.map((i) => i.code)).toContain("option_ineligible");
    expect(p2.documents.some((d) => d.form === "1701Q")).toBe(false);
    const p3 = preparePacket({ client: { name: "A", profile: profile({}) }, records: big, period: { year: 2026, quarter: 2 } });
    expect(p3.documents.some((d) => d.form === "1701Q")).toBe(false);
    const p4 = preparePacket({ client: { name: "A", profile: profile({}) }, records: big, period: { year: 2026, quarter: 4 } });
    expect(p4.documents.some((d) => d.form === "1701A")).toBe(false);
  });

  it("handles zero withholding months, VAT-inclusive bills and unknown ATCs", () => {
    const recs: ClientRecord[] = [
      sale("a", "2026-03-05", "1000", "1"),
      { kind: "expense", id: "e1", date: "2026-03-10", supplier: { name: "Contractor Inc.", tin: "9" }, category: "contractors", amount: "11200.00", supplier_vat_registered: true, withholding: { atc: "WC120" } },
      { kind: "expense", id: "e2", date: "2026-03-11", supplier: { name: "Bad" }, category: "other", amount: "100", withholding: { atc: "NOPE" } },
    ];
    const p = preparePacket({ client: { name: "A", profile: profile({ withholds_expanded: true }) }, records: recs, period: { year: 2026, quarter: 1 } });
    const jan = p.documents.find((d) => d.id === "0619E-2026-01-31")!;
    expect(jan.amount_payable).toBe("0.00");
    expect(jan.warnings[0]).toContain("Nothing was withheld");
    const eq = p.documents.find((d) => d.form === "1601EQ")!;
    expect(eq.fields.find((f) => f.key === "total_withheld")!.value).toBe("200.00");
    expect(p.documents.filter((d) => d.form === "2307")).toHaveLength(1);
  });

  it("redacts TINs for server storage", () => {
    const recs: ClientRecord[] = [
      sale("a", "2026-01-05", "1000", "1", "K"),
      { kind: "expense", id: "e1", date: "2026-01-10", supplier: { name: "Landlord", tin: "301" }, category: "rent", amount: "1000", withholding: { atc: "WI100" } },
      { kind: "form_2307_received", id: "c", date: "2026-04-01", payor: { name: "K", tin: "201" }, period_from: "2026-01-01", period_to: "2026-03-31", atc: "WI010", income_payment: "1000", tax_withheld: "50" },
    ];
    const p = preparePacket({ client: { name: "A", profile: profile({ withholds_expanded: true }) }, records: recs, period: { year: 2026, quarter: 1 } });
    const r = redactTins(p);
    expect(JSON.stringify(r)).not.toMatch(/"tin":"(301|201)"/);
    expect(r.documents.find((d) => d.form === "2307")!.recipient!.tin).toBeNull();
    expect(JSON.stringify(p)).toContain('"tin":"301"');
  });

  it("every form line awaits CPA confirmation with no invented item numbers", () => {
    for (const f of ["2551Q", "0619E", "1601EQ", "1701Q", "1701A", "2307"]) {
      const lines = linesFor(f, "2026-06-30");
      expect(lines.length).toBeGreaterThan(0);
      expect(lines.every((l) => l.item === null && l.needs_verification)).toBe(true);
    }
    expect(linesFor("2551Q", "2010-01-01")).toEqual([]);
  });
});
