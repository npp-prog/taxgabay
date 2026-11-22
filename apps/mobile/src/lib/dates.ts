/** Today in the Philippines (UTC+8) as YYYY-MM-DD. */
export function todayPH(now: Date = new Date()): string {
  return new Date(now.getTime() + 8 * 3600_000).toISOString().slice(0, 10);
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "Fri 15 May 2026" — computed from the ISO string, no time zones involved. */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  const wd = DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${wd} ${d} ${MONTHS[m - 1]!.slice(0, 3)} ${y}`;
}

/** "May 2026" from "2026-05". */
export function formatMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number) as [number, number];
  return `${MONTHS[m - 1]} ${y}`;
}
