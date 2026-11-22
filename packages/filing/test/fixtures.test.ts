import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { preparePacket, type ClientInfo, type ClientRecord, type QuarterRef } from "../src";

interface Fixture {
  description: string;
  client: ClientInfo;
  period: QuarterRef;
  records: ClientRecord[];
  expected: { forms: string[]; issue_codes: string[]; values: Record<string, Record<string, string>>; total_payable: string };
}

const dir = join(import.meta.dirname, "fixtures");
const fixtures = readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => [f, JSON.parse(readFileSync(join(dir, f), "utf8")) as Fixture] as const);

describe.each(fixtures)("worked example %s", (_name, fx) => {
  const packet = preparePacket({ client: fx.client, records: fx.records, period: fx.period });
  it("prepares the expected documents", () => {
    expect(packet.documents.map((d) => d.form)).toEqual(fx.expected.forms);
    expect(packet.issues.map((i) => i.code)).toEqual(fx.expected.issue_codes);
  });
  it("fills every expected box", () => {
    for (const [id, values] of Object.entries(fx.expected.values)) {
      const d = packet.documents.find((x) => x.id === id);
      expect(d, id).toBeDefined();
      for (const [k, v] of Object.entries(values)) expect(d!.fields.find((f) => f.key === k)?.value, `${id}.${k}`).toBe(v);
    }
    expect(packet.total_payable).toBe(fx.expected.total_payable);
  });
  it("gives every return a due date and explains every amount", () => {
    for (const d of packet.documents.filter((x) => !["QAP", "SAWT", "2307"].includes(x.form))) expect(d.due_date, d.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    for (const d of packet.documents) {
      expect(d.steps.length).toBeGreaterThan(0);
      expect(d.needs_verification).toBe(true);
    }
  });
});
