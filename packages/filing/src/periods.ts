import { endOfMonth, toISO, type ISODate } from "@taxgabay/tax-engine";
import type { QuarterRef } from "./types";

export interface Range {
  start: ISODate;
  end: ISODate;
}

export function quarterRange({ year, quarter }: QuarterRef): Range {
  const m = (quarter - 1) * 3 + 1;
  return { start: toISO(year, m, 1), end: endOfMonth(year, m + 2) };
}

export function quarterMonths({ year, quarter }: QuarterRef): Range[] {
  const m = (quarter - 1) * 3 + 1;
  return [0, 1, 2].map((i) => ({ start: toISO(year, m + i, 1), end: endOfMonth(year, m + i) }));
}

export const yearRange = (year: number): Range => ({ start: toISO(year, 1, 1), end: toISO(year, 12, 31) });

export const inRange = (d: ISODate, r: Range) => r.start <= d && d <= r.end;

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const monthLabel = (r: Range) => `${MONTHS[Number(r.start.slice(5, 7)) - 1]} ${r.start.slice(0, 4)}`;
export const quarterLabel = (q: QuarterRef) => `Q${q.quarter} ${q.year}`;
