"use client";

import { registrationSteps } from "@taxgabay/tax-engine";
import * as React from "react";
import { Disclaimer } from "@/components/disclaimer";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useUserData } from "@/lib/user-data";
import { cn } from "@/lib/utils";

export function RoadmapView() {
  const { data, toggleRoadmap } = useUserData();
  const [employerOverride, setShowEmployer] = React.useState<boolean | null>(null);
  const showEmployer = employerOverride ?? data.profile?.has_employees ?? false;

  const steps = registrationSteps
    .filter((s) => s.business_form === "dti")
    .filter((s) => !s.only_if_employees || showEmployer)
    .sort((a, b) => a.order - b.order);
  const done = steps.filter((s) => data.roadmap.includes(s.id)).length;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Register a sole proprietorship"
        description="From DTI business name to your BIR Certificate of Registration. Tick each step as you finish it — your progress is saved."
      />
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm" aria-live="polite">
          <span className="font-semibold">
            {done} of {steps.length}
          </span>{" "}
          steps done
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={showEmployer} onChange={(e) => setShowEmployer(e.target.checked)} className="h-4 w-4 accent-[var(--color-primary)]" />I will hire employees
          </label>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            Print / save as PDF
          </Button>
        </div>
      </div>
      <div className="h-2 w-full rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={done} aria-label="Roadmap progress">
        <div className="h-2 rounded-full bg-primary" style={{ width: `${(done / steps.length) * 100}%` }} />
      </div>
      <ol className="space-y-4">
        {steps.map((s, i) => {
          const isDone = data.roadmap.includes(s.id);
          return (
            <li key={s.id}>
              <Card className={cn(isDone && "border-success/50")}>
                <CardHeader className="flex-row items-start gap-3 space-y-0">
                  <input
                    type="checkbox"
                    checked={isDone}
                    onChange={() => void toggleRoadmap(s.id)}
                    aria-label={`Mark step ${i + 1} as done: ${s.title}`}
                    className="no-print mt-1 h-5 w-5 shrink-0 accent-[var(--color-primary)]"
                  />
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="muted">Step {i + 1}</Badge>
                      <Badge variant="outline">{s.agency}</Badge>
                    </div>
                    <CardTitle className="mt-2">{s.title}</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">{s.summary}</p>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div>
                    <h3 className="font-medium">What to bring</h3>
                    <ul className="mt-1 list-disc pl-5">
                      {s.requirements.map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                  </div>
                  <dl className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <dt className="font-medium">Where</dt>
                      <dd>
                        {s.where}
                        {s.online_link && (
                          <>
                            {" "}
                            —{" "}
                            <a href={s.online_link} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                              {new URL(s.online_link).hostname}
                            </a>
                          </>
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium">Typical processing time</dt>
                      <dd>{s.est_days}</dd>
                    </div>
                    <div>
                      <dt className="font-medium">Fees</dt>
                      <dd>{s.fees_note}</dd>
                    </div>
                    <div>
                      <dt className="font-medium">Legal basis</dt>
                      <dd className="text-muted-foreground">{s.legal_basis}</dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ol>
      <p className="text-sm text-muted-foreground">Roadmaps for partnerships, corporations, OPCs (SEC) and cooperatives (CDA) arrive in Phase 2.</p>
      <Disclaimer lastVerified={null} />
    </div>
  );
}
