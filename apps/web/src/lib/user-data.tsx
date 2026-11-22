"use client";

import { normalizeProfile, type Profile } from "@taxgabay/tax-engine";
import type { Session } from "@supabase/supabase-js";
import * as React from "react";
import {
  activeClient,
  addClient as addClientPure,
  dbClientId,
  DEFAULT_CLIENT_ID,
  DEFAULT_CLIENT_NAME,
  emptyClient,
  emptyStore,
  localClientId,
  parseStore,
  removeClient as removeClientPure,
  renameClient as renameClientPure,
  switchClient as switchClientPure,
  updateClient,
  type ClientData,
  type ClientStore,
  type ObligationStatus,
} from "./clients-core";
import { getSupabase, supabaseEnabled } from "./supabase";

export type { ClientData, ObligationStatus };

/** The active client's data — the shape every page used before multi-client mode. */
export interface UserData {
  profile: Profile | null;
  /** When the user agreed to the privacy notice (required before saving a profile). */
  consentAt: string | null;
  obligations: Record<string, ObligationStatus>;
  roadmap: string[];
  /** Checklist progress keys: `<item id>@<period>`. */
  checklist: string[];
}

const KEY = "taxgabay:v1";

// ---------- Local store (localStorage-backed, subscribable) ----------

function readLocal(): ClientStore {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? parseStore(JSON.parse(raw)) : emptyStore();
  } catch {
    return emptyStore();
  }
}

const SERVER_STORE = emptyStore();
let cache: ClientStore | null = null;
const listeners = new Set<() => void>();

function getSnapshot(): ClientStore {
  cache ??= readLocal();
  return cache;
}

function getServerSnapshot(): ClientStore {
  return SERVER_STORE;
}

