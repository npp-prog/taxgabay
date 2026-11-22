import { describe, expect, it } from "vitest";
import { computeEmployerContributions, employerRules, findRule, taxRules, validateRules } from "../src";
import fx from "./fixtures/contributions.json";

describe("employer contributions (fixtures)", () => {
  for (const c of fx.cases) {
    it(c.name, () => {
      const r = computeEmployerContributions(c.input, taxRules);
      expect(r.result).toMatchObject(c.expected);
      expect(r.steps.at(-1)!.label).toBe("Total employer share");
    });
  }
  it("has the older Pag-IBIG base before February 2024, and no PhilHealth row before 2024", () => {
    expect(findRule<{ max_compensation: string }>(taxRules, "employer.pagibig", "2023-06-30").value.max_compensation).toBe("5000");
    expect(() => computeEmployerContributions({ monthly_salary: "20000", date: "2023-06-30" }, taxRules)).toThrow(/No rule "employer.philhealth"/);
  });
  it("employer rules are valid and flagged", () => {
    expect(validateRules(taxRules)).toEqual([]);
    for (const r of employerRules) expect(r.needs_verification, r.id).toBe(true);
  });
});
