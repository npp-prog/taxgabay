import { preparePacket, type ClientRecord } from "@taxgabay/filing";
import { DEFAULT_PROFILE } from "@taxgabay/tax-engine";
import { describe, expect, it } from "vitest";
import { fillTins, monthPeriod, packetTinNeeds, quarterPeriod, recordTin, recordToRow, rowToRecord, tinRef } from "./workspace-core";

const exp: ClientRecord = { kind: "expense", id: "e1", date: "2026-01-31", supplier: { name: "Jose  Cruz", tin: "301-555-666-000" }, category: "rent", amount: "10000.00", withholding: { atc: "WI100" } };
const sale: ClientRecord = { kind: "sale", id: "s1", date: "2026-01-10", document_no: "1", customer: { name: "Kape Co.", tin: "201" }, amount: "30000.00" };
const cert: ClientRecord = { kind: "form_2307_received", id: "c1", date: "2026-04-01", payor: { name: "Kape Co.", tin: "201-111" }, period_from: "2026-01-01", period_to: "2026-03-31", atc: "WI010", income_payment: "30000.00", tax_withheld: "1500.00" };

describe("workspace mapping", () => {
  it("never stores a TIN in the record data", () => {
    for (const r of [exp, sale, cert]) {
      const row = recordToRow(r, "c");
      expect(JSON.stringify(row)).not.toMatch(/tin/);
      expect(row).toMatchObject({ prep_client_id: "c", record_date: r.date, kind: r.kind });
    }
    expect(recordTin(exp)).toEqual({ subject: "supplier", ref: "jose cruz", tin: "301-555-666-000" });
    expect(recordTin(sale)!.subject).toBe("customer");
    expect(recordTin(cert)!.subject).toBe("payor");
    expect(recordTin({ ...sale, customer: { name: "X" } } as ClientRecord)).toBeNull();
  });
  it("round-trips and marks TINs on file", () => {
    const row = { id: "db1", ...recordToRow(exp, "c") };
    const back = rowToRecord(row, new Map([["supplier|jose cruz", "6000"]]))!;
    expect(back).toMatchObject({ id: "db1", kind: "expense", date: "2026-01-31", supplier: { name: "Jose  Cruz", tin: "•••6000" } });
    expect(rowToRecord({ id: "s", ...recordToRow(sale, "c") })!).toMatchObject({ customer: { tin: null } });
    expect(rowToRecord({ id: "c", ...recordToRow(cert, "c") })!.kind).toBe("form_2307_received");
    expect(rowToRecord({ id: "x", prep_client_id: "c", record_date: "2026-01-01", kind: "asset", data: {} })).toBeNull();
    const payroll: ClientRecord = { kind: "payroll", id: "p", date: "2026-01-31", employee: { name: "Ana", tin: "401" }, basic_pay: "30000.00" };
    expect(JSON.stringify(recordToRow(payroll, "c"))).not.toMatch(/tin/);
    expect(recordTin(payroll)).toEqual({ subject: "employee", ref: "ana", tin: "401" });
    expect(rowToRecord({ id: "p", ...recordToRow(payroll, "c") }, new Map([["employee|ana", "0001"]]))).toMatchObject({ employee: { tin: "•••0001" } });
  });
  it("stores journal entries as kind other and reads them back", () => {
    const j: ClientRecord = { kind: "journal", id: "j", date: "2026-01-01", entry_type: "opening", memo: "Opening", lines: [{ account: "101", debit: "100" }, { account: "301", credit: "100" }] };
    const row = recordToRow(j, "c");
    expect(row.kind).toBe("other");
    expect(recordTin(j)).toBeNull();
    expect(rowToRecord({ id: "db", ...row })).toEqual({ ...j, id: "db" });
    expect(rowToRecord({ id: "x", prep_client_id: "c", record_date: "2026-01-01", kind: "other", data: {} })).toBeNull();
  });
  it("finds and fills the TINs a packet needs", () => {
    const profile = { ...DEFAULT_PROFILE, taxpayer_type: "self_employed" as const, income_tax_option: "eight_percent" as const, withholds_expanded: true };
    const p = preparePacket({ client: { name: "A", profile }, records: [sale, exp, cert], period: { year: 2026, quarter: 1 } });
    const needs = packetTinNeeds(p).map((n) => `${n.subject}|${n.ref}`).sort();
    expect(needs).toEqual(["payor|kape co.", "supplier|jose cruz"]);
    const filled = fillTins(p, new Map([["supplier|jose cruz", "301555666000"], ["payor|kape co.", "201111"]]));
    expect(filled.documents.find((d) => d.form === "2307")!.recipient!.tin).toBe("301555666000");
    expect(filled.documents.find((d) => d.form === "QAP")!.schedule!.rows[0]!.tin).toBe("301555666000");
    expect(filled.documents.find((d) => d.form === "SAWT")!.schedule!.rows[0]!.tin).toBe("201111");
    expect(tinRef("  A   B ")).toBe("a b");
    expect(monthPeriod(2028, 2)).toEqual({ kind: "month", start_date: "2028-02-01", end_date: "2028-02-29" });
    expect(quarterPeriod({ year: 2026, quarter: 2 })).toEqual({ kind: "quarter", start_date: "2026-04-01", end_date: "2026-06-30" });
  });
});
