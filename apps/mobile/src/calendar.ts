import { addDays, addMonths, deadlineExtensions, deadlineRules, generateObligations, holidays, type Obligation, type Profile } from "@taxgabay/tax-engine";

export interface MonthGroup {
  month: string; // YYYY-MM
  items: Obligation[];
}

/** Obligations from the 1st of this month through 12 months ahead, grouped by due month. */
export function calendarFor(profile: Profile, today: string): MonthGroup[] {
  const from = `${today.slice(0, 7)}-01`;
  const to = addDays(addMonths(today, 12), -1);
  const obligations = generateObligations(profile, { from, to, rules: deadlineRules, holidays, extensions: deadlineExtensions });
  const groups: MonthGroup[] = [];
  for (const o of obligations) {
    const m = o.due_date.slice(0, 7);
    const last = groups.at(-1);
    if (last && last.month === m) last.items.push(o);
    else groups.push({ month: m, items: [o] });
  }
  return groups;
}
