"use client";

import { addMonths, checklistFor, checklistPeriod, complianceScore, getForm, type ChecklistFrequency } from "@taxgabay/tax-engine";
import Link from "next/link";
import * as React from "react";
import { Disclaimer } from "@/components/disclaimer";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useUserData } from "@/lib/user-data";
import { cn, formatDatePH, todayPH } from "@/lib/utils";

const TABS: { key: ChecklistFrequency; label: string }[] = [
  { key: "monthly", label: "Monthly" },
  { key: "quarterly", label: "Quarterly" },
  { key: "annual", label: "Annual" },
  { key: "one_time", label: "One-time setup" },
];

const STEP_MONTHS: Record<ChecklistFrequency, number> = { monthly: 1, quarterly: 3, annual: 12, one_time: 0 };

function periodTitle(freq: ChecklistFrequency, on: string): string {
  const p = checklistPeriod(freq, on);
  if (freq === "monthly") return formatDatePH(`${p}-01`, { month: "long", year: "numeric" });
  if (freq === "quarterly") return p.replace("-", " ");
  if (freq === "annual") return p;
  return "Do these once";
}

export function ChecklistsView() {
  const { data, ready, toggleChecklist } = useUserData();
  const today = todayPH();
  const [freq, setFreq] = React.useState<ChecklistFrequency>("monthly");
  const [offset, setOffset] = React.useState(0);

  if (!ready) return <p>Loading…</p>;
  if (!data.profile) {
    return (
      <div className="space-y-4">
        <PageHeader title="Compliance checklists" description="Monthly, quarterly, annual and one-time tasks based on your profile." />
        <p>Create your profile first so we know which tasks apply to you.</p>
        <Link href="/profile" className={buttonVariants()}>
          Start my profile
        </Link>
      </div>
    );
  }

  const on = addMonths(today, offset * STEP_MONTHS[freq]);
  const entries = checklistFor(data.profile, freq, on);
  const score = complianceScore(entries, data.checklist);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Compliance checklists"
        description="Tick tasks as you finish them. Your compliance score counts the tasks that definitely apply to you this period."
      />
      <div role="tablist" aria-label="Checklist frequency" className="inline-flex flex-wrap rounded-md border border-border p-1">
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
            {t.label}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="space-y-4 pt-5">
          <div className="flex items-center justify-between gap-2">
            {freq !== "one_time" ? (
              <Button variant="outline" size="sm" onClick={() => setOffset((o) => o - 1)}>
                ← Previous
              </Button>
            ) : (
              <span />
            )}
            <h2 className="font-semibold" data-testid="period-title">
              {periodTitle(freq, on)}
            </h2>
            {freq !== "one_time" ? (
              <Button variant="outline" size="sm" onClick={() => setOffset((o) => o + 1)}>
                Next →
              </Button>
            ) : (
              <span />
            )}
          </div>

          {score.percent !== null && (
            <div>
              <div className="flex justify-between text-sm">
                <span>Compliance score</span>
                <span className="font-semibold" data-testid="score">
                  {score.percent}% ({score.done} of {score.total})
                </span>
              </div>
              <div className="mt-1 h-2 w-full rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={score.percent} aria-label="Compliance score">
                <div className="h-2 rounded-full bg-primary" style={{ width: `${score.percent}%` }} />
              </div>
            </div>
          )}

          {entries.length === 0 ? (
            <p className="py-4 text-center text-muted-foreground">Nothing to do here based on your profile.</p>
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
                      aria-label={`Done: ${e.title}`}
                      className="mt-1 h-4 w-4 accent-[var(--color-primary)]"
                    />
                    <div className="flex-1">
                      <div className={cn("font-medium", done && "text-muted-foreground line-through")}>{e.title}</div>
                      <div className="text-sm text-muted-foreground">{e.detail}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                        <Badge variant="muted">Due: {e.due_hint}</Badge>
                        {e.applicability === "maybe" && <Badge variant="warning">Depends on your answers</Badge>}
                        {guide && (
                          <Link href={`/guides/${guide}`} className="text-primary underline">
                            {e.form_code} guide
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
