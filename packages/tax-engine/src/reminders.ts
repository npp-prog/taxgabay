import type { DeadlineRule } from "./data/deadline-rules";
import type { DeadlineExtension, Holiday } from "./data/holidays";
import { addDays, daysBetween } from "./dates";
import { generateObligations, type Obligation } from "./deadlines/generator";
import type { Profile } from "./profile";
import type { ISODate } from "./types";

export interface ReminderSettings {
  days_before: number[];
  email_enabled: boolean;
  push_enabled: boolean;
}

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = { days_before: [7, 3, 1], email_enabled: true, push_enabled: false };

export interface PlannedReminder {
  /** Idempotency key: `<obligation id>:<days before>`. */
  key: string;
  obligation: Obligation;
  days_before: number;
  channels: ("email" | "push")[];
}

export interface PlanRemindersInput {
  profile: Profile;
  settings: ReminderSettings;
  /** Obligation ids the user marked as filed and paid. */
  completed: ReadonlySet<string>;
  /** Keys already sent (from the reminder log). */
  already_sent: ReadonlySet<string>;
  today: ISODate;
  rules: readonly DeadlineRule[];
  holidays: readonly Holiday[];
  extensions?: readonly DeadlineExtension[];
}

/**
 * Reminders to send today: pending obligations due exactly N days from today for each
 * configured N. Tentative obligations are included (the message says so).
 */
export function planReminders(input: PlanRemindersInput): PlannedReminder[] {
  const channels: PlannedReminder["channels"] = [];
  if (input.settings.email_enabled) channels.push("email");
  if (input.settings.push_enabled) channels.push("push");
  const days = [...new Set(input.settings.days_before.filter((d) => Number.isInteger(d) && d >= 0 && d <= 60))];
  if (channels.length === 0 || days.length === 0) return [];
  const horizon = addDays(input.today, Math.max(...days));
  const obligations = generateObligations(input.profile, {
    from: input.today,
    to: horizon,
    rules: input.rules,
    holidays: input.holidays,
    extensions: input.extensions,
  });
  const out: PlannedReminder[] = [];
  for (const o of obligations) {
    if (input.completed.has(o.id)) continue;
    const d = daysBetween(input.today, o.due_date);
    if (!days.includes(d)) continue;
    const key = `${o.id}:${d}`;
    if (input.already_sent.has(key)) continue;
    out.push({ key, obligation: o, days_before: d, channels });
  }
  return out;
}

export function reminderMessage(r: Pick<PlannedReminder, "obligation" | "days_before">): { subject: string; text: string } {
  const o = r.obligation;
  const when = r.days_before === 0 ? "today" : r.days_before === 1 ? "tomorrow" : `in ${r.days_before} days`;
  const subject = `BIR ${o.form_code} is due ${when} (${o.due_date})`;
  const lines = [
    `${o.title} for ${o.period_label} is due ${when}, on ${o.due_date}.`,
    ...o.adjustments,
    o.tentative ? "This depends on a profile answer you weren't sure about — check your profile." : "",
    "Mark it as filed and paid in your TaxGabay calendar to stop reminders.",
    "For guidance only. Verify with BIR issuances or consult a CPA.",
  ].filter(Boolean);
  return { subject, text: lines.join("\n") };
}
