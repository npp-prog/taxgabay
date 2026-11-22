import { DEFAULT_PROFILE } from "@taxgabay/tax-engine";
import { describe, expect, it } from "vitest";
import { calendarFor } from "../src/calendar";
import { formatDate, formatMonth, todayPH } from "../src/lib/dates";

describe("calendar", () => {
  it("groups 12 months of obligations by due month, starting this month", () => {
    const groups = calendarFor({ ...DEFAULT_PROFILE, income_tax_option: "graduated_osd" }, "2026-05-08");
    expect(groups[0]!.month).toBe("2026-05");
    expect(groups[0]!.items.map((o) => o.form_code)).toContain("1701Q");
    const months = groups.map((g) => g.month);
    expect(months).toEqual([...months].sort());
    expect(new Set(months).size).toBe(months.length);
    expect(months.at(-1)! <= "2027-05").toBe(true);
  });

  it("is empty for employees", () => {
    expect(calendarFor({ ...DEFAULT_PROFILE, taxpayer_type: "employee" }, "2026-05-08")).toEqual([]);
  });
});

describe("dates", () => {
  it("formats in Philippine time", () => {
    expect(todayPH(new Date("2026-05-07T17:00:00Z"))).toBe("2026-05-08");
    expect(formatDate("2026-05-15")).toBe("Fri 15 May 2026");
    expect(formatMonth("2026-11")).toBe("November 2026");
  });
});
