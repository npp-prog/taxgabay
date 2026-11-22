"use client";

import { preparePacket, type ClientRecord, type QuarterRef } from "@taxgabay/filing";
import { type IncomeTaxOption, type TaxpayerType, type VatStatus } from "@taxgabay/tax-engine";
import * as React from "react";
import { PdfButton } from "@/components/pdf-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { packetPdf, REVIEWER } from "@/lib/prepare-pdf";
import { type TemplateKind } from "@/lib/prepare-csv";
import { usePrepare } from "@/lib/prepare-store";
import { todayPH } from "@/lib/utils";
import { CsvImport, input, label, PacketResults, RecordForm, RecordsTable, RecordTabs } from "./parts";

const EXAMPLE: ClientRecord[] = [
  { kind: "sale", id: "x1", date: "2026-01-10", document_no: "SI-0001", customer: { name: "Kape Co., Inc." }, amount: "30000.00" },
  { kind: "sale", id: "x2", date: "2026-02-12", document_no: "SI-0002", customer: { name: "Kape Co., Inc." }, amount: "40000.00" },
  { kind: "sale", id: "x3", date: "2026-03-05", document_no: "SI-0003", customer: { name: "Bright Corp." }, amount: "50000.00" },
  { kind: "expense", id: "x4", date: "2026-01-31", supplier: { name: "Jose Cruz" }, category: "rent", amount: "10000.00", withholding: { atc: "WI100" } },
  { kind: "expense", id: "x5", date: "2026-02-28", supplier: { name: "Jose Cruz" }, category: "rent", amount: "10000.00", withholding: { atc: "WI100" } },
  { kind: "expense", id: "x6", date: "2026-03-31", supplier: { name: "Jose Cruz" }, category: "rent", amount: "10000.00", withholding: { atc: "WI100" } },
  { kind: "form_2307_received", id: "x7", date: "2026-04-05", payor: { name: "Kape Co., Inc." }, period_from: "2026-01-01", period_to: "2026-03-31", atc: "WI010", income_payment: "70000.00", tax_withheld: "3500.00" },
];

/** Browser-only preparer: no account, records stay in this browser. */
export function LocalPrepare({ banner }: { banner?: React.ReactNode }) {
  const { state, update, reset } = usePrepare();
  const { client, records, tinConsent } = state;
  const [period, setPeriod] = React.useState<QuarterRef>({ year: 2026, quarter: 1 });
  const [tab, setTab] = React.useState<TemplateKind>("sale");
  const packet = React.useMemo(() => preparePacket({ client, records, period }), [client, records, period]);
  const setProfile = (patch: Partial<typeof client.profile>) => update((s) => ({ ...s, client: { ...s.client, profile: { ...s.client.profile, ...patch } } }));
  const addRecord = (r: ClientRecord) => update((s) => ({ ...s, records: [...s.records, r] }));
  const removeRecord = (id: string) => update((s) => ({ ...s, records: s.records.filter((r) => r.id !== id) }));

  return (
    <div className="space-y-8">
      {banner}
      <div className="rounded-lg border border-sun bg-sun-soft p-4 text-sm leading-relaxed text-sun-foreground dark:text-sun">
        <strong>For now, everything stays in this browser.</strong> Clients of {REVIEWER}&apos;s firm will get a secure account where records are saved and each packet is reviewed before release. It supports self-employed individuals and sole proprietors, VAT-registered or not.
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
        <div className="max-w-md">
          <label className={label} htmlFor="p-vat">
            VAT registration
          </label>
          <select id="p-vat" className={input} value={client.profile.vat_status === "vat" ? "vat" : "non_vat"} onChange={(e) => setProfile({ vat_status: e.target.value as VatStatus })}>
            <option value="non_vat">Not VAT-registered (percentage tax)</option>
            <option value="vat">VAT-registered</option>
          </select>
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
        <RecordTabs records={records} tab={tab} onTab={setTab} />

        <RecordForm kind={tab} tinConsent={tinConsent} onAdd={addRecord} vat={client.profile.vat_status === "vat"} />

        <CsvImport kind={tab} onRecords={(rs) => update((s) => ({ ...s, records: [...s.records, ...rs] }))} />
        <RecordsTable records={records} kind={tab} onDelete={removeRecord} />
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

        <PacketResults packet={packet} status={<Badge variant="warning">Draft — not yet reviewed by {REVIEWER}</Badge>} />
      </section>
    </div>
  );
}

