import { DEFAULT_PROFILE } from "@taxgabay/tax-engine";
import { describe, expect, it, vi } from "vitest";
import { runReminderJob, type ReminderDeps, type ReminderUser } from "./reminders-job";

function user(over: Partial<ReminderUser> = {}): ReminderUser {
  return {
    user_id: "u1",
    email: "a@example.com",
    profile: { ...DEFAULT_PROFILE, income_tax_option: "graduated_osd" },
    settings: { days_before: [7], email_enabled: true, push_enabled: true },
    completed: new Set(),
    already_sent: new Set(),
    push_subscriptions: [{ id: "s1", endpoint: "https://push.example/1", p256dh: "k", auth: "a" }],
    ...over,
  };
}

function deps(users: ReminderUser[], over: Partial<ReminderDeps> = {}): ReminderDeps {
  return {
    loadUsers: async () => users,
    sendEmail: vi.fn(async () => {}),
    sendPush: vi.fn(async () => "ok" as const),
    removeSubscription: vi.fn(async () => {}),
    logSent: vi.fn(async () => {}),
    ...over,
  };
}

// 2026-05-08 is 7 days before the Q1 1701Q deadline (15 May 2026).
const TODAY = "2026-05-08";

describe("runReminderJob", () => {
  it("sends email and push, and logs each channel", async () => {
    const d = deps([user()]);
    const s = await runReminderJob(TODAY, d);
    expect(s).toMatchObject({ users: 1, planned: 1, sent: { email: 1, push: 1 }, errors: [] });
    expect(d.sendEmail).toHaveBeenCalledWith("a@example.com", "BIR 1701Q is due in 7 days (2026-05-15)", expect.stringContaining("For guidance only"));
    expect(JSON.parse((d.sendPush as ReturnType<typeof vi.fn>).mock.calls[0]![1] as string)).toMatchObject({ url: "/calendar" });
    expect(d.logSent).toHaveBeenCalledWith("u1", "dl-1701q:2026-03-31:7", "email");
    expect(d.logSent).toHaveBeenCalledWith("u1", "dl-1701q:2026-03-31:7", "push");
  });

  it("skips unconfigured channels (dry run) and users without email or subscriptions", async () => {
    const s1 = await runReminderJob(TODAY, deps([user()], { sendEmail: null, sendPush: null }));
    expect(s1).toMatchObject({ planned: 1, sent: { email: 0, push: 0 }, skipped: { email: 1, push: 1 } });
    const s2 = await runReminderJob(TODAY, deps([user({ email: null, push_subscriptions: [] })]));
    expect(s2.skipped).toEqual({ email: 1, push: 1 });
  });

  it("removes expired push subscriptions without logging a send", async () => {
    const d = deps([user({ settings: { days_before: [7], email_enabled: false, push_enabled: true } })], { sendPush: vi.fn(async () => "gone" as const) });
    const s = await runReminderJob(TODAY, d);
    expect(d.removeSubscription).toHaveBeenCalledWith("s1");
    expect(s.sent.push).toBe(0);
    expect(d.logSent).not.toHaveBeenCalled();
  });

  it("records errors and keeps going", async () => {
    const d = deps([user({ user_id: "bad" }), user({ user_id: "good" })], {
      sendEmail: vi.fn(async (to: string) => {
        if (to === "a@example.com") throw new Error("smtp down");
      }),
      sendPush: vi.fn(async () => {
        throw new Error("push down");
      }),
    });
    const s = await runReminderJob(TODAY, d);
    expect(s.errors).toHaveLength(4);
    expect(s.errors[0]).toContain("smtp down");
  });

  it("handles a user whose profile matches no deadline rules", async () => {
    const broken = user({ user_id: "broken", profile: { ...DEFAULT_PROFILE, taxpayer_type: "nope" as never } });
    const s = await runReminderJob(TODAY, deps([broken, user()]));
    expect(s.users).toBe(2);
    expect(s.planned).toBe(1);
  });
});

describe("calendar data in the reminder job", () => {
  it("uses admin-entered extensions when provided", async () => {
    const d = deps([user()], {
      loadCalendar: async () => ({
        holidays: [],
        extensions: [{ form_code: "1701Q", original_date: "2026-05-15", new_date: "2026-05-22", issuance_ref: "RMC test" }],
      }),
    });
    // With the extension, the Q1 1701Q is due 22 May, so 8 May is no longer 7 days before.
    expect((await runReminderJob(TODAY, d)).planned).toBe(0);
    expect((await runReminderJob("2026-05-15", d)).planned).toBe(1);
  });
});

describe("multi-client reminders", () => {
  it("prefixes the message with the client name and the log key with the client id", async () => {
    const d = deps([user({ client_id: "c1", client_name: "Aling Nena Store" })]);
    await runReminderJob(TODAY, d);
    expect(d.sendEmail).toHaveBeenCalledWith("a@example.com", "[Aling Nena Store] BIR 1701Q is due in 7 days (2026-05-15)", expect.stringMatching(/^For Aling Nena Store:\n/));
    expect(d.logSent).toHaveBeenCalledWith("u1", "c1:dl-1701q:2026-03-31:7", "email");
  });

  it("keeps the default client's log keys unprefixed", async () => {
    const d = deps([user({ client_id: null })]);
    await runReminderJob(TODAY, d);
    expect(d.logSent).toHaveBeenCalledWith("u1", "dl-1701q:2026-03-31:7", "email");
  });
});
