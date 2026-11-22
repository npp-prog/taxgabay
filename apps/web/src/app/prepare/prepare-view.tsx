"use client";

import { preparePacket, type ClientRecord, type ExpenseCategory, type PreparedDocument, type QuarterRef } from "@taxgabay/filing";
import { peso, type IncomeTaxOption, type TaxpayerType } from "@taxgabay/tax-engine";
import * as React from "react";
import { Disclaimer } from "@/components/disclaimer";
import { PageHeader } from "@/components/page-header";
import { PdfButton } from "@/components/pdf-button";
import { StepsTable } from "@/components/steps-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { packetPdf, REVIEWER } from "@/lib/prepare-pdf";
import { CATEGORIES, importCsv, templateCsv, TEMPLATES, type TemplateKind } from "@/lib/prepare-csv";
import { usePrepare } from "@/lib/prepare-store";
import { cn, formatDatePH, todayPH } from "@/lib/utils";

const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `r${Date.now()}${Math.random().toString(36).slice(2)}`);
const input = "h-10 w-full rounded-sm border border-input bg-card px-3 text-sm focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30";
const label = "mb-1 block text-sm font-medium";

const TABS: { kind: TemplateKind; label: string }[] = [
  { kind: "sale", label: "Sales" },
  { kind: "expense", label: "Expenses" },
  { kind: "form_2307_received", label: "2307s received" },
];

const EXAMPLE: ClientRecord[] = [
  { kind: "sale", id: "x1", date: "2026-01-10", document_no: "SI-0001", customer: { name: "Kape Co., Inc." }, amount: "30000.00" },
  { kind: "sale", id: "x2", date: "2026-02-12", document_no: "SI-0002", customer: { name: "Kape Co., Inc." }, amount: "40000.00" },
  { kind: "sale", id: "x3", date: "2026-03-05", document_no: "SI-0003", customer: { name: "Bright Corp." }, amount: "50000.00" },
  { kind: "expense", id: "x4", date: "2026-01-31", supplier: { name: "Jose Cruz" }, category: "rent", amount: "10000.00", withholding: { atc: "WI100" } },
  { kind: "expense", id: "x5", date: "2026-02-28", supplier: { name: "Jose Cruz" }, category: "rent", amount: "10000.00", withholding: { atc: "WI100" } },
  { kind: "expense", id: "x6", date: "2026-03-31", supplier: { name: "Jose Cruz" }, category: "rent", amount: "10000.00", withholding: { atc: "WI100" } },
  { kind: "form_2307_received", id: "x7", date: "2026-04-05", payor: { name: "Kape Co., Inc." }, period_from: "2026-01-01", period_to: "2026-03-31", atc: "WI010", income_payment: "70000.00", tax_withheld: "3500.00" },
];

