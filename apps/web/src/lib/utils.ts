import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Today in the Philippines (UTC+8) as YYYY-MM-DD. */
export function todayPH(now: Date = new Date()): string {
  return new Date(now.getTime() + 8 * 3600_000).toISOString().slice(0, 10);
}

export function formatDatePH(iso: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-PH", { ...opts, timeZone: "UTC" });
}
