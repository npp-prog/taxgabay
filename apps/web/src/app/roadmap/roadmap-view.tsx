"use client";

import { businessForm, registrationSteps } from "@taxgabay/tax-engine";
import * as React from "react";
import { Disclaimer } from "@/components/disclaimer";
import { ClientSwitcher } from "@/components/client-switcher";
import { PageHeader } from "@/components/page-header";
import { PdfButton } from "@/components/pdf-button";
import type { PdfDoc } from "@/lib/pdf";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useUserData } from "@/lib/user-data";
import { cn, todayPH } from "@/lib/utils";

type Path = "dti" | "sec" | "cda";

const PATHS: { key: Path; label: string; title: string; description: string }[] = [
  { key: "dti", label: "Sole proprietorship", title: "Register a sole proprietorship", description: "From DTI business name to your BIR Certificate of Registration." },
  { key: "sec", label: "Partnership / corporation / OPC", title: "Register a partnership, corporation or OPC", description: "From SEC registration to your BIR Certificate of Registration." },
  { key: "cda", label: "Cooperative", title: "Register a cooperative", description: "From the pre-membership seminar to CDA registration and BIR tax exemption." },
];

export function RoadmapView() {
  const { data, toggleRoadmap } = useUserData();
  const [pathOverride, setPath] = React.useState<Path | null>(null);
  const path: Path = pathOverride ?? (data.profile ? businessForm(data.profile.taxpayer_type) : null) ?? "dti";
  const meta = PATHS.find((p) => p.key === path)!;
  const [employerOverride, setShowEmployer] = React.useState<boolean | null>(null);
  const showEmployer = employerOverride ?? data.profile?.has_employees ?? false;

  const steps = registrationSteps
    .filter((s) => s.business_form === path)
    .filter((s) => !s.only_if_employees || showEmployer)
    .sort((a, b) => a.order - b.order);
  const done = steps.filter((s) => data.roadmap.includes(s.id)).length;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <ClientSwitcher />
      <div role="tablist" aria-label="Business form" className="no-print inline-flex flex-wrap rounded-md border border-border p-1">
        {PATHS.map((p) => (
          <button
            key={p.key}
            role="tab"
            aria-selected={path === p.key}
            onClick={() => setPath(p.key)}
            className={cn("rounded px-3 py-1.5 text-sm", path === p.key ? "bg-primary text-primary-foreground" : "hover:bg-muted")}
          >
            {p.label}
          </button>
        ))}
      </div>
      <PageHeader title={meta.title} description={`${meta.description} Tick each step as you finish it — your progress is saved.`} />
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
            Print
          </Button>
          <PdfButton
            filename={`taxgabay-roadmap-${path}.pdf`}
            build={(): PdfDoc => ({
              title: meta.title,
              subtitle: `${done} of ${steps.length} steps done`,
              generatedOn: todayPH(),
              blocks: [
                {
                  kind: "checklist",
                  items: steps.map((s, i) => ({
                    text: `${i + 1}. ${s.title}`,
                    done: data.roadmap.includes(s.id),
                    note: `${s.agency} · ${s.where} · ${s.fees_note} Bring: ${s.requirements.join("; ")}. Basis: ${s.legal_basis}`,
                  })),
                },
                { kind: "paragraph", text: "For guidance only. Verify with BIR issuances or consult a CPA. Steps and fees are pending verification by Neil Priolo, CPA." },
              ],
            })}
          />
        </div>
      </div>
      <div className="h-1.5 w-full rounded-[1px] bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={done} aria-label="Roadmap progress">
        <div className="h-1.5 rounded-[1px] bg-primary" style={{ width: `${(done / steps.length) * 100}%` }} />
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
      <Disclaimer lastVerified={null} />
    </div>
  );
}
