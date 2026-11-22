"use client";

import {
  addDays,
  addMonths,
  daysInMonth,
  deadlineRules,
  generateObligations,
  obligationsToICS,
  parseISO,
  toISO,
  weekday,
  type Holiday,
  type Obligation,
} from "@taxgabay/tax-engine";
import Link from "next/link";
import * as React from "react";
import { ClientSwitcher } from "@/components/client-switcher";
import { PageHeader } from "@/components/page-header";
import { PdfButton } from "@/components/pdf-button";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label, Select } from "@/components/ui/input";
import { useCalendarData } from "@/lib/calendar-data";
import { useUserData, type ObligationStatus } from "@/lib/user-data";
import { cn, formatDatePH, todayPH } from "@/lib/utils";

type View = "upcoming" | "month" | "form";

/** An obligation tagged with the client it belongs to. */
type Row = Obligation & { clientId: string; clientName: string; key: string };

function ObligationRow({
  o,
  status,
  onToggle,
  today,
  showClient,
}: {
  o: Row;
  status: ObligationStatus;
  onToggle: () => void;
  today: string;
  showClient: boolean;
}) {
  const done = status === "filed_and_paid";
  const overdue = !done && o.due_date < today;
  return (
    <li className="flex items-start gap-3 py-3" data-testid="obligation">
      <input
        type="checkbox"
        checked={done}
        onChange={onToggle}
        aria-label={`Mark BIR ${o.form_code} for ${o.period_label}${showClient ? ` (${o.clientName})` : ""} as filed and paid`}
        className="mt-1 h-4 w-4 accent-[var(--color-primary)]"
      />
      <div className="min-w-0 flex-1">
        <div className={cn("flex flex-wrap items-center gap-2", done && "text-muted-foreground line-through")}>
          {showClient && (
            <Badge variant="outline" data-testid="obligation-client">
              {o.clientName}
            </Badge>
          )}
          <span className="font-mono font-semibold">{o.form_code}</span>
          <span className="text-sm">{o.period_label}</span>
          {o.tentative && <Badge variant="warning">Depends on your answers</Badge>}
          {overdue && <Badge variant="warning">Overdue</Badge>}
          {done && <Badge variant="success">Filed & paid</Badge>}
        </div>
        <div className="text-sm text-muted-foreground">{o.title}</div>
        {o.adjustments.map((a) => (
          <div key={a} className="text-xs text-muted-foreground">
            {a}
          </div>
        ))}
      </div>
      <time dateTime={o.due_date} className="shrink-0 text-right text-sm font-medium">
        {formatDatePH(o.due_date, { day: "numeric", month: "short", year: "numeric", weekday: "short" })}
      </time>
    </li>
  );
}

