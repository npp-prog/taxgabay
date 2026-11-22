import { describe, expect, it } from "vitest";
import { parseAmount, runIncomeTax, runPenalty, runPercentageTax, runVat } from "../src/calc/models";

// Expected figures are the same worked examples as packages/tax-engine/test/fixtures.
describe("calculator view models", () => {
  it("parses amounts", () => {
    expect(parseAmount("1,000,000")).toBe("1000000");
    expect(parseAmount(" 250000.5 ")).toBe("250000.5");
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount("1.234")).toBeNull();
    expect(parseAmount("")).toBeNull();
  });

  it("income tax: 8% wins on ₱1M gross (2024)", () => {
    const r = runIncomeTax({ year: 2024, gross: "1,000,000", comp: "", itemized: "", vat: false });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.view.headline).toBe("₱60,000.00");
    expect(r.view.subline).toContain("8%");
    expect(r.view.extra?.find((x) => x.label.includes("OSD"))?.value).toBe("₱92,500.00");
    expect(r.view.steps.some((s) => s.legal_basis?.includes("RR 8-2018"))).toBe(true);
    expect(r.view.verified).toBe(false);
  });

  it("income tax validation", () => {
    expect(runIncomeTax({ year: 2024, gross: "", comp: "", itemized: "", vat: false })).toEqual({ ok: false, error: expect.stringContaining("Enter gross") });
    expect(runIncomeTax({ year: 2024, gross: "x", comp: "", itemized: "", vat: false }).ok).toBe(false);
    expect(runIncomeTax({ year: 2017, gross: "100", comp: "", itemized: "", vat: false })).toEqual({ ok: false, error: expect.stringContaining("No rule") });
  });

  it("income tax shows ineligible 8% for VAT-registered", () => {
    const r = runIncomeTax({ year: 2024, gross: "5000000", comp: "", itemized: "3000000", vat: true });
    if (!r.ok) throw new Error(r.error);
    expect(r.view.headline).toBe("₱402,500.00");
    expect(r.view.extra?.find((x) => x.label.startsWith("8%"))?.value).toBe("Not eligible");
  });

  it("percentage tax: 1% in Q2 2023", () => {
    const r = runPercentageTax({ year: 2023, quarter: 2, gross: "500000" });
    expect(r.ok && r.view.headline).toBe("₱5,000.00");
    expect(runPercentageTax({ year: 2023, quarter: 2, gross: "" }).ok).toBe(false);
  });

  it("VAT payable and carry-forward", () => {
    const a = runVat({ year: 2026, quarter: 1, sales: "1120000", salesInclusive: true, purchases: "560000", purchasesInclusive: true, carried: "" });
    expect(a.ok && a.view.headline).toBe("₱60,000.00");
    const b = runVat({ year: 2026, quarter: 2, sales: "1000000", salesInclusive: false, purchases: "1200000", purchasesInclusive: false, carried: "10000" });
    expect(b.ok && [b.view.headline, b.view.subline]).toEqual(["₱34,000.00", "Excess input VAT to carry forward"]);
    expect(runVat({ year: 2026, quarter: 1, sales: "", salesInclusive: true, purchases: "", purchasesInclusive: true, carried: "" }).ok).toBe(false);
  });

  it("penalty across the EOPT change", () => {
    const r = runPenalty({ due: "2024-01-10", paid: "2024-02-09", basic: "100000", size: "micro", lateFiling: true, latePayment: true, willful: false, compromise: true });
    expect(r.ok && r.view.headline).toBe("₱135,673.97");
    expect(r.ok && r.view.subline).toContain("30 days late");
  });

  it("penalty validation", () => {
    const base = { basic: "1", size: "micro" as const, lateFiling: true, latePayment: true, willful: false, compromise: true };
    expect(runPenalty({ ...base, due: "2024/01/10", paid: "2024-02-09" })).toEqual({ ok: false, error: "Enter dates as YYYY-MM-DD." });
    expect(runPenalty({ ...base, due: "2024-02-10", paid: "2024-02-09" }).ok).toBe(false);
    expect(runPenalty({ ...base, basic: "", due: "2024-01-10", paid: "2024-02-09" })).toEqual({ ok: false, error: "Enter the basic tax due." });
    expect(runPenalty({ ...base, due: "2024-02-30", paid: "2024-03-09" }).ok).toBe(false);
    const oneDay = runPenalty({ ...base, due: "2025-04-15", paid: "2025-04-16" });
    expect(oneDay.ok && oneDay.view.subline).toContain("1 day late");
  });
});
