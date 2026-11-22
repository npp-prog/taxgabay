"use client";

import {
  ISSUANCE_STATUSES,
  TAX_TYPE_LABELS,
  facetValues,
  filterIssuances,
  issuanceLabel,
  type IssuanceFilters,
  type IssuanceStatus,
  type IssuanceType,
} from "@taxgabay/content/issuances";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import * as React from "react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { useLibrary } from "@/lib/issuances-data";
import { formatDatePH } from "@/lib/utils";

export function IssuanceLibrary() {
  const params = useSearchParams();
  const lib = useLibrary();
  const [f, setF] = React.useState<IssuanceFilters>({ q: params.get("q") ?? "", type: "", year: "", tax_type: "", topic: "", status: "" });
  const facets = facetValues(lib.issuances);
  const results = filterIssuances(lib.issuances, f);
  const set = <K extends keyof IssuanceFilters>(k: K, v: IssuanceFilters[K]) => setF((x) => ({ ...x, [k]: v }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="BIR issuances library"
        description="Revenue regulations (RR), memorandum orders (RMO) and circulars (RMC), laws (RA) and other issuances, with plain-language summaries and links to the official source."
      />
      {lib.source === "bundled" && (
        <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
          Showing a starter list of key issuances. Summaries are being reviewed by our CPA; always read the official text.
        </p>
      )}
      <Card>
        <CardContent className="grid gap-3 pt-5 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
            <Label htmlFor="iss-q">Search issuances</Label>
            <Input id="iss-q" type="search" placeholder="e.g. RR 8-2018, invoicing, estate tax" value={f.q} onChange={(e) => set("q", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="iss-type">Type</Label>
            <Select id="iss-type" value={f.type} onChange={(e) => set("type", e.target.value as IssuanceType | "")}>
              <option value="">All types</option>
              {facets.types.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="iss-year">Year</Label>
            <Select id="iss-year" value={f.year} onChange={(e) => set("year", e.target.value ? Number(e.target.value) : "")}>
              <option value="">All years</option>
              {facets.years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="iss-tax">Tax type</Label>
            <Select id="iss-tax" value={f.tax_type} onChange={(e) => set("tax_type", e.target.value)}>
              <option value="">All tax types</option>
              {facets.taxTypes.map((t) => (
                <option key={t} value={t}>
                  {TAX_TYPE_LABELS[t] ?? t}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="iss-topic">Topic</Label>
            <Select id="iss-topic" value={f.topic} onChange={(e) => set("topic", e.target.value)}>
              <option value="">All topics</option>
              {facets.topics.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="iss-status">Status</Label>
            <Select id="iss-status" value={f.status} onChange={(e) => set("status", e.target.value as IssuanceStatus | "")}>
              <option value="">Any status</option>
              {ISSUANCE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </div>
        </CardContent>
      </Card>

      {lib.loading ? (
        <p>Loading…</p>
      ) : lib.error ? (
        <p role="alert" className="text-destructive">
          Could not load issuances: {lib.error}
        </p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground" aria-live="polite" data-testid="result-count">
            {results.length} of {lib.issuances.length} issuances
          </p>
          <ul className="space-y-3">
            {results.map((i) => (
              <li key={i.slug}>
                <Link href={`/issuances/${i.slug}`} className="group block">
                  <Card className="transition-colors group-hover:border-primary">
                    <CardContent className="space-y-1 pt-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-semibold">{issuanceLabel(i)}</span>
                        {i.status !== "active" && <Badge variant="warning">{i.status}</Badge>}
                        {i.needs_verification && <Badge variant="muted">Summary under review</Badge>}
                        {i.date_issued && <span className="text-xs text-muted-foreground">Issued {formatDatePH(i.date_issued)}</span>}
                      </div>
                      <h2 className="font-medium">{i.title}</h2>
                      {i.summary_plain && <p className="line-clamp-2 text-sm text-muted-foreground">{i.summary_plain}</p>}
                      <div className="flex flex-wrap gap-1 pt-1">
                        {i.tax_types.map((t) => (
                          <Badge key={t} variant="outline">
                            {TAX_TYPE_LABELS[t] ?? t}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
