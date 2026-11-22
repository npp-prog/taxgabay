"use client";

import { computeEwt, listAtcs, pct, peso, type CalcResult, type EwtResult } from "@taxgabay/tax-engine";
import * as React from "react";
import { CalcError, CalcResultPanel, isAmount, pdfMoney } from "@/components/calc-result";
import { MoneyField } from "@/components/money-field";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label, Select } from "@/components/ui/input";
import { rules } from "@/lib/rules";
import { todayPH } from "@/lib/utils";
import { Checkbox, DateField, Headline } from "../_shared";

export function EwtCalculator() {
  const today = todayPH();
  const atcs = listAtcs(rules, today);
  const [atc, setAtc] = React.useState(atcs[0]?.atc ?? "");
  const [date, setDate] = React.useState(today);
  const [amount, setAmount] = React.useState("");
  const [vatIncl, setVatIncl] = React.useState(false);
  const [out, setOut] = React.useState<CalcResult<EwtResult> | null>(null);
  const [pdfInputs, setPdfInputs] = React.useState<[string, string][]>([]);
  const [error, setError] = React.useState<string | null>(null);

  function compute(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!date) return setError("Enter the payment date.");
    if (!amount.trim() || !isAmount(amount)) return setError("Enter the amount of the payment.");
    try {
      setPdfInputs([["ATC", atc], ["Payment date", date], ["Amount of the payment", pdfMoney(amount)], ["Amount includes VAT", vatIncl ? "Yes" : "No"]]);
      setOut(computeEwt({ atc, payment_date: date, amount, vat_inclusive: vatIncl }, rules));
    } catch (err) {
      setOut(null);
      setError((err as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expanded withholding tax (EWT)"
        description="Tax you withhold when paying suppliers such as landlords, professionals and contractors. The rate depends on the ATC (alphanumeric tax code) for the type of payment."
      />
      <Card>
        <CardContent className="pt-5">
          <form onSubmit={compute} className="grid gap-4 sm:grid-cols-2" noValidate>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="ewt-atc">Type of payment (ATC)</Label>
              <Select id="ewt-atc" value={atc} onChange={(e) => setAtc(e.target.value)}>
                {atcs.map((a) => (
                  <option key={a.atc} value={a.atc}>
                    {a.atc} — {a.description} ({pct(a.rate)})
                  </option>
                ))}
              </Select>
            </div>
            <DateField id="ewt-date" label="Payment date" value={date} onChange={setDate} />
            <MoneyField id="ewt-amount" label="Amount of the payment" value={amount} onChange={setAmount} />
            <div className="sm:col-span-2">
              <Checkbox id="ewt-vat" label="Amount includes VAT (payee is VAT-registered)" checked={vatIncl} onChange={setVatIncl} />
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
          pdfTitle={"Expanded withholding tax"}
          pdfHeadline={`Expanded withholding tax: ${peso(out.result.ewt)}; net amount to pay the payee: ${peso(out.result.net_payment)}`}
          pdfInputs={pdfInputs}
          headline={<Headline label="Expanded withholding tax" amount={peso(out.result.ewt)} extra={`Net amount to pay the payee: ${peso(out.result.net_payment)}`} />}
          steps={out.steps}
          rulesUsed={out.rules_used}
          warnings={out.warnings}
        />
      )}
    </div>
  );
}
