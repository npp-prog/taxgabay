import { checklistItems, type ChecklistFrequency, type ChecklistItem } from "./data/checklist-items";
import { parseISO } from "./dates";
import { applies, type Applicability, type Profile } from "./profile";
import type { ISODate } from "./types";

export interface ChecklistEntry extends ChecklistItem {
  applicability: Exclude<Applicability, "no">;
  /** Progress key: `<item id>@<period>`. */
  key: string;
}

/** Period labels used for checklist progress: 2026-11, 2026-Q4, 2026, "once". */
export function checklistPeriod(frequency: ChecklistFrequency, on: ISODate): string {
  const { y, m } = parseISO(on);
  switch (frequency) {
    case "monthly":
      return on.slice(0, 7);
    case "quarterly":
      return `${y}-Q${Math.ceil(m / 3)}`;
    case "annual":
      return String(y);
    case "one_time":
      return "once";
  }
}

/** Items that apply to `profile` for the period containing `on`. */
export function checklistFor(profile: Profile, frequency: ChecklistFrequency, on: ISODate, items: readonly ChecklistItem[] = checklistItems): ChecklistEntry[] {
  const period = checklistPeriod(frequency, on);
  const { m } = parseISO(on);
  const quarter = Math.ceil(m / 3);
  const out: ChecklistEntry[] = [];
  for (const it of items) {
    if (it.frequency !== frequency) continue;
    if (it.months === "non_quarter_end" && m % 3 === 0) continue;
    if (it.months === "quarter_end" && m % 3 !== 0) continue;
    if (it.quarters && !it.quarters.includes(quarter)) continue;
    const a = applies(it.applies_when, profile);
    if (a === "no") continue;
    out.push({ ...it, applicability: a, key: `${it.id}@${period}` });
  }
  return out;
}

export interface ComplianceScore {
  done: number;
  total: number;
  /** 0–100, rounded down; null when nothing applies. */
  percent: number | null;
}

/** Score counts only items that definitely apply ("maybe" items are shown but not scored). */
export function complianceScore(entries: readonly ChecklistEntry[], doneKeys: ReadonlySet<string> | readonly string[]): ComplianceScore {
  const done = new Set(doneKeys);
  const scored = entries.filter((e) => e.applicability === "yes");
  const n = scored.filter((e) => done.has(e.key)).length;
  return { done: n, total: scored.length, percent: scored.length ? Math.floor((n * 100) / scored.length) : null };
}
