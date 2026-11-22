"use client";

import { DEFAULT_PROFILE, addDays, addMonths, deadlineExtensions, deadlineRules, generateObligations, holidays, parseISO } from "@taxgabay/tax-engine";
import * as React from "react";
import { todayPH } from "@/lib/utils";

const noop = () => () => {};
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * The next real deadlines for an example sole proprietor (non-VAT, graduated rates, one
 * employee), computed by the tax engine in the browser. Shows what the calendar does
 * before the visitor answers anything.
 */
export function SampleSchedule() {
  const today = React.useSyncExternalStore(noop, () => todayPH(), () => null);
  const rows = React.useMemo(() => {
    if (!today) return null;
    const profile = { ...DEFAULT_PROFILE, income_tax_option: "graduated_osd" as const, has_employees: true };
    return generateObligations(profile, { from: today, to: addDays(addMonths(today, 4), 0), rules: deadlineRules, holidays, extensions: deadlineExtensions }).slice(0, 5);
  }, [today]);

  return (
    <div className="overflow-hidden rounded-[16px] border border-border bg-card">
      <div className="flex items-baseline justify-between gap-3 border-b border-border px-5 py-3">
        <span className="form-label">Example: a sole proprietor</span>
        <span className="form-label text-primary">Next deadlines</span>
      </div>
      <ol className="divide-y divide-border">
        {(rows ?? Array.from({ length: 5 }, () => null)).map((o, i) => {
          if (!o) {
            return (
              <li key={i} className="flex items-center gap-4 px-5 py-3">
                <span className="h-12 w-12 rounded-sm bg-muted" />
                <span className="h-4 flex-1 rounded-sm bg-muted" />
              </li>
            );
          }
          const d = parseISO(o.due_date);
          return (
            <li key={o.id} className="flex items-center gap-4 px-5 py-3">
              <span className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-md border ${i === 0 ? "border-sun bg-sun-soft" : "border-border bg-card"}`}>
                <span className="text-[0.62rem] font-semibold uppercase tracking-wider text-muted-foreground">{MONTHS[d.m - 1]}</span>
                <span className="text-lg font-semibold leading-none">{d.day}</span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="code text-sm">{o.form_code}</span>
                <span className="ml-2 font-mono text-[0.7rem] text-muted-foreground">{o.period_label}</span>
                <span className="block truncate text-sm text-muted-foreground">{o.title}</span>
              </span>
            </li>
          );
        })}
      </ol>
      <div className="border-t border-border bg-muted/60 px-5 py-2.5 text-xs text-muted-foreground">Non-VAT, graduated rates, one employee. Weekend and holiday deadlines are already moved to the next working day.</div>
    </div>
  );
}
