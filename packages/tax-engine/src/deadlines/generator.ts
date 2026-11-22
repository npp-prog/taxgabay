import {
  addDays,
  addMonths,
  daysInMonth,
  endOfMonth,
  isWeekend,
  parseISO,
  toISO,
} from "../dates";
import type { DeadlineRule, DueLogic } from "../data/deadline-rules";
import type { DeadlineExtension, Holiday } from "../data/holidays";
import { applies, normalizeProfile, type Profile } from "../profile";
import { inForce } from "../rules";
import type { ISODate } from "../types";

export interface Obligation {
  id: string;
  rule_id: string;
  form_code: string;
  title: string;
  period_label: string;
  period_start: ISODate;
  period_end: ISODate;
  /** Due date before weekend/holiday roll-over and extensions. */
  statutory_due_date: ISODate;
  due_date: ISODate;
  adjustments: string[];
  /** True when applicability depends on a "not sure" profile answer. */
  tentative: boolean;
  legal_basis: string;
  needs_verification: boolean;
}

export interface GenerateOptions {
  from: ISODate;
  to: ISODate;
  rules: readonly DeadlineRule[];
  holidays: readonly Holiday[];
  extensions?: readonly DeadlineExtension[];
}

interface Period {
  label: string;
  start: ISODate;
  end: ISODate;
  /** Calendar month of the period end (1–12), used for exceptions. */
  endMonth: number;
}

/** Next working day on or after `d` (skips weekends and all listed holidays). */
export function rollForward(
  d: ISODate,
  holidays: readonly Holiday[],
): { date: ISODate; skipped: string[] } {
  const byDate = new Map(holidays.map((h) => [h.date, h.name]));
  const skipped: string[] = [];
  let cur = d;
  // Bounded loop: no real calendar has 30 consecutive non-working days.
  for (let i = 0; i < 30; i++) {
    const holiday = byDate.get(cur);
    if (!isWeekend(cur) && !holiday) return { date: cur, skipped };
    skipped.push(holiday ? `${cur} (${holiday})` : `${cur} (weekend)`);
    cur = addDays(cur, 1);
  }
  throw new Error(`Could not find a working day after ${d}`);
}

function dayIn(y: number, m: number, day: number | "last"): ISODate {
  return toISO(y, m, day === "last" ? daysInMonth(y, m) : Math.min(day, daysInMonth(y, m)));
}

/** Statutory due date for a period. */
export function dueDateFor(logic: DueLogic, period: Period, profile: Profile): ISODate {
  const { y, m } = parseISO(period.end);
  switch (logic.kind) {
    case "monthly_following": {
      const exception = logic.exceptions?.find((e) => e.period_month === period.endMonth);
      if (exception) {
        const t = parseISO(addMonths(toISO(y, m, 1), exception.month_offset));
        return dayIn(t.y, t.m, exception.day);
      }
      const t = parseISO(addMonths(toISO(y, m, 1), 1));
      const efpsDay =
        profile.filing_channel === "efps" && profile.efps_group
          ? logic.efps_days?.[profile.efps_group]
          : undefined;
      return dayIn(t.y, t.m, efpsDay ?? logic.day);
    }
    case "quarterly":
    case "annual": {
      if ("days_after" in logic && logic.days_after !== undefined) {
        return addDays(period.end, logic.days_after);
      }
      const t = parseISO(addMonths(toISO(y, m, 1), logic.month_offset ?? 0));
      return dayIn(t.y, t.m, logic.day ?? "last");
    }
    /* c8 ignore next 2 -- event rules are filtered out before this is called */
    case "event":
      throw new Error("Event-based deadlines need an event date");
  }
}

/** Year-end month for a rule: calendar (12) or the profile's taxable year. */
function yearEndMonth(basis: "calendar" | "taxable_year", profile: Profile): number {
  return basis === "calendar" ? 12 : profile.fiscal_year_end_month;
}

function taxableYearLabel(endY: number, endM: number): string {
  return endM === 12 ? `${endY}` : `FY ending ${toISO(endY, endM, 1).slice(0, 7)}`;
}

