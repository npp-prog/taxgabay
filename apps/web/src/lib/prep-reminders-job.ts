import { addDays, type ISODate, type Profile } from "@taxgabay/tax-engine";
import { nextRecordRequests, quarterOf, type RecordRequest } from "./prep-schedule";

/** One prep client as the records-reminder job sees it. */
export interface PrepReminderClient {
  id: string;
  name: string;
  profile: Profile;
  users: { user_id: string; email: string | null }[];
  /** Quarter periods by start date → status. */
  periods: Map<string, string>;
  already_sent: Set<string>;
}

export interface PrepReminderDeps {
  loadClients: () => Promise<PrepReminderClient[]>;
  sendEmail: ((to: string, subject: string, text: string) => Promise<void>) | null;
  logSent: (user_id: string, key: string) => Promise<void>;
}

export interface PrepReminderSummary {
  clients: number;
  sent: number;
  skipped: number;
  errors: string[];
}

/** Days before the records date on which a reminder goes out (0 = on the day). */
export const RECORDS_REMINDER_DAYS = [5, 1, 0];

const quarterStart = (d: ISODate) => `${d.slice(0, 4)}-${String((quarterOf(d) - 1) * 3 + 1).padStart(2, "0")}-01`;

/** Whether the client already marked the records for this request complete (or the firm has them). */
export function recordsDone(req: RecordRequest, periods: Map<string, string>): boolean {
  const st = periods.get(quarterStart(req.period_end));
  return !!st && st !== "records_incomplete";
}

export function reminderKey(clientId: string, req: RecordRequest, daysBefore: number) {
  return `prep:${clientId}:${req.form}:${req.period_end}:${daysBefore}`;
}

export function recordsReminderMessage(clientName: string, req: RecordRequest, firm: string, siteUrl = "") {
  return {
    subject: `Records needed by ${req.records_by}: ${req.form} for ${req.period_label}`,
    text: [
      `Hello ${clientName},`,
      "",
      `${firm} will prepare your ${req.form} for ${req.period_label} (due to the BIR on ${req.due_date}).`,
      `Please enter your sales, expenses and Forms 2307 for the period in TaxGabay by ${req.records_by}, then press "My records are complete".`,
      "",
      `Open TaxGabay: ${siteUrl.replace(/\/$/, "")}/prepare`,
    ].join("\n"),
  };
}

/** Sends today's "records needed" reminders to client users. One failure never stops the others. */
export async function runPrepReminderJob(today: ISODate, deps: PrepReminderDeps, firm = "Neil Priolo, CPA's firm", siteUrl = ""): Promise<PrepReminderSummary> {
  const summary: PrepReminderSummary = { clients: 0, sent: 0, skipped: 0, errors: [] };
  const clients = await deps.loadClients();
  summary.clients = clients.length;
  for (const c of clients) {
    let requests: RecordRequest[];
    try {
      requests = nextRecordRequests(c.profile, today, { limit: 5 });
    } catch (e) {
      summary.errors.push(`${c.id}: ${(e as Error).message}`);
      continue;
    }
    for (const req of requests) {
      const days = RECORDS_REMINDER_DAYS.find((d) => addDays(today, d) === req.records_by);
      if (days === undefined || recordsDone(req, c.periods)) continue;
      const key = reminderKey(c.id, req, days);
      if (c.already_sent.has(key)) continue;
      const msg = recordsReminderMessage(c.name, req, firm, siteUrl);
      for (const u of c.users) {
        if (!deps.sendEmail || !u.email) {
          summary.skipped++;
          continue;
        }
        try {
          await deps.sendEmail(u.email, msg.subject, msg.text);
          await deps.logSent(u.user_id, key);
          summary.sent++;
        } catch (e) {
          summary.errors.push(`${c.id} ${key}: ${(e as Error).message}`);
        }
      }
    }
  }
  return summary;
}
