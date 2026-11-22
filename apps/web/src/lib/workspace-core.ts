import type { ClientRecord, Packet, Party, QuarterRef } from "@taxgabay/filing";
import { quarterRange } from "@taxgabay/filing";

/** Database row of public.records. */
export interface RecordRow {
  id: string;
  prep_client_id: string;
  record_date: string;
  kind: string;
  data: Record<string, unknown>;
}

export type TinSubject = "client" | "supplier" | "customer" | "payor" | "employee";

/** How a TIN is keyed in public.tins: by kind of party and the party's normalized name. */
export const tinRef = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ");

const noTin = (p: Party): Party => ({ name: p.name, ...(p.address ? { address: p.address } : {}) });

/** The TIN to save separately (encrypted) for a record, if one was typed in. */
export function recordTin(r: ClientRecord): { subject: TinSubject; ref: string; tin: string } | null {
  if (r.kind === "journal") return null;
  const [subject, party]: [TinSubject, Party] = r.kind === "sale" ? ["customer", r.customer] : r.kind === "expense" ? ["supplier", r.supplier] : r.kind === "payroll" ? ["employee", r.employee] : ["payor", r.payor];
  return party.tin ? { subject, ref: tinRef(party.name), tin: party.tin } : null;
}

/** A record as stored: TINs removed (they live in public.tins). */
export function recordToRow(r: ClientRecord, prepClientId: string): Omit<RecordRow, "id"> {
  const { id: _id, date, kind, ...rest } = r as ClientRecord & Record<string, unknown>;
  void _id;
  const data: Record<string, unknown> = { ...rest };
  // Manual journal entries are stored as kind "other" (the database's catch-all kind).
  if (r.kind === "journal") return { prep_client_id: prepClientId, record_date: date, kind: "other", data: { ...data, journal: true } };
  if (r.kind === "sale") data.customer = noTin(r.customer);
  if (r.kind === "expense") data.supplier = noTin(r.supplier);
  if (r.kind === "form_2307_received") data.payor = noTin(r.payor);
  if (r.kind === "payroll") data.employee = noTin(r.employee);
  return { prep_client_id: prepClientId, record_date: date, kind, data };
}

/**
 * Back from the database. `tinsOnFile` marks parties whose TIN is stored (shown masked), so the
 * checks do not ask for a TIN that is already on file.
 */
export function rowToRecord(row: RecordRow, tinsOnFile: ReadonlyMap<string, string> = new Map()): ClientRecord | null {
  if (row.kind === "other" && row.data.journal) {
    const { journal: _j, ...d } = row.data;
    void _j;
    return { ...d, kind: "journal", id: row.id, date: row.record_date } as unknown as ClientRecord;
  }
  if (row.kind !== "sale" && row.kind !== "expense" && row.kind !== "form_2307_received" && row.kind !== "payroll") return null;
  const r = { ...row.data, id: row.id, kind: row.kind, date: row.record_date } as unknown as ClientRecord;
  const mark = (subject: TinSubject, p: Party): Party => {
    const last4 = tinsOnFile.get(`${subject}|${tinRef(p.name)}`);
    return last4 ? { ...p, tin: `•••${last4}` } : { ...p, tin: null };
  };
  if (r.kind === "sale") return { ...r, customer: mark("customer", r.customer) };
  if (r.kind === "expense") return { ...r, supplier: mark("supplier", r.supplier) };
  if (r.kind === "payroll") return { ...r, employee: mark("employee", r.employee) };
  if (r.kind === "journal") return r;
  return { ...r, payor: mark("payor", r.payor) };
}

export const tinKey = (subject: string, ref: string) => `${subject}|${ref}`;

/** Every TIN a packet PDF needs, as (subject, ref) pairs. */
export function packetTinNeeds(packet: Packet): { subject: TinSubject; ref: string }[] {
  const out = new Map<string, { subject: TinSubject; ref: string }>();
  const add = (subject: TinSubject, name: string) => out.set(tinKey(subject, tinRef(name)), { subject, ref: tinRef(name) });
  for (const d of packet.documents) {
    if (d.recipient) add(d.form === "2316" ? "employee" : "supplier", d.recipient.name);
    if (d.form === "1604C") d.schedule?.rows.forEach((r) => add("employee", r.name ?? ""));
    if (d.form === "QAP") d.schedule?.rows.forEach((r) => add("supplier", r.name ?? ""));
    if (d.form === "SAWT") d.schedule?.rows.forEach((r) => add("payor", r.name ?? ""));
  }
  return [...out.values()];
}

/** Puts TINs (fetched from the encrypted store) back into a packet for printing. */
export function fillTins(packet: Packet, tins: ReadonlyMap<string, string>): Packet {
  const get = (subject: TinSubject, name: string) => tins.get(tinKey(subject, tinRef(name))) ?? null;
  return {
    ...packet,
    documents: packet.documents.map((d) => ({
      ...d,
      recipient: d.recipient ? { ...d.recipient, tin: get(d.form === "2316" ? "employee" : "supplier", d.recipient.name) } : undefined,
      schedule: d.schedule
        ? { ...d.schedule, rows: d.schedule.rows.map((r) => (d.form === "QAP" ? { ...r, tin: get("supplier", r.name ?? "") ?? "" } : d.form === "SAWT" ? { ...r, tin: get("payor", r.name ?? "") ?? "" } : d.form === "1604C" ? { ...r, tin: get("employee", r.name ?? "") ?? "" } : r)) }
        : undefined,
    })),
  };
}

export const quarterPeriod = (q: QuarterRef) => {
  const r = quarterRange(q);
  return { kind: "quarter" as const, start_date: r.start, end_date: r.end };
};

export const monthPeriod = (year: number, month: number) => {
  const mm = String(month).padStart(2, "0");
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { kind: "month" as const, start_date: `${year}-${mm}-01`, end_date: `${year}-${mm}-${String(last).padStart(2, "0")}` };
};

export const PERIOD_STATUS_LABEL: Record<string, string> = {
  records_incomplete: "Records in progress",
  ready: "Records complete — waiting for the firm",
  prepared: "Prepared — awaiting CPA review",
  reviewed: "Reviewed — ready to release",
  released: "Released to the client",
  filed: "Filed by the client",
};
