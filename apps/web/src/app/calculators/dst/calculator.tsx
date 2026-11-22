"use client";

import { computeDst, peso, type CalcResult, type DstResult, type DstTransaction } from "@taxgabay/tax-engine";
import * as React from "react";
import { CalcError, CalcResultPanel, isAmount } from "@/components/calc-result";
import { MoneyField } from "@/components/money-field";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { rules } from "@/lib/rules";
import { todayPH } from "@/lib/utils";
import { DateField, Headline } from "../_shared";

const AMOUNT_LABEL: Record<DstTransaction, string> = {
  sale_real_property: "Selling price (consideration)",
  original_issue_shares: "Par value of shares issued",
  debt_instrument: "Loan amount / issue price",
};

export function DstCalculator() {
  const [tx, setTx] = React.useState<DstTransaction>("sale_real_property");
  const [date, setDate] = React.useState(todayPH());
  const [amount, setAmount] = React.useState("");
  const [fmv, setFmv] = React.useState("");
  const [term, setTerm] = React.useState("");
  const [out, setOut] = React.useState<CalcResult<DstResult> | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  function compute(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!date) return setError("Enter the date.");
    if (!amount.trim() || ![amount, fmv].every(isAmount)) return setError("Enter the amount and check the values.");
    if (term.trim() && !/^\d+$/.test(term.trim())) return setError("Enter the term as a whole number of days.");
    try {
      setOut(
        computeDst(
          {
            transaction: tx,
            date,
            amount,
            fair_market_value: tx === "sale_real_property" ? fmv || "0" : undefined,
            term_days: tx === "debt_instrument" && term.trim() ? Number(term) : undefined,
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
        title="Documentary stamp tax (DST)"
        description="Tax on documents such as deeds of sale, share certificates and loan agreements. It is charged per fixed unit of value, and any fraction of a unit counts as a whole unit."
      />
      <Card>
        <CardContent className="pt-5">
          <form onSubmit={compute} className="grid gap-4 sm:grid-cols-2" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="dst-tx">Transaction</Label>
              <Select
                id="dst-tx"
                value={tx}
                onChange={(e) => {
                  setTx(e.target.value as DstTransaction);
                  setOut(null);
                }}
              >
                <option value="sale_real_property">Sale of real property</option>
                <option value="original_issue_shares">Original issue of shares</option>
                <option value="debt_instrument">Loan or other debt instrument</option>
              </Select>
            </div>
            <DateField id="dst-date" label="Date of the document" value={date} onChange={setDate} />
            <MoneyField id="dst-amount" label={AMOUNT_LABEL[tx]} value={amount} onChange={setAmount} />
            {tx === "sale_real_property" && (
              <MoneyField id="dst-fmv" label="Fair market value" value={fmv} onChange={setFmv} hint="Higher of the BIR zonal value and the assessor's value" />
            )}
            {tx === "debt_instrument" && (
              <div className="space-y-1.5">
                <Label htmlFor="dst-term">Term in days (optional)</Label>
                <Input id="dst-term" inputMode="numeric" value={term} onChange={(e) => setTerm(e.target.value)} />
                <p className="text-xs text-muted-foreground">Only if the term is less than one year; the tax is pro-rated.</p>
              </div>
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
          headline={<Headline label="Documentary stamp tax due" amount={peso(out.result.dst)} extra={`Tax base: ${peso(out.result.tax_base)}`} />}
          steps={out.steps}
          rulesUsed={out.rules_used}
          warnings={out.warnings}
        />
      )}
    </div>
  );
}
