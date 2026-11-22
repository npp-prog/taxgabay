import { describe, expect, it } from "vitest";
import {
  DEFAULT_PROFILE,
  deadlineRules,
  generateObligations,
  holidays,
  obligationsToICS,
  rollForward,
  type DeadlineExtension,
  type Profile,
} from "../src";

const soleProp: Profile = {
  ...DEFAULT_PROFILE,
  taxpayer_type: "sole_proprietorship",
  vat_status: "non_vat",
  income_tax_option: "graduated_osd",
};

function gen(profile: Profile, from = "2026-01-01", to = "2026-12-31", extensions: DeadlineExtension[] = []) {
  return generateObligations(profile, { from, to, rules: deadlineRules, holidays, extensions });
}

function dates(obs: ReturnType<typeof gen>, form: string) {
  return obs.filter((o) => o.form_code === form).map((o) => `${o.period_label} → ${o.due_date}`);
}

describe("rollForward", () => {
  it("skips holidays and weekends", () => {
    // 24 Dec special day, 25 Dec regular holiday, 26–27 weekend
    const r = rollForward("2026-12-24", holidays);
    expect(r.date).toBe("2026-12-28");
    expect(r.skipped).toHaveLength(4);
    expect(r.skipped[0]).toContain("Christmas Eve");
    expect(r.skipped[2]).toContain("weekend");
  });

  it("leaves working days alone", () => {
    expect(rollForward("2026-04-15", holidays)).toEqual({ date: "2026-04-15", skipped: [] });
  });

  it("gives up on an impossible calendar", () => {
    const all = Array.from({ length: 40 }, (_, i) => ({
      date: `2030-01-${String(i + 1).padStart(2, "0")}`,
      name: "x",
      type: "regular" as const,
      year: 2030,
      legal_basis: "t",
      needs_verification: true,
    })).filter((h) => Number(h.date.slice(8)) <= 31);
    const feb = Array.from({ length: 28 }, (_, i) => ({ ...all[0]!, date: `2030-02-${String(i + 1).padStart(2, "0")}` }));
    expect(() => rollForward("2030-01-01", [...all, ...feb])).toThrow(/working day/);
  });
});

describe("generateObligations — sole proprietor, non-VAT, graduated", () => {
  const obs = gen(soleProp);

  it("generates 1701Q with weekend roll-over", () => {
    expect(dates(obs, "1701Q")).toEqual([
      "Q1 2026 → 2026-05-15",
      "Q2 2026 → 2026-08-17",
      "Q3 2026 → 2026-11-16",
    ]);
    const q2 = obs.find((o) => o.form_code === "1701Q" && o.period_label === "Q2 2026")!;
    expect(q2.statutory_due_date).toBe("2026-08-15");
    expect(q2.adjustments[0]).toMatch(/weekend/);
  });

  it("generates 2551Q including Q4 of the prior year", () => {
    expect(dates(obs, "2551Q")).toEqual([
      "Q4 2025 → 2026-01-26",
      "Q1 2026 → 2026-04-27",
      "Q2 2026 → 2026-07-27",
      "Q3 2026 → 2026-10-26",
    ]);
  });

  it("uses 1701A for OSD and the annual 15 April date", () => {
    expect(dates(obs, "1701A")).toEqual(["TY 2025 → 2026-04-15"]);
    expect(dates(obs, "1701")).toEqual([]);
  });

  it("does not generate employer or VAT returns", () => {
    expect(obs.some((o) => ["1601C", "2550Q", "0619E"].includes(o.form_code))).toBe(false);
    expect(obs.every((o) => !o.tentative)).toBe(true);
  });

  it("is sorted by due date", () => {
    const ds = obs.map((o) => o.due_date);
    expect([...ds].sort()).toEqual(ds);
  });
});

