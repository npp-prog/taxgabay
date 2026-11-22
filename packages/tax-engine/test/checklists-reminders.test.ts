import { describe, expect, it } from "vitest";
import {
  DEFAULT_PROFILE,
  DEFAULT_REMINDER_SETTINGS,
  checklistFor,
  checklistItems,
  checklistPeriod,
  complianceScore,
  deadlineRules,
  getLifeEvent,
  holidays,
  lifeEvents,
  planReminders,
  registrationSteps,
  reminderMessage,
  type Profile,
} from "../src";

const soleProp: Profile = { ...DEFAULT_PROFILE, income_tax_option: "graduated_osd" };

describe("checklists", () => {
  it("labels periods", () => {
    expect(checklistPeriod("monthly", "2026-11-22")).toBe("2026-11");
    expect(checklistPeriod("quarterly", "2026-11-22")).toBe("2026-Q4");
    expect(checklistPeriod("annual", "2026-11-22")).toBe("2026");
    expect(checklistPeriod("one_time", "2026-11-22")).toBe("once");
  });

  it("filters monthly items by month type", () => {
    const p = { ...soleProp, withholds_expanded: true, has_employees: true };
    expect(checklistFor(p, "monthly", "2026-11-05").map((e) => e.id)).toContain("m-0619e");
    expect(checklistFor(p, "monthly", "2026-12-05").map((e) => e.id)).not.toContain("m-0619e");
    expect(checklistFor(p, "monthly", "2026-12-05").map((e) => e.id)).toContain("m-1601c");
  });

  it("filters quarterly items by quarter and profile", () => {
    expect(checklistFor(soleProp, "quarterly", "2026-05-01").map((e) => e.id)).toEqual(["q-1701q", "q-2551q", "q-2307-collect"]);
    expect(checklistFor(soleProp, "quarterly", "2026-11-01").map((e) => e.id)).not.toContain("q-1701q");
    expect(checklistFor({ ...soleProp, income_tax_option: "eight_percent" }, "quarterly", "2026-05-01").map((e) => e.id)).not.toContain("q-2551q");
  });

  it("supports quarter-end-only monthly items", () => {
    const items = [{ ...checklistItems[0]!, id: "x", months: "quarter_end" as const }];
    expect(checklistFor(soleProp, "monthly", "2026-11-01", items)).toEqual([]);
    expect(checklistFor(soleProp, "monthly", "2026-12-01", items)).toHaveLength(1);
  });

  it("employees have no business checklist", () => {
    expect(checklistFor({ ...DEFAULT_PROFILE, taxpayer_type: "employee" }, "annual", "2026-01-01")).toEqual([]);
  });

  it("scores only definite items", () => {
    const unsure = { ...soleProp, vat_status: "not_sure" as const };
    const entries = checklistFor(unsure, "quarterly", "2026-05-01");
    expect(entries.find((e) => e.id === "q-2550q")!.applicability).toBe("maybe");
    const score = complianceScore(entries, ["q-1701q@2026-Q2", "q-2550q@2026-Q2"]);
    expect(score).toEqual({ done: 1, total: 2, percent: 50 });
    expect(complianceScore([], [])).toEqual({ done: 0, total: 0, percent: null });
  });

  it("every item is flagged and cites a basis", () => {
    for (const i of checklistItems) {
      expect(i.needs_verification).toBe(true);
      expect(i.legal_basis.length).toBeGreaterThan(3);
    }
  });
});

describe("planReminders", () => {
  const base = {
    profile: soleProp,
    settings: DEFAULT_REMINDER_SETTINGS,
    completed: new Set<string>(),
    already_sent: new Set<string>(),
    rules: deadlineRules,
    holidays,
  };

  it("finds obligations due exactly N days ahead", () => {
    const r = planReminders({ ...base, today: "2026-05-08" });
    expect(r.map((x) => x.key)).toEqual(["dl-1701q:2026-03-31:7"]);
    expect(r[0]!.channels).toEqual(["email"]);
    expect(planReminders({ ...base, today: "2026-05-14" }).map((x) => x.days_before)).toEqual([1]);
    expect(planReminders({ ...base, today: "2026-05-10" })).toEqual([]);
  });

  it("skips completed and already-sent reminders", () => {
    expect(planReminders({ ...base, today: "2026-05-08", completed: new Set(["dl-1701q:2026-03-31"]) })).toEqual([]);
    expect(planReminders({ ...base, today: "2026-05-08", already_sent: new Set(["dl-1701q:2026-03-31:7"]) })).toEqual([]);
  });

  it("respects channels and ignores invalid day settings", () => {
    expect(planReminders({ ...base, today: "2026-05-08", settings: { days_before: [7], email_enabled: false, push_enabled: false } })).toEqual([]);
    expect(planReminders({ ...base, today: "2026-05-08", settings: { days_before: [-1, 99, 1.5], email_enabled: true, push_enabled: true } })).toEqual([]);
    expect(planReminders({ ...base, today: "2026-05-08", settings: { days_before: [7, 7], email_enabled: true, push_enabled: true } })[0]!.channels).toEqual(["email", "push"]);
  });

  it("writes plain messages", () => {
    const [r] = planReminders({ ...base, today: "2026-05-08" });
    const m = reminderMessage(r!);
    expect(m.subject).toBe("BIR 1701Q is due in 7 days (2026-05-15)");
    expect(m.text).toContain("For guidance only");
    expect(reminderMessage({ ...r!, days_before: 1 }).subject).toContain("tomorrow");
    expect(reminderMessage({ ...r!, days_before: 0 }).subject).toContain("today");
    expect(reminderMessage({ obligation: { ...r!.obligation, tentative: true }, days_before: 3 }).text).toContain("weren't sure");
  });
});

describe("roadmaps and life events data", () => {
  it("has DTI, SEC and CDA paths with unique ids and contiguous order", () => {
    const ids = new Set(registrationSteps.map((s) => s.id));
    expect(ids.size).toBe(registrationSteps.length);
    for (const form of ["dti", "sec", "cda"] as const) {
      const orders = registrationSteps.filter((s) => s.business_form === form).map((s) => s.order).sort((a, b) => a - b);
      expect(orders).toEqual(orders.map((_, i) => i + 1));
    }
  });

  it("has seven life events with internal links only", () => {
    expect(lifeEvents.map((e) => e.slug)).toEqual(["start-a-business", "hire-first-employee", "close-a-business", "settle-an-estate", "sell-real-property", "donate-property", "transfer-rdo"]);
    for (const e of lifeEvents) {
      expect(e.needs_verification).toBe(true);
      for (const s of e.steps) for (const l of s.links) expect(l.href.startsWith("/")).toBe(true);
    }
    expect(getLifeEvent("settle-an-estate")!.steps.length).toBeGreaterThan(2);
    expect(getLifeEvent("nope")).toBeUndefined();
  });
});
