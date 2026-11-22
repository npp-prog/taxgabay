import { DEFAULT_PROFILE } from "@taxgabay/tax-engine";
import { describe, expect, it } from "vitest";
import {
  activeClient,
  addClient,
  dbClientId,
  DEFAULT_CLIENT_ID,
  emptyStore,
  localClientId,
  parseStore,
  reminderLogKey,
  removeClient,
  renameClient,
  switchClient,
  updateClient,
} from "./clients-core";

describe("parseStore", () => {
  it("migrates the single-profile shape into a client named Me", () => {
    const old = { profile: DEFAULT_PROFILE, consentAt: "2026-01-01T00:00:00Z", obligations: { "dl-1701q:2026-03-31": "filed_and_paid" }, roadmap: ["dti-bn"] };
    const s = parseStore(old);
    expect(s.clients).toHaveLength(1);
    expect(s.activeClientId).toBe(DEFAULT_CLIENT_ID);
    expect(activeClient(s)).toMatchObject({ id: "default", name: "Me", profile: DEFAULT_PROFILE, consentAt: "2026-01-01T00:00:00Z", roadmap: ["dti-bn"], checklist: [] });
    expect(activeClient(s).obligations["dl-1701q:2026-03-31"]).toBe("filed_and_paid");
  });

  it("returns an empty store for nothing or junk", () => {
    expect(parseStore(null)).toEqual(emptyStore());
    expect(parseStore("x")).toEqual(emptyStore());
    expect(activeClient(parseStore({})).profile).toBeNull();
  });

  it("reads the current shape, dropping duplicates and fixing a missing active id", () => {
    const s = parseStore({ version: 2, activeClientId: "zzz", clients: [{ id: "default", name: "Me" }, { id: "b", name: "B" }, { id: "b", name: "dup" }, { name: "" }] });
    expect(s.clients.map((c) => c.id)).toEqual(["default", "b", "client-3"]);
    expect(s.clients[2]!.name).toBe("Client 4");
    expect(s.activeClientId).toBe("default");
    expect(parseStore({ version: 2, activeClientId: "b", clients: [{ id: "default" }, { id: "b" }] }).activeClientId).toBe("b");
  });
});

describe("client operations", () => {
  it("adds (and switches to), renames, switches and removes clients", () => {
    let s = addClient(emptyStore(), "c1", "  Aling Nena Store ");
    expect(s.activeClientId).toBe("c1");
    expect(activeClient(s).name).toBe("Aling Nena Store");
    expect(addClient(s, "c2", " ").clients.at(-1)!.name).toBe("Client 3");
    s = renameClient(s, "c1", "Nena's");
    expect(activeClient(s).name).toBe("Nena's");
    expect(renameClient(s, "c1", "  ")).toBe(s);
    s = switchClient(s, "default");
    expect(s.activeClientId).toBe("default");
    expect(switchClient(s, "missing")).toBe(s);
    s = switchClient(s, "c1");
    s = removeClient(s, "c1");
    expect(s.clients.map((c) => c.id)).toEqual(["default"]);
    expect(s.activeClientId).toBe("default");
    expect(removeClient(s, "default")).toBe(s); // cannot remove the last
    expect(removeClient(addClient(s, "c3", "x"), "missing").clients).toHaveLength(2);
  });

  it("updates one client without touching others", () => {
    const s = addClient(emptyStore(), "c1", "A");
    const u = updateClient(s, "c1", (c) => ({ ...c, roadmap: ["x"] }));
    expect(u.clients[0]!.roadmap).toEqual([]);
    expect(u.clients[1]!.roadmap).toEqual(["x"]);
  });

  it("maps ids to and from the database", () => {
    expect(dbClientId("default")).toBeNull();
    expect(dbClientId("abc")).toBe("abc");
    expect(localClientId(null)).toBe("default");
    expect(localClientId("abc")).toBe("abc");
    expect(reminderLogKey(null, "k")).toBe("k");
    expect(reminderLogKey("c", "k")).toBe("c:k");
  });
});
