import { addDays, deadlineExtensions, deadlineRules, generateObligations, holidays, type DeadlineExtension, type DeadlineRule, type Holiday, type ISODate, type Profile } from "@taxgabay/tax-engine";

/** Forms the first preparation batch covers. */
export const PREPARED_FORMS = new Set(["2551Q", "0619E", "1601EQ", "1701Q", "1701A"]);

/**
 * How many days before a filing deadline the firm asks for complete records. This is the firm's
 * own working rule (not a BIR rule); change it here.
 */
export const RECORDS_LEAD_DAYS = 10;

export interface RecordRequest {
  form: string;
  period_label: string;
  period_start: ISODate;
  period_end: ISODate;
  due_date: ISODate;
  /** Date the firm needs the records for this period. */
  records_by: ISODate;
}

/**
 * The next filings the firm will prepare for a client, with the date their records are needed.
 * Monthly 0619E returns fall due before the quarter ends, so withholding agents get monthly requests.
 */
export function nextRecordRequests(
  profile: Profile,
  today: ISODate,
  opts: { limit?: number; rules?: readonly DeadlineRule[]; holidayList?: readonly Holiday[]; extensions?: readonly DeadlineExtension[] } = {},
): RecordRequest[] {
  const obligations = generateObligations(profile, {
    from: today,
    to: addDays(today, 200),
    rules: opts.rules ?? deadlineRules,
    holidays: opts.holidayList ?? holidays,
    extensions: opts.extensions ?? deadlineExtensions,
  });
  return obligations
    .filter((o) => PREPARED_FORMS.has(o.form_code) && o.due_date >= today)
    .sort((a, b) => a.due_date.localeCompare(b.due_date) || a.form_code.localeCompare(b.form_code))
    .slice(0, opts.limit ?? 3)
    .map((o) => ({ form: o.form_code, period_label: o.period_label, period_start: o.period_start, period_end: o.period_end, due_date: o.due_date, records_by: addDays(o.due_date, -RECORDS_LEAD_DAYS) }));
}

/** Quarter (1–4) containing a date. */
export const quarterOf = (d: ISODate) => (Math.floor((Number(d.slice(5, 7)) - 1) / 3) + 1) as 1 | 2 | 3 | 4;
