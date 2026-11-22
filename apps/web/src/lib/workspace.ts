"use client";

import { preparePacket, redactTins, type ClientInfo, type ClientRecord, type Packet, type QuarterRef } from "@taxgabay/filing";
import { DEFAULT_PROFILE, type Profile } from "@taxgabay/tax-engine";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase } from "./supabase";
import { fillTins, monthPeriod, packetTinNeeds, quarterPeriod, recordTin, recordToRow, rowToRecord, tinKey, type RecordRow } from "./workspace-core";

/** Data access for the firm workspace and the client portal. RLS in the database is the security boundary. */

export const CONSENT_VERSION = "2026-11";

export interface PrepClient {
  id: string;
  name: string;
  profile: Profile;
  /** Stored inside prep_clients.profile under the "corporate" key. */
  corporate?: ClientInfo["corporate"];
  invite_code: string | null;
  archived: boolean;
}

export interface PeriodRow {
  id: string;
  prep_client_id: string;
  kind: string;
  start_date: string;
  end_date: string;
  status: string;
}

export interface PacketRow {
  id: string;
  period_id: string;
  prep_client_id: string;
  payload: Packet;
  status: "prepared" | "reviewed" | "released";
  prepared_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  released_at: string | null;
}

export interface Membership {
  userId: string;
  firmRole: "preparer" | "reviewer" | "admin" | null;
  firmName: string | null;
  clientIds: string[];
}

function sb(): SupabaseClient {
  const c = getSupabase();
  if (!c) throw new Error("Accounts are not enabled on this deployment.");
  return c;
}

