"use client";

import { DEFAULT_REMINDER_SETTINGS, type ReminderSettings } from "@taxgabay/tax-engine";
import Link from "next/link";
import * as React from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSupabase, supabaseEnabled } from "@/lib/supabase";
import { useUserData } from "@/lib/user-data";

const DAY_OPTIONS = [14, 7, 3, 1, 0];
const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function base64ToUint8(b64: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function subscribePush(userId: string): Promise<void> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) throw new Error("This browser does not support push notifications.");
  if (!VAPID_PUBLIC) throw new Error("Push notifications are not configured on this site yet.");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notifications were not allowed in your browser settings.");
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ToUint8(VAPID_PUBLIC) });
  const json = sub.toJSON();
  const { error } = await getSupabase()!
    .from("push_subscriptions")
    .upsert({ user_id: userId, endpoint: sub.endpoint, p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" }, { onConflict: "endpoint" });
  if (error) throw error;
}

function label(d: number) {
  return d === 0 ? "On the due date" : d === 1 ? "1 day before" : `${d} days before`;
}

export function ReminderSettingsCard() {
  const { session, data } = useUserData();
  const [settings, setSettings] = React.useState<ReminderSettings | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);
  const userId = session?.user.id;

  React.useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    getSupabase()!
      .from("reminder_settings")
      .select("days_before,email_enabled,push_enabled")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data: row }) => {
        if (!cancelled) setSettings((row as ReminderSettings | null) ?? { ...DEFAULT_REMINDER_SETTINGS, email_enabled: false });
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (!supabaseEnabled) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Reminders</CardTitle>
          <CardDescription>Email and push reminders need an account, which is not enabled on this deployment yet. You can export your deadlines to your phone&apos;s calendar from the Calendar page.</CardDescription>
        </CardHeader>
      </Card>
    );
  }
  if (!session) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Reminders</CardTitle>
          <CardDescription>Sign in to get email or push reminders 7, 3 and 1 day before each deadline.</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/login" className={buttonVariants({ variant: "outline" })}>
            Sign in
          </Link>
        </CardContent>
      </Card>
    );
  }
  if (!settings) return null;

  const toggleDay = (d: number) =>
    setSettings((s) => s && { ...s, days_before: s.days_before.includes(d) ? s.days_before.filter((x) => x !== d) : [...s.days_before, d].sort((a, b) => b - a) });

  async function save() {
    setStatus(null);
    try {
      if (settings!.push_enabled) await subscribePush(userId!);
      const { error } = await getSupabase()!.from("reminder_settings").upsert({ user_id: userId, ...settings });
      if (error) throw error;
      setStatus("Reminder settings saved.");
    } catch (e) {
      setStatus((e as Error).message);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reminders</CardTitle>
        <CardDescription>
          We remind you about deadlines in your calendar that you have not marked as filed and paid.
          {!data.profile && " Create your profile first so we know your deadlines."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">How</legend>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={settings.email_enabled} onChange={(e) => setSettings({ ...settings, email_enabled: e.target.checked })} className="h-4 w-4 accent-[var(--color-primary)]" />
            Email to {session.user.email}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={settings.push_enabled} onChange={(e) => setSettings({ ...settings, push_enabled: e.target.checked })} className="h-4 w-4 accent-[var(--color-primary)]" />
            Push notifications on this device
          </label>
        </fieldset>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">When</legend>
          <div className="flex flex-wrap gap-3">
            {DAY_OPTIONS.map((d) => (
              <label key={d} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={settings.days_before.includes(d)} onChange={() => toggleDay(d)} className="h-4 w-4 accent-[var(--color-primary)]" />
                {label(d)}
              </label>
            ))}
          </div>
        </fieldset>
        <Button onClick={save}>Save reminder settings</Button>
        {status && (
          <p role="status" className="text-sm">
            {status}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
