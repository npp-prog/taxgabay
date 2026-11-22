import "server-only";
import { createClient } from "@supabase/supabase-js";
import { DEFAULT_PROFILE, normalizeProfile, type DeadlineExtension, type Holiday, type Profile } from "@taxgabay/tax-engine";
import { mergeCalendarData } from "./calendar-merge";
import { sendNotification, setVapidDetails } from "web-push";
import { reminderLogKey } from "./clients-core";
import type { ReminderDeps, ReminderUser } from "./reminders-job";

/** Production dependencies for the reminder job (service role; server only). */
export function supabaseReminderDeps(): ReminderDeps {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  const sb = createClient(url, serviceKey, { auth: { persistSession: false } });

  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.REMINDER_FROM_EMAIL;
  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT;
  const pushReady = Boolean(vapidPublic && vapidPrivate && vapidSubject);
  if (pushReady) setVapidDetails(vapidSubject!, vapidPublic!, vapidPrivate!);

  return {
    async loadUsers() {
      const { data: settings, error } = await sb.from("reminder_settings").select("*").or("email_enabled.eq.true,push_enabled.eq.true");
      if (error) throw error;
      const users: ReminderUser[] = [];
      for (const s of settings ?? []) {
        const uid = s.user_id as string;
        const [profiles, clients, obligations, log, subs, auth] = await Promise.all([
          sb.from("profiles").select("*").eq("user_id", uid),
          sb.from("clients").select("id,name").eq("user_id", uid),
          sb.from("user_obligations").select("obligation_id,client_id").eq("user_id", uid).neq("status", "pending"),
          sb.from("reminder_log").select("reminder_key").eq("user_id", uid),
          sb.from("push_subscriptions").select("id,endpoint,p256dh,auth").eq("user_id", uid),
          sb.auth.admin.getUserById(uid),
        ]);
        const rows = (profiles.data ?? []) as Record<string, unknown>[];
        const names = new Map(((clients.data ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]));
        const sentKeys = (log.data ?? []).map((l) => l.reminder_key as string);
        const multi = rows.length > 1;
        for (const p of rows) {
          const clientId = (p.client_id as string | null) ?? null;
          const prof: Profile = normalizeProfile({
            ...DEFAULT_PROFILE,
            ...Object.fromEntries(Object.keys(DEFAULT_PROFILE).map((k) => [k, p[k] ?? DEFAULT_PROFILE[k as keyof Profile]])),
          } as Profile);
          // Log keys carry the client id (none for the default client); strip it back off here.
          const prefix = reminderLogKey(clientId, "");
          const sent = sentKeys
            .filter((k) => (clientId ? k.startsWith(prefix) : !/^[0-9a-f]{8}-[0-9a-f]{4}-/.test(k)))
            .map((k) => k.slice(prefix.length));
          users.push({
            user_id: uid,
            client_id: clientId,
            client_name: multi ? (clientId ? names.get(clientId) ?? "Client" : "Me") : null,
            email: auth.data.user?.email ?? null,
            profile: prof,
            settings: { days_before: s.days_before as number[], email_enabled: s.email_enabled as boolean, push_enabled: s.push_enabled as boolean },
            completed: new Set(
              ((obligations.data ?? []) as { obligation_id: string; client_id: string | null }[])
                .filter((o) => (o.client_id ?? null) === clientId)
                .map((o) => o.obligation_id),
            ),
            // A key counts as sent if any channel logged it; per-channel resend is not attempted.
            already_sent: new Set(sent),
            push_subscriptions: (subs.data ?? []) as ReminderUser["push_subscriptions"],
          });
        }
      }
      return users;
    },
    sendEmail:
      resendKey && from
        ? async (to, subject, text) => {
            const res = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({ from, to, subject, text }),
            });
            if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
          }
        : null,
    sendPush: pushReady
      ? async (sub, payload) => {
          try {
            await sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload);
            return "ok";
          } catch (e) {
            const status = (e as { statusCode?: number }).statusCode;
            if (status === 404 || status === 410) return "gone";
            throw e;
          }
        }
      : null,
    async loadCalendar() {
      const [h, e] = await Promise.all([
        sb.from("holidays").select("date,name,type,year,legal_basis,needs_verification"),
        sb.from("deadline_extensions").select("form_code,original_date,new_date,issuance_ref"),
      ]);
      if (h.error) throw h.error;
      if (e.error) throw e.error;
      return mergeCalendarData((h.data ?? []) as Holiday[], (e.data ?? []) as DeadlineExtension[]);
    },
    async removeSubscription(id) {
      await sb.from("push_subscriptions").delete().eq("id", id);
    },
    async logSent(user_id, key, channel) {
      await sb.from("reminder_log").upsert({ user_id, reminder_key: key, channel });
    },
  };
}
