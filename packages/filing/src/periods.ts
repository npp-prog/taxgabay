import { addDays, addMonths, endOfMonth, toISO, type ISODate } from "@taxgabay/tax-engine";
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

/**
 * Fiscal years are named by the year they end in (FY2027 ending June 2027 starts July 2026).
 * `fyEnd` is the month the fiscal year ends (12 = calendar year).
 */
export function fiscalYearRange(fyEnd: number, year: number): Range {
  const end = endOfMonth(year, fyEnd);
  return { start: addDays(endOfMonth(year - 1, fyEnd), 1), end };
}

export function fiscalQuarterRange(fyEnd: number, q: QuarterRef): Range {
  if (fyEnd === 12) return quarterRange(q);
  const start = addMonths(fiscalYearRange(fyEnd, q.year).start, (q.quarter - 1) * 3);
  const endMonth = addMonths(start, 2);
  return { start, end: endOfMonth(Number(endMonth.slice(0, 4)), Number(endMonth.slice(5, 7))) };
}

/** The calendar months inside a range of whole months. */
export function monthsOfRange(r: Range): Range[] {
  const out: Range[] = [];
  for (let d = r.start; d <= r.end; d = addMonths(d, 1)) out.push({ start: d, end: endOfMonth(Number(d.slice(0, 4)), Number(d.slice(5, 7))) });
  return out;
}

const SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function fiscalQuarterLabel(fyEnd: number, q: QuarterRef): string {
  if (fyEnd === 12) return quarterLabel(q);
  const r = fiscalQuarterRange(fyEnd, q);
  return `Q${q.quarter} FY${q.year} (${SHORT[Number(r.start.slice(5, 7)) - 1]}–${SHORT[Number(r.end.slice(5, 7)) - 1]} ${r.end.slice(0, 4)})`;
}
