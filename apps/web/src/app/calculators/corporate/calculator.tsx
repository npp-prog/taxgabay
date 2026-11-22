"use client";

import { computeCorporateIncomeTax, peso, type CalcResult, type CorporateIncomeTaxResult } from "@taxgabay/tax-engine";
import * as React from "react";
import { CalcError, CalcResultPanel, isAmount, pdfMoney } from "@/components/calc-result";
import { MoneyField } from "@/components/money-field";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { rules } from "@/lib/rules";
import { todayPH } from "@/lib/utils";
import { DateField, Headline } from "../_shared";

export function CorporateCalculator() {
  const thisYear = Number(todayPH().slice(0, 4));
  const [yearEnd, setYearEnd] = React.useState(`${thisYear - 1}-12-31`);
  const [commenced, setCommenced] = React.useState(String(thisYear - 5));
  const [sales, setSales] = React.useState("");
  const [cos, setCos] = React.useState("");
  const [other, setOther] = React.useState("");
  const [ded, setDed] = React.useState("");
  const [assets, setAssets] = React.useState("");
  const [out, setOut] = React.useState<CalcResult<CorporateIncomeTaxResult> | null>(null);
  const [pdfInputs, setPdfInputs] = React.useState<[string, string][]>([]);
  const [error, setError] = React.useState<string | null>(null);

  function compute(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!yearEnd) return setError("Enter the last day of the taxable year.");
    if (!/^\d{4}$/.test(commenced.trim())) return setError("Enter the year operations began, e.g. 2019.");
    if (!sales.trim() || ![sales, cos, other, ded, assets].every(isAmount)) return setError("Enter gross sales and check the amounts.");
    try {
      setPdfInputs([["Last day of the taxable year", yearEnd], ["Year operations began", commenced], ["Gross sales", pdfMoney(sales)], ["Cost of sales", pdfMoney(cos)], ["Other taxable income", pdfMoney(other)], ["Itemized deductions", pdfMoney(ded)], ["Total assets excluding land", pdfMoney(assets)]]);
      setOut(
        computeCorporateIncomeTax(
          {
            taxable_year_end: yearEnd,
            year_commenced: Number(commenced),
            gross_sales: sales,
            cost_of_sales: cos || "0",
            other_income: other || "0",
            deductions: ded || "0",
            total_assets_excl_land: assets || "0",
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
        title="Corporate income tax: RCIT vs MCIT"
        description="For corporations, partnerships and OPCs. The tax due is the higher of the regular corporate income tax (RCIT, on taxable income) and the minimum corporate income tax (MCIT, on gross income), once MCIT applies."
      />
      <Card>
        <CardContent className="pt-5">
          <form onSubmit={compute} className="grid gap-4 sm:grid-cols-2" noValidate>
            <DateField id="corp-year-end" label="Last day of the taxable year" value={yearEnd} onChange={setYearEnd} />
            <div className="space-y-1.5">
              <Label htmlFor="corp-commenced">Year operations began</Label>
              <Input id="corp-commenced" inputMode="numeric" maxLength={4} value={commenced} onChange={(e) => setCommenced(e.target.value)} />
              <p className="text-xs text-muted-foreground">MCIT starts in the 4th taxable year after this year.</p>
            </div>
            <MoneyField id="corp-sales" label="Gross sales" value={sales} onChange={setSales} hint="Net of returns, allowances and discounts" />
            <MoneyField id="corp-cos" label="Cost of sales" value={cos} onChange={setCos} />
            <MoneyField id="corp-other" label="Other taxable income (optional)" value={other} onChange={setOther} hint="Income not subject to final tax" />
            <MoneyField id="corp-ded" label="Itemized deductions" value={ded} onChange={setDed} hint="Allowable operating expenses" />
            <MoneyField id="corp-assets" label="Total assets excluding land" value={assets} onChange={setAssets} hint="Excluding the land where the office, plant and equipment are located" />
            <div className="sm:col-span-2">
              <Button type="submit">Compute</Button>
            </div>
          </form>
        </CardContent>
      </Card>
      {error && <CalcError message={error} />}
      {out && (
        <CalcResultPanel
          pdfTitle={"Corporate income tax: RCIT vs MCIT"}
          pdfHeadline={`Income tax due (${out.result.basis.toUpperCase()}): ${peso(out.result.tax_due)} — RCIT ${peso(out.result.rcit)}, MCIT ${peso(out.result.mcit)}`}
          pdfInputs={pdfInputs}
          headline={<Headline label={`Income tax due (${out.result.basis.toUpperCase()})`} amount={peso(out.result.tax_due)} extra={`RCIT ${peso(out.result.rcit)} · MCIT ${peso(out.result.mcit)}`} />}
          steps={out.steps}
          rulesUsed={out.rules_used}
          warnings={out.warnings}
        />
      )}
    </div>
  );
}
