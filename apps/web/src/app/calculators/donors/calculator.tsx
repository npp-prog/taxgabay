"use client";

import { computeDonorsTax, peso, type CalcResult, type DonorsTaxResult } from "@taxgabay/tax-engine";
import * as React from "react";
import { CalcError, CalcResultPanel, isAmount, pdfMoney } from "@/components/calc-result";
import { MoneyField } from "@/components/money-field";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { rules } from "@/lib/rules";
import { todayPH } from "@/lib/utils";
import { DateField, Headline } from "../_shared";

export function DonorsCalculator() {
  const [date, setDate] = React.useState(todayPH());
  const [gift, setGift] = React.useState("");
  const [prior, setPrior] = React.useState("");
  const [paid, setPaid] = React.useState("");
  const [out, setOut] = React.useState<CalcResult<DonorsTaxResult> | null>(null);
  const [pdfInputs, setPdfInputs] = React.useState<[string, string][]>([]);
  const [error, setError] = React.useState<string | null>(null);

  function compute(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!date) return setError("Enter the date of the gift.");
    if (!gift.trim() || ![gift, prior, paid].every(isAmount)) return setError("Enter the value of this gift and check the amounts.");
    try {
      setPdfInputs([["Date of the gift", date], ["Value of this gift", pdfMoney(gift)], ["Earlier gifts this year", pdfMoney(prior)], ["Donor's tax already paid this year", pdfMoney(paid)]]);
      setOut(computeDonorsTax({ date_of_gift: date, gift_amount: gift, prior_gifts_this_year: prior || "0", prior_tax_paid_this_year: paid || "0" }, rules));
    } catch (err) {
      setOut(null);
      setError((err as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Donor's tax"
        description="Tax on gifts. It is computed on all your gifts in the calendar year combined, so enter earlier gifts this year and the donor's tax you already paid on them."
      />
      <Card>
        <CardContent className="pt-5">
          <form onSubmit={compute} className="grid gap-4 sm:grid-cols-2" noValidate>
            <DateField id="don-date" label="Date of the gift" value={date} onChange={setDate} />
            <MoneyField id="don-gift" label="Value of this gift" value={gift} onChange={setGift} hint="Fair market value, net of exempt gifts" />
            <MoneyField id="don-prior" label="Earlier gifts this year" value={prior} onChange={setPrior} />
            <MoneyField id="don-paid" label="Donor's tax already paid this year" value={paid} onChange={setPaid} />
            <div className="sm:col-span-2">
              <Button type="submit">Compute</Button>
            </div>
          </form>
        </CardContent>
      </Card>
      {error && <CalcError message={error} />}
      {out && (
        <CalcResultPanel
          pdfTitle={"Donor's tax"}
          pdfHeadline={`Donor's tax due: ${peso(out.result.donors_tax_due)}`}
          pdfInputs={pdfInputs}
          headline={<Headline label="Donor's tax due" amount={peso(out.result.donors_tax_due)} extra={`Total gifts this year: ${peso(out.result.total_gifts_this_year)}`} />}
          steps={out.steps}
          rulesUsed={out.rules_used}
          warnings={out.warnings}
        />
      )}
    </div>
  );
}
