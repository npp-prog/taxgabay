import {
  deadlineExtensions,
  deadlineRules,
  holidays,
  planReminders,
  reminderMessage,
  type DeadlineExtension,
  type Holiday,
  type PlannedReminder,
  type Profile,
  type ReminderSettings,
} from "@taxgabay/tax-engine";

/** Everything the job needs about one opted-in user. */
export interface ReminderUser {
  user_id: string;
  email: string | null;
  profile: Profile;
  settings: ReminderSettings;
  completed: Set<string>;
  already_sent: Set<string>;
  push_subscriptions: { id: string; endpoint: string; p256dh: string; auth: string }[];
}

export interface ReminderDeps {
  loadUsers: () => Promise<ReminderUser[]>;
  /** null = channel not configured (dry run for that channel). */
  sendEmail: ((to: string, subject: string, text: string) => Promise<void>) | null;
  /** Returns "gone" when the subscription is expired and should be removed. */
  sendPush: ((sub: ReminderUser["push_subscriptions"][number], payload: string) => Promise<"ok" | "gone">) | null;
  removeSubscription: (id: string) => Promise<void>;
  logSent: (user_id: string, key: string, channel: "email" | "push") => Promise<void>;
  /** Admin-entered holidays and BIR extensions merged with the bundled ones. */
  loadCalendar?: () => Promise<{ holidays: Holiday[]; extensions: DeadlineExtension[] }>;
}

export interface ReminderJobSummary {
  today: string;
  users: number;
  planned: number;
  sent: { email: number; push: number };
  skipped: { email: number; push: number };
  errors: string[];
}

/** Plans and sends today's reminders. Failures for one user or channel never stop the others. */
export async function runReminderJob(today: string, deps: ReminderDeps): Promise<ReminderJobSummary> {
  const summary: ReminderJobSummary = { today, users: 0, planned: 0, sent: { email: 0, push: 0 }, skipped: { email: 0, push: 0 }, errors: [] };
  const users = await deps.loadUsers();
  const calendar = deps.loadCalendar ? await deps.loadCalendar() : { holidays, extensions: deadlineExtensions };
  summary.users = users.length;
  for (const u of users) {
    let planned: PlannedReminder[];
    try {
      planned = planReminders({
        profile: u.profile,
        settings: u.settings,
        completed: u.completed,
        already_sent: u.already_sent,
        today,
        rules: deadlineRules,
        holidays: calendar.holidays,
        extensions: calendar.extensions,
      });
    } catch (e) {
      summary.errors.push(`${u.user_id}: ${(e as Error).message}`);
      continue;
    }
    summary.planned += planned.length;
    for (const r of planned) {
      const msg = reminderMessage(r);
      if (r.channels.includes("email")) {
        if (!deps.sendEmail || !u.email) {
          summary.skipped.email++;
        } else {
          try {
            await deps.sendEmail(u.email, msg.subject, msg.text);
            await deps.logSent(u.user_id, r.key, "email");
            summary.sent.email++;
          } catch (e) {
            summary.errors.push(`${u.user_id} email ${r.key}: ${(e as Error).message}`);
          }
        }
      }
      if (r.channels.includes("push")) {
        if (!deps.sendPush || u.push_subscriptions.length === 0) {
          summary.skipped.push++;
        } else {
          const payload = JSON.stringify({ title: msg.subject, body: msg.text.split("\n")[0], url: "/calendar" });
          let delivered = false;
          for (const sub of u.push_subscriptions) {
            try {
              const res = await deps.sendPush(sub, payload);
              if (res === "gone") await deps.removeSubscription(sub.id);
              else delivered = true;
            } catch (e) {
              summary.errors.push(`${u.user_id} push ${r.key}: ${(e as Error).message}`);
            }
          }
          if (delivered) {
            await deps.logSent(u.user_id, r.key, "push");
            summary.sent.push++;
          }
        }
      }
    }
  }
  return summary;
}
