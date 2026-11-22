import { describe, expect, it } from "vitest";
import {
  D,
  addMonths,
  daysBetween,
  dec,
  deadlineRules,
  findRule,
  forms,
  getForm,
  holidays,
  isLeapYear,
  maxISO,
  compareISO,
  money,
  parseISO,
  pct,
  peso,
  registrationSteps,
  RuleNotFoundError,
  taxRules,
  validateRules,
  type TaxRule,
} from "../src";

describe("seed data integrity", () => {
  it("has no overlapping or malformed tax rules", () => {
    expect(validateRules(taxRules)).toEqual([]);
  });

  it("marks every seeded row as needing verification", () => {
    for (const r of taxRules) expect(r.needs_verification, r.id).toBe(true);
    for (const r of deadlineRules) expect(r.needs_verification, r.id).toBe(true);
    for (const h of holidays) expect(h.needs_verification, h.date).toBe(true);
    for (const s of registrationSteps) expect(s.needs_verification, s.id).toBe(true);
    for (const f of forms) expect(f.needs_verification, f.code).toBe(true);
  });

  it("cites a legal basis on every row", () => {
    for (const r of [...taxRules, ...deadlineRules, ...holidays, ...registrationSteps]) {
      expect(r.legal_basis.trim().length).toBeGreaterThan(3);
    }
  });

  it("has contiguous graduated brackets starting at zero with an open top", () => {
    for (const r of taxRules.filter((x) => x.rule_key === "income_tax.individual.graduated")) {
      const b = (r.value as { brackets: { over: string; not_over: string | null }[] }).brackets;
      expect(b[0]!.over).toBe("0");
      expect(b.at(-1)!.not_over).toBeNull();
      for (let i = 1; i < b.length; i++) expect(b[i]!.over).toBe(b[i - 1]!.not_over);
    }
  });

  it("links every deadline rule to a known form", () => {
    for (const r of deadlineRules) expect(getForm(r.form_code), r.form_code).toBeDefined();
  });
});

describe("findRule / validateRules", () => {
  const base: Omit<TaxRule, "id" | "effective_from" | "effective_to"> = {
    rule_key: "x",
    tax_type: "vat",
    taxpayer_category: "all",
    value: 1,
    legal_basis: "test",
    source_url: null,
    last_verified_at: null,
    needs_verification: true,
  };

  it("picks the row in force on the date (inclusive bounds)", () => {
    expect(findRule(taxRules, "percentage_tax.sec116", "2023-06-30").id).toBe("pt-116-create");
    expect(findRule(taxRules, "percentage_tax.sec116", "2023-07-01").id).toBe("pt-116-2023");
  });

  it("throws RuleNotFoundError with a helpful message", () => {
    try {
      findRule(taxRules, "nope", "2024-01-01", { category: "individual" });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(RuleNotFoundError);
      expect((e as Error).message).toMatch(/nope.*individual.*2024-01-01/);
    }
  });

  it("throws on overlapping rows", () => {
    const rules = [
      { ...base, id: "a", effective_from: "2020-01-01", effective_to: null },
      { ...base, id: "b", effective_from: "2021-01-01", effective_to: null },
    ];
    expect(() => findRule(rules, "x", "2022-01-01")).toThrow(/Overlapping/);
    expect(validateRules(rules)).toEqual(["Overlap in x|all: a and b"]);
  });

  it("reports malformed rows", () => {
    const problems = validateRules([
      { ...base, id: "a", effective_from: "2020-13-01", effective_to: null },
      { ...base, id: "a", effective_from: "2020-01-01", effective_to: "2019-01-01", legal_basis: " " },
    ]);
    expect(problems).toEqual([
      "a: Invalid ISO date: 2020-13-01",
      "Duplicate id a",
      "a: effective_to before effective_from",
      "a: missing legal_basis",
    ]);
  });
});

describe("money and dates helpers", () => {
  it("rounds half-up to centavos and formats pesos", () => {
    expect(money("0.005")).toBe("0.01");
    expect(money("1,234.565")).toBe("1234.57");
    expect(money("")).toBe("0.00");
    expect(peso("1234567.8")).toBe("₱1,234,567.80");
    expect(peso("-50")).toBe("-₱50.00");
    expect(pct("0.12")).toBe("12%");
    expect(dec(new D(5)).toString()).toBe("5");
    expect(() => dec("abc")).toThrow();
    expect(() => dec(Infinity)).toThrow(/finite/);
  });

  it("handles month arithmetic and comparisons", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-01-15", -2)).toBe("2025-11-15");
    expect(daysBetween("2024-02-28", "2024-03-01")).toBe(2);
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2026)).toBe(false);
    expect(maxISO("2026-01-01", "2025-12-31")).toBe("2026-01-01");
    expect(maxISO("2025-01-01", "2025-12-31")).toBe("2025-12-31");
    expect(compareISO("2026-01-01", "2026-01-01")).toBe(0);
    expect(compareISO("2026-01-01", "2026-01-02")).toBe(-1);
    expect(compareISO("2026-01-03", "2026-01-02")).toBe(1);
    expect(() => parseISO("2026-1-1")).toThrow();
  });
});
