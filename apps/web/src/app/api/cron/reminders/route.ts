import { NextResponse } from "next/server";
import { runReminderJob } from "@/lib/reminders-job";
import { supabaseReminderDeps } from "@/lib/reminders-supabase";
import { todayPH } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** Daily reminder job. Vercel Cron calls this with `Authorization: Bearer $CRON_SECRET`. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const summary = await runReminderJob(todayPH(), supabaseReminderDeps());
    return NextResponse.json(summary);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
