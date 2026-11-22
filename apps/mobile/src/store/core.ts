import { DEFAULT_PROFILE, normalizeProfile, type Profile } from "@taxgabay/tax-engine";

/**
 * Pure state core for the app's on-device data. No React Native imports, so it is
 * unit-tested with vitest; StoreProvider wires it to AsyncStorage.
 */

export const STORAGE_KEY = "taxgabay:mobile:v1";

export type ObligationStatus = "pending" | "filed_and_paid";

export interface AppState {
  profile: Profile | null;
  obligations: Record<string, ObligationStatus>;
}

export const EMPTY_STATE: AppState = { profile: null, obligations: {} };

export type Action =
  | { type: "hydrate"; state: AppState }
  | { type: "saveProfile"; profile: Profile }
  | { type: "toggleObligation"; id: string }
  | { type: "reset" };

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "hydrate":
      return action.state;
    case "saveProfile":
      return { ...state, profile: normalizeProfile(action.profile) };
    case "toggleObligation": {
      const cur = state.obligations[action.id] ?? "pending";
      const next: Record<string, ObligationStatus> = { ...state.obligations };
      if (cur === "pending") next[action.id] = "filed_and_paid";
      else delete next[action.id];
      return { ...state, obligations: next };
    }
    case "reset":
      return EMPTY_STATE;
  }
}

const PROFILE_KEYS = Object.keys(DEFAULT_PROFILE) as (keyof Profile)[];

/** Parses stored JSON defensively: unknown or broken data falls back to empty state. */
export function parseState(raw: string | null): AppState {
  if (!raw) return EMPTY_STATE;
  try {
    const data = JSON.parse(raw) as Partial<AppState>;
    let profile: Profile | null = null;
    if (data.profile && typeof data.profile === "object") {
      const p = data.profile as Partial<Profile>;
      const merged = { ...DEFAULT_PROFILE } as Record<keyof Profile, unknown>;
      for (const k of PROFILE_KEYS) if (k in p) merged[k] = p[k];
      profile = normalizeProfile(merged as unknown as Profile);
    }
    const obligations: Record<string, ObligationStatus> = {};
    if (data.obligations && typeof data.obligations === "object") {
      for (const [id, v] of Object.entries(data.obligations)) if (v === "filed_and_paid") obligations[id] = v;
    }
    return { profile, obligations };
  } catch {
    return EMPTY_STATE;
  }
}

export function serializeState(state: AppState): string {
  return JSON.stringify(state);
}
