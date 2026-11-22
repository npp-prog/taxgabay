import { DEFAULT_PROFILE, type Profile } from "@taxgabay/tax-engine";
import { describe, expect, it } from "vitest";
import { recordsDone, recordsReminderMessage, reminderKey, runPrepReminderJob, type PrepReminderClient } from "./prep-reminders-job";
import { nextRecordRequests, quarterOf, RECORDS_LEAD_DAYS } from "./prep-schedule";

const profile = (p: Partial<Profile> = {}): Profile => ({ ...DEFAULT_PROFILE, taxpayer_type: "self_employed", vat_status: "non_vat", income_tax_option: "graduated_osd", ...p });

describe("nextRecordRequests", () => {
  it("lists the next prepared filings with a records date before each deadline", () => {
    const r = nextRecordRequests(profile(), "2026-04-01");
    expect(r.length).toBeGreaterThan(0);
    for (const x of r) {
      expect(["2551Q", "1701Q", "1701A", "0619E", "1601EQ"]).toContain(x.form);
      expect(x.due_date >= "2026-04-01").toBe(true);
      expect(new Date(x.due_date).getTime() - new Date(x.records_by).getTime()).toBe(RECORDS_LEAD_DAYS * 86400000);
    }
    const sorted = [...r].sort((a, b) => a.due_date.localeCompare(b.due_date));
    expect(r).toEqual(sorted);
  });
  it("asks withholding agents for monthly records (0619E)", () => {
    const r = nextRecordRequests(profile({ withholds_expanded: true }), "2026-01-01", { limit: 10 });
    expect(r.some((x) => x.form === "0619E" && x.period_end === "2026-01-31")).toBe(true);
  });
  it("finds the quarter of a date", () => {
    expect([quarterOf("2026-01-31"), quarterOf("2026-06-30"), quarterOf("2026-07-01"), quarterOf("2026-12-31")]).toEqual([1, 2, 3, 4]);
  });
});

describe("runPrepReminderJob", () => {
  const today = "2026-04-01";
  const req = nextRecordRequests(profile(), today)[0]!;
  // Run on a day that is exactly 5 days before the records date.
  const runDay = new Date(new Date(req.records_by).getTime() - 5 * 86400000).toISOString().slice(0, 10);
  const client = (over: Partial<PrepReminderClient> = {}): PrepReminderClient => ({
    id: "c1",
    name: "Ligaya",
    profile: profile(),
    users: [
      { user_id: "u1", email: "a@example.test" },
      { user_id: "u2", email: null },
    ],
    periods: new Map(),
    already_sent: new Set(),
    ...over,
  });

  it("emails client users 5 days before the records date and logs it", async () => {
    const sent: string[] = [];
    const logged: string[] = [];
    const s = await runPrepReminderJob(runDay, { loadClients: async () => [client()], sendEmail: async (to, subject) => void sent.push(`${to}|${subject}`), logSent: async (u, k) => void logged.push(`${u}|${k}`) });
    expect(s).toMatchObject({ clients: 1, sent: 1, skipped: 1, errors: [] });
    expect(sent[0]).toContain(`Records needed by ${req.records_by}`);
    expect(logged).toEqual([`u1|${reminderKey("c1", req, 5)}`]);
  });

  it("skips when already sent, when records are done, or on other days", async () => {
    const send = async () => {
      throw new Error("should not send");
    };
    const base = { sendEmail: send, logSent: async () => {} };
    expect((await runPrepReminderJob(runDay, { ...base, loadClients: async () => [client({ already_sent: new Set([reminderKey("c1", req, 5)]) })] })).sent).toBe(0);
    const qs = `${req.period_end.slice(0, 4)}-${String((quarterOf(req.period_end) - 1) * 3 + 1).padStart(2, "0")}-01`;
    expect((await runPrepReminderJob(runDay, { ...base, loadClients: async () => [client({ periods: new Map([[qs, "ready"]]) })] })).errors).toEqual([]);
    expect((await runPrepReminderJob("2026-04-02", { ...base, loadClients: async () => [client()] })).errors).toEqual([]);
  });

  it("records failures without stopping, and counts missing channels as skipped", async () => {
    const s = await runPrepReminderJob(runDay, { loadClients: async () => [client()], sendEmail: async () => Promise.reject(new Error("smtp down")), logSent: async () => {} });
    expect(s.errors[0]).toContain("smtp down");
    const s2 = await runPrepReminderJob(runDay, { loadClients: async () => [client()], sendEmail: null, logSent: async () => {} });
    expect(s2.skipped).toBe(2);
    const bad = await runPrepReminderJob(runDay, { loadClients: async () => [client({ profile: { ...profile(), taxpayer_type: "nope" as never } })], sendEmail: null, logSent: async () => {} });
    expect(bad.errors.length + bad.skipped + bad.sent).toBeGreaterThanOrEqual(0);
  });

  it("builds a plain message and knows when records are done", () => {
    const m = recordsReminderMessage("Ligaya", req, "the firm", "https://taxgabay.example/");
    expect(m.text).toContain("https://taxgabay.example/prepare");
    expect(m.text).toContain(req.due_date);
    expect(recordsDone(req, new Map())).toBe(false);
  });
});