function check<T>(r: { data: T; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data;
}

const asClient = (row: Record<string, unknown>): PrepClient => {
  const { corporate, ...prof } = ((row.profile as Partial<Profile> & { corporate?: ClientInfo["corporate"] }) ?? {});
  return {
  id: String(row.id),
  name: String(row.name),
  profile: { ...DEFAULT_PROFILE, taxpayer_type: "self_employed", vat_status: "non_vat", ...prof },
  corporate,
  invite_code: (row.invite_code as string | null) ?? null,
  archived: !!row.archived,
  };
};

export async function loadMembership(userId: string): Promise<Membership> {
  const fm = check(await sb().from("firm_members").select("user_id,role,display_name").eq("user_id", userId)) as { role: Membership["firmRole"]; display_name: string | null }[];
  const cu = check(await sb().from("client_users").select("prep_client_id,user_id").eq("user_id", userId)) as { prep_client_id: string }[];
  return { userId, firmRole: fm[0]?.role ?? null, firmName: fm[0]?.display_name ?? null, clientIds: cu.map((c) => c.prep_client_id) };
}

export async function claimClient(code: string): Promise<string> {
  return check(await sb().rpc("claim_client", { code })) as string;
}

export async function getClient(id: string): Promise<PrepClient> {
  const rows = check(await sb().from("prep_clients").select("id,name,profile,invite_code,archived").eq("id", id)) as Record<string, unknown>[];
  if (!rows[0]) throw new Error("Client not found.");
  return asClient(rows[0]);
}

export async function listClients(): Promise<PrepClient[]> {
  const rows = check(await sb().from("prep_clients").select("id,name,profile,invite_code,archived").order("name")) as Record<string, unknown>[];
  return rows.map(asClient);
}

export async function createClient(name: string, profile: Profile): Promise<PrepClient> {
  const rows = check(await sb().from("prep_clients").insert({ name, profile }).select("id,name,profile,invite_code,archived")) as Record<string, unknown>[];
  return asClient(rows[0]!);
}

export async function updateClientProfile(id: string, profile: Profile, corporate?: ClientInfo["corporate"]): Promise<void> {
  check(await sb().from("prep_clients").update({ profile: corporate ? { ...profile, corporate } : profile }).eq("id", id));
}

export async function resetInviteCode(id: string): Promise<string> {
  return check(await sb().rpc("reset_invite_code", { cid: id })) as string;
}

// ---------- Consent ----------

export interface Consents {
  records_storage: boolean;
  tin: boolean;
}

export async function loadConsents(cid: string): Promise<Consents> {
  const rows = check(await sb().from("client_consents").select("id,consent_type,withdrawn_at").eq("prep_client_id", cid)) as { consent_type: string; withdrawn_at: string | null }[];
  const active = (t: string) => rows.some((r) => r.consent_type === t && !r.withdrawn_at);
  return { records_storage: active("records_storage"), tin: active("tin") };
}

export async function giveConsent(cid: string, userId: string, type: keyof Consents): Promise<void> {
  check(await sb().from("client_consents").insert({ prep_client_id: cid, user_id: userId, consent_type: type, version: CONSENT_VERSION }));
}

export async function withdrawConsent(cid: string, userId: string, type: keyof Consents): Promise<void> {
  check(await sb().from("client_consents").update({ withdrawn_at: new Date().toISOString() }).eq("prep_client_id", cid).eq("user_id", userId).eq("consent_type", type));
}

// ---------- Records and TINs ----------

export async function loadTinsOnFile(cid: string): Promise<Map<string, string>> {
  const r = await sb().rpc("list_tins", { cid });
  if (r.error) return new Map(); // no TIN consent yet
  return new Map(((r.data ?? []) as { subject: string; subject_ref: string; last4: string }[]).map((t) => [tinKey(t.subject, t.subject_ref), t.last4]));
}

export async function loadRecords(cid: string): Promise<ClientRecord[]> {
  const rows = check(await sb().from("records").select("id,prep_client_id,record_date,kind,data").eq("prep_client_id", cid).order("record_date")) as RecordRow[];
  const tins = await loadTinsOnFile(cid);
  return rows.map((r) => rowToRecord(r, tins)).filter((r): r is ClientRecord => r !== null);
}

export async function addRecords(cid: string, records: ClientRecord[], saveTins: boolean): Promise<void> {
  if (!records.length) return;
  check(await sb().from("records").insert(records.map((r) => recordToRow(r, cid))));
  if (saveTins) {
    for (const r of records) {
      const t = recordTin(r);
      if (t && !t.tin.startsWith("•")) check(await sb().rpc("set_tin", { cid, subj: t.subject, ref: t.ref, tin: t.tin }));
    }
  }
}

export async function deleteRecord(id: string): Promise<void> {
  check(await sb().from("records").delete().eq("id", id));
}

export async function setClientTin(cid: string, tin: string): Promise<void> {
  check(await sb().rpc("set_tin", { cid, subj: "client", ref: "", tin }));
}

async function tinsFor(cid: string, packet: Packet): Promise<{ map: Map<string, string>; client: string | null }> {
  const map = new Map<string, string>();
  let client: string | null = null;
  try {
    for (const n of packetTinNeeds(packet)) {
      const r = await sb().rpc("get_tin", { cid, subj: n.subject, ref: n.ref });
      if (!r.error && r.data) map.set(tinKey(n.subject, n.ref), String(r.data));
    }
    const c = await sb().rpc("get_tin", { cid, subj: "client", ref: "" });
    if (!c.error && c.data) client = String(c.data);
  } catch {
    /* without TIN consent the PDF prints blanks */
  }
  return { map, client };
}

/** A stored packet with TINs put back in, ready to print. */
export async function printablePacket(cid: string, client: PrepClient, packet: Packet): Promise<{ client: ClientInfo; packet: Packet }> {
  const t = await tinsFor(cid, packet);
  return { client: { name: client.name, profile: client.profile, corporate: client.corporate, tin: t.client }, packet: fillTins(packet, t.map) };
}

// ---------- Periods and packets ----------

export async function loadPeriods(cid: string): Promise<PeriodRow[]> {
  return check(await sb().from("periods").select("id,prep_client_id,kind,start_date,end_date,status").eq("prep_client_id", cid).order("start_date", { ascending: false })) as PeriodRow[];
}

export async function setPeriodStatus(cid: string, q: QuarterRef, status: string, month?: number): Promise<PeriodRow> {
  const p = month ? monthPeriod(q.year, month) : quarterPeriod(q);
  const existing = (check(await sb().from("periods").select("id,prep_client_id,kind,start_date,end_date,status").eq("prep_client_id", cid).eq("kind", p.kind).eq("start_date", p.start_date)) as PeriodRow[])[0];
  if (existing) {
    const rows = check(await sb().from("periods").update({ status }).eq("id", existing.id).select("id,prep_client_id,kind,start_date,end_date,status")) as PeriodRow[];
    return rows[0] ?? { ...existing, status };
  }
  const rows = check(await sb().from("periods").insert({ prep_client_id: cid, ...p, status }).select("id,prep_client_id,kind,start_date,end_date,status")) as PeriodRow[];
  return rows[0]!;
}

export async function loadPackets(cid: string): Promise<PacketRow[]> {
  return check(await sb().from("packets").select("id,period_id,prep_client_id,payload,status,prepared_at,reviewed_by,reviewed_at,released_at").eq("prep_client_id", cid).order("prepared_at", { ascending: false })) as PacketRow[];
}

/** Firm: prepares the packet for a quarter from the client's stored records and saves it (without TINs). */
export async function createPacket(client: PrepClient, q: QuarterRef, month?: number): Promise<PacketRow> {
  const records = await loadRecords(client.id);
  const packet = preparePacket({ client: { name: client.name, profile: client.profile, corporate: client.corporate }, records, period: q, month });
  const period = await setPeriodStatus(client.id, q, "prepared", month);
  const rows = check(await sb().from("packets").insert({ period_id: period.id, prep_client_id: client.id, payload: redactTins(packet), status: "prepared" }).select("id,period_id,prep_client_id,payload,status,prepared_at,reviewed_by,reviewed_at,released_at")) as PacketRow[];
  return rows[0]!;
}

export async function setPacketStatus(packet: PacketRow, status: "reviewed" | "released"): Promise<void> {
  check(await sb().from("packets").update({ status }).eq("id", packet.id));
  if (status === "reviewed" || status === "released") check(await sb().from("periods").update({ status }).eq("id", packet.period_id));
}

export async function firmMemberName(userId: string | null): Promise<string | null> {
  if (!userId) return null;
  const rows = check(await sb().from("firm_members").select("user_id,display_name").eq("user_id", userId)) as { display_name: string | null }[];
  return rows[0]?.display_name ?? null;
}

// ---------- Receipts (private storage bucket "receipts", folder per client) ----------

export const RECEIPT_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];
export const RECEIPT_MAX_BYTES = 10 * 1024 * 1024;

