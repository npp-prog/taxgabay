import { describe, expect, it } from "vitest";
import { en } from "./en";
import { fil } from "./fil";

function leaves(o: unknown, path = ""): [string, string][] {
  if (typeof o === "string") return [[path, o]];
  if (Array.isArray(o)) return o.flatMap((v, i) => leaves(v, `${path}[${i}]`));
  return Object.entries(o as Record<string, unknown>).flatMap(([k, v]) => leaves(v, path ? `${path}.${k}` : k));
}
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("dictionaries", () => {
  const e = new Map(leaves(en));
  const f = new Map(leaves(fil));
  it("have the same keys", () => {
    expect([...f.keys()].sort()).toEqual([...e.keys()].sort());
  });
  it("keep the same placeholders and no empty strings", () => {
    for (const [k, v] of e) {
      expect(placeholders(f.get(k)!), k).toEqual(placeholders(v));
      expect(f.get(k)!.trim().length, k).toBeGreaterThan(0);
    }
  });
});

describe("format", async () => {
  const { format } = await import("./format");
  it("fills placeholders and leaves unknown ones", () => {
    expect(format("Step {n} of {total}", { n: 2, total: 9 })).toBe("Step 2 of 9");
    expect(format("Hi {name}")).toBe("Hi {name}");
  });
});