/** Enumerate periods whose end falls in [start, end]. */
function periodsFor(logic: DueLogic, profile: Profile, start: ISODate, end: ISODate): Period[] {
  const out: Period[] = [];
  const s = parseISO(start);
  const e = parseISO(end);
  for (let idx = s.y * 12 + s.m - 1; idx <= e.y * 12 + e.m - 1; idx++) {
    const y = Math.floor(idx / 12);
    const m = (idx % 12) + 1;
    const monthEnd = endOfMonth(y, m);
    const monthStart = toISO(y, m, 1);
    if (logic.kind === "monthly_following") {
      if (logic.period_months === "non_quarter_end" && m % 3 === 0) continue;
      out.push({ label: monthStart.slice(0, 7), start: monthStart, end: monthEnd, endMonth: m });
    } else if (logic.kind === "quarterly") {
      const yem = yearEndMonth(logic.quarter_basis, profile);
      // Months since year end, 1..12; quarter ends are at 3, 6, 9, 12.
      const offset = (((m - yem) % 12) + 12) % 12 || 12;
      if (offset % 3 !== 0) continue;
      const q = offset / 3;
      if (!logic.quarters.includes(q)) continue;
      const yearEnd = parseISO(addMonths(toISO(y, m, 1), 12 - offset));
      out.push({
        label: `Q${q} ${taxableYearLabel(yearEnd.y, yearEnd.m)}`,
        start: addMonths(toISO(y, m, 1), -2),
        end: monthEnd,
        endMonth: m,
      });
    } else if (logic.kind === "annual") {
      if (m !== yearEndMonth(logic.year_basis, profile)) continue;
      out.push({
        label: `TY ${taxableYearLabel(y, m)}`,
        start: addMonths(toISO(y, m, 1), -11),
        end: monthEnd,
        endMonth: m,
      });
    }
  }
  return out;
}

/**
 * Generates dated obligations for `profile` whose (final) due date falls in [from, to].
 * Rules must be in force on the period end date.
 */
export function generateObligations(profileIn: Profile, opts: GenerateOptions): Obligation[] {
  const profile = normalizeProfile(profileIn);
  const { from, to, rules, holidays, extensions = [] } = opts;
  parseISO(from);
  parseISO(to);
  if (from > to) throw new Error("`from` must be on or before `to`");

  // Longest lag between period end and due date is under 5 months; look back 6 to be safe,
  // and stop at `to` since a period cannot end after its due date.
  const scanStart = addMonths(from, -6);

  const out: Obligation[] = [];
  for (const rule of rules) {
    if (rule.due_logic.kind === "event") continue;
    if (rule.filing_channel !== "all" && rule.filing_channel !== profile.filing_channel) continue;
    const applicability = applies(rule.applies_when, profile);
    if (applicability === "no") continue;

    for (const period of periodsFor(rule.due_logic, profile, scanStart, to)) {
      if (!inForce(rule, period.end)) continue;
      const statutory = dueDateFor(rule.due_logic, period, profile);
      const adjustments: string[] = [];
      let due = statutory;

      const extension = extensions.find(
        (x) => x.form_code === rule.form_code && x.original_date === statutory,
      );
      const rolled = rollForward(statutory, holidays);
      if (rolled.date !== statutory) {
        adjustments.push(`Moved from ${statutory} to ${rolled.date}: ${rolled.skipped.join(", ")} not a working day`);
        due = rolled.date;
      }
      const rolledExtension =
        extension ??
        extensions.find((x) => x.form_code === rule.form_code && x.original_date === rolled.date);
      if (rolledExtension) {
        adjustments.push(`Extended to ${rolledExtension.new_date} by ${rolledExtension.issuance_ref}`);
        due = rolledExtension.new_date;
      }
      if (due < from || due > to) continue;

      out.push({
        id: `${rule.id}:${period.end}`,
        rule_id: rule.id,
        form_code: rule.form_code,
        title: rule.title,
        period_label: period.label,
        period_start: period.start,
        period_end: period.end,
        statutory_due_date: statutory,
        due_date: due,
        adjustments,
        tentative: applicability === "maybe",
        legal_basis: rule.legal_basis,
        needs_verification: rule.needs_verification,
      });
    }
  }
  return out.sort((a, b) =>
    a.due_date === b.due_date ? a.form_code.localeCompare(b.form_code) : a.due_date < b.due_date ? -1 : 1,
  );
}
