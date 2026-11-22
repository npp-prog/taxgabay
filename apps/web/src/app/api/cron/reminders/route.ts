import { NextResponse } from "next/server";
import { runPrepReminderJob } from "@/lib/prep-reminders-job";
import { supabasePrepReminderDeps } from "@/lib/prep-reminders-supabase";
import { runReminderJob } from "@/lib/reminders-job";
import { supabaseReminderDeps } from "@/lib/reminders-supabase";
import { todayPH } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** Daily reminder job (deadline reminders, plus records reminders for the firm's clients). Vercel Cron calls this with `Authorization: Bearer $CRON_SECRET`. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const deps = supabaseReminderDeps();
    const summary = await runReminderJob(todayPH(), deps);
    // Clients of the firm: "records needed" reminders before each prepared filing.
    const records = await runPrepReminderJob(todayPH(), supabasePrepReminderDeps(deps.sendEmail), undefined, process.env.NEXT_PUBLIC_SITE_URL ?? "");
    return NextResponse.json({ ...summary, records });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
