import { describe, expect, it } from "vitest";
import {
  DEFAULT_PROFILE,
  applies,
  businessForm,
  deadlineRules,
  normalizeProfile,
  summarizeProfile,
  type Profile,
} from "../src";

describe("normalizeProfile", () => {
  it("forces calendar year and income-tax option rules for individuals", () => {
    const p = normalizeProfile({ ...DEFAULT_PROFILE, taxpayer_type: "self_employed", fiscal_year_end_month: 6, income_tax_option: "not_applicable" });
    expect(p.fiscal_year_end_month).toBe(12);
    expect(p.income_tax_option).toBe("not_sure");
  });

  it("corporations have no 8% option; employees are non-VAT; eFPS group cleared for eBIRForms", () => {
    expect(normalizeProfile({ ...DEFAULT_PROFILE, taxpayer_type: "corporation", income_tax_option: "eight_percent" }).income_tax_option).toBe("not_applicable");
    expect(normalizeProfile({ ...DEFAULT_PROFILE, taxpayer_type: "employee", vat_status: "vat" }).vat_status).toBe("non_vat");
    expect(normalizeProfile({ ...DEFAULT_PROFILE, filing_channel: "ebirforms", efps_group: "A" }).efps_group).toBeNull();
  });

  it("maps business forms", () => {
    expect(businessForm("sole_proprietorship")).toBe("dti");
    expect(businessForm("opc")).toBe("sec");
    expect(businessForm("cooperative")).toBe("cda");
    expect(businessForm("employee")).toBeNull();
  });
});

describe("applies", () => {
  const p: Profile = { ...DEFAULT_PROFILE, taxpayer_type: "self_employed", vat_status: "non_vat", income_tax_option: "eight_percent" };
  it("evaluates conditions and exclusions", () => {
    expect(applies({}, p)).toBe("yes");
    expect(applies({ taxpayer_types: ["corporation"] }, p)).toBe("no");
    expect(applies({ vat_status: ["non_vat"], not: { income_tax_options: ["eight_percent"] } }, p)).toBe("no");
    expect(applies({ vat_status: ["non_vat"], not: { income_tax_options: ["graduated_osd"] } }, p)).toBe("yes");
    expect(applies({ withholds_expanded: false, has_employees: false }, p)).toBe("yes");
    expect(applies({ withholds_expanded: true }, p)).toBe("no");
  });

  it("returns maybe when the answer depends on a not-sure field", () => {
    const unsure = { ...p, vat_status: "not_sure" as const, income_tax_option: "not_sure" as const };
    expect(applies({ vat_status: ["vat"] }, unsure)).toBe("maybe");
    expect(applies({ income_tax_options: ["eight_percent"] }, unsure)).toBe("maybe");
    expect(applies({ taxpayer_types: ["self_employed"], not: { income_tax_options: ["eight_percent"] } }, unsure)).toBe("maybe");
    expect(applies({ taxpayer_types: ["corporation"], vat_status: ["vat"] }, unsure)).toBe("no");
  });
});

describe("summarizeProfile", () => {
  const on = "2026-06-01";

  it("sole proprietor with employees", () => {
    const s = summarizeProfile({ ...DEFAULT_PROFILE, has_employees: true, income_tax_option: "graduated_osd" }, deadlineRules, on);
    expect(s.registrations.map((r) => r.title)).toEqual([
      "DTI business name registration",
      "Barangay clearance and mayor's/business permit",
      "BIR registration",
      "Employer registration with SSS, PhilHealth and Pag-IBIG",
    ]);
    expect(s.returns.map((r) => r.code)).toEqual(["1701Q", "1701A", "2551Q", "1601C", "1604C"]);
    expect(s.tax_types).toEqual(["Income tax", "Percentage tax", "Withholding tax on compensation"]);
    expect(s.returns.find((r) => r.code === "1701Q")!.guide_slug).toBe("1701q");
  });

  it("corporation, VAT, with expanded withholding", () => {
    const s = summarizeProfile({ ...DEFAULT_PROFILE, taxpayer_type: "corporation", vat_status: "vat", withholds_expanded: true }, deadlineRules, on);
    expect(s.registrations[0]!.title).toBe("SEC registration");
    expect(s.registrations[2]!.detail).toContain("1903");
    expect(s.tax_types).toContain("Value-added tax (VAT)");
    expect(s.tax_types).toContain("Expanded withholding tax");
    expect(s.returns.find((r) => r.code === "1702Q")!.guide_slug).toBeNull();
  });

  it("cooperative path and not-sure notes", () => {
    const s = summarizeProfile({ ...DEFAULT_PROFILE, taxpayer_type: "cooperative", vat_status: "not_sure" }, deadlineRules, on);
    expect(s.registrations[0]!.title).toBe("CDA registration");
    expect(s.notes.join(" ")).toMatch(/VAT-registered/);
    const ind = summarizeProfile({ ...DEFAULT_PROFILE, income_tax_option: "not_sure" }, deadlineRules, on);
    expect(ind.notes.join(" ")).toMatch(/compare the 8% option/);
    expect(ind.returns.filter((r) => r.applicability === "maybe").map((r) => r.code)).toEqual(["1701A", "1701", "2551Q"]);
  });

  it("employee, estate and one-time transaction notes", () => {
    expect(summarizeProfile({ ...DEFAULT_PROFILE, taxpayer_type: "employee" }, deadlineRules, on).notes[0]).toMatch(/substituted filing/);
    const est = summarizeProfile({ ...DEFAULT_PROFILE, taxpayer_type: "estate" }, deadlineRules, on);
    expect(est.tax_types).toEqual(["Estate tax"]);
    expect(summarizeProfile({ ...DEFAULT_PROFILE, taxpayer_type: "one_time" }, deadlineRules, on).notes[0]).toMatch(/One-time/);
  });

  it("skips rules not yet in force", () => {
    const s = summarizeProfile({ ...DEFAULT_PROFILE, vat_status: "vat" }, deadlineRules, "2022-06-01");
    expect(s.returns.some((r) => r.code === "2550Q")).toBe(false);
  });
});