function MonthGrid({ month, obligations, holidays, showClient }: { month: string; obligations: Row[]; holidays: readonly Holiday[]; showClient: boolean }) {
  const { y, m } = parseISO(`${month}-01`);
  const first = toISO(y, m, 1);
  const lead = weekday(first);
  const n = daysInMonth(y, m);
  const cells: (string | null)[] = [...Array<null>(lead).fill(null), ...Array.from({ length: n }, (_, i) => toISO(y, m, i + 1))];
  while (cells.length % 7) cells.push(null);
  const byDate = new Map<string, Row[]>();
  for (const o of obligations) byDate.set(o.due_date, [...(byDate.get(o.due_date) ?? []), o]);
  const holidayByDate = new Map(holidays.map((h) => [h.date, h.name]));
  return (
    <div className="overflow-x-auto">
      <table className="w-full table-fixed border-collapse text-xs sm:text-sm" aria-label={formatDatePH(first, { month: "long", year: "numeric" })}>
        <thead>
          <tr>
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <th key={d} scope="col" className="py-1 font-medium text-muted-foreground">
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: cells.length / 7 }, (_, r) => (
            <tr key={r}>
              {cells.slice(r * 7, r * 7 + 7).map((d, c) => (
                <td key={c} className={cn("h-20 border border-border p-1 align-top", !d && "bg-muted/40")}>
                  {d && (
                    <>
                      <div className="text-muted-foreground">{Number(d.slice(8))}</div>
                      {holidayByDate.has(d) && <div className="truncate text-[10px] text-warning-foreground" title={holidayByDate.get(d)}>{holidayByDate.get(d)}</div>}
                      {(byDate.get(d) ?? []).map((o) => (
                        <div key={o.key} className="mt-0.5 truncate rounded bg-secondary px-1 font-mono text-[11px] text-secondary-foreground" title={`${showClient ? `${o.clientName}: ` : ""}${o.form_code} — ${o.title}`}>
                          {o.form_code}
                        </div>
                      ))}
                    </>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CalendarView() {
  const { data, ready, setObligation, clients, activeClientId } = useUserData();
  const [view, setView] = React.useState<View>("upcoming");
  const [scope, setScope] = React.useState<"client" | "all">("client");
  const multi = clients.length > 1;
  const showAll = multi && scope === "all";
  const today = todayPH();
  const [month, setMonth] = React.useState(today.slice(0, 7));

  // Start at the 1st of this month so recent unfiled deadlines show as overdue.
  const from = `${today.slice(0, 7)}-01`;
  const to = addDays(addMonths(today, 12), -1);

  const { holidays, extensions } = useCalendarData();
  const obligations = React.useMemo<Row[]>(() => {
    const list = showAll ? clients : clients.filter((c) => c.id === activeClientId);
    return list
      .flatMap((c) =>
        c.profile
          ? generateObligations(c.profile, { from, to, rules: deadlineRules, holidays, extensions }).map((o) => ({ ...o, clientId: c.id, clientName: c.name, key: `${c.id}:${o.id}` }))
          : [],
      )
      .sort((a, b) => (a.due_date === b.due_date ? a.clientName.localeCompare(b.clientName) || a.form_code.localeCompare(b.form_code) : a.due_date < b.due_date ? -1 : 1));
  }, [showAll, clients, activeClientId, from, to, holidays, extensions]);

  if (!ready) return <p>Loading…</p>;
  if (!data.profile && !showAll) {
    return (
      <div className="space-y-4">
        <ClientSwitcher />
        <PageHeader title="My tax calendar" description="Your personalized deadlines for the next 12 months." />
        <p>Create your profile first so we know which returns apply to you.</p>
        <Link href="/profile" className={buttonVariants()}>
          Start my profile
        </Link>
      </div>
    );
  }

  const statusOf = (o: Row): ObligationStatus => clients.find((c) => c.id === o.clientId)?.obligations[o.id] ?? "pending";
  const toggle = (o: Row) =>
    void setObligation(o.id, o.rule_id, o.period_label, o.due_date, statusOf(o) === "pending" ? "filed_and_paid" : "pending", o.clientId);

  const lastHolidayYear = holidays.reduce((y, h) => Math.max(y, h.year), 0);
  const beyondHolidays = Number(to.slice(0, 4)) > lastHolidayYear;

  function downloadICS() {
    const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
    const blob = new Blob([obligationsToICS(obligations, stamp)], { type: "text/calendar" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "taxgabay-deadlines.ics";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const byForm = new Map<string, Row[]>();
  for (const o of obligations) byForm.set(o.form_code, [...(byForm.get(o.form_code) ?? []), o]);
  const monthObligations = obligations.filter((o) => o.due_date.startsWith(month));
  const firstMonth = from.slice(0, 7);
  const lastMonth = to.slice(0, 7);

  return (
    <div className="space-y-6">
      {!showAll && <ClientSwitcher />}
      <PageHeader
        title={showAll ? "Tax calendar: all clients" : "My tax calendar"}
        description={`Deadlines from ${formatDatePH(from)} to ${formatDatePH(to)}. Dates falling on a weekend or holiday move to the next working day.`}
      />
      {multi && (
        <div className="flex max-w-xs flex-col gap-1">
          <Label htmlFor="cal-scope">Show</Label>
          <Select id="cal-scope" value={scope} onChange={(e) => setScope(e.target.value as "client" | "all")}>
            <option value="client">{clients.find((c) => c.id === activeClientId)?.name ?? "This client"} only</option>
            <option value="all">All clients</option>
          </Select>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Calendar view" className="inline-flex rounded-md border border-border p-1">
          {(
            [
              ["upcoming", "Upcoming"],
              ["month", "Month"],
              ["form", "By form"],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={cn("rounded px-3 py-1.5 text-sm", view === v ? "bg-primary text-primary-foreground" : "hover:bg-muted")}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={downloadICS} disabled={obligations.length === 0}>
            Export to calendar (.ics)
          </Button>
          {obligations.length > 0 && (
            <PdfButton
              filename="taxgabay-calendar.pdf"
              build={() => ({
                title: "My BIR tax calendar",
                subtitle: `Deadlines from ${from} to ${to}`,
                generatedOn: today,
                blocks: [
                  {
                    kind: "table",
                    columns: [
                      { label: "Due date", width: 0.15 },
                      { label: "Form", width: 0.12 },
                      { label: "Period", width: 0.18 },
                      { label: "Title", width: 0.4 },
                      { label: "Status", width: 0.15 },
                    ],
                    rows: obligations.map((o) => [
                      o.due_date,
                      o.form_code,
                      o.period_label,
                      `${showAll ? `${o.clientName}: ` : ""}${o.tentative ? `${o.title} (depends on your answers)` : o.title}`,
                      statusOf(o) === "filed_and_paid" ? "Filed & paid" : o.due_date < today ? "Overdue" : "Pending",
                    ]),
                  },
                  { kind: "paragraph", text: "Dates falling on a weekend or holiday are moved to the next working day. Deadline rules and holidays are pending CPA verification." },
                ],
              })}
            />
          )}
        </div>
      </div>

      {beyondHolidays && (
        <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
          Holidays are loaded only through {lastHolidayYear}. Dates after that are moved for weekends only, until the holiday list is updated.
        </p>
      )}

      <Card>
        <CardContent className="pt-2">
          {obligations.length === 0 ? (
            <p className="py-6 text-center text-muted-foreground">
              No BIR returns to file based on {showAll ? "your clients' profiles" : "your profile"}.{" "}
              {!showAll && data.profile?.taxpayer_type === "employee" && "Your employer files and withholds for you; ask for your Form 2316 each year."}
            </p>
          ) : view === "upcoming" ? (
            <ul className="divide-y divide-border" aria-label="Upcoming deadlines">
              {obligations.map((o) => (
                <ObligationRow key={o.key} o={o} status={statusOf(o)} onToggle={() => toggle(o)} today={today} showClient={showAll} />
              ))}
            </ul>
          ) : view === "month" ? (
            <div className="space-y-4 pt-3">
              <div className="flex items-center justify-between">
                <Button variant="outline" size="sm" disabled={month <= firstMonth} onClick={() => setMonth(addMonths(`${month}-01`, -1).slice(0, 7))}>
                  ← Previous
                </Button>
                <h2 className="font-semibold">{formatDatePH(`${month}-01`, { month: "long", year: "numeric" })}</h2>
                <Button variant="outline" size="sm" disabled={month >= lastMonth} onClick={() => setMonth(addMonths(`${month}-01`, 1).slice(0, 7))}>
                  Next →
                </Button>
              </div>
              <MonthGrid month={month} obligations={monthObligations} holidays={holidays} showClient={showAll} />
              <ul className="divide-y divide-border">
                {monthObligations.map((o) => (
                  <ObligationRow key={o.key} o={o} status={statusOf(o)} onToggle={() => toggle(o)} today={today} showClient={showAll} />
                ))}
              </ul>
            </div>
          ) : (
            <div className="space-y-6 pt-3">
              {[...byForm.entries()].map(([code, list]) => (
                <section key={code}>
                  <h2 className="font-semibold">
                    <span className="font-mono">{code}</span> — {list[0]!.title}
                  </h2>
                  <ul className="divide-y divide-border">
                    {list.map((o) => (
                      <ObligationRow key={o.key} o={o} status={statusOf(o)} onToggle={() => toggle(o)} today={today} showClient={showAll} />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <p className="text-sm text-muted-foreground">
        For guidance only. Verify with BIR issuances or consult a CPA. Deadline rules and holidays are pending CPA verification.{" "}
        <Link href="/account" className="underline">
          Set up email or push reminders
        </Link>
        .
      </p>
    </div>
  );
}
