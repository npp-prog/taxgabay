import type { ISODate } from "./types";

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseISO(d: ISODate): { y: number; m: number; day: number } {
  const m = ISO_RE.exec(d);
  if (!m) throw new Error(`Invalid ISO date: ${d}`);
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const day = Number(m[3]);
  if (mo < 1 || mo > 12 || day < 1 || day > daysInMonth(y, mo)) {
    throw new Error(`Invalid ISO date: ${d}`);
  }
  return { y, m: mo, day };
}

export function toISO(y: number, m: number, day: number): ISODate {
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function toUTC(d: ISODate): number {
  const { y, m, day } = parseISO(d);
  return Date.UTC(y, m - 1, day);
}

function fromUTC(ms: number): ISODate {
  const dt = new Date(ms);
  return toISO(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export function addDays(d: ISODate, n: number): ISODate {
  return fromUTC(toUTC(d) + n * 86_400_000);
}

/** Whole days from `a` to `b` (b − a). */
export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((toUTC(b) - toUTC(a)) / 86_400_000);
}

/** Month arithmetic; day is clamped to the target month's length. */
export function addMonths(d: ISODate, n: number): ISODate {
  const { y, m, day } = parseISO(d);
  const idx = y * 12 + (m - 1) + n;
  const ny = Math.floor(idx / 12);
  const nm = (idx % 12) + 1;
  return toISO(ny, nm, Math.min(day, daysInMonth(ny, nm)));
}

export function endOfMonth(y: number, m: number): ISODate {
  return toISO(y, m, daysInMonth(y, m));
}

/** 0 = Sunday … 6 = Saturday. */
export function weekday(d: ISODate): number {
  return new Date(toUTC(d)).getUTCDay();
}

export function isWeekend(d: ISODate): boolean {
  const w = weekday(d);
  return w === 0 || w === 6;
}

/** ISO strings compare correctly as strings. */
export function compareISO(a: ISODate, b: ISODate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function minISO(a: ISODate, b: ISODate): ISODate {
  return a <= b ? a : b;
}

export function maxISO(a: ISODate, b: ISODate): ISODate {
  return a >= b ? a : b;
}

export function isLeapYear(y: number): boolean {
  return daysInMonth(y, 2) === 29;
}
