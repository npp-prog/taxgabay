"use client";

import type { ClientRecord, ExpenseCategory, Packet, PreparedDocument } from "@taxgabay/filing";
import { peso } from "@taxgabay/tax-engine";
import * as React from "react";
import { StepsTable } from "@/components/steps-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CATEGORIES, importCsv, templateCsv, TEMPLATES, type TemplateKind } from "@/lib/prepare-csv";
import { cn, formatDatePH } from "@/lib/utils";

/** Pieces shared by the browser-only preparer, the client portal and the firm workspace. */

export const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `r${Date.now()}${Math.random().toString(36).slice(2)}`);
export const input = "h-10 w-full rounded-sm border border-input bg-card px-3 text-sm focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30";
export const label = "mb-1 block text-sm font-medium";

const TABS: { kind: TemplateKind; label: string }[] = [
  { kind: "sale", label: "Sales" },
  { kind: "expense", label: "Expenses" },
  { kind: "form_2307_received", label: "2307s received" },
  { kind: "payroll", label: "Payroll" },
];

function download(name: string, text: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function RecordTabs({ records, tab, onTab }: { records: readonly ClientRecord[]; tab: TemplateKind; onTab: (t: TemplateKind) => void }) {
  return (
        <div role="tablist" className="flex gap-1 border-b border-border">
          {TABS.map((t) => (
            <button key={t.kind} type="button" role="tab" aria-selected={tab === t.kind} onClick={() => onTab(t.kind)} className={cn("-mb-px border-b-2 px-3 py-2 text-sm font-medium", tab === t.kind ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
              {t.label} <span className="ml-1 text-xs text-muted-foreground">{records.filter((r) => r.kind === t.kind).length}</span>
            </button>
          ))}
        </div>
  );
}

export function CsvImport({ kind, onRecords }: { kind: TemplateKind; onRecords: (r: ClientRecord[]) => void | Promise<void> }) {
  const tab = kind;
  const [importMsg, setImportMsg] = React.useState<{ ok: number; errors: string[] } | null>(null);
  async function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const r = importCsv(tab, await file.text(), newId);
    try {
      if (r.records.length) await onRecords(r.records);
      setImportMsg({ ok: r.records.length, errors: r.errors });
    } catch (err) {
      setImportMsg({ ok: 0, errors: [(err as Error).message] });
    }
  }
  return (
    <>
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
    </>
  );
}

export interface ReceiptActions {
  attachments: ReadonlyMap<string, string>;
  onAttach?: (recordId: string, file: File) => void;
  onOpen: (path: string) => void;
}

export function RecordsTable({ records, kind, onDelete, receipts }: { records: readonly ClientRecord[]; kind: TemplateKind; onDelete?: (id: string) => void; receipts?: ReceiptActions }) {
  const tab = kind;
  const shown = records.filter((r) => r.kind === kind).sort((a, b) => a.date.localeCompare(b.date));
  return (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-sm" data-testid="records-table">
            <thead className="border-b border-border text-left">
              <tr className="form-label">
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">{tab === "sale" ? "Invoice · customer" : tab === "expense" ? "Supplier · category" : tab === "payroll" ? "Employee" : "Customer who withheld"}</th>
                <th className="py-2 pr-3 text-right">{tab === "form_2307_received" ? "Income · tax withheld" : tab === "payroll" ? "Basic pay" : "Amount"}</th>
                {receipts && <th className="py-2 pr-3">Receipt</th>}
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-muted-foreground">
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
                        {r.vat_treatment && r.vat_treatment !== "vatable" && <Badge variant="muted" className="ml-2">{r.vat_treatment === "zero_rated" ? "zero-rated" : "exempt"}</Badge>}
                      </>
                    )}
                    {r.kind === "expense" && (
                      <>
                        {r.supplier.name} <span className="text-muted-foreground">· {CATEGORIES.find((c) => c.key === r.category)?.label}</span>
                        {r.withholding && <Badge variant="muted" className="ml-2">{r.withholding.atc}</Badge>}
                      </>
                    )}
                    {r.kind === "payroll" && (
                      <>
                        {r.employee.name}
                        {r.benefits && Number(r.benefits) > 0 && <span className="text-muted-foreground"> · benefits {peso(r.benefits)}</span>}
                        {r.minimum_wage_earner && <Badge variant="muted" className="ml-2">MWE</Badge>}
                      </>
                    )}
                    {r.kind === "form_2307_received" && (
                      <>
                        {r.payor.name} <span className="text-muted-foreground">· {r.atc} · {formatDatePH(r.period_from, { month: "short", day: "numeric" })}–{formatDatePH(r.period_to)}</span>
                      </>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-right font-mono">{r.kind === "form_2307_received" ? `${peso(r.income_payment)} · ${peso(r.tax_withheld)}` : r.kind === "payroll" ? peso(r.basic_pay) : peso(r.amount)}</td>
                  {receipts && (
                    <td className="py-2 pr-3 text-sm">
                      {receipts.attachments.get(r.id) ? (
                        <button type="button" className="text-primary underline" onClick={() => receipts.onOpen(receipts.attachments.get(r.id)!)}>
                          View
                        </button>
                      ) : receipts.onAttach ? (
                        <label className="cursor-pointer text-primary underline">
                          Attach
                          <input type="file" accept="image/*,application/pdf" className="sr-only" aria-label={`Attach receipt for ${r.date}`} onChange={(e) => {
                            const f = e.target.files?.[0];
                            e.target.value = "";
                            if (f) receipts.onAttach!(r.id, f);
                          }} />
                        </label>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  )}
                  <td className="py-2 text-right">
                    {onDelete && <button type="button" aria-label="Delete record" onClick={() => onDelete(r.id)} className="h-8 w-8 rounded-full text-muted-foreground hover:bg-muted hover:text-destructive">
                      ×
                    </button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
  );
}

export function PacketResults({ packet, status }: { packet: Packet; status: React.ReactNode }) {
  return (
    <>
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
              {status}
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
    </>
  );
}

export function DocumentCard({ d }: { d: PreparedDocument }) {
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

export function RecordForm({ kind, tinConsent, onAdd, vat = false }: { kind: TemplateKind; tinConsent: boolean; onAdd: (r: ClientRecord) => void; vat?: boolean }) {
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
      const vt = v("vt") as "" | "vatable" | "zero_rated" | "exempt";
      onAdd({ kind: "sale", id: newId(), date: v("date"), document_no: v("no"), customer: { name: v("name") || "Walk-in customer", tin: tin("tin") }, amount: amt(v("amount")), ...(vat && vt ? { vat_treatment: vt } : {}) });
    } else if (kind === "expense") {
      if (!v("name") || !ok(v("amount"))) return setError("Enter the supplier and an amount.");
      onAdd({ kind: "expense", id: newId(), date: v("date"), document_no: v("no") || undefined, supplier: { name: v("name"), tin: tin("tin") }, category: (v("category") || "other") as ExpenseCategory, amount: amt(v("amount")), supplier_vat_registered: v("vat") === "yes", withholding: v("atc") ? { atc: v("atc") } : null });
    } else if (kind === "payroll") {
      if (!v("name") || !ok(v("basic"))) return setError("Enter the employee and the basic pay.");
      if ((v("benefits") && !ok(v("benefits"))) || (v("demin") && !ok(v("demin")))) return setError("Benefits and de minimis must be amounts.");
      onAdd({ kind: "payroll", id: newId(), date: v("date"), employee: { name: v("name"), tin: tin("tin") }, basic_pay: amt(v("basic")), ...(v("benefits") ? { benefits: amt(v("benefits")) } : {}), ...(v("demin") ? { de_minimis: amt(v("demin")) } : {}), minimum_wage_earner: v("mwe") === "yes" });
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
      {field("date", kind === "form_2307_received" ? "Date received" : kind === "payroll" ? "Month's last payday" : "Date", { type: "date" })}
      {kind === "payroll" && (
        <>
          {field("name", "Employee")}
          {field("basic", "Basic pay for the month (₱)", { inputMode: "decimal" })}
          {field("benefits", "13th month / bonus paid (₱, optional)", { inputMode: "decimal" })}
          {field("demin", "De minimis benefits (₱, optional)", { inputMode: "decimal" })}
          <div>
            <label className={label} htmlFor="rf-mwe">
              Minimum wage earner?
            </label>
            <select id="rf-mwe" className={input} value={v("mwe")} onChange={set("mwe")}>
              <option value="">No</option>
              <option value="yes">Yes</option>
            </select>
          </div>
        </>
      )}
      {kind === "sale" && (
        <>
          {field("no", "Invoice no.")}
          {field("name", "Customer")}
          {field("amount", vat ? "Invoice total incl. VAT (₱)" : "Amount (₱)", { inputMode: "decimal" })}
          {vat && (
            <div>
              <label className={label} htmlFor="rf-vt">
                VAT treatment
              </label>
              <select id="rf-vt" className={input} value={v("vt")} onChange={set("vt")}>
                <option value="">Vatable (12% VAT included)</option>
                <option value="zero_rated">Zero-rated</option>
                <option value="exempt">VAT-exempt</option>
              </select>
            </div>
          )}
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
      {tinConsent && field("tin", kind === "sale" ? "Customer TIN (optional)" : kind === "expense" ? "Supplier TIN" : kind === "payroll" ? "Employee TIN" : "Customer TIN")}
      <div className="flex items-end gap-3 sm:col-span-2 lg:col-span-4">
        <Button type="submit" size="sm">
          Add {kind === "sale" ? "sale" : kind === "expense" ? "expense" : kind === "payroll" ? "payroll" : "certificate"}
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
