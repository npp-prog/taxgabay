import { describe, expect, it } from "vitest";
import { importCsv, parseCsv, templateCsv } from "./prepare-csv";

let n = 0;
const id = () => `r${++n}`;

describe("prepare CSV import", () => {
  it("parses quotes, escaped quotes and CRLF", () => {
    expect(parseCsv('a,"b, c","d ""e"""\r\n1,2,3\n\n')).toEqual([["a", "b, c", 'd "e"'], ["1", "2", "3"]]);
  });
  it("round-trips every template", () => {
    for (const k of ["sale", "expense", "form_2307_received"] as const) {
      const r = importCsv(k, templateCsv(k), id);
      expect(r.errors).toEqual([]);
      expect(r.records).toHaveLength(1);
      expect(r.records[0]!.kind).toBe(k);
    }
  });
  it("reports bad rows by line and keeps the good ones", () => {
    const csv = "date,invoice_no,customer_name,amount\n2026-01-01,SI-1,A,\"1,500.00\"\n01/02/2026,SI-2,B,100\n2026-01-03,,C,100\n2026-01-04,SI-4,D,abc\n";
    const r = importCsv("sale", csv, id);
    expect(r.records).toHaveLength(1);
    expect(r.records[0]).toMatchObject({ amount: "1500.00", customer: { name: "A", tin: null } });
    expect(r.errors).toEqual([expect.stringMatching(/^Line 3: /), expect.stringMatching(/^Line 4: invoice_no/), expect.stringMatching(/^Line 5: amount/)]);
  });
  it("reads the VAT treatment of sales", () => {
    const r = importCsv("sale", "date,invoice_no,customer_name,amount,vat_treatment\n2026-01-01,1,A,100,Zero-rated\n2026-01-01,2,A,100,\n2026-01-01,3,A,100,maybe\n", id);
    expect(r.records.map((x) => (x as { vat_treatment?: string }).vat_treatment)).toEqual(["zero_rated", undefined]);
    expect(r.errors[0]).toMatch(/^Line 4: vat_treatment/);
  });
  it("validates expenses and 2307 rows", () => {
    const e = importCsv("expense", "date,supplier_name,category,amount,atc\n2026-01-01,X,food,100,\n2026-01-01,,rent,100,\n2026-01-01,Y,rent,1x,\n2026-01-01,Z,Rent,100,wi100\n", id);
    expect(e.errors).toHaveLength(3);
    expect(e.records[0]).toMatchObject({ category: "rent", withholding: { atc: "WI100" }, supplier_vat_registered: false });
    const c = importCsv("form_2307_received", "date_received,payor_name,period_from,period_to,atc,income_payment,tax_withheld\n2026-04-01,A,2026-01-01,bad,WI010,1,1\n2026-04-01,A,2026-01-01,2026-03-31,WI010,x,1\n2026-04-01,,2026-01-01,2026-03-31,WI010,1,1\n", id);
    expect(c.errors).toHaveLength(3);
  });
  it("rejects empty files and missing columns", () => {
    expect(importCsv("sale", "", id).errors[0]).toMatch(/empty/);
    expect(importCsv("sale", "date,amount\n2026-01-01,1\n", id).errors[0]).toMatch(/Missing column/);
  });
});
