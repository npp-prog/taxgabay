"use client";

import { quarterLabel, type ClientRecord, type QuarterRef } from "@taxgabay/filing";
import { peso, type IncomeTaxOption, type Profile, type TaxpayerType } from "@taxgabay/tax-engine";
import Link from "next/link";
import * as React from "react";
import { PageHeader } from "@/components/page-header";
import { PdfButton } from "@/components/pdf-button";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { type TemplateKind } from "@/lib/prepare-csv";
import { packetPdf, REVIEWER } from "@/lib/prepare-pdf";
import { supabaseEnabled } from "@/lib/supabase";
import { useUserData } from "@/lib/user-data";
import { cn, formatDatePH, todayPH } from "@/lib/utils";
import {
  createClient,
  createPacket,
  firmMemberName,
  listClients,
  loadMembership,
  loadPackets,
  loadPeriods,
  loadRecords,
  printablePacket,
  resetInviteCode,
  setPacketStatus,
  updateClientProfile,
  type Membership,
  type PacketRow,
  type PeriodRow,
  type PrepClient,
} from "@/lib/workspace";
import { PERIOD_STATUS_LABEL } from "@/lib/workspace-core";
import { input, label, PacketResults, RecordsTable, RecordTabs } from "../prepare/parts";

const PACKET_STATUS: Record<PacketRow["status"], string> = { prepared: "Prepared — not reviewed", reviewed: "Reviewed", released: "Released to client" };
const defaultProfile = (): Profile => ({ taxpayer_type: "self_employed", vat_status: "non_vat", income_tax_option: "eight_percent", has_employees: false, withholds_expanded: false, filing_channel: "ebirforms", efps_group: null, fiscal_year_end_month: 12, rdo_code: null, taxpayer_size: "micro", line_of_business: null });

export function FirmWorkspace() {
  const { ready, session } = useUserData();
  const userId = session?.user.id ?? null;
  const [m, setM] = React.useState<{ uid: string; m: Membership } | null>(null);
  React.useEffect(() => {
    if (!userId) return;
    let live = true;
    loadMembership(userId).then((x) => live && setM({ uid: userId, m: x }), () => live && setM({ uid: userId, m: { userId, firmRole: null, firmName: null, clientIds: [] } }));
    return () => {
      live = false;
    };
  }, [userId]);
  const membership = m && m.uid === userId ? m.m : null;

  const gate = (msg: string, signIn = false) => (
    <div className="mx-auto max-w-xl space-y-4" data-testid="firm-gate">
      <PageHeader title="Firm workspace" />
      <p>{msg}</p>
      {signIn && (
        <Link href="/login" className={buttonVariants()}>
          Sign in
        </Link>
      )}
    </div>
  );
  if (!supabaseEnabled) return gate("The firm workspace needs accounts (Supabase). See the README to enable them.");
  if (!ready || (userId && !membership)) return <p className="text-muted-foreground">Loading…</p>;
  if (!userId) return gate("Sign in with your firm account.", true);
  if (!membership!.firmRole) return gate(`This account is not on ${REVIEWER}'s firm team. Ask the firm admin to add you.`);
  return <Workspace role={membership!.firmRole} />;
}

