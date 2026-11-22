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
import { ClientSwitcher } from "@/components/client-switcher";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { format, useLocale } from "@/lib/i18n";
import { useUserData } from "@/lib/user-data";

interface Option<V extends string> {
  value: V;
  label: string;
  hint?: string;
}

const TYPE_ORDER: TaxpayerType[] = ["employee", "self_employed", "mixed_income", "sole_proprietorship", "partnership", "corporation", "opc", "cooperative", "estate", "one_time"];

type StepId = "type" | "vat" | "itOption" | "employees" | "ewt" | "channel" | "fiscal" | "size" | "details" | "consent";

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


export function ProfileWizard() {
  const { activeClientId } = useUserData();
  return (
    <div className="mx-auto max-w-2xl">
      <ClientSwitcher />
      {/* Keyed by client so an unsaved draft never carries over to another client. */}
      <WizardForClient key={activeClientId} />
    </div>
  );
}

function WizardForClient() {
  const { data, saveProfile } = useUserData();
  const { locale, t } = useLocale();
  const w = t.wizard;
  const router = useRouter();
  const TYPE_OPTIONS: Option<TaxpayerType>[] = TYPE_ORDER.map((v) => ({ value: v, label: w.types[v][0]!, hint: w.types[v][1] }));
  const YES_NO: Option<"yes" | "no">[] = [
    { value: "yes", label: w.yes },
    { value: "no", label: w.no },
  ];
  const MONTHS = Array.from({ length: 12 }, (_, i) =>
    new Date(Date.UTC(2000, i, 1)).toLocaleDateString(locale === "fil" ? "fil-PH" : "en-PH", { month: "long", timeZone: "UTC" }),
  );
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
      setError(w.consentRequired);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveProfile(draft);
      router.push("/profile/summary");
    } catch (e) {
      setError(format(w.saveFailed, { error: (e as Error).message }));
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title={w.title}
        description={w.description}
      />
      <div className="mb-4 flex items-center justify-between text-sm text-muted-foreground">
        <span>{format(w.step, { n: idx + 1, total: steps.length })}</span>
        {data.profile && (
          <Link href="/profile/summary" className="underline">
            {w.viewSummary}
          </Link>
        )}
      </div>
      <div
        className="mb-6 h-1.5 w-full rounded-[1px] bg-muted"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={steps.length}
        aria-valuenow={idx + 1}
        aria-label={w.progress}
      >
        <div className="h-1.5 rounded-[1px] bg-primary transition-all" style={{ width: `${((idx + 1) / steps.length) * 100}%` }} />
      </div>
      <Card>
        <CardContent className="space-y-5 pt-5">
          {step === "type" && (
            <RadioGroup name="taxpayer_type" legend={w.qType} options={TYPE_OPTIONS} value={draft.taxpayer_type} onChange={(v) => set("taxpayer_type", v)} />
          )}
          {step === "vat" && (
            <RadioGroup
              name="vat_status"
              legend={w.qVat}
              options={[
                { value: "non_vat", label: w.vat.non_vat },
                { value: "vat", label: w.vat.vat },
                { value: "not_sure", label: w.vat.not_sure },
              ]}
              value={draft.vat_status}
              onChange={(v) => set("vat_status", v)}
            />
          )}
          {step === "itOption" && (
            <RadioGroup
              name="income_tax_option"
              legend={w.qItOption}
              options={[
                { value: "eight_percent", label: w.itOption.eight_percent },
                { value: "graduated_osd", label: w.itOption.graduated_osd },
                { value: "graduated_itemized", label: w.itOption.graduated_itemized },
                { value: "not_sure", label: w.itOption.not_sure },
              ]}
              value={draft.income_tax_option}
              onChange={(v) => set("income_tax_option", v)}
            />
          )}
          {step === "employees" && (
            <RadioGroup name="has_employees" legend={w.qEmployees} options={YES_NO} value={draft.has_employees ? "yes" : "no"} onChange={(v) => set("has_employees", v === "yes")} />
          )}
          {step === "ewt" && (
            <RadioGroup
              name="withholds_expanded"
              legend={w.qEwt}
              options={YES_NO}
              value={draft.withholds_expanded ? "yes" : "no"}
              onChange={(v) => set("withholds_expanded", v === "yes")}
            />
          )}
          {step === "channel" && (
            <div className="space-y-4">
              <RadioGroup
                name="filing_channel"
                legend={w.qChannel}
                options={[
                  { value: "ebirforms", label: w.channel.ebirforms },
                  { value: "efps", label: w.channel.efps },
                  { value: "not_sure", label: w.channel.not_sure },
                ]}
                value={draft.filing_channel}
                onChange={(v) => set("filing_channel", v)}
              />
              {draft.filing_channel === "efps" && (
                <div className="space-y-2">
                  <Label htmlFor="efps_group">{w.efpsGroup}</Label>
                  <Select id="efps_group" value={draft.efps_group ?? ""} onChange={(e) => set("efps_group", (e.target.value || null) as Profile["efps_group"])}>
                    <option value="">{w.selectGroup}</option>
                    {(["A", "B", "C", "D", "E"] as const).map((g) => (
                      <option key={g} value={g}>
                        {format(w.group, { g })}
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
                {w.qFiscal}
              </Label>
              <Select id="fy" value={draft.fiscal_year_end_month} onChange={(e) => set("fiscal_year_end_month", Number(e.target.value))}>
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                    {i === 11 ? w.calendarYear : ""}
                  </option>
                ))}
              </Select>
            </div>
          )}
          {step === "size" && (
            <RadioGroup
              name="taxpayer_size"
              legend={w.qSize}
              options={[
                { value: "micro", label: w.size.micro },
                { value: "small", label: w.size.small },
                { value: "medium", label: w.size.medium },
                { value: "large", label: w.size.large },
                { value: "not_sure", label: w.size.not_sure },
              ]}
              value={draft.taxpayer_size}
              onChange={(v) => set("taxpayer_size", v)}
            />
          )}
          {step === "details" && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">{w.detailsTitle}</h2>
              <div className="space-y-2">
                <Label htmlFor="rdo">{w.rdo}</Label>
                <Input id="rdo" inputMode="numeric" maxLength={4} placeholder={w.rdoPlaceholder} value={draft.rdo_code ?? ""} onChange={(e) => set("rdo_code", e.target.value.trim() || null)} />
              </div>
              {hasBusiness(draft.taxpayer_type) && (
                <div className="space-y-2">
                  <Label htmlFor="lob">{w.lob}</Label>
                  <Input id="lob" maxLength={100} placeholder={w.lobPlaceholder} value={draft.line_of_business ?? ""} onChange={(e) => set("line_of_business", e.target.value || null)} />
                </div>
              )}
              <p className="text-sm text-muted-foreground">{w.noTin}</p>
            </div>
          )}
          {step === "consent" && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">{w.saveTitle}</h2>
              <label className="flex items-start gap-3">
                <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1 accent-[var(--color-primary)]" />
                <span className="text-sm">
                  {w.consentBefore}{" "}
                  <Link href="/privacy" className="underline" target="_blank">
                    {w.consentLink}
                  </Link>{" "}
                  {w.consentAfter}
                </span>
              </label>
            </div>
          )}

          <details className="rounded-md bg-muted p-3 text-sm">
            <summary className="cursor-pointer font-medium">{w.notSure}</summary>
            <p className="mt-2 text-muted-foreground">{w.help[step]}</p>
          </details>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="flex justify-between gap-3">
            <Button variant="outline" onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0}>
              {w.back}
            </Button>
            {isLast ? (
              <Button onClick={finish} disabled={saving}>
                {saving ? w.saving : w.save}
              </Button>
            ) : (
              <Button onClick={() => setIdx((i) => Math.min(steps.length - 1, i + 1))}>{w.next}</Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
