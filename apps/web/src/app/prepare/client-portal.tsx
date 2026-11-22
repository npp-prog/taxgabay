"use client";

import { preparePacket, quarterLabel, type ClientRecord, type QuarterRef } from "@taxgabay/filing";
import { peso } from "@taxgabay/tax-engine";
import * as React from "react";
import { PdfButton } from "@/components/pdf-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type TemplateKind } from "@/lib/prepare-csv";
import { packetPdf, REVIEWER } from "@/lib/prepare-pdf";
import { formatDatePH, todayPH } from "@/lib/utils";
import {
  addRecords,
  deleteRecord,
  firmMemberName,
  getClient,
  giveConsent,
  loadConsents,
  loadPackets,
  loadPeriods,
  loadRecords,
  printablePacket,
  setClientTin,
  setPeriodStatus,
  withdrawConsent,
  type Consents,
  type PacketRow,
  type PeriodRow,
  type PrepClient,
} from "@/lib/workspace";
import { PERIOD_STATUS_LABEL, quarterPeriod } from "@/lib/workspace-core";
import { CsvImport, input, label, PacketResults, RecordForm, RecordsTable, RecordTabs } from "./parts";

interface Data {
  client: PrepClient;
  consents: Consents;
  records: ClientRecord[];
  periods: PeriodRow[];
  packets: PacketRow[];
}

async function loadAll(cid: string): Promise<Data> {
  const [client, consents] = await Promise.all([getClient(cid), loadConsents(cid)]);
  const [records, periods, packets] = consents.records_storage ? await Promise.all([loadRecords(cid), loadPeriods(cid), loadPackets(cid)]) : [[], [], []];
  return { client, consents, records, periods, packets };
}

