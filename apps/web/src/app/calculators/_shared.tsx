"use client";

import { Input, Label } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function Tabs<T extends string>({ label, tabs, value, onChange }: { label: string; tabs: readonly (readonly [T, string])[]; value: T; onChange: (v: T) => void }) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex rounded-md border border-border p-1">
      {tabs.map(([v, text]) => (
        <button
          key={v}
          type="button"
          role="tab"
          aria-selected={value === v}
          onClick={() => onChange(v)}
          className={cn("rounded px-3 py-1.5 text-sm", value === v ? "bg-primary text-primary-foreground" : "hover:bg-muted")}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

export function DateField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type="date" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export function Checkbox({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label htmlFor={id} className="flex items-center gap-2 text-sm">
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-[var(--color-primary)]" />
      {label}
    </label>
  );
}

export function Headline({ label, amount, extra }: { label: string; amount: string; extra?: React.ReactNode }) {
  return (
    <p>
      <span className="block text-sm">{label}</span>
      <span className="text-2xl font-bold" data-testid="headline-amount">
        {amount}
      </span>
      {extra && <span className="block text-sm">{extra}</span>}
    </p>
  );
}

export function yearsSince2018(thisYear: number): number[] {
  return Array.from({ length: thisYear - 2018 + 1 }, (_, i) => thisYear - i);
}
