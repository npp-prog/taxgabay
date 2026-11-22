"use client";

import {
  DEFAULT_PROFILE,
  hasBusiness,
  isIndividual,
  type Profile,
  type TaxpayerType,
} from "@taxgabay/tax-engine";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { useUserData } from "@/lib/user-data";

interface Option<V extends string> {
  value: V;
  label: string;
  hint?: string;
}

const TYPE_OPTIONS: Option<TaxpayerType>[] = [
  { value: "employee", label: "Employee only", hint: "I only earn a salary from an employer." },
  { value: "self_employed", label: "Self-employed or professional", hint: "Freelancer, doctor, lawyer, CPA, consultant, content creator…" },
  { value: "mixed_income", label: "Employee with a side business or profession", hint: "Salary plus business or professional income (mixed income)." },
  { value: "sole_proprietorship", label: "Sole proprietor", hint: "I own a business registered (or to be registered) with the DTI." },
  { value: "partnership", label: "Partnership", hint: "Registered with the SEC as a partnership." },
  { value: "corporation", label: "Corporation", hint: "Registered with the SEC as a stock or non-stock corporation." },
  { value: "opc", label: "One Person Corporation (OPC)", hint: "SEC-registered corporation with a single stockholder." },
  { value: "cooperative", label: "Cooperative", hint: "Registered with the Cooperative Development Authority (CDA)." },
  { value: "estate", label: "Heir or estate administrator", hint: "Settling the estate of someone who passed away." },
  { value: "one_time", label: "One-time transaction", hint: "Selling property, donating, or selling shares." },
];

type StepId = "type" | "vat" | "itOption" | "employees" | "ewt" | "channel" | "fiscal" | "size" | "details" | "consent";

const HELP: Record<StepId, string> = {
  type: "Pick the one that describes most of your income. If you are an employee who also freelances, choose \"Employee with a side business\". You can change this later.",
  vat: "Look at your BIR Certificate of Registration (Form 2303) under \"Tax types\": it lists either Value-Added Tax or Percentage Tax. If your gross sales go above ₱3,000,000 a year you must register for VAT (threshold to be verified). Not registered yet? Choose \"Not sure\".",
  itOption: "Graduated rates tax your net income at 0–35%. You either deduct 40% of gross sales automatically (OSD) or deduct actual expenses with receipts (itemized). The 8% option taxes gross sales above ₱250,000 at 8% and replaces percentage tax — only for non-VAT taxpayers with gross sales up to ₱3M. Not sure? Use the income tax calculator to compare.",
  employees: "Choose Yes if you pay anyone a salary or wage, even part-time. Employers withhold tax from compensation and file monthly (1601C) and annual (1604C) returns.",
  ewt: "Businesses that pay rent, professional fees (lawyers, accountants, consultants), or certain contractors usually must withhold expanded withholding tax and file 0619E, 1601EQ and 1604E. If you are unsure, check your COR for \"Withholding Tax – Expanded\".",
  channel: "eBIRForms is the free downloadable or online filing system most small taxpayers use. eFPS is required for certain taxpayers (e.g. large taxpayers, top withholding agents); your RDO would have told you and assigned an industry group (A–E).",
  fiscal: "Most businesses use the calendar year (ending December). Corporations may use a fiscal year ending in another month — check your articles of incorporation or your COR.",
  size: "Under the Ease of Paying Taxes Act, taxpayers are grouped by gross sales: micro (below ₱3M), small (₱3M to below ₱20M), medium (₱20M to below ₱1B) and large (₱1B and up) — to be verified. Micro and small taxpayers get lower penalties.",
  details: "Your RDO (Revenue District Office) code is on your COR. Both fields are optional and help us show the right local office later.",
  consent: "We only store what you entered here. Without an account it stays in this browser. If you sign in, it is saved to your account so you can use it on other devices; you can delete it anytime.",
};

function stepsFor(p: Profile): StepId[] {
  const s: StepId[] = ["type"];
  const business = hasBusiness(p.taxpayer_type);
  const individual = isIndividual(p.taxpayer_type);
  if (business) {
    s.push("vat");
    if (individual) s.push("itOption");
    s.push("employees", "ewt", "channel");
    if (!individual) s.push("fiscal");
    s.push("size");
  }
  s.push("details", "consent");
  return s;
}

