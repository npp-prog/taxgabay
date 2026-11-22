import { deadlineExtensions, holidays as bundledHolidays, type DeadlineExtension, type Holiday } from "@taxgabay/tax-engine";

/** Bundled holidays/extensions merged with admin-entered rows (database rows win on the same date). */
export function mergeCalendarData(dbHolidays: Holiday[], dbExtensions: DeadlineExtension[]) {
  const byDate = new Map(bundledHolidays.map((h) => [h.date, h]));
  for (const h of dbHolidays) byDate.set(h.date, h);
  const ext = new Map(deadlineExtensions.map((e) => [`${e.form_code}|${e.original_date}`, e]));
  for (const e of dbExtensions) ext.set(`${e.form_code}|${e.original_date}`, e);
  return { holidays: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)), extensions: [...ext.values()] };
}
