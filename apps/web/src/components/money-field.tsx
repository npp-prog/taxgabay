"use client";

import { Input, Label } from "@/components/ui/input";
import { isAmount } from "@/components/calc-result";

export function MoneyField({
  id,
  label,
  value,
  onChange,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  const invalid = !isAmount(value);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₱</span>
        <Input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          className="pl-7"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={invalid}
          aria-describedby={hint || invalid ? `${id}-hint` : undefined}
        />
      </div>
      {(hint || invalid) && (
        <p id={`${id}-hint`} className={invalid ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
          {invalid ? "Enter an amount like 250000 or 250,000.50" : hint}
        </p>
      )}
    </div>
  );
}