function Workspace({ role }: { role: NonNullable<Membership["firmRole"]> }) {
  const [clients, setClients] = React.useState<PrepClient[] | null>(null);
  const [selected, setSelected] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [nonce, setNonce] = React.useState(0);
  React.useEffect(() => {
    let live = true;
    listClients().then((c) => live && setClients(c), (e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [nonce]);
  const current = clients?.find((c) => c.id === selected) ?? null;

  return (
    <div className="space-y-8">
      <PageHeader eyebrow={`Firm workspace · ${role}`} title="Clients and filing packets" description="Create clients and give them their invite code. When a client marks a quarter complete, prepare the packet, review it, and release it to the client." />
      {error && <p role="alert" className="text-destructive">{error}</p>}
      <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="space-y-4">
          <NewClient
            onCreated={(c) => {
              setNonce((n) => n + 1);
              setSelected(c.id);
            }}
          />
          <ul className="form-box divide-y divide-border overflow-hidden" data-testid="client-list">
            {clients?.length === 0 && <li className="p-4 text-sm text-muted-foreground">No clients yet.</li>}
            {clients?.map((c) => (
              <li key={c.id}>
                <button type="button" onClick={() => setSelected(c.id)} className={cn("block w-full px-4 py-3 text-left text-sm hover:bg-lavender", selected === c.id && "bg-lavender font-semibold text-primary")}>
                  {c.name}
                </button>
              </li>
            ))}
          </ul>
        </aside>
        <div>{current ? <ClientDetail key={current.id} client={current} role={role} onChanged={() => setNonce((n) => n + 1)} /> : <p className="form-box p-6 text-muted-foreground">Choose a client, or create one.</p>}</div>
      </div>
    </div>
  );
}

function NewClient({ onCreated }: { onCreated: (c: PrepClient) => void }) {
  const [name, setName] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  return (
    <form
      className="form-box space-y-3 p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        try {
          onCreated(await createClient(name.trim(), defaultProfile()));
          setName("");
        } catch (err) {
          setError((err as Error).message);
        }
      }}
    >
      <label className={label} htmlFor="new-client">
        New client (registered name)
      </label>
      <input id="new-client" className={input} value={name} onChange={(e) => setName(e.target.value)} required />
      <Button type="submit" size="sm">
        Create client
      </Button>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </form>
  );
}

interface Detail {
  records: ClientRecord[];
  periods: PeriodRow[];
  packets: PacketRow[];
}

