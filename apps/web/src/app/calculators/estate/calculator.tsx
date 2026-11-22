"use client";

import { computeEstateTax, peso, type CalcResult, type EstateTaxResult } from "@taxgabay/tax-engine";
import * as React from "react";
import { CalcError, CalcResultPanel, isAmount } from "@/components/calc-result";
import { MoneyField } from "@/components/money-field";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { rules } from "@/lib/rules";
import { Checkbox, DateField, Headline } from "../_shared";

export function EstateCalculator() {
  const [dod, setDod] = React.useState("");
  const [excl, setExcl] = React.useState("");
  const [conj, setConj] = React.useState("");
  const [exclDed, setExclDed] = React.useState("");
  const [conjDed, setConjDed] = React.useState("");
  const [fh, setFh] = React.useState("");
  const [fhConj, setFhConj] = React.useState(false);
  const [out, setOut] = React.useState<CalcResult<EstateTaxResult> | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  function compute(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!dod) return setError("Enter the date of death.");
    if (![excl, conj, exclDed, conjDed, fh].every(isAmount)) return setError("Please fix the highlighted amounts.");
    if (!excl.trim() && !conj.trim()) return setError("Enter the decedent's exclusive or conjugal/community property.");
    try {
      setOut(
        computeEstateTax(
          {
            date_of_death: dod,
            exclusive_property: excl || "0",
            conjugal_property: conj || "0",
            exclusive_deductions: exclDed || "0",
            conjugal_deductions: conjDed || "0",
            family_home_value: fh || "0",
            family_home_is_conjugal: fhConj,
          },
          rules,
        ),
      );
    } catch (err) {
      setOut(null);
      setError((err as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Estate tax"
        description="Tax on the net estate of a person who died on or after 1 January 2018 (citizens and residents). Use fair market values at the time of death."
      />
      <Card>
        <CardContent className="pt-5">
          <form onSubmit={compute} className="grid gap-4 sm:grid-cols-2" noValidate>
            <DateField id="est-dod" label="Date of death" value={dod} onChange={setDod} />
            <div />
            <MoneyField id="est-excl" label="Exclusive property of the decedent" value={excl} onChange={setExcl} hint="Property owned by the decedent alone" />
            <MoneyField id="est-conj" label="Conjugal or community property" value={conj} onChange={setConj} hint="Property owned with the surviving spouse (whole value)" />
            <MoneyField id="est-excl-ded" label="Deductions charged to exclusive property" value={exclDed} onChange={setExclDed} hint="Claims, unpaid mortgages, losses" />
            <MoneyField id="est-conj-ded" label="Deductions charged to conjugal property" value={conjDed} onChange={setConjDed} />
            <MoneyField id="est-fh" label="Family home value" value={fh} onChange={setFh} hint="Fair market value of the whole family home" />
            <div className="flex items-end">
              <Checkbox id="est-fh-conj" label="The family home is conjugal/community property" checked={fhConj} onChange={setFhConj} />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit">Compute</Button>
            </div>
          </form>
        </CardContent>
      </Card>
      {error && <CalcError message={error} />}
      {out && (
        <CalcResultPanel
          headline={<Headline label="Estate tax due" amount={peso(out.result.estate_tax)} extra={`Net taxable estate: ${peso(out.result.net_taxable_estate)}`} />}
          steps={out.steps}
          rulesUsed={out.rules_used}
          warnings={out.warnings}
        />
      )}
    </div>
  );
}
