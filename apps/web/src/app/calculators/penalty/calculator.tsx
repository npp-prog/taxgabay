"use client";

import { computePenalty, forms, peso, type CalcResult, type PenaltyInput, type PenaltyResult } from "@taxgabay/tax-engine";
import * as React from "react";
import { CalcError, CalcResultPanel, isAmount } from "@/components/calc-result";
import { MoneyField } from "@/components/money-field";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { useUserData } from "@/lib/user-data";
import { rules } from "@/lib/rules";
import { todayPH } from "@/lib/utils";

export function PenaltyCalculator() {
  const { data } = useUserData();
  const [form, setForm] = React.useState("");
  const [due, setDue] = React.useState("");
  const [paid, setPaid] = React.useState(todayPH());
  const [basic, setBasic] = React.useState("");
  const profileSize = data.profile?.taxpayer_size;
  const [sizeOverride, setSize] = React.useState<PenaltyInput["taxpayer_size"] | null>(null);
  const size = sizeOverride ?? (profileSize && profileSize !== "not_sure" ? profileSize : "micro");
  const [lateFiling, setLateFiling] = React.useState(true);
  const [latePayment, setLatePayment] = React.useState(true);
  const [willful, setWillful] = React.useState(false);
  const [compromise, setCompromise] = React.useState(true);
  const [out, setOut] = React.useState<CalcResult<PenaltyResult> | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  function compute(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!due || !paid) return setError("Enter the original due date and the payment date.");
    if (!basic.trim() || !isAmount(basic)) return setError("Enter the basic tax due.");
    if (paid < due) return setError("The payment date is before the due date — no penalty applies.");
    try {
      setOut(
        computePenalty(
          {
            form_code: form || undefined,
            due_date: due,
            payment_date: paid,
            basic_tax_due: basic,
            taxpayer_size: size,
            late_filing: lateFiling,
            late_payment: latePayment,
            willful,
            include_compromise: compromise,
          },
          rules,
        ),
      );
    } catch (err) {
      setOut(null);
      setError((err as Error).message);
    }
  }

  const check = (id: string, label: string, v: boolean, set: (b: boolean) => void) => (
    <label htmlFor={id} className="flex items-center gap-2 text-sm">
      <input id={id} type="checkbox" checked={v} onChange={(e) => set(e.target.checked)} className="h-4 w-4 accent-[var(--color-primary)]" />
      {label}
    </label>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Late filing and payment penalties"
        description="Surcharge, interest and the suggested compromise penalty, with reduced rates for micro and small taxpayers under the Ease of Paying Taxes Act."
      />
      <Card>
        <CardContent className="pt-5">
          <form onSubmit={compute} className="grid gap-4 sm:grid-cols-2" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="pen-form">Form (optional)</Label>
              <Select id="pen-form" value={form} onChange={(e) => setForm(e.target.value)}>
                <option value="">—</option>
                {forms
                  .filter((f) => f.frequency !== "one_time")
                  .map((f) => (
                    <option key={f.code} value={f.code}>
                      {f.code}
                    </option>
                  ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pen-size">Taxpayer size</Label>
              <Select id="pen-size" value={size} onChange={(e) => setSize(e.target.value as PenaltyInput["taxpayer_size"])}>
                <option value="micro">Micro (gross sales below ₱3M)</option>
                <option value="small">Small (₱3M to below ₱20M)</option>
                <option value="medium">Medium (₱20M to below ₱1B)</option>
                <option value="large">Large (₱1B and up)</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pen-due">Original due date</Label>
              <Input id="pen-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pen-paid">Actual or planned payment date</Label>
              <Input id="pen-paid" type="date" value={paid} onChange={(e) => setPaid(e.target.value)} />
            </div>
            <MoneyField id="pen-basic" label="Basic tax due" value={basic} onChange={setBasic} />
            <fieldset className="space-y-2">
              <legend className="mb-1 text-sm font-medium">What happened?</legend>
              {check("pen-lf", "Return filed late (or not yet filed)", lateFiling, setLateFiling)}
              {check("pen-lp", "Tax paid late (or not yet paid)", latePayment, setLatePayment)}
              {check("pen-w", "Willful neglect or false/fraudulent return (50% surcharge)", willful, setWillful)}
              {check("pen-c", "Include suggested compromise penalty", compromise, setCompromise)}
            </fieldset>
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
              <span className="block text-sm">
                Total amount due ({out.result.days_late} day{out.result.days_late === 1 ? "" : "s"} late)
              </span>
              <span className="text-2xl font-bold" data-testid="headline-amount">
                {peso(out.result.total_amount_due)}
              </span>
              <span className="block text-sm">Penalties: {peso(out.result.total_penalties)}</span>
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
