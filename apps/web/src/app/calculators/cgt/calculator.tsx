"use client";

import { computeCgtRealProperty, computeCgtUnlistedShares, peso, type CalcResult, type CgtResult } from "@taxgabay/tax-engine";
import * as React from "react";
import { CalcError, CalcResultPanel, isAmount, pdfMoney } from "@/components/calc-result";
import { MoneyField } from "@/components/money-field";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { rules } from "@/lib/rules";
import { todayPH } from "@/lib/utils";
import { DateField, Headline, Tabs } from "../_shared";

type Tab = "property" | "shares";

export function CgtCalculator() {
  const [tab, setTab] = React.useState<Tab>("property");
  const [date, setDate] = React.useState(todayPH());
  const [gsp, setGsp] = React.useState("");
  const [zonal, setZonal] = React.useState("");
  const [assessor, setAssessor] = React.useState("");
  const [price, setPrice] = React.useState("");
  const [cost, setCost] = React.useState("");
  const [expenses, setExpenses] = React.useState("");
  const [out, setOut] = React.useState<CalcResult<CgtResult> | null>(null);
  const [pdfInputs, setPdfInputs] = React.useState<[string, string][]>([]);
  const [error, setError] = React.useState<string | null>(null);

  function switchTab(t: Tab) {
    setTab(t);
    setOut(null);
    setError(null);
  }

  function compute(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!date) return setError("Enter the date of sale.");
    try {
      if (tab === "property") {
        if (![gsp, zonal, assessor].every(isAmount) || (!gsp.trim() && !zonal.trim() && !assessor.trim())) return setError("Enter the selling price and property values.");
        setPdfInputs([["Type of sale", "Real property"], ["Date of sale", date], ["Gross selling price", pdfMoney(gsp)], ["BIR zonal value", pdfMoney(zonal)], ["Assessor's fair market value", pdfMoney(assessor)]]);
        setOut(computeCgtRealProperty({ date_of_sale: date, gross_selling_price: gsp || "0", zonal_value: zonal || "0", assessor_fair_market_value: assessor || "0" }, rules));
      } else {
        if (!price.trim() || ![price, cost, expenses].every(isAmount)) return setError("Enter the selling price and check the amounts.");
        setPdfInputs([["Type of sale", "Unlisted shares"], ["Date of sale", date], ["Selling price of the shares", pdfMoney(price)], ["Cost basis", pdfMoney(cost)], ["Selling expenses", pdfMoney(expenses)]]);
        setOut(computeCgtUnlistedShares({ date_of_sale: date, selling_price: price, cost_basis: cost || "0", selling_expenses: expenses || "0" }, rules));
      }
    } catch (err) {
      setOut(null);
      setError((err as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Capital gains tax"
        description="Final tax on selling real property held as a capital asset (not used in business), or shares not traded on the stock exchange. The zonal value is the BIR's official value for land in your area."
      />
      <Tabs<Tab> label="Type of sale" tabs={[["property", "Real property"], ["shares", "Unlisted shares"]] as const} value={tab} onChange={switchTab} />
      <Card>
        <CardContent className="pt-5">
          <form onSubmit={compute} className="grid gap-4 sm:grid-cols-2" noValidate>
            <DateField id="cgt-date" label="Date of sale" value={date} onChange={setDate} />
            <div />
            {tab === "property" ? (
              <>
                <MoneyField id="cgt-gsp" label="Gross selling price" value={gsp} onChange={setGsp} />
                <MoneyField id="cgt-zonal" label="BIR zonal value" value={zonal} onChange={setZonal} />
                <MoneyField id="cgt-assessor" label="Assessor's fair market value" value={assessor} onChange={setAssessor} hint="From the tax declaration" />
              </>
            ) : (
              <>
                <MoneyField id="cgt-price" label="Selling price of the shares" value={price} onChange={setPrice} />
                <MoneyField id="cgt-cost" label="Cost basis" value={cost} onChange={setCost} hint="What you paid for the shares" />
                <MoneyField id="cgt-expenses" label="Selling expenses" value={expenses} onChange={setExpenses} />
              </>
            )}
            <div className="sm:col-span-2">
              <Button type="submit">Compute</Button>
            </div>
          </form>
        </CardContent>
      </Card>
      {error && <CalcError message={error} />}
      {out && (
        <CalcResultPanel
          pdfTitle={tab === "property" ? "Capital gains tax on real property" : "Capital gains tax on unlisted shares"}
          pdfHeadline={`Capital gains tax: ${peso(out.result.capital_gains_tax)} (tax base ${peso(out.result.tax_base)})`}
          pdfInputs={pdfInputs}
          headline={<Headline label="Capital gains tax" amount={peso(out.result.capital_gains_tax)} extra={`Tax base: ${peso(out.result.tax_base)}`} />}
          steps={out.steps}
          rulesUsed={out.rules_used}
          warnings={out.warnings}
        />
      )}
    </div>
  );
}
