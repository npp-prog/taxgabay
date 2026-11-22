import "server-only";
import { createClient } from "@supabase/supabase-js";
import { DEFAULT_PROFILE, type Profile } from "@taxgabay/tax-engine";
import type { PrepReminderClient, PrepReminderDeps } from "./prep-reminders-job";

/** Production dependencies for the records-reminder job (service role; server only). */
export function supabasePrepReminderDeps(sendEmail: PrepReminderDeps["sendEmail"]): PrepReminderDeps {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  const sb = createClient(url, serviceKey, { auth: { persistSession: false } });
  return {
    async loadClients() {
      const [clients, links, periods, log] = await Promise.all([
        sb.from("prep_clients").select("id,name,profile").eq("archived", false),
        sb.from("client_users").select("prep_client_id,user_id"),
        sb.from("periods").select("prep_client_id,kind,start_date,status").eq("kind", "quarter"),
        sb.from("reminder_log").select("user_id,reminder_key").like("reminder_key", "prep:%"),
      ]);
      for (const r of [clients, links, periods, log]) if (r.error) throw r.error;
      const emails = new Map<string, string | null>();
      const out: PrepReminderClient[] = [];
      for (const c of (clients.data ?? []) as { id: string; name: string; profile: Partial<Profile> }[]) {
        const users: PrepReminderClient["users"] = [];
        for (const l of ((links.data ?? []) as { prep_client_id: string; user_id: string }[]).filter((x) => x.prep_client_id === c.id)) {
          if (!emails.has(l.user_id)) emails.set(l.user_id, (await sb.auth.admin.getUserById(l.user_id)).data.user?.email ?? null);
          users.push({ user_id: l.user_id, email: emails.get(l.user_id) ?? null });
        }
        out.push({
          id: c.id,
          name: c.name,
          profile: { ...DEFAULT_PROFILE, taxpayer_type: "self_employed", vat_status: "non_vat", ...c.profile },
          users,
          periods: new Map(((periods.data ?? []) as { prep_client_id: string; start_date: string; status: string }[]).filter((p) => p.prep_client_id === c.id).map((p) => [p.start_date, p.status])),
          already_sent: new Set(((log.data ?? []) as { reminder_key: string }[]).map((l) => l.reminder_key).filter((k) => k.startsWith(`prep:${c.id}:`))),
        });
      }
      return out;
    },
    sendEmail,
    async logSent(user_id, key) {
      await sb.from("reminder_log").upsert({ user_id, reminder_key: key, channel: "email" });
    },
  };
}