export function ClientPortal({ clientId, userId }: { clientId: string; userId: string }) {
  const [data, setData] = React.useState<Data | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [nonce, setNonce] = React.useState(0);
  const [tab, setTab] = React.useState<TemplateKind>("sale");
  const [period, setPeriod] = React.useState<QuarterRef>({ year: 2026, quarter: 1 });
  const reload = () => setNonce((n) => n + 1);

  React.useEffect(() => {
    let live = true;
    loadAll(clientId).then(
      (d) => live && setData(d),
      (e: Error) => live && setError(e.message),
    );
    return () => {
      live = false;
    };
  }, [clientId, nonce]);

  async function run(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
      reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const packet = React.useMemo(() => (data ? preparePacket({ client: { name: data.client.name, profile: data.client.profile }, records: data.records, period }) : null), [data, period]);

  if (!data) return error ? <p role="alert" className="text-destructive">{error}</p> : <p className="text-muted-foreground">Loading your records…</p>;
  if (!data.consents.records_storage) return <ConsentCard client={data.client} onAccept={(tin) => run(async () => {
    await giveConsent(clientId, userId, "records_storage");
    if (tin) await giveConsent(clientId, userId, "tin");
  })} error={error} />;

  const qp = quarterPeriod(period);
  const status = data.periods.find((p) => p.kind === "quarter" && p.start_date === qp.start_date)?.status ?? "records_incomplete";
  const editable = status === "records_incomplete" || status === "ready";

  return (
    <div className="space-y-8" data-testid="client-portal">
      <div className="form-box flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <p className="form-label">Your business</p>
          <h2 className="mt-1 text-xl font-semibold">{data.client.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">Records are saved securely and prepared by {REVIEWER}&apos;s firm. Your details and tax options are set by the firm — ask them to change anything.</p>
        </div>
        <TinConsent client={data.client} consents={data.consents} onChange={(on, tin) => run(async () => {
          if (on) {
            if (!data.consents.tin) await giveConsent(clientId, userId, "tin");
            if (tin) await setClientTin(clientId, tin);
          } else await withdrawConsent(clientId, userId, "tin");
        })} />
      </div>
      {error && <p role="alert" className="rounded-sm border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}

      <section className="form-box space-y-4 p-6" aria-labelledby="records-h">
        <h2 id="records-h" className="text-lg font-semibold">
          Your records
        </h2>
        <RecordTabs records={data.records} tab={tab} onTab={setTab} />
        <RecordForm kind={tab} tinConsent={data.consents.tin} onAdd={(r) => run(() => addRecords(clientId, [r], data.consents.tin))} />
        <CsvImport kind={tab} onRecords={(rs) => run(() => addRecords(clientId, rs, data.consents.tin))} />
        <RecordsTable records={data.records} kind={tab} onDelete={(id) => run(() => deleteRecord(id))} />
      </section>

      <section className="space-y-4" aria-labelledby="quarter-h">
        <div className="form-box flex flex-wrap items-end gap-4 p-6">
          <div className="mr-auto">
            <h2 id="quarter-h" className="text-lg font-semibold">
              Quarter
            </h2>
            <p className="mt-1 text-sm" data-testid="period-status">
              {PERIOD_STATUS_LABEL[status]}
            </p>
          </div>
          <div>
            <label className={label} htmlFor="c-year">
              Year
            </label>
            <select id="c-year" className={input} value={period.year} onChange={(e) => setPeriod((p) => ({ ...p, year: Number(e.target.value) }))}>
              {[2025, 2026, 2027].map((y) => (
                <option key={y}>{y}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={label} htmlFor="c-quarter">
              Quarter
            </label>
            <select id="c-quarter" className={input} value={period.quarter} onChange={(e) => setPeriod((p) => ({ ...p, quarter: Number(e.target.value) as QuarterRef["quarter"] }))}>
              {[1, 2, 3, 4].map((q) => (
                <option key={q} value={q}>
                  Q{q}
                </option>
              ))}
            </select>
          </div>
          {status === "records_incomplete" && <Button onClick={() => run(() => setPeriodStatus(clientId, period, "ready"))}>My records for {quarterLabel(period)} are complete</Button>}
          {status === "ready" && (
            <Button variant="outline" onClick={() => run(() => setPeriodStatus(clientId, period, "records_incomplete"))}>
              I need to add more records
            </Button>
          )}
        </div>
        {!editable && <p className="text-sm text-muted-foreground">This quarter is with the firm, so its records are locked. Contact the firm if something needs to change.</p>}
        {packet && (
          <details className="form-box p-5">
            <summary className="cursor-pointer font-medium">Preview what will be prepared ({peso(packet.total_payable)} to pay)</summary>
            <p className="mt-2 text-sm text-muted-foreground">A preview from your records. The official packet is prepared and reviewed by the firm.</p>
            <div className="mt-4 space-y-4">
              <PacketResults packet={packet} status={<Badge variant="muted">Preview</Badge>} />
            </div>
          </details>
        )}
      </section>

      <ReleasedPackets client={data.client} packets={data.packets} />
    </div>
  );
}

function ConsentCard({ client, onAccept, error }: { client: PrepClient; onAccept: (tin: boolean) => void; error: string | null }) {
  const [storage, setStorage] = React.useState(false);
  const [tin, setTin] = React.useState(false);
  return (
    <div className="form-box max-w-2xl space-y-4 p-6" data-testid="consent-card">
      <h2 className="text-lg font-semibold">Before you add records for {client.name}</h2>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Under the Data Privacy Act (RA 10173), we ask before saving anything. Your records are visible only to you and {REVIEWER}&apos;s firm, are used only to prepare your BIR documents, and can be downloaded or deleted at any time. See the{" "}
        <a href="/privacy" className="text-primary underline">
          privacy notice
        </a>
        .
      </p>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-1" checked={storage} onChange={(e) => setStorage(e.target.checked)} />I agree that TaxGabay may store my sales, expenses, Forms 2307 and receipts so the firm can prepare my documents. (Required)
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-1" checked={tin} onChange={(e) => setTin(e.target.checked)} />I agree that my TIN and my customers&apos; and suppliers&apos; TINs may be stored encrypted and printed on my documents. (Optional — without it, TIN boxes are left blank.)
      </label>
      <Button disabled={!storage} onClick={() => onAccept(tin)}>
        Continue
      </Button>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

function TinConsent({ consents, onChange }: { client: PrepClient; consents: Consents; onChange: (on: boolean, tin?: string) => void }) {
  const [tin, setTin] = React.useState("");
  if (!consents.tin)
    return (
      <Button size="sm" variant="outline" onClick={() => onChange(true)}>
        Allow TINs on my documents
      </Button>
    );
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        onChange(true, tin);
        setTin("");
      }}
    >
      <div>
        <label className={label} htmlFor="my-tin">
          My TIN (saved encrypted)
        </label>
        <input id="my-tin" className={input} value={tin} onChange={(e) => setTin(e.target.value)} placeholder="000-000-000-000" />
      </div>
      <Button size="sm" type="submit" disabled={!tin}>
        Save
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          if (window.confirm("Withdraw consent? All stored TINs for your business will be deleted.")) onChange(false);
        }}
      >
        Withdraw TIN consent
      </Button>
    </form>
  );
}

function ReleasedPackets({ client, packets }: { client: PrepClient; packets: PacketRow[] }) {
  return (
    <section className="space-y-3" aria-labelledby="released-h">
      <h2 id="released-h" className="text-lg font-semibold">
        Your filing packets
      </h2>
      {packets.length === 0 && <p className="text-sm text-muted-foreground">No packets yet. When the firm releases one, it appears here for you to download, sign and file.</p>}
      {packets.map((p) => (
        <div key={p.id} className="form-box flex flex-wrap items-center gap-4 p-5" data-testid="released-packet">
          <div className="mr-auto">
            <p className="font-semibold">{p.payload.period_label}</p>
            <p className="text-sm text-muted-foreground">
              {peso(p.payload.total_payable)} to pay · reviewed {p.reviewed_at ? formatDatePH(p.reviewed_at.slice(0, 10)) : ""}
            </p>
          </div>
          <Badge variant="success">Reviewed by {REVIEWER}</Badge>
          <PdfButton
            filename={`taxgabay-packet-${p.payload.period.year}-q${p.payload.period.quarter}.pdf`}
            label="Download packet (PDF)"
            build={async () => {
              const pr = await printablePacket(client.id, client, p.payload);
              const by = (await firmMemberName(p.reviewed_by)) ?? REVIEWER;
              return packetPdf(pr.client, pr.packet, todayPH(), { by, on: (p.reviewed_at ?? "").slice(0, 10) });
            }}
          />
        </div>
      ))}
    </section>
  );
}
