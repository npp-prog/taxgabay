"use client";

import type { ClientInfo, ClientRecord } from "@taxgabay/filing";
import { DEFAULT_PROFILE } from "@taxgabay/tax-engine";
import * as React from "react";

/**
 * The client's preparation workspace. Without an account it stays in this browser only;
 * the firm workspace (Supabase, reviewed by Neil Priolo, CPA) stores it on the server.
 */
export interface PrepareState {
  client: ClientInfo;
  /** Client agreed that TINs may be kept (here: in this browser) and printed on documents. */
  tinConsent: boolean;
  records: ClientRecord[];
}

const KEY = "taxgabay:prepare:v1";
export const EMPTY_PREPARE: PrepareState = {
  client: { name: "", tin: null, profile: { ...DEFAULT_PROFILE, taxpayer_type: "self_employed", vat_status: "non_vat", income_tax_option: "eight_percent" } },
  tinConsent: false,
  records: [],
};

let cache: PrepareState | null = null;
const listeners = new Set<() => void>();

function read(): PrepareState {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY_PREPARE;
    const p = JSON.parse(raw) as Partial<PrepareState>;
    return { ...EMPTY_PREPARE, ...p, client: { ...EMPTY_PREPARE.client, ...p.client, profile: { ...EMPTY_PREPARE.client.profile, ...p.client?.profile } }, records: Array.isArray(p.records) ? p.records : [] };
  } catch {
    return EMPTY_PREPARE;
  }
}

/** Removes every TIN from the state (used when consent is withdrawn). */
export function withoutTins(s: PrepareState): PrepareState {
  const strip = <T extends { tin?: string | null }>(p: T): T => ({ ...p, tin: null });
  return {
    ...s,
    client: strip(s.client),
    records: s.records.map((r) => (r.kind === "sale" ? { ...r, customer: strip(r.customer) } : r.kind === "expense" ? { ...r, supplier: strip(r.supplier) } : { ...r, payor: strip(r.payor) })),
  };
}

function write(next: PrepareState) {
  const safe = next.tinConsent ? next : withoutTins(next);
  cache = safe;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(safe));
  } catch {
    /* storage blocked: keeps working for this visit */
  }
  listeners.forEach((l) => l());
}

export function usePrepare() {
  const state = React.useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => (cache ??= read()),
    () => EMPTY_PREPARE,
  );
  return {
    state,
    update: (fn: (s: PrepareState) => PrepareState) => write(fn(cache ?? read())),
    reset: () => write(EMPTY_PREPARE),
  };
}
