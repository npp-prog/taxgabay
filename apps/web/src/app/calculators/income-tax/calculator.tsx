"use client";

import { computeIndividualIncomeTax, peso, type CalcResult, type IndividualIncomeTaxResult } from "@taxgabay/tax-engine";
import * as React from "react";
import { CalcError, CalcResultPanel, isAmount } from "@/components/calc-result";
import { MoneyField } from "@/components/money-field";
import { PageHeader } from "@/components/page-header";
import { StepsTable } from "@/components/steps-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label, Select } from "@/components/ui/input";
import { rules } from "@/lib/rules";
import { cn, todayPH } from "@/lib/utils";

export function IncomeTaxCalculator() {
  const thisYear = Number(todayPH().slice(0, 4));
  const [year, setYear] = React.useState(thisYear);
  const [comp, setComp] = React.useState("");
  const [gross, setGross] = React.useState("");
  const [other, setOther] = React.useState("");
  const [itemized, setItemized] = React.useState("");
  const [vat, setVat] = React.useState(false);
  const [out, setOut] = React.useState<CalcResult<IndividualIncomeTaxResult> | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  function compute(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (![comp, gross, other, itemized].every(isAmount)) {
      setError("Please fix the highlighted amounts.");
      return;
    }
    if (!comp.trim() && !gross.trim() && !other.trim()) {
      setError("Enter compensation income, gross sales/receipts, or both.");
      return;
    }
    try {
      setOut(
        computeIndividualIncomeTax(
          {
            taxable_year: year,
            compensation_income: comp,
            gross_sales_receipts: gross,
            other_non_operating_income: other,
            itemized_deductions: itemized.trim() ? itemized : undefined,
            vat_registered: vat,
          },
          rules,
        ),
      );
    } catch (err) {
      setOut(null);
      setError((err as Error).message);
    }
  }

  const years = Array.from({ length: thisYear - 2018 + 1 }, (_, i) => thisYear - i);
  const r = out?.result;
  const rec = r?.options.find((o) => o.key === r.recommended);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Income tax: 8% vs graduated rates"
        description="For self-employed individuals, professionals and mixed-income earners. Annual figures. Totals include percentage tax under graduated rates for non-VAT taxpayers, since the 8% option replaces it."
      />
      <Card>
        <CardContent className="pt-5">
          <form onSubmit={compute} className="grid gap-4 sm:grid-cols-2" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="year">Taxable year</Label>
              <Select id="year" value={year} onChange={(e) => setYear(Number(e.target.value))}>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={vat} onChange={(e) => setVat(e.target.checked)} className="h-4 w-4 accent-[var(--color-primary)]" />
                I am VAT-registered
              </label>
            </div>
            <MoneyField id="gross" label="Gross sales or receipts" value={gross} onChange={setGross} hint="Net of returns, allowances and discounts" />
            <MoneyField id="other" label="Other non-operating income (optional)" value={other} onChange={setOther} />
            <MoneyField id="comp" label="Taxable compensation income (if employed)" value={comp} onChange={setComp} hint="From your Form 2316, after non-taxable benefits and contributions" />
            <MoneyField id="itemized" label="Itemized deductions (optional)" value={itemized} onChange={setItemized} hint="Total allowable expenses with receipts — leave blank to skip" />
            <div className="sm:col-span-2">
              <Button type="submit">Compute</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {error && <CalcError message={error} />}

      {out && r && (
        <CalcResultPanel
          headline={
            rec ? (
              <p>
                <span className="block text-sm">Lowest total tax</span>
                <span className="text-2xl font-bold" data-testid="headline-amount">
                  {peso(rec.total_tax)}
                </span>{" "}
                <span className="text-sm">with {rec.label.toLowerCase()}</span>
              </p>
            ) : (
              <p>No eligible option.</p>
            )
          }
          steps={rec?.steps ?? []}
          rulesUsed={out.rules_used}
          warnings={out.warnings}
        >
          {r.options.length > 1 && (
            <div className="grid gap-3 sm:grid-cols-3" data-testid="options">
              {r.options.map((o) => (
                <div key={o.key} className={cn("rounded-lg border p-4", o.key === r.recommended ? "border-primary" : "border-border", !o.eligible && "opacity-70")}>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold">{o.label}</h3>
                    {o.key === r.recommended && <Badge>Lowest</Badge>}
                    {!o.eligible && <Badge variant="muted">Not eligible</Badge>}
                  </div>
                  <p className="mt-2 font-mono text-xl tabular-nums">{peso(o.total_tax)}</p>
                  <p className="text-xs text-muted-foreground">
                    Income tax {peso(o.income_tax)}
                    {o.percentage_tax !== "0.00" && ` + percentage tax ${peso(o.percentage_tax)}`}
                  </p>
                  {o.ineligible_reasons.map((x) => (
                    <p key={x} className="mt-1 text-xs text-warning-foreground">
                      {x}
                    </p>
                  ))}
                  {o.key !== r.recommended && (
                    <details className="mt-2 text-sm">
                      <summary className="cursor-pointer text-primary">Show computation</summary>
                      <div className="mt-2">
                        <StepsTable steps={o.steps} caption={o.label} />
                      </div>
                    </details>
                  )}
                </div>
              ))}
            </div>
          )}
        </CalcResultPanel>
      )}
    </div>
  );
}
