"use client";

import {
  computeAnnualCompensationTax,
  computeCompensationWithholding,
  deMinimisCeilings,
  peso,
  type AnnualCompensationResult,
  type CalcResult,
  type CompensationWithholdingResult,
  type PayrollPeriod,
} from "@taxgabay/tax-engine";
import * as React from "react";
import { CalcError, CalcResultPanel, isAmount, pdfMoney } from "@/components/calc-result";
import { MoneyField } from "@/components/money-field";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label, Select } from "@/components/ui/input";
import { rules } from "@/lib/rules";
import { todayPH } from "@/lib/utils";
import { DateField, Headline, Tabs, yearsSince2018 } from "../_shared";

type Tab = "payroll" | "annual";

function PerPayroll() {
  const [period, setPeriod] = React.useState<PayrollPeriod>("monthly");
  const [payDate, setPayDate] = React.useState(todayPH());
  const [gross, setGross] = React.useState("");
  const [contrib, setContrib] = React.useState("");
  const [nonTax, setNonTax] = React.useState("");
  const [out, setOut] = React.useState<CalcResult<CompensationWithholdingResult> | null>(null);
  const [pdfInputs, setPdfInputs] = React.useState<[string, string][]>([]);
  const [error, setError] = React.useState<string | null>(null);

  function compute(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!payDate) return setError("Enter the pay date.");
    if (!gross.trim() || ![gross, contrib, nonTax].every(isAmount)) return setError("Enter the gross compensation and check the amounts.");
    try {
      setPdfInputs([["Payroll period", period.replace("_", "-")], ["Pay date", payDate], ["Gross compensation for the period", pdfMoney(gross)], ["Mandatory contributions", pdfMoney(contrib)], ["Non-taxable pay", pdfMoney(nonTax)]]);
      setOut(computeCompensationWithholding({ period, pay_date: payDate, gross_compensation: gross, mandatory_contributions: contrib || "0", non_taxable_compensation: nonTax || "0" }, rules));
    } catch (err) {
      setOut(null);
      setError((err as Error).message);
    }
  }

  return (
    <>
      <Card>
        <CardContent className="pt-5">
          <form onSubmit={compute} className="grid gap-4 sm:grid-cols-2" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="wtc-period">Payroll period</Label>
              <Select id="wtc-period" value={period} onChange={(e) => setPeriod(e.target.value as PayrollPeriod)}>
                <option value="monthly">Monthly</option>
                <option value="semi_monthly">Semi-monthly</option>
                <option value="weekly">Weekly</option>
                <option value="daily">Daily</option>
              </Select>
            </div>
            <DateField id="wtc-date" label="Pay date" value={payDate} onChange={setPayDate} />
            <MoneyField id="wtc-gross" label="Gross compensation for the period" value={gross} onChange={setGross} />
            <MoneyField id="wtc-contrib" label="Mandatory contributions (employee share)" value={contrib} onChange={setContrib} hint="SSS, PhilHealth, Pag-IBIG and union dues" />
            <MoneyField id="wtc-nontax" label="Non-taxable pay included above" value={nonTax} onChange={setNonTax} hint="De minimis benefits within the ceilings" />
            <div className="sm:col-span-2">
              <Button type="submit">Compute</Button>
            </div>
          </form>
        </CardContent>
      </Card>
      {error && <CalcError message={error} />}
      {out && (
        <CalcResultPanel
          pdfTitle={"Withholding tax on compensation (per payroll)"}
          pdfHeadline={`Tax to withhold this payroll: ${peso(out.result.withholding_tax)}`}
          pdfInputs={pdfInputs}
          headline={<Headline label="Tax to withhold this payroll" amount={peso(out.result.withholding_tax)} />}
          steps={out.steps}
          rulesUsed={out.rules_used}
          warnings={out.warnings}
        />
      )}
    </>
  );
}

