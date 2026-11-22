import { holidays } from "@taxgabay/tax-engine";
import { describe, expect, it } from "vitest";
import { mergeCalendarData } from "./calendar-merge";

describe("mergeCalendarData", () => {
  it("adds database holidays and lets them override bundled dates", () => {
    const m = mergeCalendarData(
      [
        { date: "2026-03-20", name: "Eid'l Fitr", type: "regular", year: 2026, legal_basis: "Proclamation", needs_verification: false },
        { date: "2026-01-01", name: "New Year (edited)", type: "regular", year: 2026, legal_basis: "Proclamation", needs_verification: false },
      ],
      [{ form_code: "1701A", original_date: "2026-04-15", new_date: "2026-05-15", issuance_ref: "RMC" }],
    );
    expect(m.holidays).toHaveLength(holidays.length + 1);
    expect(m.holidays.find((h) => h.date === "2026-01-01")!.name).toBe("New Year (edited)");
    expect(m.holidays.map((h) => h.date)).toEqual([...m.holidays.map((h) => h.date)].sort());
    expect(m.extensions).toHaveLength(1);
  });
});