describe("generateObligations — variants", () => {
  it("8% option: no percentage tax", () => {
    const obs = gen({ ...soleProp, income_tax_option: "eight_percent" });
    expect(dates(obs, "2551Q")).toEqual([]);
    expect(dates(obs, "1701A")).toHaveLength(1);
  });

  it("mixed income files 1701", () => {
    const obs = gen({ ...soleProp, taxpayer_type: "mixed_income", income_tax_option: "eight_percent" });
    expect(dates(obs, "1701")).toEqual(["TY 2025 → 2026-04-15"]);
  });

  it("VAT-registered files 2550Q, not 2551Q", () => {
    const obs = gen({ ...soleProp, vat_status: "vat" });
    expect(dates(obs, "2550Q")).toHaveLength(4);
    expect(dates(obs, "2551Q")).toEqual([]);
  });

  it("marks obligations tentative when VAT status is not sure", () => {
    const obs = gen({ ...soleProp, vat_status: "not_sure" });
    const vatish = obs.filter((o) => o.form_code === "2550Q" || o.form_code === "2551Q");
    expect(vatish.length).toBe(8);
    expect(vatish.every((o) => o.tentative)).toBe(true);
  });

  it("employer: 1601C monthly with December due 15 January, and 1604C", () => {
    const obs = gen({ ...soleProp, has_employees: true }, "2026-01-01", "2027-01-31");
    const c = dates(obs, "1601C");
    expect(c[0]).toBe("2025-12 → 2026-01-15");
    expect(c).toContain("2026-02 → 2026-03-10");
    expect(c.at(-1)).toBe("2026-12 → 2027-01-15");
    // 31 Jan 2026 is a Saturday → 2 Feb 2026; 31 Jan 2027 is a Sunday → 1 Feb 2027 (outside range)
    expect(dates(obs, "1604C")).toEqual(["TY 2025 → 2026-02-02"]);
  });

  it("eFPS group days for 1601C", () => {
    const a = gen({ ...soleProp, has_employees: true, filing_channel: "efps", efps_group: "A" }, "2026-02-01", "2026-02-28");
    expect(dates(a, "1601C")).toEqual(["2026-01 → 2026-02-16"]); // 15 Feb is a Sunday
    const e = gen({ ...soleProp, has_employees: true, filing_channel: "efps", efps_group: "E" }, "2026-02-01", "2026-02-28");
    expect(dates(e, "1601C")).toEqual(["2026-01 → 2026-02-11"]);
    // eBIRForms filers ignore group
    const m = gen({ ...soleProp, has_employees: true, filing_channel: "ebirforms", efps_group: "A" }, "2026-02-01", "2026-02-28");
    expect(dates(m, "1601C")).toEqual(["2026-01 → 2026-02-10"]);
  });

  it("expanded withholding: 0619E skips quarter-end months; 1601EQ rolls past a holiday; 1604E", () => {
    const obs = gen({ ...soleProp, withholds_expanded: true });
    const e = dates(obs, "0619E");
    expect(e).toHaveLength(8);
    expect(e.some((x) => /-(03|06|09|12) →/.test(x))).toBe(false);
    // Q3 2026: 31 Oct (Sat) → 1 Nov (Sun) → 2 Nov (All Souls') → 3 Nov
    const q3 = obs.find((o) => o.form_code === "1601EQ" && o.period_label === "Q3 2026")!;
    expect(q3.due_date).toBe("2026-11-03");
    expect(q3.adjustments[0]).toContain("All Souls");
    expect(dates(obs, "1604E")).toEqual(["TY 2025 → 2026-03-02"]); // 1 Mar 2026 is a Sunday
  });

  it("fiscal-year corporation: quarters follow the taxable year", () => {
    const corp: Profile = { ...DEFAULT_PROFILE, taxpayer_type: "corporation", vat_status: "non_vat", fiscal_year_end_month: 6 };
    const obs = gen(corp, "2026-07-01", "2027-06-30");
    expect(dates(obs, "2551Q")).toEqual([
      "Q4 FY ending 2026-06 → 2026-07-27",
      "Q1 FY ending 2027-06 → 2026-10-26",
      "Q2 FY ending 2027-06 → 2027-01-25",
      "Q3 FY ending 2027-06 → 2027-04-26",
    ]);
    // 29 Nov 2026 (Sun) → 30 Nov (Bonifacio Day) → 1 Dec
    expect(dates(obs, "1702Q")[0]).toBe("Q1 FY ending 2027-06 → 2026-12-01");
    expect(dates(obs, "1702-RT")).toEqual(["TY FY ending 2026-06 → 2026-10-15"]);
    // Individuals are forced to calendar year even if a fiscal month is stored.
    const ind = gen({ ...soleProp, fiscal_year_end_month: 6 });
    expect(dates(ind, "2551Q")[0]).toBe("Q4 2025 → 2026-01-26");
  });

  it("applies BIR extensions", () => {
    const obs = gen(soleProp, "2026-01-01", "2026-12-31", [
      { form_code: "1701A", original_date: "2026-04-15", new_date: "2026-05-15", issuance_ref: "RMC 99-2026 (example)" },
      { form_code: "1701Q", original_date: "2026-08-17", new_date: "2026-08-20", issuance_ref: "RMC 100-2026 (example)" },
    ]);
    const a = obs.find((o) => o.form_code === "1701A")!;
    expect(a.due_date).toBe("2026-05-15");
    expect(a.adjustments).toEqual(["Extended to 2026-05-15 by RMC 99-2026 (example)"]);
    // Extension keyed on the rolled-over date also matches
    expect(obs.find((o) => o.form_code === "1701Q" && o.period_label === "Q2 2026")!.due_date).toBe("2026-08-20");
  });

  it("employees only have no generated returns", () => {
    expect(gen({ ...DEFAULT_PROFILE, taxpayer_type: "employee" })).toEqual([]);
  });

  it("validates the range", () => {
    expect(() => gen(soleProp, "2026-12-31", "2026-01-01")).toThrow(/from/);
  });

  it("skips rules restricted to another filing channel and event rules", () => {
    const rules = [
      { ...deadlineRules[0]!, id: "efps-only", filing_channel: "efps" as const },
      { ...deadlineRules[0]!, id: "event", due_logic: { kind: "event" as const, event: "x", days_after_event: 30 } },
    ];
    expect(generateObligations(soleProp, { from: "2026-01-01", to: "2026-12-31", rules, holidays })).toEqual([]);
  });

  it("skips periods before a rule took effect", () => {
    // 2550Q starts 2023-01-01: Q4 2022 (due Jan 2023) is not generated
    const obs = gen({ ...soleProp, vat_status: "vat" }, "2023-01-01", "2023-02-28");
    expect(dates(obs, "2550Q")).toEqual([]);
  });
});

describe("obligationsToICS", () => {
  it("produces all-day events with escaped text and folded lines", () => {
    const obs = gen(soleProp, "2026-04-01", "2026-04-30");
    const ics = obligationsToICS(obs, "20260101T000000Z");
    expect(ics).toMatch(/^BEGIN:VCALENDAR\r\n/);
    expect(ics).toContain("DTSTART;VALUE=DATE:20260415");
    expect(ics).toContain("DTEND;VALUE=DATE:20260416");
    expect(ics).toContain("SUMMARY:BIR 1701A due (TY 2025)");
    expect(ics).toContain("\\,");
    for (const line of ics.split("\r\n")) expect(line.length).toBeLessThanOrEqual(75);
    expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
  });
});