function download(name: string, text: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function PrepareView() {
  const { state, update, reset } = usePrepare();
  const { client, records, tinConsent } = state;
  const [period, setPeriod] = React.useState<QuarterRef>({ year: 2026, quarter: 1 });
  const [tab, setTab] = React.useState<TemplateKind>("sale");
  const [importMsg, setImportMsg] = React.useState<{ ok: number; errors: string[] } | null>(null);

  const packet = React.useMemo(() => preparePacket({ client, records, period }), [client, records, period]);
  const setProfile = (patch: Partial<typeof client.profile>) => update((s) => ({ ...s, client: { ...s.client, profile: { ...s.client.profile, ...patch } } }));
  const addRecord = (r: ClientRecord) => update((s) => ({ ...s, records: [...s.records, r] }));
  const removeRecord = (id: string) => update((s) => ({ ...s, records: s.records.filter((r) => r.id !== id) }));
  const shown = records.filter((r) => r.kind === tab).sort((a, b) => a.date.localeCompare(b.date));

  async function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const r = importCsv(tab, await file.text(), newId);
    if (r.records.length) update((s) => ({ ...s, records: [...s.records, ...r.records] }));
    setImportMsg({ ok: r.records.length, errors: r.errors });
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Document preparation"
        title="Prepare my BIR documents"
        description="Enter your sales, expenses and the Forms 2307 your customers gave you. TaxGabay checks them and prepares your returns, schedules and certificates for the quarter. You review, sign and file them yourself."
      />

      <div className="rounded-lg border border-sun bg-sun-soft p-4 text-sm leading-relaxed text-sun-foreground dark:text-sun">
        <strong>For now, everything stays in this browser.</strong> Clients of {REVIEWER}&apos;s firm will get a secure account where records are saved and each packet is reviewed before release. This first version supports non-VAT self-employed individuals and sole proprietors.
      </div>

      {/* 1. Details */}
      <section className="form-box space-y-4 p-6" aria-labelledby="details-h">
        <h2 id="details-h" className="text-lg font-semibold">
          1 · Your details
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className={label} htmlFor="p-name">
              Registered name
            </label>
            <input id="p-name" className={input} value={client.name} onChange={(e) => update((s) => ({ ...s, client: { ...s.client, name: e.target.value } }))} placeholder="As shown on your Certificate of Registration" />
          </div>
          <div>
            <label className={label} htmlFor="p-tin">
              TIN <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <input id="p-tin" className={input} disabled={!tinConsent} value={client.tin ?? ""} onChange={(e) => update((s) => ({ ...s, client: { ...s.client, tin: e.target.value } }))} placeholder={tinConsent ? "000-000-000-000" : "Tick the consent box first"} />
          </div>
          <div>
            <label className={label} htmlFor="p-type">
              You are a
            </label>
            <select id="p-type" className={input} value={client.profile.taxpayer_type} onChange={(e) => setProfile({ taxpayer_type: e.target.value as TaxpayerType })}>
              <option value="self_employed">Self-employed professional or freelancer</option>
              <option value="sole_proprietorship">Sole proprietor (DTI-registered business)</option>
            </select>
          </div>
          <div>
            <label className={label} htmlFor="p-option">
              Income tax option chosen for the year
            </label>
            <select id="p-option" className={input} value={client.profile.income_tax_option} onChange={(e) => setProfile({ income_tax_option: e.target.value as IncomeTaxOption })}>
              <option value="eight_percent">8% on gross sales/receipts</option>
              <option value="graduated_osd">Graduated rates with 40% optional standard deduction</option>
              <option value="graduated_itemized">Graduated rates with itemized deductions</option>
            </select>
          </div>
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={client.profile.withholds_expanded} onChange={(e) => setProfile({ withholds_expanded: e.target.checked })} />I withhold tax when I pay rent, professional fees or contractors (I am a withholding agent).
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={tinConsent} onChange={(e) => update((s) => ({ ...s, tinConsent: e.target.checked }))} />I agree that TaxGabay may keep my TIN and my customers&apos; and suppliers&apos; TINs and print them on the prepared documents. Unticking this deletes them.
        </label>
      </section>

      {/* 2. Records */}
      <section className="form-box space-y-4 p-6" aria-labelledby="records-h">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="records-h" className="text-lg font-semibold">
            2 · Your records
          </h2>
          <div className="flex flex-wrap gap-2">
            {records.length === 0 && (
              <Button size="sm" variant="outline" onClick={() => update((s) => ({ ...s, client: { ...s.client, name: s.client.name || "Sample Freelancer", profile: { ...s.client.profile, income_tax_option: "eight_percent", withholds_expanded: true } }, records: EXAMPLE }))}>
                Load an example
              </Button>
            )}
            {records.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  if (window.confirm("Delete all records and details in this browser?")) reset();
                }}
              >
                Clear everything
              </Button>
            )}
          </div>
        </div>
        <div role="tablist" className="flex gap-1 border-b border-border">
          {TABS.map((t) => (
            <button key={t.kind} type="button" role="tab" aria-selected={tab === t.kind} onClick={() => setTab(t.kind)} className={cn("-mb-px border-b-2 px-3 py-2 text-sm font-medium", tab === t.kind ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
              {t.label} <span className="ml-1 text-xs text-muted-foreground">{records.filter((r) => r.kind === t.kind).length}</span>
            </button>
          ))}
        </div>

        <RecordForm kind={tab} tinConsent={tinConsent} onAdd={addRecord} />

        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="cursor-pointer rounded-full border border-border px-4 py-2 font-medium hover:bg-lavender">
            Import CSV
            <input type="file" accept=".csv,text/csv" className="sr-only" onChange={onImport} aria-label={`Import ${tab} CSV`} />
          </label>
          <button type="button" className="text-primary underline" onClick={() => download(TEMPLATES[tab].file, templateCsv(tab))}>
            Download the template
          </button>
          <span className="text-muted-foreground">Fill it in Excel or Google Sheets, save as CSV, then import.</span>
        </div>
        {importMsg && (
          <div role="status" className={cn("rounded-sm border p-3 text-sm", importMsg.errors.length ? "border-sun bg-sun-soft" : "border-success/40 bg-success/10")}>
            Imported {importMsg.ok} record{importMsg.ok === 1 ? "" : "s"}.
            {importMsg.errors.length > 0 && (
              <ul className="mt-1 list-disc pl-5">
                {importMsg.errors.slice(0, 8).map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-sm" data-testid="records-table">
            <thead className="border-b border-border text-left">
              <tr className="form-label">
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">{tab === "sale" ? "Invoice · customer" : tab === "expense" ? "Supplier · category" : "Customer who withheld"}</th>
                <th className="py-2 pr-3 text-right">{tab === "form_2307_received" ? "Income · tax withheld" : "Amount"}</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-muted-foreground">
                    Nothing recorded yet.
                  </td>
                </tr>
              )}
              {shown.map((r) => (
                <tr key={r.id} className="border-b border-border/70">
                  <td className="py-2 pr-3 font-mono text-xs">{formatDatePH(r.date)}</td>
                  <td className="py-2 pr-3">
                    {r.kind === "sale" && (
                      <>
                        <span className="font-mono text-xs text-muted-foreground">{r.document_no}</span> {r.customer.name}
                      </>
                    )}
                    {r.kind === "expense" && (
                      <>
                        {r.supplier.name} <span className="text-muted-foreground">· {CATEGORIES.find((c) => c.key === r.category)?.label}</span>
                        {r.withholding && <Badge variant="muted" className="ml-2">{r.withholding.atc}</Badge>}
                      </>
                    )}
                    {r.kind === "form_2307_received" && (
                      <>
                        {r.payor.name} <span className="text-muted-foreground">· {r.atc} · {formatDatePH(r.period_from, { month: "short", day: "numeric" })}–{formatDatePH(r.period_to)}</span>
                      </>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-right font-mono">{r.kind === "form_2307_received" ? `${peso(r.income_payment)} · ${peso(r.tax_withheld)}` : peso(r.amount)}</td>
                  <td className="py-2 text-right">
                    <button type="button" aria-label="Delete record" onClick={() => removeRecord(r.id)} className="h-8 w-8 rounded-full text-muted-foreground hover:bg-muted hover:text-destructive">
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 3. Packet */}
      <section className="space-y-4" aria-labelledby="packet-h">
        <div className="form-box flex flex-wrap items-end gap-4 p-6">
          <h2 id="packet-h" className="mr-auto text-lg font-semibold">
            3 · Your filing packet
          </h2>
          <div>
            <label className={label} htmlFor="q-year">
              Year
            </label>
            <select id="q-year" className={input} value={period.year} onChange={(e) => setPeriod((p) => ({ ...p, year: Number(e.target.value) }))}>
              {[2025, 2026, 2027].map((y) => (
                <option key={y}>{y}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={label} htmlFor="q-quarter">
              Quarter
            </label>
            <select id="q-quarter" className={input} value={period.quarter} onChange={(e) => setPeriod((p) => ({ ...p, quarter: Number(e.target.value) as QuarterRef["quarter"] }))}>
              <option value={1}>Q1 (Jan–Mar)</option>
              <option value={2}>Q2 (Apr–Jun)</option>
              <option value={3}>Q3 (Jul–Sep)</option>
              <option value={4}>Q4 (Oct–Dec) + annual</option>
            </select>
          </div>
          <PdfButton
            filename={`taxgabay-packet-${period.year}-q${period.quarter}.pdf`}
            label="Download packet (PDF)"
            build={() => packetPdf({ ...client, name: client.name || "Taxpayer" }, packet, todayPH(), null)}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="form-box p-5">
            <p className="form-label">Total to pay</p>
            <p className="mt-1 font-mono text-3xl font-semibold" data-testid="packet-total">
              {peso(packet.total_payable)}
            </p>
          </div>
          <div className="form-box p-5">
            <p className="form-label">Documents prepared</p>
            <p className="mt-1 text-3xl font-semibold">{packet.documents.length}</p>
          </div>
          <div className="form-box p-5">
            <p className="form-label">Status</p>
            <p className="mt-2">
              <Badge variant="warning">Draft — not yet reviewed by {REVIEWER}</Badge>
            </p>
          </div>
        </div>

        {packet.issues.length > 0 && (
          <div className="form-box p-5" data-testid="packet-issues">
            <h3 className="font-semibold">Check these first</h3>
            <ul className="mt-2 space-y-1.5 text-sm">
              {packet.issues.map((i, n) => (
                <li key={n} className="flex gap-2">
                  <Badge variant={i.severity === "error" ? "outline" : "warning"} className={i.severity === "error" ? "border-destructive/50 text-destructive" : ""}>
                    {i.severity === "error" ? "Fix" : "Check"}
                  </Badge>
                  <span>{i.message}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {packet.not_supported.length > 0 && (
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {packet.not_supported.map((n) => (
              <li key={n.form + n.reason}>{n.reason}</li>
            ))}
          </ul>
        )}

        <div className="space-y-4">
          {packet.documents.map((d) => (
            <DocumentCard key={d.id} d={d} />
          ))}
        </div>
      </section>
      <Disclaimer lastVerified={null} />
    </div>
  );
}

function DocumentCard({ d }: { d: PreparedDocument }) {
  return (
    <article className="form-box overflow-hidden" data-testid="prepared-doc">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border px-5 py-3">
        <span className="rounded-full bg-secondary px-3 py-1 font-mono text-sm font-semibold text-secondary-foreground">{d.form}</span>
        <h3 className="font-semibold">{d.title}</h3>
        <span className="ml-auto text-sm text-muted-foreground">
          {d.period_label}
          {d.due_date && <> · due {formatDatePH(d.due_date)}</>}
        </span>
        {Number(d.amount_payable) > 0 && <span className="font-mono font-semibold">{peso(d.amount_payable)}</span>}
      </header>
      <div className="space-y-4 p-5">
        {d.recipient && (
          <p className="text-sm">
            Give this certificate to <strong>{d.recipient.name}</strong>
            {d.recipient.tin ? ` (TIN ${d.recipient.tin})` : ""}.
          </p>
        )}
        {d.fields.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="form-label text-left">
                <th className="pb-2">Box on the form</th>
                <th className="w-24 pb-2">Item no.</th>
                <th className="w-36 pb-2 text-right">Value</th>
              </tr>
            </thead>
            <tbody>
              {d.fields.map((f) => (
                <tr key={f.key} className="border-t border-border/70">
                  <td className="py-2 pr-3">{f.label}</td>
                  <td className="py-2 text-xs text-muted-foreground">{f.item ?? "to confirm"}</td>
                  <td className="py-2 text-right font-mono">{f.key === "rate" ? `${Number(f.value) * 100}%` : peso(f.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {d.schedule && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[30rem] text-sm">
              <thead>
                <tr className="form-label text-left">
                  {d.schedule.columns.map((c) => (
                    <th key={c.key} className={cn("pb-2 pr-3", c.align === "right" && "text-right")}>
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.schedule.rows.map((r, i) => (
                  <tr key={i} className="border-t border-border/70">
                    {d.schedule!.columns.map((c) => (
                      <td key={c.key} className={cn("py-2 pr-3", c.align === "right" && "text-right font-mono")}>
                        {c.align === "right" && !String(r[c.key]).endsWith("%") ? peso(r[c.key] ?? "0") : r[c.key] || <span className="text-muted-foreground">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <details>
          <summary className="cursor-pointer text-sm font-medium text-primary">How this was computed</summary>
          <div className="mt-3">
            <StepsTable steps={d.steps} />
          </div>
        </details>
        {d.warnings.length > 0 && (
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {d.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}

function RecordForm({ kind, tinConsent, onAdd }: { kind: TemplateKind; tinConsent: boolean; onAdd: (r: ClientRecord) => void }) {
  const [f, setF] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState<string | null>(null);
  const v = (k: string) => f[k] ?? "";
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((x) => ({ ...x, [k]: e.target.value }));
  const amt = (s: string) => s.replace(/[₱,\s]/g, "");
  const ok = (s: string) => /^\d+(\.\d{1,2})?$/.test(amt(s)) && Number(amt(s)) > 0;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const tin = (k: string) => (tinConsent && v(k) ? v(k) : null);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v("date"))) return setError("Enter the date.");
    if (kind === "sale") {
      if (!v("no") || !ok(v("amount"))) return setError("Enter the invoice number and an amount.");
      onAdd({ kind: "sale", id: newId(), date: v("date"), document_no: v("no"), customer: { name: v("name") || "Walk-in customer", tin: tin("tin") }, amount: amt(v("amount")) });
    } else if (kind === "expense") {
      if (!v("name") || !ok(v("amount"))) return setError("Enter the supplier and an amount.");
      onAdd({ kind: "expense", id: newId(), date: v("date"), document_no: v("no") || undefined, supplier: { name: v("name"), tin: tin("tin") }, category: (v("category") || "other") as ExpenseCategory, amount: amt(v("amount")), supplier_vat_registered: v("vat") === "yes", withholding: v("atc") ? { atc: v("atc") } : null });
    } else {
      if (!v("name") || !v("atc") || !ok(v("income")) || !ok(v("tax")) || !v("from") || !v("to")) return setError("Fill in every field of the certificate.");
      onAdd({ kind: "form_2307_received", id: newId(), date: v("date"), payor: { name: v("name"), tin: tin("tin") }, period_from: v("from"), period_to: v("to"), atc: v("atc").toUpperCase(), income_payment: amt(v("income")), tax_withheld: amt(v("tax")) });
    }
    setError(null);
    setF({});
  }

  const field = (k: string, text: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label className={label} htmlFor={`rf-${k}`}>
        {text}
      </label>
      <input id={`rf-${k}`} className={input} value={v(k)} onChange={set(k)} {...props} />
    </div>
  );

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-md bg-lavender p-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Add a record">
      {field("date", kind === "form_2307_received" ? "Date received" : "Date", { type: "date" })}
      {kind === "sale" && (
        <>
          {field("no", "Invoice no.")}
          {field("name", "Customer")}
          {field("amount", "Amount (₱)", { inputMode: "decimal" })}
        </>
      )}
      {kind === "expense" && (
        <>
          {field("name", "Supplier")}
          <div>
            <label className={label} htmlFor="rf-category">
              Category
            </label>
            <select id="rf-category" className={input} value={v("category")} onChange={set("category")}>
              <option value="">Choose…</option>
              {CATEGORIES.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          {field("amount", "Amount (₱)", { inputMode: "decimal" })}
          {field("no", "Receipt/invoice no. (optional)")}
          <div>
            <label className={label} htmlFor="rf-atc">
              Tax you withheld (ATC)
            </label>
            <select id="rf-atc" className={input} value={v("atc")} onChange={set("atc")}>
              <option value="">None</option>
              <option value="WI100">WI100 — rent, individual landlord</option>
              <option value="WC100">WC100 — rent, company landlord</option>
              <option value="WI010">WI010 — professional fee, individual</option>
              <option value="WC010">WC010 — professional fee, company</option>
              <option value="WI120">WI120 — contractor, individual</option>
              <option value="WC120">WC120 — contractor, company</option>
            </select>
          </div>
          <div>
            <label className={label} htmlFor="rf-vat">
              Supplier VAT-registered?
            </label>
            <select id="rf-vat" className={input} value={v("vat")} onChange={set("vat")}>
              <option value="">No</option>
              <option value="yes">Yes (amount includes VAT)</option>
            </select>
          </div>
        </>
      )}
      {kind === "form_2307_received" && (
        <>
          {field("name", "Customer (withholding agent)")}
          {field("atc", "ATC", { placeholder: "e.g. WI010" })}
          {field("from", "Period from", { type: "date" })}
          {field("to", "Period to", { type: "date" })}
          {field("income", "Income payment (₱)", { inputMode: "decimal" })}
          {field("tax", "Tax withheld (₱)", { inputMode: "decimal" })}
        </>
      )}
      {tinConsent && field("tin", kind === "sale" ? "Customer TIN (optional)" : kind === "expense" ? "Supplier TIN" : "Customer TIN")}
      <div className="flex items-end gap-3 sm:col-span-2 lg:col-span-4">
        <Button type="submit" size="sm">
          Add {kind === "sale" ? "sale" : kind === "expense" ? "expense" : "certificate"}
        </Button>
        {error && (
          <span role="alert" className="text-sm text-destructive">
            {error}
          </span>
        )}
      </div>
    </form>
  );
}
