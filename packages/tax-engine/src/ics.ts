import { addDays } from "./dates";
import type { Obligation } from "./deadlines/generator";

function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

/** Fold lines longer than 75 octets (RFC 5545 §3.1). */
function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 74) {
    out.push(rest.slice(0, 74));
    rest = " " + rest.slice(74);
  }
  out.push(rest);
  return out.join("\r\n");
}

/** All-day iCalendar events for each obligation. `stamp` is a UTC timestamp like 20260101T000000Z. */
export function obligationsToICS(obligations: readonly Obligation[], stamp: string): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//TaxGabay//Tax Calendar//EN",
    "CALSCALE:GREGORIAN",
    "X-WR-CALNAME:TaxGabay deadlines",
  ];
  for (const o of obligations) {
    const start = o.due_date.replace(/-/g, "");
    const end = addDays(o.due_date, 1).replace(/-/g, "");
    lines.push(
      "BEGIN:VEVENT",
      `UID:${o.id}@taxgabay`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${start}`,
      `DTEND;VALUE=DATE:${end}`,
      fold(`SUMMARY:${esc(`BIR ${o.form_code} due (${o.period_label})`)}`),
      fold(`DESCRIPTION:${esc(`${o.title}. Basis: ${o.legal_basis}. For guidance only; verify with BIR issuances or consult a CPA.`)}`),
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}
