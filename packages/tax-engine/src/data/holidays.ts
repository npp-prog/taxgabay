import type { ISODate } from "../types";

export type HolidayType = "regular" | "special_non_working";

export interface Holiday {
  date: ISODate;
  name: string;
  type: HolidayType;
  year: number;
  legal_basis: string;
  needs_verification: boolean;
  note?: string;
}

export interface DeadlineExtension {
  form_code: string;
  original_date: ISODate;
  new_date: ISODate;
  issuance_ref: string;
}

const RA9492 = "RA 9492 / annual Presidential proclamation (number to confirm)";
const PROC = "Annual Presidential proclamation (number to confirm)";

function h(date: ISODate, name: string, type: HolidayType, legal_basis: string, note?: string): Holiday {
  return { date, name, type, year: Number(date.slice(0, 4)), legal_basis, needs_verification: true, ...(note ? { note } : {}) };
}

/**
 * Philippine holidays used for deadline roll-over. Fixed-date regular holidays are high confidence;
 * movable feasts, Eid holidays and special days depend on the year's proclamation.
 */
export const holidays: Holiday[] = [
  // 2026
  h("2026-01-01", "New Year's Day", "regular", RA9492),
  h("2026-02-17", "Chinese New Year", "special_non_working", PROC),
  h("2026-04-02", "Maundy Thursday", "regular", RA9492),
  h("2026-04-03", "Good Friday", "regular", RA9492),
  h("2026-04-04", "Black Saturday", "special_non_working", PROC),
  h("2026-04-09", "Araw ng Kagitingan", "regular", RA9492),
  h("2026-05-01", "Labor Day", "regular", RA9492),
  h("2026-06-12", "Independence Day", "regular", RA9492),
  h("2026-08-21", "Ninoy Aquino Day", "special_non_working", PROC),
  h("2026-08-31", "National Heroes Day", "regular", RA9492),
  h("2026-11-01", "All Saints' Day", "special_non_working", PROC),
  h("2026-11-02", "All Souls' Day", "special_non_working", PROC, "LOW CONFIDENCE: included in recent years; confirm for 2026."),
  h("2026-11-30", "Bonifacio Day", "regular", RA9492),
  h("2026-12-08", "Feast of the Immaculate Conception", "special_non_working", "RA 10966"),
  h("2026-12-24", "Christmas Eve", "special_non_working", PROC),
  h("2026-12-25", "Christmas Day", "regular", RA9492),
  h("2026-12-30", "Rizal Day", "regular", RA9492),
  h("2026-12-31", "Last Day of the Year", "special_non_working", PROC),
  // 2027
  h("2027-01-01", "New Year's Day", "regular", RA9492),
  h("2027-02-06", "Chinese New Year", "special_non_working", PROC),
  h("2027-03-25", "Maundy Thursday", "regular", RA9492),
  h("2027-03-26", "Good Friday", "regular", RA9492),
  h("2027-03-27", "Black Saturday", "special_non_working", PROC),
  h("2027-04-09", "Araw ng Kagitingan", "regular", RA9492),
  h("2027-05-01", "Labor Day", "regular", RA9492),
  h("2027-06-12", "Independence Day", "regular", RA9492),
  h("2027-08-21", "Ninoy Aquino Day", "special_non_working", PROC),
  h("2027-08-30", "National Heroes Day", "regular", RA9492),
  h("2027-11-01", "All Saints' Day", "special_non_working", PROC),
  h("2027-11-02", "All Souls' Day", "special_non_working", PROC, "LOW CONFIDENCE: confirm for 2027."),
  h("2027-11-30", "Bonifacio Day", "regular", RA9492),
  h("2027-12-08", "Feast of the Immaculate Conception", "special_non_working", "RA 10966"),
  h("2027-12-24", "Christmas Eve", "special_non_working", PROC),
  h("2027-12-25", "Christmas Day", "regular", RA9492),
  h("2027-12-30", "Rizal Day", "regular", RA9492),
  h("2027-12-31", "Last Day of the Year", "special_non_working", PROC),
];

/**
 * Not seeded as dates: Eid'l Fitr and Eid'l Adha (regular holidays under RA 9177 and RA 9849)
 * are fixed each year by proclamation based on the Islamic calendar. The admin must add them.
 */
export const HOLIDAYS_NOT_SEEDED = ["Eid'l Fitr (RA 9177)", "Eid'l Adha (RA 9849)", "EDSA People Power anniversary (status varies by year)"];

/** BIR-announced deadline extensions. None seeded; added by admin per issuance. */
export const deadlineExtensions: DeadlineExtension[] = [];
