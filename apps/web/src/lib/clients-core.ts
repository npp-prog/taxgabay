import type { Profile } from "@taxgabay/tax-engine";

/**
 * Pure client (multi-profile) store logic. No React, no browser APIs, no `@/` imports,
 * so it is unit-tested directly.
 */

export type ObligationStatus = "pending" | "filed_and_paid";

export interface ClientData {
  id: string;
  name: string;
  profile: Profile | null;
  /** When the user agreed to the privacy notice for this client's profile. */
  consentAt: string | null;
  obligations: Record<string, ObligationStatus>;
  roadmap: string[];
  /** Checklist progress keys: `<item id>@<period>`. */
  checklist: string[];
}

export interface ClientStore {
  version: 2;
  clients: ClientData[];
  activeClientId: string;
}

/**
 * The first client. In the database its rows have `client_id = null` (rows written
 * before multi-client mode existed belong to it).
 */
export const DEFAULT_CLIENT_ID = "default";
export const DEFAULT_CLIENT_NAME = "Me";

export function emptyClient(id: string, name: string): ClientData {
  return { id, name, profile: null, consentAt: null, obligations: {}, roadmap: [], checklist: [] };
}

export function emptyStore(): ClientStore {
  return { version: 2, clients: [emptyClient(DEFAULT_CLIENT_ID, DEFAULT_CLIENT_NAME)], activeClientId: DEFAULT_CLIENT_ID };
}

function asClient(raw: unknown, fallbackId: string, fallbackName: string): ClientData {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<ClientData>;
  return {
    id: typeof r.id === "string" && r.id ? r.id : fallbackId,
    name: typeof r.name === "string" && r.name.trim() ? r.name : fallbackName,
    profile: r.profile ?? null,
    consentAt: r.consentAt ?? null,
    obligations: r.obligations && typeof r.obligations === "object" ? r.obligations : {},
    roadmap: Array.isArray(r.roadmap) ? r.roadmap : [],
    checklist: Array.isArray(r.checklist) ? r.checklist : [],
  };
}

/**
 * Reads whatever is in storage: the current shape, the single-profile shape used before
 * multi-client mode (migrated into a client named "Me"), or nothing.
 */
export function parseStore(raw: unknown): ClientStore {
  if (!raw || typeof raw !== "object") return emptyStore();
  const r = raw as Record<string, unknown>;
  if (r.version === 2 && Array.isArray(r.clients) && r.clients.length > 0) {
    const seen = new Set<string>();
    const clients = r.clients
      .map((c, i) => asClient(c, i === 0 ? DEFAULT_CLIENT_ID : `client-${i}`, i === 0 ? DEFAULT_CLIENT_NAME : `Client ${i + 1}`))
      .filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)));
    const active = typeof r.activeClientId === "string" && clients.some((c) => c.id === r.activeClientId) ? r.activeClientId : clients[0]!.id;
    return { version: 2, clients, activeClientId: active };
  }
  // Single-profile shape: { profile, consentAt, obligations, roadmap, checklist }.
  return { version: 2, clients: [asClient({ ...r, id: DEFAULT_CLIENT_ID, name: DEFAULT_CLIENT_NAME }, DEFAULT_CLIENT_ID, DEFAULT_CLIENT_NAME)], activeClientId: DEFAULT_CLIENT_ID };
}

export function activeClient(s: ClientStore): ClientData {
  return s.clients.find((c) => c.id === s.activeClientId) ?? s.clients[0]!;
}

export function updateClient(s: ClientStore, id: string, fn: (c: ClientData) => ClientData): ClientStore {
  return { ...s, clients: s.clients.map((c) => (c.id === id ? fn(c) : c)) };
}

export function addClient(s: ClientStore, id: string, name: string): ClientStore {
  const clean = name.trim() || `Client ${s.clients.length + 1}`;
  return { ...s, clients: [...s.clients, emptyClient(id, clean)], activeClientId: id };
}

export function renameClient(s: ClientStore, id: string, name: string): ClientStore {
  const clean = name.trim();
  if (!clean) return s;
  return updateClient(s, id, (c) => ({ ...c, name: clean }));
}

/** Removes a client; the last one cannot be removed. */
export function removeClient(s: ClientStore, id: string): ClientStore {
  if (s.clients.length <= 1) return s;
  const clients = s.clients.filter((c) => c.id !== id);
  if (clients.length === s.clients.length) return s;
  return { ...s, clients, activeClientId: s.activeClientId === id ? clients[0]!.id : s.activeClientId };
}

export function switchClient(s: ClientStore, id: string): ClientStore {
  return s.clients.some((c) => c.id === id) ? { ...s, activeClientId: id } : s;
}

/** The database `client_id` for a local client id. */
export function dbClientId(id: string): string | null {
  return id === DEFAULT_CLIENT_ID ? null : id;
}

/** The local client id for a database `client_id`. */
export function localClientId(dbId: string | null | undefined): string {
  return dbId ?? DEFAULT_CLIENT_ID;
}

/** Prefix that keeps reminder-log keys apart when two clients have the same obligation. */
export function reminderLogKey(clientId: string | null, key: string): string {
  return clientId ? `${clientId}:${key}` : key;
}
