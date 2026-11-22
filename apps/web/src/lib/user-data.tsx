"use client";

import { normalizeProfile, type Profile } from "@taxgabay/tax-engine";
import type { Session } from "@supabase/supabase-js";
import * as React from "react";
import { getSupabase, supabaseEnabled } from "./supabase";

export type ObligationStatus = "pending" | "filed_and_paid";

export interface UserData {
  profile: Profile | null;
  /** When the user agreed to the privacy notice (required before saving a profile). */
  consentAt: string | null;
  obligations: Record<string, ObligationStatus>;
  roadmap: string[];
}

const EMPTY: UserData = { profile: null, consentAt: null, obligations: {}, roadmap: [] };
const KEY = "taxgabay:v1";

// ---------- Local store (localStorage-backed, subscribable) ----------

function readLocal(): UserData {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    return { ...EMPTY, ...(JSON.parse(raw) as Partial<UserData>) };
  } catch {
    return EMPTY;
  }
}

let cache: UserData | null = null;
const listeners = new Set<() => void>();

function getSnapshot(): UserData {
  cache ??= readLocal();
  return cache;
}

function getServerSnapshot(): UserData {
  return EMPTY;
}

function setStore(next: UserData) {
  cache = next;
  try {
    if (next === EMPTY) window.localStorage.removeItem(KEY);
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

// ---------- Supabase mapping ----------

type ProfileRow = Profile & { user_id: string; consent_at: string };

async function loadRemote(userId: string): Promise<Partial<UserData>> {
  const sb = getSupabase()!;
  const [profile, obligations, roadmap] = await Promise.all([
    sb.from("profiles").select("*").eq("user_id", userId).maybeSingle<ProfileRow>(),
    sb.from("user_obligations").select("obligation_id,status"),
    sb.from("user_roadmap_progress").select("step_id"),
  ]);
  const out: Partial<UserData> = {};
  if (profile.data) {
    const r = profile.data;
    out.profile = normalizeProfile({
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
    out.consentAt = r.consent_at;
  }
  if (obligations.data) {
    out.obligations = Object.fromEntries(obligations.data.map((o) => [o.obligation_id as string, o.status as ObligationStatus]));
  }
  if (roadmap.data) out.roadmap = roadmap.data.map((r) => r.step_id as string);
  return out;
}

function profileRow(userId: string, p: Profile, consentAt: string) {
  return {
    user_id: userId,
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

// ---------- Context ----------

interface Ctx {
  data: UserData;
  /** False during server render and hydration; true once local data is readable. */
  ready: boolean;
  session: Session | null;
  saveProfile: (p: Profile) => Promise<void>;
  setObligation: (id: string, ruleId: string, period: string, dueDate: string, status: ObligationStatus) => Promise<void>;
  toggleRoadmap: (stepId: string) => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const UserDataContext = React.createContext<Ctx | null>(null);

export function UserDataProvider({ children }: { children: React.ReactNode }) {
  const data = React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const ready = React.useSyncExternalStore(noopSubscribe, () => true, () => false);
  const [session, setSession] = React.useState<Session | null>(null);

  // Supabase session: load remote data; upload a local profile on first sign-in.
  React.useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    const sync = async (s: Session | null) => {
      setSession(s);
      if (!s) return;
      const remote = await loadRemote(s.user.id);
      const local = getSnapshot();
      if (!remote.profile && local.profile && local.consentAt) {
        await sb.from("profiles").upsert(profileRow(s.user.id, local.profile, local.consentAt));
        if (local.roadmap.length) {
          await sb.from("user_roadmap_progress").upsert(local.roadmap.map((step_id) => ({ user_id: s.user.id, step_id })));
        }
        return;
      }
      setStore({ ...getSnapshot(), ...remote });
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
      const consentAt = getSnapshot().consentAt ?? new Date().toISOString();
      setStore({ ...getSnapshot(), profile, consentAt });
      const sb = getSupabase();
      if (sb && session) {
        const { error } = await sb.from("profiles").upsert(profileRow(session.user.id, profile, consentAt));
        if (error) throw error;
      }
    },
    [session],
  );

  const setObligation = React.useCallback(
    async (id: string, ruleId: string, period: string, dueDate: string, status: ObligationStatus) => {
      const cur = getSnapshot();
      setStore({ ...cur, obligations: { ...cur.obligations, [id]: status } });
      const sb = getSupabase();
      if (sb && session) {
        await sb.from("user_obligations").upsert({
          user_id: session.user.id,
          obligation_id: id,
          deadline_rule_id: ruleId,
          period,
          due_date: dueDate,
          status,
          completed_at: status === "pending" ? null : new Date().toISOString(),
        });
      }
    },
    [session],
  );

  const toggleRoadmap = React.useCallback(
    async (stepId: string) => {
      const cur = getSnapshot();
      const done = cur.roadmap.includes(stepId);
      setStore({ ...cur, roadmap: done ? cur.roadmap.filter((s) => s !== stepId) : [...cur.roadmap, stepId] });
      const sb = getSupabase();
      if (sb && session) {
        if (done) await sb.from("user_roadmap_progress").delete().eq("user_id", session.user.id).eq("step_id", stepId);
        else await sb.from("user_roadmap_progress").upsert({ user_id: session.user.id, step_id: stepId });
      }
    },
    [session],
  );

  const deleteAccount = React.useCallback(async () => {
    const sb = getSupabase();
    if (sb && session) {
      const { error } = await sb.rpc("delete_my_account");
      if (error) throw error;
      await sb.auth.signOut();
    }
    setStore(EMPTY);
  }, [session]);

  const value = React.useMemo<Ctx>(
    () => ({ data, ready, session, saveProfile, setObligation, toggleRoadmap, deleteAccount }),
    [data, ready, session, saveProfile, setObligation, toggleRoadmap, deleteAccount],
  );
  return <UserDataContext.Provider value={value}>{children}</UserDataContext.Provider>;
}

export function useUserData(): Ctx {
  const ctx = React.useContext(UserDataContext);
  if (!ctx) throw new Error("useUserData must be used inside UserDataProvider");
  return ctx;
}

export { supabaseEnabled };
