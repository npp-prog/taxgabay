"use client";

import { addMonths, checklistFor, checklistPeriod, complianceScore, getForm, type ChecklistFrequency } from "@taxgabay/tax-engine";
import Link from "next/link";
import * as React from "react";
import { Disclaimer } from "@/components/disclaimer";
import { ClientSwitcher } from "@/components/client-switcher";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { format, useLocale } from "@/lib/i18n";
import type { Messages } from "@/lib/i18n/en";
import { useUserData } from "@/lib/user-data";
import { cn, todayPH } from "@/lib/utils";

const TABS: { key: ChecklistFrequency; label: keyof Messages["checklists"] }[] = [
  { key: "monthly", label: "monthly" },
  { key: "quarterly", label: "quarterly" },
  { key: "annual", label: "annual" },
  { key: "one_time", label: "oneTime" },
];

const STEP_MONTHS: Record<ChecklistFrequency, number> = { monthly: 1, quarterly: 3, annual: 12, one_time: 0 };

function periodTitle(freq: ChecklistFrequency, on: string, loc: string, once: string): string {
  const p = checklistPeriod(freq, on);
  if (freq === "monthly") return new Date(`${p}-01T00:00:00Z`).toLocaleDateString(loc, { month: "long", year: "numeric", timeZone: "UTC" });
  if (freq === "quarterly") return p.replace("-", " ");
  if (freq === "annual") return p;
  return once;
}

export function ChecklistsView() {
  const { data, ready, toggleChecklist } = useUserData();
  const { locale, t: tr } = useLocale();
  const c = tr.checklists;
  const loc = locale === "fil" ? "fil-PH" : "en-PH";
  const today = todayPH();
  const [freq, setFreq] = React.useState<ChecklistFrequency>("monthly");
  const [offset, setOffset] = React.useState(0);

  if (!ready) return <p>{c.loading}</p>;
  if (!data.profile) {
    return (
      <div className="space-y-4">
        <ClientSwitcher />
        <PageHeader title={c.title} description={c.emptyDescription} />
        <p>{c.needProfile}</p>
        <Link href="/profile" className={buttonVariants()}>
          {tr.home.start}
        </Link>
      </div>
    );
  }

  const on = addMonths(today, offset * STEP_MONTHS[freq]);
  const entries = checklistFor(data.profile, freq, on);
  const score = complianceScore(entries, data.checklist);

  return (
    <div className="space-y-6">
      <ClientSwitcher />
      <PageHeader
        title={c.title}
        description={c.description}
      />
      <div role="tablist" aria-label={c.frequencyLabel} className="inline-flex flex-wrap rounded-md border border-border p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={freq === t.key}
            onClick={() => {
              setFreq(t.key);
              setOffset(0);
            }}
            className={cn("rounded px-3 py-1.5 text-sm", freq === t.key ? "bg-primary text-primary-foreground" : "hover:bg-muted")}
          >
            {c[t.label]}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="space-y-4 pt-5">
          <div className="flex items-center justify-between gap-2">
            {freq !== "one_time" ? (
              <Button variant="outline" size="sm" onClick={() => setOffset((o) => o - 1)}>
                {c.previous}
              </Button>
            ) : (
              <span />
            )}
            <h2 className="font-semibold" data-testid="period-title">
              {periodTitle(freq, on, loc, c.once)}
            </h2>
            {freq !== "one_time" ? (
              <Button variant="outline" size="sm" onClick={() => setOffset((o) => o + 1)}>
                {c.next}
              </Button>
            ) : (
              <span />
            )}
          </div>

          {score.percent !== null && (
            <div>
              <div className="flex justify-between text-sm">
                <span>{c.score}</span>
                <span className="font-semibold" data-testid="score">
                  {score.percent}% ({score.done} of {score.total})
                </span>
              </div>
              <div className="mt-1 h-2 w-full rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={score.percent} aria-label={c.score}>
                <div className="h-2 rounded-full bg-primary" style={{ width: `${score.percent}%` }} />
              </div>
            </div>
          )}

          {entries.length === 0 ? (
            <p className="py-4 text-center text-muted-foreground">{c.nothing}</p>
          ) : (
            <ul className="divide-y divide-border">
              {entries.map((e) => {
                const done = data.checklist.includes(e.key);
                const guide = e.form_code ? getForm(e.form_code)?.guide_slug : null;
                return (
                  <li key={e.key} className="flex items-start gap-3 py-3" data-testid="checklist-item">
                    <input
                      type="checkbox"
                      checked={done}
                      onChange={() => void toggleChecklist(e.key)}
                      aria-label={format(c.doneLabel, { title: e.title })}
                      className="mt-1 h-4 w-4 accent-[var(--color-primary)]"
                    />
                    <div className="flex-1">
                      <div className={cn("font-medium", done && "text-muted-foreground line-through")}>{e.title}</div>
                      <div className="text-sm text-muted-foreground">{e.detail}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                        <Badge variant="muted">{format(c.due, { when: e.due_hint })}</Badge>
                        {e.applicability === "maybe" && <Badge variant="warning">{c.depends}</Badge>}
                        {guide && (
                          <Link href={`/guides/${guide}`} className="text-primary underline">
                            {format(c.guide, { form: e.form_code ?? "" })}
                          </Link>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
      <Disclaimer lastVerified={null} />
    </div>
  );
}
