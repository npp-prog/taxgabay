import { DEFAULT_PROFILE } from "@taxgabay/tax-engine";
import { describe, expect, it } from "vitest";
import { EMPTY_STATE, parseState, reducer, serializeState } from "../src/store/core";

describe("store core", () => {
  it("saves a normalized profile", () => {
    const s = reducer(EMPTY_STATE, { type: "saveProfile", profile: { ...DEFAULT_PROFILE, taxpayer_type: "self_employed", fiscal_year_end_month: 6 } });
    expect(s.profile?.taxpayer_type).toBe("self_employed");
    expect(s.profile?.fiscal_year_end_month).toBe(12); // individuals are calendar-year
  });

  it("toggles obligations on and off", () => {
    let s = reducer(EMPTY_STATE, { type: "toggleObligation", id: "dl-1701q:2026-03-31" });
    expect(s.obligations).toEqual({ "dl-1701q:2026-03-31": "filed_and_paid" });
    s = reducer(s, { type: "toggleObligation", id: "dl-1701q:2026-03-31" });
    expect(s.obligations).toEqual({});
  });

  it("hydrates and resets", () => {
    const saved = { profile: DEFAULT_PROFILE, obligations: { a: "filed_and_paid" as const } };
    expect(reducer(EMPTY_STATE, { type: "hydrate", state: saved })).toBe(saved);
    expect(reducer(saved, { type: "reset" })).toBe(EMPTY_STATE);
  });

  it("round-trips through storage", () => {
    const s = reducer(reducer(EMPTY_STATE, { type: "saveProfile", profile: DEFAULT_PROFILE }), { type: "toggleObligation", id: "x" });
    expect(parseState(serializeState(s))).toEqual(s);
  });

  it("parses defensively", () => {
    expect(parseState(null)).toBe(EMPTY_STATE);
    expect(parseState("not json")).toBe(EMPTY_STATE);
    const p = parseState(JSON.stringify({ profile: { taxpayer_type: "corporation", junk: 1 }, obligations: { a: "filed_and_paid", b: "weird" } }));
    expect(p.profile?.taxpayer_type).toBe("corporation");
    expect(p.profile?.vat_status).toBe(DEFAULT_PROFILE.vat_status);
    expect(p.profile).not.toHaveProperty("junk");
    expect(p.obligations).toEqual({ a: "filed_and_paid" });
    expect(parseState(JSON.stringify({ profile: "nope" })).profile).toBeNull();
  });
});
