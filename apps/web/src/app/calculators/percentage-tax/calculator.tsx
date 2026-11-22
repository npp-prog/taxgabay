"use client";

import { computePercentageTax, endOfMonth, peso, type CalcResult, type PercentageTaxResult } from "@taxgabay/tax-engine";
import * as React from "react";
import { CalcError, CalcResultPanel, isAmount } from "@/components/calc-result";
import { MoneyField } from "@/components/money-field";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label, Select } from "@/components/ui/input";
import { rules } from "@/lib/rules";
import { todayPH } from "@/lib/utils";

export function PercentageTaxCalculator() {
  const today = todayPH();
  const thisYear = Number(today.slice(0, 4));
  const [year, setYear] = React.useState(thisYear);
  const [quarter, setQuarter] = React.useState(Math.ceil(Number(today.slice(5, 7)) / 3));
  const [gross, setGross] = React.useState("");
  const [out, setOut] = React.useState<CalcResult<PercentageTaxResult> | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  function compute(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!gross.trim() || !isAmount(gross)) {
      setError("Enter your gross sales or receipts for the quarter.");
      return;
    }
    try {
      setOut(computePercentageTax({ period_end: endOfMonth(year, quarter * 3), gross_sales_receipts: gross }, rules));
    } catch (err) {
      setOut(null);
      setError((err as Error).message);
    }
  }

  const years = Array.from({ length: thisYear - 2018 + 1 }, (_, i) => thisYear - i);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Quarterly percentage tax"
        description="For non-VAT taxpayers who did not elect the 8% income tax option (BIR Form 2551Q, NIRC Sec. 116)."
      />
      <Card>
        <CardContent className="pt-5">
          <form onSubmit={compute} className="grid gap-4 sm:grid-cols-3" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="pt-year">Year</Label>
              <Select id="pt-year" value={year} onChange={(e) => setYear(Number(e.target.value))}>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pt-quarter">Quarter</Label>
              <Select id="pt-quarter" value={quarter} onChange={(e) => setQuarter(Number(e.target.value))}>
                <option value={1}>Q1 (Jan–Mar)</option>
                <option value={2}>Q2 (Apr–Jun)</option>
                <option value={3}>Q3 (Jul–Sep)</option>
                <option value={4}>Q4 (Oct–Dec)</option>
              </Select>
            </div>
            <MoneyField id="pt-gross" label="Gross sales/receipts for the quarter" value={gross} onChange={setGross} />
            <div className="sm:col-span-3">
              <Button type="submit">Compute</Button>
            </div>
          </form>
        </CardContent>
      </Card>
      {error && <CalcError message={error} />}
      {out && (
        <CalcResultPanel
          headline={
            <p>
              <span className="block text-sm">Percentage tax due</span>
              <span className="text-2xl font-bold" data-testid="headline-amount">
                {peso(out.result.tax_due)}
              </span>
            </p>
          }
          steps={out.steps}
          rulesUsed={out.rules_used}
          warnings={out.warnings}
        />
      )}
    </div>
  );
}
