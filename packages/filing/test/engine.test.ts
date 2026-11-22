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

  it("prepares zero returns when nothing is recorded yet", () => {
    const p = preparePacket({ client: { name: "A", profile: profile({}) }, records: [], period: { year: 2026, quarter: 1 } });
    expect(p.documents.find((d) => d.form === "1701Q")!.amount_payable).toBe("0.00");
    expect(p.total_payable).toBe("0.00");
  });

  it("reports what it cannot prepare yet", () => {
    const fy = preparePacket({ client: { name: "C", profile: profile({ taxpayer_type: "corporation", fiscal_year_end_month: 6 }) }, records: [], period: { year: 2026, quarter: 1 } });
    expect(fy.documents).toEqual([]);
    expect(fy.not_supported[0]!.reason).toContain("fiscal year");
    const coop = preparePacket({ client: { name: "C", profile: profile({ taxpayer_type: "cooperative" }) }, records: [], period: { year: 2026, quarter: 1 } });
    expect(coop.not_supported[0]!.reason).toContain("Supported:");
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

describe("VAT clients", () => {
  const vat = (p: Partial<Profile> = {}) => profile({ vat_status: "vat", income_tax_option: "graduated_osd", ...p });
  it("refuses the 8% option and lists customers and suppliers on the summary lists", () => {
    const recs: ClientRecord[] = [
      { kind: "sale", id: "a", date: "2026-01-05", document_no: "1", customer: { name: "B", tin: "1" }, amount: "11200.00" },
      { kind: "sale", id: "b", date: "2026-02-05", document_no: "2", customer: { name: "A" }, amount: "1000.00", vat_treatment: "exempt" },
      { kind: "sale", id: "c", date: "2026-03-05", document_no: "3", customer: { name: "B", tin: "1" }, amount: "500.00", vat_treatment: "zero_rated" },
      { kind: "expense", id: "s", date: "2026-01-31", supplier: { name: "Staff" }, category: "salaries", amount: "5000.00", supplier_vat_registered: true },
      { kind: "expense", id: "t", date: "2026-01-31", supplier: { name: "LGU" }, category: "taxes_licenses", amount: "500.00" },
      { kind: "expense", id: "g", date: "2026-02-01", supplier: { name: "Goods Inc." }, category: "cost_of_sales", amount: "2240.00", supplier_vat_registered: true },
    ];
    const eight = preparePacket({ client: { name: "V", profile: vat({ income_tax_option: "eight_percent" }) }, records: recs, period: { year: 2026, quarter: 1 } });
    expect(eight.issues.map((i) => i.code)).toContain("option_ineligible");
    expect(eight.documents.some((d) => d.form === "2551Q")).toBe(false);
    const p = preparePacket({ client: { name: "V", profile: vat({ income_tax_option: "graduated_itemized" }) }, records: recs, period: { year: 2026, quarter: 1 } });
    const sls = p.documents.find((d) => d.form === "SLS")!;
    expect(sls.schedule!.rows).toEqual([
      { tin: "", name: "A", exempt: "1000.00", zero: "0.00", taxable: "0.00", vat: "0.00" },
      { tin: "1", name: "B", exempt: "0.00", zero: "500.00", taxable: "10000.00", vat: "1200.00" },
    ]);
    const slp = p.documents.find((d) => d.form === "SLP")!;
    expect(slp.schedule!.rows).toEqual([{ tin: "", name: "Goods Inc.", no_vat: "0.00", services: "0.00", capital_goods: "0.00", goods: "2000.00", vat: "240.00" }]);
    const q = p.documents.find((d) => d.form === "2550Q")!;
    expect(q.fields.find((f) => f.key === "payable")!.value).toBe("960.00");
    expect(q.warnings.some((w) => w.includes("Zero-rated"))).toBe(true);
    // Itemized deductions are net of input VAT; salaries and taxes carry no VAT.
    expect(p.documents.find((d) => d.form === "1701Q")!.fields.find((f) => f.key === "deductions")!.value).toBe("7500.00");
  });
  it("carries excess input tax forward and pays nothing", () => {
    const recs: ClientRecord[] = [
      { kind: "sale", id: "a", date: "2026-01-05", document_no: "1", customer: { name: "B" }, amount: "1120.00" },
      { kind: "expense", id: "g", date: "2026-01-06", supplier: { name: "G" }, category: "equipment", amount: "22400.00", supplier_vat_registered: true },
    ];
    const p = preparePacket({ client: { name: "V", profile: vat() }, records: recs, period: { year: 2026, quarter: 1 } });
    const q = p.documents.find((d) => d.form === "2550Q")!;
    expect(q.fields.find((f) => f.key === "payable")!.value).toBe("-2280.00");
    expect(q.amount_payable).toBe("0.00");
    const q2 = preparePacket({ client: { name: "V", profile: vat() }, records: recs, period: { year: 2026, quarter: 2 } }).documents.find((d) => d.form === "2550Q")!;
    expect(q2.fields.find((f) => f.key === "input_vat_carried_over")!.value).toBe("2280.00");
    const empty = preparePacket({ client: { name: "V", profile: vat() }, records: [], period: { year: 2026, quarter: 1 } });
    expect(empty.documents.find((d) => d.form === "2550Q")!.amount_payable).toBe("0.00");
  });
});

describe("payroll", () => {
  const emp = (p: Partial<Profile> = {}) => profile({ income_tax_option: "graduated_osd", has_employees: true, ...p });
  const pay = (id: string, date: string, basic: string, extra: Partial<ClientRecord> = {}): ClientRecord => ({ kind: "payroll", id, date, employee: { name: "Ben Cruz" }, basic_pay: basic, ...extra }) as ClientRecord;

  it("checks duplicates, missing TINs and a profile without employees", () => {
    const recs = [pay("a", "2026-01-31", "20000"), pay("b", "2026-01-15", "20000"), pay("c", "2026-02-28", "20000")];
    const codes = checkRecords(recs, { year: 2026, quarter: 1 }, rules, { hasEmployees: false }).map((i) => i.code);
    expect(codes.filter((c) => c === "duplicate_payroll")).toHaveLength(1);
    expect(codes.filter((c) => c === "missing_employee_tin")).toHaveLength(1);
    expect(codes).toContain("payroll_without_employees");
  });

  it("treats minimum wage earners as exempt and warns about months without payroll", () => {
    const recs = [pay("a", "2026-01-31", "15000", { minimum_wage_earner: true } as Partial<ClientRecord>)];
    const p = preparePacket({ client: { name: "S", profile: emp() }, records: recs, period: { year: 2026, quarter: 1 } });
    const jan = p.documents.find((d) => d.id === "1601C-2026-01-31")!;
    expect(jan.fields.find((f) => f.key === "tax_withheld")!.value).toBe("0.00");
    expect(jan.warnings.some((w) => w.includes("Minimum wage earners"))).toBe(true);
    expect(p.documents.find((d) => d.id === "1601C-2026-02-28")!.warnings.some((w) => w.includes("No payroll"))).toBe(true);
    const q4 = preparePacket({ client: { name: "S", profile: emp() }, records: recs, period: { year: 2026, quarter: 4 } });
    const c = q4.documents.find((d) => d.form === "2316")!;
    expect(c.fields.find((f) => f.key === "tax_due")!.value).toBe("0.00");
    expect(c.steps[0]!.label).toContain("Minimum wage earner");
  });

  it("refunds over-withholding in December and counts payroll in itemized deductions", () => {
    // High pay early in the year, low in December: annual tax is less than what was withheld.
    const recs = [pay("a", "2026-01-31", "200000"), pay("d", "2026-12-31", "0.01")];
    const p = preparePacket({ client: { name: "S", profile: emp({ income_tax_option: "graduated_itemized" }) }, records: [...recs, { kind: "sale", id: "s", date: "2026-12-01", document_no: "1", customer: { name: "X" }, amount: "1000000.00" }], period: { year: 2026, quarter: 4 } });
    const dec1601 = p.documents.find((d) => d.id === "1601C-2026-12-31")!;
    expect(Number(dec1601.fields.find((f) => f.key === "tax_withheld")!.value)).toBeLessThan(0);
    expect(dec1601.amount_payable).toBe("0.00");
    expect(dec1601.warnings.some((w) => w.includes("refund"))).toBe(true);
    expect(p.not_supported.map((n) => n.form)).toContain("1701");
    const q1 = preparePacket({ client: { name: "S", profile: emp({ income_tax_option: "graduated_itemized" }) }, records: [...recs, { kind: "sale", id: "s", date: "2026-01-02", document_no: "1", customer: { name: "X" }, amount: "1000000.00" }], period: { year: 2026, quarter: 1 } });
    expect(Number(q1.documents.find((d) => d.form === "1701Q")!.fields.find((f) => f.key === "deductions")!.value)).toBeGreaterThan(200000);
  });
});

describe("corporations", () => {
  const corp = (p: Partial<Profile> = {}) => profile({ taxpayer_type: "corporation", income_tax_option: "not_applicable", ...p });
  const sales: ClientRecord[] = [1, 2, 3].map((m) => ({ kind: "sale", id: `s${m}`, date: `2026-0${m}-15`, document_no: String(m), customer: { name: "X" }, amount: "1000000.00" }));

  it("asks for the start year and skips MCIT in the first years", () => {
    const none = preparePacket({ client: { name: "C", profile: corp() }, records: sales, period: { year: 2026, quarter: 1 } });
    expect(none.issues.map((i) => i.code)).toContain("year_commenced");
    expect(none.documents.map((d) => d.form)).toEqual(["2551Q"]);
    const young = preparePacket({ client: { name: "C", profile: corp(), corporate: { year_commenced: 2025 } }, records: sales, period: { year: 2026, quarter: 1 } });
    const q = young.documents.find((d) => d.form === "1702Q")!;
    expect(q.fields.find((f) => f.key === "mcit")!.value).toBe("0.00");
    // Assets unknown: regular 25% on ₱3,000,000.
    expect(q.fields.find((f) => f.key === "rcit")!.value).toBe("750000.00");
    expect(q.warnings.some((w) => w.includes("Total assets"))).toBe(true);
  });

  it("prepares the annual 1702-RT in Q4 and flags taxable partnerships", () => {
    const p = preparePacket({ client: { name: "P", profile: corp({ taxpayer_type: "partnership", vat_status: "vat" }), corporate: { year_commenced: 2015, total_assets_excl_land: "1000000" } }, records: sales, period: { year: 2026, quarter: 4 } });
    expect(p.documents.map((d) => d.form)).toEqual(["2550Q", "SLS", "SLP", "1702-RT"]);
    const rt = p.documents.find((d) => d.form === "1702-RT")!;
    expect(rt.due_date).toBe("2027-04-15");
    expect(p.issues.map((i) => i.code)).toContain("partnership_type");
  });
});