export function receiptProblem(file: { type: string; size: number }): string | null {
  if (!RECEIPT_TYPES.includes(file.type)) return "Upload a photo (JPG, PNG, WebP, HEIC) or a PDF.";
  if (file.size > RECEIPT_MAX_BYTES) return "The file is larger than 10 MB.";
  return null;
}

export async function loadAttachments(cid: string): Promise<Map<string, string>> {
  const rows = check(await sb().from("records").select("id,attachment_path").eq("prep_client_id", cid)) as { id: string; attachment_path: string | null }[];
  return new Map(rows.filter((r) => r.attachment_path).map((r) => [r.id, r.attachment_path!]));
}

export async function attachReceipt(cid: string, recordId: string, file: File): Promise<void> {
  const problem = receiptProblem(file);
  if (problem) throw new Error(problem);
  const safe = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-").slice(-60);
  // A fresh name per upload: storage policies allow insert and delete, not overwrite.
  const path = `${cid}/${recordId}/${Date.now()}-${safe}`;
  const up = await sb().storage.from("receipts").upload(path, file, { upsert: false, contentType: file.type });
  if (up.error) throw new Error(up.error.message);
  check(await sb().from("records").update({ attachment_path: path }).eq("id", recordId));
}

export async function openReceipt(path: string): Promise<string> {
  const r = await sb().storage.from("receipts").createSignedUrl(path, 300);
  if (r.error || !r.data) throw new Error(r.error?.message ?? "Could not open the receipt.");
  return r.data.signedUrl;
}

// ---------- Firm overview ----------

export async function loadAllQuarterPeriods(): Promise<PeriodRow[]> {
  return check(await sb().from("periods").select("id,prep_client_id,kind,start_date,end_date,status").eq("kind", "quarter")) as PeriodRow[];
}

// ---------- Export and deletion ----------

/** Everything stored for a client, as JSON (TINs shown masked). */
export async function exportClientData(cid: string): Promise<string> {
  const [client, consents, records, periods, packets, tins] = await Promise.all([
    getClient(cid),
    sb().from("client_consents").select("consent_type,version,accepted_at,withdrawn_at").eq("prep_client_id", cid),
    sb().from("records").select("id,record_date,kind,data,attachment_path,created_at").eq("prep_client_id", cid),
    loadPeriods(cid),
    loadPackets(cid),
    loadTinsOnFile(cid),
  ]);
  const data = {
    exported_at: new Date().toISOString(),
    business: { name: client.name, profile: client.profile },
    consents: consents.data ?? [],
    records: records.data ?? [],
    tins_on_file: [...tins].map(([k, last4]) => ({ who: k, last4 })),
    periods,
    packets: packets.map((p) => ({ status: p.status, period: p.payload.period_label, prepared_at: p.prepared_at, reviewed_at: p.reviewed_at, released_at: p.released_at, documents: p.payload.documents })),
  };
  return JSON.stringify(data, null, 2);
}

/** Firm: deletes a client with all records, TINs, periods, packets, consents and receipts. */
export async function deleteClientCompletely(cid: string): Promise<void> {
  const bucket = sb().storage.from("receipts");
  const top = await bucket.list(cid, { limit: 1000 });
  if (!top.error) {
    for (const folder of top.data ?? []) {
      const inner = await bucket.list(`${cid}/${folder.name}`, { limit: 1000 });
      const paths = inner.error ? [] : (inner.data ?? []).map((f) => `${cid}/${folder.name}/${f.name}`);
      if (paths.length) await bucket.remove(paths);
    }
  }
  check(await sb().from("prep_clients").delete().eq("id", cid));
}
