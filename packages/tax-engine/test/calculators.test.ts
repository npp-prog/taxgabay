import { describe, expect, it } from "vitest";
import {
  computeIndividualIncomeTax,
  computePenalty,
  computePercentageTax,
  computeVat,
  graduatedTax,
  splitVat,
  taxRules,
  type IndividualIncomeTaxInput,
  type PenaltyInput,
  type VatInput,
} from "../src";
import graduated from "./fixtures/graduated-tax.json";
import individual from "./fixtures/individual-income-tax.json";
import penalty from "./fixtures/penalty.json";
import percentage from "./fixtures/percentage-tax.json";
import vat from "./fixtures/vat.json";

describe("graduated income tax (fixtures)", () => {
  for (const c of graduated.cases) {
    it(`${c.year}: ₱${c.taxable_income} → ₱${c.expected_tax}`, () => {
      const g = graduatedTax(c.taxable_income, `${c.year}-12-31`, taxRules);
      expect(g.tax.toFixed(2)).toBe(c.expected_tax);
      expect(g.step.legal_basis).toContain("24(A)(2)(a)");
    });
  }

  it("treats negative taxable income as zero", () => {
    expect(graduatedTax("-5000", "2024-12-31", taxRules).tax.toFixed(2)).toBe("0.00");
  });

  it("throws for years before the seeded tables", () => {
    expect(() => graduatedTax("100000", "2017-12-31", taxRules)).toThrow(/No rule/);
  });
});

describe("individual income tax comparison (fixtures)", () => {
  for (const c of individual.cases) {
    it(c.name, () => {
      const r = computeIndividualIncomeTax(c.input as IndividualIncomeTaxInput, taxRules);
      expect(r.result.kind).toBe(c.expected.kind);
      expect(r.result.recommended).toBe(c.expected.recommended);
      for (const [key, exp] of Object.entries(c.expected.options)) {
        const opt = r.result.options.find((o) => o.key === key);
        expect(opt, key).toBeDefined();
        expect(opt).toMatchObject(exp);
      }
      expect(r.steps.length).toBeGreaterThan(0);
      for (const s of r.steps) expect(s.amount).toMatch(/^-?\d+\.\d{2}$/);
    });
  }

  it("warns when the percentage tax rate changed during the year (2023)", () => {
    const r = computeIndividualIncomeTax({ taxable_year: 2023, gross_sales_receipts: "1000000", vat_registered: false }, taxRules);
    expect(r.warnings.join(" ")).toMatch(/changed during 2023/);
    expect(r.rules_used).toEqual(expect.arrayContaining(["pt-116-create", "pt-116-2023"]));
  });

  it("explains why 8% is unavailable for VAT-registered taxpayers", () => {
    const r = computeIndividualIncomeTax({ taxable_year: 2024, gross_sales_receipts: "1000000", vat_registered: true }, taxRules);
    const eight = r.result.options.find((o) => o.key === "eight_percent")!;
    expect(eight.ineligible_reasons[0]).toMatch(/non-VAT/);
    expect(r.warnings.join(" ")).toMatch(/VAT is not included/);
  });

  it("ignores a blank itemized deduction", () => {
    const r = computeIndividualIncomeTax({ taxable_year: 2024, gross_sales_receipts: "500000", itemized_deductions: "", vat_registered: false }, taxRules);
    expect(r.result.options.map((o) => o.key)).toEqual(["graduated_osd", "eight_percent"]);
  });

  it("handles other non-operating income", () => {
    const r = computeIndividualIncomeTax({ taxable_year: 2024, gross_sales_receipts: "900000", other_non_operating_income: "100000", vat_registered: false }, taxRules);
    const eight = r.result.options.find((o) => o.key === "eight_percent")!;
    expect(eight.income_tax).toBe("60000.00"); // 8% × (1,000,000 − 250,000)
    const osd = r.result.options.find((o) => o.key === "graduated_osd")!;
    // OSD 40% × 900,000 = 360,000; taxable = 1,000,000 − 360,000 = 640,000 → 22,500 + 20% × 240,000
    expect(osd.income_tax).toBe("70500.00");
  });
});

describe("percentage tax (fixtures)", () => {
  for (const c of percentage.cases) {
    it(`${c.period_end}: ₱${c.gross}`, () => {
      const r = computePercentageTax({ period_end: c.period_end, gross_sales_receipts: c.gross }, taxRules);
      expect(r.result.rate).toBe(String(Number(c.expected_rate)));
      expect(r.result.tax_due).toBe(c.expected_tax);
      expect(r.warnings).toEqual([]);
    });
  }

  it("warns when quarterly sales exceed the VAT threshold", () => {
    const r = computePercentageTax({ period_end: "2026-03-31", gross_sales_receipts: "3500000" }, taxRules);
    expect(r.warnings[0]).toMatch(/VAT threshold/);
  });
});

describe("VAT (fixtures)", () => {
  for (const c of vat.cases) {
    it(c.name, () => {
      const r = computeVat(c.input as VatInput, taxRules);
      expect(r.result).toMatchObject(c.expected);
    });
  }

  it("splitVat exclusive", () => {
    const s = splitVat("1000", "0.12", false);
    expect([s.net.toFixed(2), s.vat.toFixed(2), s.gross.toFixed(2)]).toEqual(["1000.00", "120.00", "1120.00"]);
  });
});

describe("penalties (fixtures)", () => {
  for (const c of penalty.cases) {
    it(c.name, () => {
      const r = computePenalty(c.input as PenaltyInput, taxRules);
      const { segments, ...exp } = c.expected as typeof c.expected & { segments?: { days: number; amount: string }[] };
      expect(r.result).toMatchObject(exp);
      if (segments) {
        expect(r.result.interest_segments.map((s) => ({ days: s.days, amount: s.amount }))).toEqual(segments);
      }
      const total = r.steps.at(-1)!;
      expect(total.amount).toBe(c.expected.total_amount_due);
    });
  }

  it("throws on an invalid date", () => {
    expect(() =>
      computePenalty({ due_date: "2025-02-30", payment_date: "2025-03-01", basic_tax_due: 1, taxpayer_size: "micro", late_filing: true, late_payment: true, willful: false }, taxRules),
    ).toThrow(/Invalid ISO date/);
  });

  it("charges no compromise when the basic tax is zero", () => {
    const r = computePenalty({ due_date: "2025-04-15", payment_date: "2025-05-15", basic_tax_due: 0, taxpayer_size: "medium", late_filing: true, late_payment: true, willful: false }, taxRules);
    expect(r.result.compromise).toBe("0.00");
  });
});
