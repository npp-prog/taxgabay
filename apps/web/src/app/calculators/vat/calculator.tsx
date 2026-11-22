"use client";

import { computeVat, endOfMonth, peso, type CalcResult, type VatResult } from "@taxgabay/tax-engine";
import * as React from "react";
import { CalcError, CalcResultPanel, isAmount } from "@/components/calc-result";
import { MoneyField } from "@/components/money-field";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label, Select } from "@/components/ui/input";
import { rules } from "@/lib/rules";
import { todayPH } from "@/lib/utils";

export function VatCalculator() {
  const today = todayPH();
  const thisYear = Number(today.slice(0, 4));
  const [year, setYear] = React.useState(thisYear);
  const [quarter, setQuarter] = React.useState(Math.ceil(Number(today.slice(5, 7)) / 3));
  const [sales, setSales] = React.useState("");
  const [salesIncl, setSalesIncl] = React.useState(true);
  const [purchases, setPurchases] = React.useState("");
  const [purchIncl, setPurchIncl] = React.useState(true);
  const [carry, setCarry] = React.useState("");
  const [out, setOut] = React.useState<CalcResult<VatResult> | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  function compute(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (![sales, purchases, carry].every(isAmount) || !sales.trim()) {
      setError("Enter your vatable sales and check the amounts.");
      return;
    }
    try {
      setOut(
        computeVat(
          {
            period_end: endOfMonth(year, quarter * 3),
            vatable_sales: sales,
            sales_vat_inclusive: salesIncl,
            vatable_purchases: purchases || "0",
            purchases_vat_inclusive: purchIncl,
            input_tax_carried_over: carry || "0",
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
  return (
    <div className="space-y-6">
      <PageHeader title="Quarterly VAT" description="Output VAT on your sales less input VAT on your purchases (BIR Form 2550Q)." />
      <Card>
        <CardContent className="pt-5">
          <form onSubmit={compute} className="grid gap-4 sm:grid-cols-2" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="vat-year">Year</Label>
              <Select id="vat-year" value={year} onChange={(e) => setYear(Number(e.target.value))}>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vat-quarter">Quarter</Label>
              <Select id="vat-quarter" value={quarter} onChange={(e) => setQuarter(Number(e.target.value))}>
                <option value={1}>Q1</option>
                <option value={2}>Q2</option>
                <option value={3}>Q3</option>
                <option value={4}>Q4</option>
              </Select>
            </div>
            <div className="space-y-2">
              <MoneyField id="vat-sales" label="Vatable sales" value={sales} onChange={setSales} />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={salesIncl} onChange={(e) => setSalesIncl(e.target.checked)} className="h-4 w-4 accent-[var(--color-primary)]" />
                Amount already includes VAT
              </label>
            </div>
            <div className="space-y-2">
              <MoneyField id="vat-purchases" label="Vatable purchases" value={purchases} onChange={setPurchases} />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={purchIncl} onChange={(e) => setPurchIncl(e.target.checked)} className="h-4 w-4 accent-[var(--color-primary)]" />
                Amount already includes VAT
              </label>
            </div>
            <MoneyField id="vat-carry" label="Excess input VAT from last quarter (optional)" value={carry} onChange={setCarry} />
            <div className="sm:col-span-2">
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
              <span className="block text-sm">{out.result.vat_payable !== "0.00" ? "VAT payable" : "Excess input VAT to carry forward"}</span>
              <span className="text-2xl font-bold" data-testid="headline-amount">
                {peso(out.result.vat_payable !== "0.00" ? out.result.vat_payable : out.result.excess_input_carried_forward)}
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
