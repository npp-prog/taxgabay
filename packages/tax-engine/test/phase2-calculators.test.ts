import { describe, expect, it } from "vitest";
import {
  computeAnnualCompensationTax,
  computeCgtRealProperty,
  computeCgtUnlistedShares,
  computeCompensationWithholding,
  computeCorporateIncomeTax,
  computeDonorsTax,
  computeDst,
  computeEstateTax,
  computeEwt,
  deMinimisCeilings,
  listAtcs,
  perUnitOrFraction,
  taxRules,
  type CompensationTableValue,
  type CorporateIncomeTaxInput,
  type DstInput,
  type EwtInput,
  type PayrollPeriod,
} from "../src";
import corporate from "./fixtures/corporate.json";
import ewt from "./fixtures/ewt.json";
import transfer from "./fixtures/transfer-taxes.json";
import comp from "./fixtures/withholding-compensation.json";

describe("corporate income tax (fixtures)", () => {
  for (const c of corporate.cases) {
    it(c.name, () => {
      const r = computeCorporateIncomeTax(c.input as CorporateIncomeTaxInput, taxRules);
      expect(r.result).toMatchObject(c.expected);
      expect(r.steps.at(-1)!.amount).toBe(r.result.tax_due);
    });
  }

  it("warns when the rate changed during the taxable year (calendar 2020), not for FY July 2020–June 2021", () => {
    const base = { year_commenced: 2010, gross_sales: "1000000", cost_of_sales: "0", deductions: "0", total_assets_excl_land: "1" };
    expect(computeCorporateIncomeTax({ ...base, taxable_year_end: "2020-12-31" }, taxRules).warnings.join(" ")).toMatch(/rate changed/);
    expect(computeCorporateIncomeTax({ ...base, taxable_year_end: "2021-06-30" }, taxRules).warnings.join(" ")).not.toMatch(/rate changed/);
  });

  it("explains the reduced-rate conditions and the MCIT carry-forward", () => {
    const r = computeCorporateIncomeTax(corporate.cases[2]!.input as CorporateIncomeTaxInput, taxRules);
    expect(r.warnings.join(" ")).toMatch(/reduced 20% rate needs/);
    expect(r.warnings.join(" ")).toMatch(/carried forward/);
  });

  it("does not warn about a rate change when no earlier rule exists", () => {
    const r = computeCorporateIncomeTax({ taxable_year_end: "2009-12-31", year_commenced: 2000, gross_sales: "1", cost_of_sales: "0", other_income: "0", deductions: "0", total_assets_excl_land: "0" }, taxRules);
    expect(r.warnings.join(" ")).not.toMatch(/rate changed/);
  });
});

describe("withholding on compensation (fixtures)", () => {
  for (const c of comp.periodic) {
    it(`${c.period} ${c.pay_date}: ₱${c.gross} → ₱${c.expected}`, () => {
      const r = computeCompensationWithholding(
        { period: c.period as PayrollPeriod, pay_date: c.pay_date, gross_compensation: c.gross, mandatory_contributions: c.contributions, non_taxable_compensation: c.non_taxable },
        taxRules,
      );
      expect(r.result.withholding_tax).toBe(c.expected);
    });
  }
  for (const c of comp.annual) {
    it(c.name, () => {
      const r = computeAnnualCompensationTax(c.input, taxRules);
      expect(r.result).toMatchObject(c.expected);
    });
  }

  it("has contiguous compensation tables", () => {
    for (const r of taxRules.filter((x) => x.rule_key.startsWith("withholding.compensation.") && "brackets" in (x.value as object))) {
      const b = (r.value as CompensationTableValue).brackets;
      expect(b[0]!.over).toBe("0");
      expect(b.at(-1)!.not_over).toBeNull();
      for (let i = 1; i < b.length; i++) expect(b[i]!.over).toBe(b[i - 1]!.not_over);
    }
  });

  it("only seeds semi-monthly, weekly and daily tables from 2023", () => {
    expect(() => computeCompensationWithholding({ period: "weekly", pay_date: "2022-06-07", gross_compensation: 1 }, taxRules)).toThrow(/No rule/);
  });

  it("lists de minimis ceilings", () => {
    const d = deMinimisCeilings(taxRules, "2026-01-01");
    expect(d.items.find((i) => i.key === "rice")!.ceiling).toBe("2000");
  });
});

describe("expanded withholding (fixtures)", () => {
  for (const c of ewt.cases) {
    it(`${c.input.atc} ₱${c.input.amount}`, () => {
      expect(computeEwt(c.input as EwtInput, taxRules).result).toMatchObject(c.expected);
    });
  }
  it("lists ATCs sorted and rejects unknown codes", () => {
    const atcs = listAtcs(taxRules, "2026-01-01");
    expect(atcs.length).toBe(12);
    expect(atcs.map((a) => a.atc)).toEqual([...atcs.map((a) => a.atc)].sort());
    expect(() => computeEwt({ atc: "XX999", payment_date: "2026-01-01", amount: 1, vat_inclusive: false }, taxRules)).toThrow(/No rule/);
  });
});

describe("estate, donor's, CGT, DST (fixtures)", () => {
  for (const c of transfer.estate) {
    it(`estate: ${c.name}`, () => expect(computeEstateTax(c.input, taxRules).result).toMatchObject(c.expected));
  }
  it("estate: deaths before 2018 are out of range", () => {
    expect(() => computeEstateTax({ date_of_death: "2017-12-31", exclusive_property: 1 }, taxRules)).toThrow(/No rule/);
  });
  for (const c of transfer.donors) {
    it(`donor's: ${c.name}`, () => expect(computeDonorsTax(c.input, taxRules).result).toMatchObject(c.expected));
  }
  for (const c of transfer.cgt_real_property) {
    it("CGT real property picks the highest value", () => {
      const r = computeCgtRealProperty(c.input, taxRules);
      expect(r.result).toMatchObject(c.expected);
      expect(r.steps[0]!.formula).toContain("zonal value");
    });
  }
  for (const c of transfer.cgt_shares) {
    it("CGT unlisted shares", () => expect(computeCgtUnlistedShares(c.input, taxRules).result).toMatchObject(c.expected));
  }
  it("CGT shares: a loss gives zero tax", () => {
    expect(computeCgtUnlistedShares({ date_of_sale: "2024-01-01", selling_price: 100, cost_basis: 200 }, taxRules).result.capital_gains_tax).toBe("0.00");
  });
  for (const c of transfer.dst) {
    it(`DST: ${c.name}`, () => expect(computeDst(c.input as DstInput, taxRules).result).toMatchObject(c.expected));
  }
  it("DST: consideration below FMV uses FMV; terms of a year or more are not pro-rated", () => {
    expect(computeDst({ transaction: "sale_real_property", date: "2024-01-01", amount: "1000000", fair_market_value: "2000000" }, taxRules).result.tax_base).toBe("2000000.00");
    expect(computeDst({ transaction: "sale_real_property", date: "2024-01-01", amount: "1000000" }, taxRules).result.dst).toBe("15000.00");
    expect(computeDst({ transaction: "debt_instrument", date: "2024-01-01", amount: "1000000", term_days: 400 }, taxRules).result.dst).toBe("7500.00");
  });
  it("perUnitOrFraction", () => {
    expect(perUnitOrFraction("0", "1000", "15").tax.toFixed(2)).toBe("0.00");
    expect(perUnitOrFraction("1", "1000", "15").tax.toFixed(2)).toBe("15.00");
  });
});