function setStore(next: ClientStore | null) {
  cache = next ?? emptyStore();
  try {
    if (!next) window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage blocked (private mode): the app still works for this session.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Keep tabs in sync.
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = readLocal();
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

const noopSubscribe = () => () => {};

function newClientId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  // Fallback for non-secure contexts: RFC 4122 version 4 from random bytes.
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// ---------- Supabase mapping ----------

function splitChecklistKey(key: string): { checklist_item_id: string; period: string } {
  const at = key.lastIndexOf("@");
  return { checklist_item_id: key.slice(0, at), period: key.slice(at + 1) };
}

type ProfileRow = Profile & { user_id: string; client_id: string | null; consent_at: string };

function rowToProfile(r: ProfileRow): Profile {
  return normalizeProfile({
    taxpayer_type: r.taxpayer_type,
    vat_status: r.vat_status,
    income_tax_option: r.income_tax_option,
    has_employees: r.has_employees,
    withholds_expanded: r.withholds_expanded,
    filing_channel: r.filing_channel,
    efps_group: r.efps_group,
    fiscal_year_end_month: r.fiscal_year_end_month,
    rdo_code: r.rdo_code,
    taxpayer_size: r.taxpayer_size,
    line_of_business: r.line_of_business,
  });
}

/** Loads every client of the signed-in user. Returns null when the user has nothing saved yet. */
async function loadRemote(userId: string, localDefaultName: string): Promise<ClientData[] | null> {
  const sb = getSupabase()!;
  const [clients, profiles, obligations, roadmap, checklist] = await Promise.all([
    sb.from("clients").select("id,name,created_at").order("created_at"),
    sb.from("profiles").select("*").eq("user_id", userId),
    sb.from("user_obligations").select("obligation_id,status,client_id"),
    sb.from("user_roadmap_progress").select("step_id,client_id"),
    sb.from("user_checklist_progress").select("checklist_item_id,period,client_id"),
  ]);
  const clientRows = (clients.data ?? []) as { id: string; name: string }[];
  const profileRows = (profiles.data ?? []) as ProfileRow[];
  if (clientRows.length === 0 && profileRows.length === 0) return null;

  const byId = new Map<string, ClientData>();
  byId.set(DEFAULT_CLIENT_ID, emptyClient(DEFAULT_CLIENT_ID, localDefaultName));
  for (const c of clientRows) byId.set(c.id, emptyClient(c.id, c.name));
  for (const p of profileRows) {
    const c = byId.get(localClientId(p.client_id));
    if (c) Object.assign(c, { profile: rowToProfile(p), consentAt: p.consent_at });
  }
  for (const o of (obligations.data ?? []) as { obligation_id: string; status: ObligationStatus; client_id: string | null }[]) {
    const c = byId.get(localClientId(o.client_id));
    if (c) c.obligations[o.obligation_id] = o.status;
  }
  for (const r of (roadmap.data ?? []) as { step_id: string; client_id: string | null }[]) byId.get(localClientId(r.client_id))?.roadmap.push(r.step_id);
  for (const k of (checklist.data ?? []) as { checklist_item_id: string; period: string; client_id: string | null }[]) {
    byId.get(localClientId(k.client_id))?.checklist.push(`${k.checklist_item_id}@${k.period}`);
  }
  const list = [...byId.values()];
  // Hide an empty default client when the user only keeps named clients.
  const def = list[0]!;
  return def.profile || list.length === 1 ? list : list.slice(1);
}

function profileRow(userId: string, clientId: string, p: Profile, consentAt: string) {
  return {
    user_id: userId,
    client_id: dbClientId(clientId),
    taxpayer_type: p.taxpayer_type,
    vat_status: p.vat_status,
    income_tax_option: p.income_tax_option,
    has_employees: p.has_employees,
    withholds_expanded: p.withholds_expanded,
    filing_channel: p.filing_channel,
    efps_group: p.efps_group,
    fiscal_year_end_month: p.fiscal_year_end_month,
    rdo_code: p.rdo_code,
    taxpayer_size: p.taxpayer_size,
    line_of_business: p.line_of_business,
    consent_at: consentAt,
    updated_at: new Date().toISOString(),
  };
}

/** Uploads every local client the first time a user signs in. */
async function uploadLocal(userId: string, s: ClientStore) {
  const sb = getSupabase()!;
  for (const c of s.clients) {
    if (c.id !== DEFAULT_CLIENT_ID) await sb.from("clients").upsert({ id: c.id, user_id: userId, name: c.name });
    const client_id = dbClientId(c.id);
    if (c.profile && c.consentAt) await sb.from("profiles").upsert(profileRow(userId, c.id, c.profile, c.consentAt), { onConflict: "user_id,client_id" });
    if (c.roadmap.length) await sb.from("user_roadmap_progress").upsert(c.roadmap.map((step_id) => ({ user_id: userId, client_id, step_id })), { onConflict: "user_id,client_id,step_id" });
    if (c.checklist.length) {
      await sb.from("user_checklist_progress").upsert(
        c.checklist.map((k) => ({ user_id: userId, client_id, ...splitChecklistKey(k) })),
        { onConflict: "user_id,client_id,checklist_item_id,period" },
      );
    }
  }
}

// ---------- Context ----------

interface Ctx {
  /** The active client's data. */
  data: UserData;
  clients: ClientData[];
  activeClientId: string;
  /** False during server render and hydration; true once local data is readable. */
  ready: boolean;
  session: Session | null;
  saveProfile: (p: Profile) => Promise<void>;
  /** Marks an obligation; `clientId` defaults to the active client. */
  setObligation: (id: string, ruleId: string, period: string, dueDate: string, status: ObligationStatus, clientId?: string) => Promise<void>;
  toggleRoadmap: (stepId: string) => Promise<void>;
  toggleChecklist: (key: string) => Promise<void>;
  addClient: (name: string) => Promise<string>;
  renameClient: (id: string, name: string) => Promise<void>;
  removeClient: (id: string) => Promise<void>;
  switchClient: (id: string) => void;
  deleteAccount: () => Promise<void>;
}

const UserDataContext = React.createContext<Ctx | null>(null);

export function UserDataProvider({ children }: { children: React.ReactNode }) {
  const store = React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const ready = React.useSyncExternalStore(noopSubscribe, () => true, () => false);
  const [session, setSession] = React.useState<Session | null>(null);
  const active = activeClient(store);
  const data = React.useMemo<UserData>(
    () => ({ profile: active.profile, consentAt: active.consentAt, obligations: active.obligations, roadmap: active.roadmap, checklist: active.checklist }),
    [active],
  );

  // Supabase session: load remote clients; upload local clients on first sign-in.
  React.useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    const sync = async (s: Session | null) => {
      setSession(s);
      if (!s) return;
      const local = getSnapshot();
      const defName = local.clients.find((c) => c.id === DEFAULT_CLIENT_ID)?.name ?? DEFAULT_CLIENT_NAME;
      const remote = await loadRemote(s.user.id, defName);
      if (!remote) {
        if (local.clients.some((c) => c.profile && c.consentAt)) await uploadLocal(s.user.id, local);
        return;
      }
      const cur = getSnapshot();
      setStore({ version: 2, clients: remote, activeClientId: remote.some((c) => c.id === cur.activeClientId) ? cur.activeClientId : remote[0]!.id });
    };
    sb.auth.getSession().then(({ data: { session: s } }) => sync(s));
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => {
      void sync(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const saveProfile = React.useCallback(
    async (p: Profile) => {
      const profile = normalizeProfile(p);
      const cur = getSnapshot();
      const c = activeClient(cur);
      const consentAt = c.consentAt ?? new Date().toISOString();
      setStore(updateClient(cur, c.id, (x) => ({ ...x, profile, consentAt })));
      const sb = getSupabase();
      if (sb && session) {
        if (c.id !== DEFAULT_CLIENT_ID) await sb.from("clients").upsert({ id: c.id, user_id: session.user.id, name: c.name });
        const { error } = await sb.from("profiles").upsert(profileRow(session.user.id, c.id, profile, consentAt), { onConflict: "user_id,client_id" });
        if (error) throw error;
      }
    },
    [session],
  );

  const setObligation = React.useCallback(
    async (id: string, ruleId: string, period: string, dueDate: string, status: ObligationStatus, clientId?: string) => {
      const cur = getSnapshot();
      const cid = clientId ?? cur.activeClientId;
      setStore(updateClient(cur, cid, (c) => ({ ...c, obligations: { ...c.obligations, [id]: status } })));
      const sb = getSupabase();
      if (sb && session) {
        await sb.from("user_obligations").upsert(
          {
            user_id: session.user.id,
            client_id: dbClientId(cid),
            obligation_id: id,
            deadline_rule_id: ruleId,
            period,
            due_date: dueDate,
            status,
            completed_at: status === "pending" ? null : new Date().toISOString(),
          },
          { onConflict: "user_id,client_id,obligation_id" },
        );
      }
    },
    [session],
  );

  const toggleRoadmap = React.useCallback(
    async (stepId: string) => {
      const cur = getSnapshot();
      const c = activeClient(cur);
      const done = c.roadmap.includes(stepId);
      setStore(updateClient(cur, c.id, (x) => ({ ...x, roadmap: done ? x.roadmap.filter((s) => s !== stepId) : [...x.roadmap, stepId] })));
      const sb = getSupabase();
      if (sb && session) {
        const client_id = dbClientId(c.id);
        if (done) {
          let q = sb.from("user_roadmap_progress").delete().eq("user_id", session.user.id).eq("step_id", stepId);
          q = client_id ? q.eq("client_id", client_id) : q.is("client_id", null);
          await q;
        } else await sb.from("user_roadmap_progress").upsert({ user_id: session.user.id, client_id, step_id: stepId }, { onConflict: "user_id,client_id,step_id" });
      }
    },
    [session],
  );

  const toggleChecklist = React.useCallback(
    async (key: string) => {
      const cur = getSnapshot();
      const c = activeClient(cur);
      const done = c.checklist.includes(key);
      setStore(updateClient(cur, c.id, (x) => ({ ...x, checklist: done ? x.checklist.filter((k) => k !== key) : [...x.checklist, key] })));
      const sb = getSupabase();
      if (sb && session) {
        const client_id = dbClientId(c.id);
        const parts = splitChecklistKey(key);
        if (done) {
          let q = sb.from("user_checklist_progress").delete().match({ user_id: session.user.id, ...parts });
          q = client_id ? q.eq("client_id", client_id) : q.is("client_id", null);
          await q;
        } else {
          await sb.from("user_checklist_progress").upsert({ user_id: session.user.id, client_id, ...parts }, { onConflict: "user_id,client_id,checklist_item_id,period" });
        }
      }
    },
    [session],
  );

  const addClient = React.useCallback(
    async (name: string) => {
      const id = newClientId();
      const next = addClientPure(getSnapshot(), id, name);
      setStore(next);
      const sb = getSupabase();
      if (sb && session) {
        const { error } = await sb.from("clients").insert({ id, user_id: session.user.id, name: next.clients.at(-1)!.name });
        if (error) throw error;
      }
      return id;
    },
    [session],
  );

  const renameClient = React.useCallback(
    async (id: string, name: string) => {
      setStore(renameClientPure(getSnapshot(), id, name));
      const sb = getSupabase();
      // The default client has no database row; its name is kept on this device.
      if (sb && session && id !== DEFAULT_CLIENT_ID && name.trim()) await sb.from("clients").update({ name: name.trim() }).eq("id", id);
    },
    [session],
  );

  const removeClient = React.useCallback(
    async (id: string) => {
      const cur = getSnapshot();
      if (cur.clients.length <= 1) return;
      setStore(removeClientPure(cur, id));
      const sb = getSupabase();
      if (sb && session) {
        if (id !== DEFAULT_CLIENT_ID) await sb.from("clients").delete().eq("id", id); // rows cascade
        else {
          for (const t of ["profiles", "user_obligations", "user_roadmap_progress", "user_checklist_progress"]) {
            await sb.from(t).delete().eq("user_id", session.user.id).is("client_id", null);
          }
        }
      }
    },
    [session],
  );

  const switchClient = React.useCallback((id: string) => setStore(switchClientPure(getSnapshot(), id)), []);

  const deleteAccount = React.useCallback(async () => {
    const sb = getSupabase();
    if (sb && session) {
      const { error } = await sb.rpc("delete_my_account");
      if (error) throw error;
      await sb.auth.signOut();
    }
    setStore(null);
  }, [session]);

  const value = React.useMemo<Ctx>(
    () => ({
      data,
      clients: store.clients,
      activeClientId: store.activeClientId,
      ready,
      session,
      saveProfile,
      setObligation,
      toggleRoadmap,
      toggleChecklist,
      addClient,
      renameClient,
      removeClient,
      switchClient,
      deleteAccount,
    }),
    [data, store, ready, session, saveProfile, setObligation, toggleRoadmap, toggleChecklist, addClient, renameClient, removeClient, switchClient, deleteAccount],
  );
  return <UserDataContext.Provider value={value}>{children}</UserDataContext.Provider>;
}

export function useUserData(): Ctx {
  const ctx = React.useContext(UserDataContext);
  if (!ctx) throw new Error("useUserData must be used inside UserDataProvider");
  return ctx;
}

export { supabaseEnabled };