function YearEnd() {
  const thisYear = Number(todayPH().slice(0, 4));
  const [year, setYear] = React.useState(thisYear);
  const [gross, setGross] = React.useState("");
  const [contrib, setContrib] = React.useState("");
  const [benefits, setBenefits] = React.useState("");
  const [deMin, setDeMin] = React.useState("");
  const [withheld, setWithheld] = React.useState("");
  const [out, setOut] = React.useState<CalcResult<AnnualCompensationResult> | null>(null);
  const [pdfInputs, setPdfInputs] = React.useState<[string, string][]>([]);
  const [error, setError] = React.useState<string | null>(null);

  function compute(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!gross.trim() || ![gross, contrib, benefits, deMin, withheld].every(isAmount)) return setError("Enter basic pay and check the amounts.");
    try {
      setPdfInputs([["Taxable year", String(year)], ["Basic pay and taxable allowances", pdfMoney(gross)], ["Mandatory contributions", pdfMoney(contrib)], ["13th month pay and other benefits", pdfMoney(benefits)], ["De minimis benefits", pdfMoney(deMin)], ["Tax withheld during the year", pdfMoney(withheld)]]);
      setOut(
        computeAnnualCompensationTax(
          {
            taxable_year: year,
            gross_compensation: gross,
            mandatory_contributions: contrib || "0",
            thirteenth_month_and_other_benefits: benefits || "0",
            de_minimis: deMin || "0",
            tax_withheld: withheld || "0",
          },
          rules,
        ),
      );
    } catch (err) {
      setOut(null);
      setError((err as Error).message);
    }
  }

  const refund = out ? out.result.balance.startsWith("-") : false;
  return (
    <>
      <Card>
        <CardContent className="pt-5">
          <form onSubmit={compute} className="grid gap-4 sm:grid-cols-2" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="wta-year">Taxable year</Label>
              <Select id="wta-year" value={year} onChange={(e) => setYear(Number(e.target.value))}>
                {yearsSince2018(thisYear).map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </Select>
            </div>
            <div />
            <MoneyField id="wta-gross" label="Basic pay and taxable allowances for the year" value={gross} onChange={setGross} hint="Exclude 13th month pay, other benefits and de minimis" />
            <MoneyField id="wta-contrib" label="Mandatory contributions for the year" value={contrib} onChange={setContrib} />
            <MoneyField id="wta-benefits" label="13th month pay and other benefits" value={benefits} onChange={setBenefits} hint="Only the amount above ₱90,000 is taxable (to be verified)" />
            <MoneyField id="wta-deminimis" label="De minimis benefits" value={deMin} onChange={setDeMin} />
            <MoneyField id="wta-withheld" label="Tax withheld during the year" value={withheld} onChange={setWithheld} />
            <div className="sm:col-span-2">
              <Button type="submit">Compute</Button>
            </div>
          </form>
        </CardContent>
      </Card>
      {error && <CalcError message={error} />}
      {out && (
        <CalcResultPanel
          pdfTitle={"Withholding tax on compensation (year-end)"}
          pdfHeadline={`${refund ? "Refund to employee" : "Balance to withhold"}: ${peso(out.result.balance.replace(/^-/, ""))} (annual tax ${peso(out.result.annual_tax)}, withheld ${peso(out.result.tax_withheld)})`}
          pdfInputs={pdfInputs}
          headline={
            <Headline
              label={refund ? "Refund to employee" : "Balance to withhold"}
              amount={peso(out.result.balance.replace(/^-/, ""))}
              extra={`Annual tax ${peso(out.result.annual_tax)} · withheld ${peso(out.result.tax_withheld)}`}
            />
          }
          steps={out.steps}
          rulesUsed={out.rules_used}
          warnings={out.warnings}
        />
      )}
    </>
  );
}

export function WithholdingCompensationCalculator() {
  const [tab, setTab] = React.useState<Tab>("payroll");
  const dm = deMinimisCeilings(rules, todayPH());
  return (
    <div className="space-y-6">
      <PageHeader
        title="Withholding tax on compensation"
        description="For employers: how much tax to withhold from an employee's pay each payroll, and the year-end adjustment (annualization)."
      />
      <Tabs<Tab> label="Calculation" tabs={[["payroll", "Per payroll"], ["annual", "Year-end"]] as const} value={tab} onChange={setTab} />
      {tab === "payroll" ? <PerPayroll /> : <YearEnd />}
      <details className="rounded-md bg-muted p-3 text-sm">
        <summary className="cursor-pointer font-medium">De minimis ceilings</summary>
        <p className="mt-2 text-muted-foreground">Small benefits that are not taxable up to these amounts (pending CPA verification). Basis: {dm.legal_basis}</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {dm.items.map((i) => (
            <li key={i.key}>
              {i.label}: {peso(i.ceiling)} per {i.per}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