function RadioGroup<V extends string>({
  name,
  legend,
  options,
  value,
  onChange,
}: {
  name: string;
  legend: string;
  options: Option<V>[];
  value: V | null;
  onChange: (v: V) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-3 text-lg font-semibold">{legend}</legend>
      <div className="grid gap-2">
        {options.map((o) => (
          <label
            key={o.value}
            className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 hover:bg-muted has-[:checked]:border-primary has-[:checked]:bg-secondary"
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="mt-1 accent-[var(--color-primary)]"
            />
            <span>
              <span className="font-medium">{o.label}</span>
              {o.hint && <span className="block text-sm text-muted-foreground">{o.hint}</span>}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

const YES_NO: Option<"yes" | "no">[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function ProfileWizard() {
  const { data, saveProfile } = useUserData();
  const router = useRouter();
  // Until the user edits, show the saved profile (or defaults).
  const [edited, setEdited] = React.useState<Profile | null>(null);
  const draft = edited ?? data.profile ?? DEFAULT_PROFILE;
  const [idx, setIdx] = React.useState(0);
  const [agreedOverride, setAgreed] = React.useState<boolean | null>(null);
  const agreed = agreedOverride ?? Boolean(data.consentAt);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const steps = stepsFor(draft);
  const step = steps[Math.min(idx, steps.length - 1)]!;
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setEdited({ ...draft, [k]: v });
  const isLast = idx >= steps.length - 1;

  async function finish() {
    if (!agreed) {
      setError("Please agree to the privacy notice to save your profile.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveProfile(draft);
      router.push("/profile/summary");
    } catch (e) {
      setError(`Could not save your profile: ${(e as Error).message}`);
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Your taxpayer profile"
        description="A few questions so we can show only what applies to you. Every question has a “Not sure?” explanation."
      />
      <div className="mb-4 flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Step {idx + 1} of {steps.length}
        </span>
        {data.profile && (
          <Link href="/profile/summary" className="underline">
            View my current summary
          </Link>
        )}
      </div>
      <div
        className="mb-6 h-2 w-full rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={steps.length}
        aria-valuenow={idx + 1}
        aria-label="Profile progress"
      >
        <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${((idx + 1) / steps.length) * 100}%` }} />
      </div>
      <Card>
        <CardContent className="space-y-5 pt-5">
          {step === "type" && (
            <RadioGroup name="taxpayer_type" legend="Which best describes you?" options={TYPE_OPTIONS} value={draft.taxpayer_type} onChange={(v) => set("taxpayer_type", v)} />
          )}
          {step === "vat" && (
            <RadioGroup
              name="vat_status"
              legend="Are you VAT-registered?"
              options={[
                { value: "non_vat", label: "No — non-VAT (percentage tax)" },
                { value: "vat", label: "Yes — VAT-registered" },
                { value: "not_sure", label: "Not sure / not registered yet" },
              ]}
              value={draft.vat_status}
              onChange={(v) => set("vat_status", v)}
            />
          )}
          {step === "itOption" && (
            <RadioGroup
              name="income_tax_option"
              legend="Which income tax option do you use (or plan to use)?"
              options={[
                { value: "eight_percent", label: "8% on gross sales/receipts" },
                { value: "graduated_osd", label: "Graduated rates with 40% optional standard deduction (OSD)" },
                { value: "graduated_itemized", label: "Graduated rates with itemized deductions" },
                { value: "not_sure", label: "Not sure yet" },
              ]}
              value={draft.income_tax_option}
              onChange={(v) => set("income_tax_option", v)}
            />
          )}
          {step === "employees" && (
            <RadioGroup name="has_employees" legend="Do you have employees?" options={YES_NO} value={draft.has_employees ? "yes" : "no"} onChange={(v) => set("has_employees", v === "yes")} />
          )}
          {step === "ewt" && (
            <RadioGroup
              name="withholds_expanded"
              legend="Do you pay rent, professional fees or contractors and withhold tax from those payments?"
              options={YES_NO}
              value={draft.withholds_expanded ? "yes" : "no"}
              onChange={(v) => set("withholds_expanded", v === "yes")}
            />
          )}
          {step === "channel" && (
            <div className="space-y-4">
              <RadioGroup
                name="filing_channel"
                legend="How do you file your returns?"
                options={[
                  { value: "ebirforms", label: "eBIRForms" },
                  { value: "efps", label: "eFPS" },
                  { value: "not_sure", label: "Not sure" },
                ]}
                value={draft.filing_channel}
                onChange={(v) => set("filing_channel", v)}
              />
              {draft.filing_channel === "efps" && (
                <div className="space-y-2">
                  <Label htmlFor="efps_group">eFPS industry group</Label>
                  <Select id="efps_group" value={draft.efps_group ?? ""} onChange={(e) => set("efps_group", (e.target.value || null) as Profile["efps_group"])}>
                    <option value="">Select group</option>
                    {(["A", "B", "C", "D", "E"] as const).map((g) => (
                      <option key={g} value={g}>
                        Group {g}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
            </div>
          )}
          {step === "fiscal" && (
            <div className="space-y-2">
              <Label htmlFor="fy" className="text-lg font-semibold">
                In which month does your taxable year end?
              </Label>
              <Select id="fy" value={draft.fiscal_year_end_month} onChange={(e) => set("fiscal_year_end_month", Number(e.target.value))}>
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                    {i === 11 ? " (calendar year)" : ""}
                  </option>
                ))}
              </Select>
            </div>
          )}
          {step === "size" && (
            <RadioGroup
              name="taxpayer_size"
              legend="What are your expected gross annual sales?"
              options={[
                { value: "micro", label: "Below ₱3 million (micro)" },
                { value: "small", label: "₱3 million to below ₱20 million (small)" },
                { value: "medium", label: "₱20 million to below ₱1 billion (medium)" },
                { value: "large", label: "₱1 billion or more (large)" },
                { value: "not_sure", label: "Not sure" },
              ]}
              value={draft.taxpayer_size}
              onChange={(v) => set("taxpayer_size", v)}
            />
          )}
          {step === "details" && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">A few optional details</h2>
              <div className="space-y-2">
                <Label htmlFor="rdo">RDO code (optional)</Label>
                <Input id="rdo" inputMode="numeric" maxLength={4} placeholder="e.g. 044" value={draft.rdo_code ?? ""} onChange={(e) => set("rdo_code", e.target.value.trim() || null)} />
              </div>
              {hasBusiness(draft.taxpayer_type) && (
                <div className="space-y-2">
                  <Label htmlFor="lob">Line of business (optional)</Label>
                  <Input id="lob" maxLength={100} placeholder="e.g. sari-sari store, web design" value={draft.line_of_business ?? ""} onChange={(e) => set("line_of_business", e.target.value || null)} />
                </div>
              )}
              <p className="text-sm text-muted-foreground">We never ask for your TIN.</p>
            </div>
          )}
          {step === "consent" && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Save your profile</h2>
              <label className="flex items-start gap-3">
                <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1 accent-[var(--color-primary)]" />
                <span className="text-sm">
                  I have read the{" "}
                  <Link href="/privacy" className="underline" target="_blank">
                    privacy notice
                  </Link>{" "}
                  and agree to TaxGabay storing my answers to personalize my obligations (Data Privacy Act, RA 10173).
                </span>
              </label>
            </div>
          )}

          <details className="rounded-md bg-muted p-3 text-sm">
            <summary className="cursor-pointer font-medium">Not sure?</summary>
            <p className="mt-2 text-muted-foreground">{HELP[step]}</p>
          </details>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="flex justify-between gap-3">
            <Button variant="outline" onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0}>
              Back
            </Button>
            {isLast ? (
              <Button onClick={finish} disabled={saving}>
                {saving ? "Saving…" : "Save and see what applies to me"}
              </Button>
            ) : (
              <Button onClick={() => setIdx((i) => Math.min(steps.length - 1, i + 1))}>Next</Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