function ClientDetail({ client, role, onChanged }: { client: PrepClient; role: NonNullable<Membership["firmRole"]>; onChanged: () => void }) {
  const [d, setD] = React.useState<Detail | null>(null);
  const [profile, setProfile] = React.useState<Profile>(client.profile);
  const [code, setCode] = React.useState(client.invite_code);
  const [tab, setTab] = React.useState<TemplateKind>("sale");
  const [period, setPeriod] = React.useState<QuarterRef>({ year: 2026, quarter: 1 });
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [nonce, setNonce] = React.useState(0);
  React.useEffect(() => {
    let live = true;
    Promise.all([loadRecords(client.id), loadPeriods(client.id), loadPackets(client.id)]).then(
      ([records, periods, packets]) => live && setD({ records, periods, packets }),
      (e: Error) => live && setError(e.message),
    );
    return () => {
      live = false;
    };
  }, [client.id, nonce]);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      setNonce((n) => n + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const canReview = role === "reviewer" || role === "admin";

  return (
    <div className="space-y-6" data-testid="client-detail">
      <section className="form-box space-y-4 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="text-xl font-semibold">{client.name}</h2>
          <div className="text-right text-sm">
            <p className="form-label">Invite code</p>
            <p className="font-mono text-lg font-semibold tracking-wider" data-testid="invite-code">
              {code ?? "—"}
            </p>
            <button type="button" className="text-xs text-primary underline" onClick={() => run(async () => setCode(await resetInviteCode(client.id)))}>
              Issue a new code
            </button>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <label className={label} htmlFor="f-type">
              Taxpayer type
            </label>
            <select id="f-type" className={input} value={profile.taxpayer_type} onChange={(e) => setProfile({ ...profile, taxpayer_type: e.target.value as TaxpayerType })}>
              <option value="self_employed">Self-employed / professional</option>
              <option value="sole_proprietorship">Sole proprietor</option>
            </select>
          </div>
          <div>
            <label className={label} htmlFor="f-option">
              Income tax option
            </label>
            <select id="f-option" className={input} value={profile.income_tax_option} onChange={(e) => setProfile({ ...profile, income_tax_option: e.target.value as IncomeTaxOption })}>
              <option value="eight_percent">8%</option>
              <option value="graduated_osd">Graduated, OSD</option>
              <option value="graduated_itemized">Graduated, itemized</option>
            </select>
          </div>
          <label className="flex items-end gap-2 pb-2 text-sm">
            <input type="checkbox" checked={profile.withholds_expanded} onChange={(e) => setProfile({ ...profile, withholds_expanded: e.target.checked })} />
            Withholding agent (expanded)
          </label>
        </div>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => run(async () => {
          await updateClientProfile(client.id, profile);
          onChanged();
        })}>
          Save profile
        </Button>
      </section>

      {error && <p role="alert" className="rounded-sm border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}

      {d && (
        <>
          <section className="form-box space-y-4 p-6">
            <h3 className="font-semibold">Records ({d.records.length})</h3>
            <RecordTabs records={d.records} tab={tab} onTab={setTab} />
            <RecordsTable records={d.records} kind={tab} />
          </section>

          <section className="form-box space-y-4 p-6">
            <div className="flex flex-wrap items-end gap-4">
              <h3 className="mr-auto font-semibold">Prepare a packet</h3>
              <select aria-label="Year" className={cn(input, "w-28")} value={period.year} onChange={(e) => setPeriod((p) => ({ ...p, year: Number(e.target.value) }))}>
                {[2025, 2026, 2027].map((y) => (
                  <option key={y}>{y}</option>
                ))}
              </select>
              <select aria-label="Quarter" className={cn(input, "w-28")} value={period.quarter} onChange={(e) => setPeriod((p) => ({ ...p, quarter: Number(e.target.value) as QuarterRef["quarter"] }))}>
                {[1, 2, 3, 4].map((q) => (
                  <option key={q} value={q}>
                    Q{q}
                  </option>
                ))}
              </select>
              <Button disabled={busy} onClick={() => run(() => createPacket({ ...client, profile }, period))}>
                Prepare {quarterLabel(period)} packet
              </Button>
            </div>
            <ul className="space-y-1 text-sm">
              {d.periods.map((p) => (
                <li key={p.id}>
                  <span className="font-mono">{p.start_date}</span> – {PERIOD_STATUS_LABEL[p.status] ?? p.status}
                </li>
              ))}
            </ul>
          </section>

          <section className="space-y-4">
            <h3 className="font-semibold">Packets</h3>
            {d.packets.length === 0 && <p className="text-sm text-muted-foreground">None yet.</p>}
            {d.packets.map((p) => (
              <PacketCard key={p.id} client={{ ...client, profile }} packet={p} canReview={canReview} busy={busy} onStatus={(s) => run(() => setPacketStatus(p, s))} />
            ))}
          </section>
        </>
      )}
    </div>
  );
}

function PacketCard({ client, packet, canReview, busy, onStatus }: { client: PrepClient; packet: PacketRow; canReview: boolean; busy: boolean; onStatus: (s: "reviewed" | "released") => void }) {
  const p = packet.payload;
  return (
    <article className="form-box space-y-4 p-5" data-testid="firm-packet">
      <header className="flex flex-wrap items-center gap-3">
        <h4 className="mr-auto font-semibold">
          {p.period_label} · {peso(p.total_payable)} to pay
        </h4>
        <Badge variant={packet.status === "prepared" ? "warning" : "success"}>{PACKET_STATUS[packet.status]}</Badge>
        {packet.status === "prepared" && canReview && (
          <Button size="sm" disabled={busy} onClick={() => onStatus("reviewed")}>
            Mark reviewed
          </Button>
        )}
        {packet.status === "prepared" && !canReview && <span className="text-xs text-muted-foreground">Waiting for a reviewer</span>}
        {packet.status === "reviewed" && (
          <Button size="sm" disabled={busy} onClick={() => onStatus("released")}>
            Release to client
          </Button>
        )}
        <PdfButton
          filename={`${client.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${p.period.year}-q${p.period.quarter}.pdf`}
          label="PDF"
          build={async () => {
            const pr = await printablePacket(client.id, client, p);
            const reviewed = packet.reviewed_at ? { by: (await firmMemberName(packet.reviewed_by)) ?? REVIEWER, on: packet.reviewed_at.slice(0, 10) } : null;
            return packetPdf(pr.client, pr.packet, todayPH(), reviewed);
          }}
        />
      </header>
      <p className="text-xs text-muted-foreground">
        Prepared {formatDatePH(packet.prepared_at.slice(0, 10))}
        {packet.reviewed_at && <> · reviewed {formatDatePH(packet.reviewed_at.slice(0, 10))}</>}
        {packet.released_at && <> · released {formatDatePH(packet.released_at.slice(0, 10))}</>}
      </p>
      <details>
        <summary className="cursor-pointer text-sm font-medium text-primary">Open the documents</summary>
        <div className="mt-4 space-y-4">
          <PacketResults packet={p} status={<Badge variant={packet.status === "prepared" ? "warning" : "success"}>{PACKET_STATUS[packet.status]}</Badge>} />
        </div>
      </details>
    </article>
  );
}
