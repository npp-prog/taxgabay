import { expect, test } from "@playwright/test";
import { installMockSupabase, MOCK_USER_ID } from "./mock-supabase";

const profile = { taxpayer_type: "self_employed", vat_status: "non_vat", income_tax_option: "eight_percent", has_employees: false, withholds_expanded: true, filing_channel: "ebirforms", efps_group: null, fiscal_year_end_month: 12, rdo_code: null, taxpayer_size: "micro", line_of_business: null };
const rec = (id: string, record_date: string, kind: string, data: object) => ({ id, prep_client_id: "pc1", record_date, kind, data });
const RECORDS = [
  rec("r1", "2026-01-10", "sale", { document_no: "SI-1", customer: { name: "Kape Co." }, amount: "30000.00" }),
  rec("r2", "2026-02-10", "sale", { document_no: "SI-2", customer: { name: "Kape Co." }, amount: "30000.00" }),
  rec("r3", "2026-03-10", "sale", { document_no: "SI-3", customer: { name: "Kape Co." }, amount: "30000.00" }),
  rec("r4", "2026-01-31", "expense", { supplier: { name: "Jose Cruz" }, category: "rent", amount: "10000.00", withholding: { atc: "WI100" } }),
];

test("firm: create a client, prepare, review and release a packet", async ({ page }) => {
  const db = await installMockSupabase(page, {
    role: null,
    tables: { firm_members: [{ user_id: MOCK_USER_ID, role: "admin", display_name: "Neil Priolo, CPA" }], prep_clients: [{ id: "pc1", name: "Ligaya Reyes", profile, invite_code: "ABCDE23456", archived: false }], records: RECORDS },
  });
  await page.goto("/firm");
  await page.getByLabel("New client (registered name)").fill("Juan Dela Cruz");
  await page.getByRole("button", { name: "Create client" }).click();
  await expect(page.getByTestId("client-detail")).toContainText("Juan Dela Cruz");
  await expect(page.getByTestId("invite-code")).not.toHaveText("—");

  await page.getByTestId("client-list").getByRole("button", { name: "Ligaya Reyes" }).click();
  await expect(page.getByTestId("invite-code")).toHaveText("ABCDE23456");
  await page.getByRole("button", { name: "Prepare Q1 2026 packet" }).click();
  const card = page.getByTestId("firm-packet");
  await expect(card).toContainText("Prepared — not reviewed");
  await expect(card).toContainText("₱500.00 to pay"); // one rent payment in January: 0619E ₱500, nothing left for the 1601EQ
  // Saved without TINs, period moved to prepared.
  expect(JSON.stringify(db.tables.packets)).not.toMatch(/"tin":"\d/);
  expect(db.tables.periods![0]).toMatchObject({ status: "prepared", start_date: "2026-01-01" });

  await card.getByRole("button", { name: "Mark reviewed" }).click();
  await expect(card).toContainText("Reviewed");
  await card.getByRole("button", { name: "Release to client" }).click();
  await expect(card).toContainText("Released to client");
  const download = page.waitForEvent("download");
  await card.getByRole("button", { name: "PDF" }).click();
  expect((await download).suggestedFilename()).toBe("ligaya-reyes-2026-q1.pdf");
});

test("client: link with an invite code, consent, add records, send to the firm, download the released packet", async ({ page }) => {
  const db = await installMockSupabase(page, {
    role: null,
    tables: {
      prep_clients: [{ id: "pc1", name: "Ligaya Reyes", profile, invite_code: "ABCDE23456", archived: false }],
      records: RECORDS,
      periods: [{ id: "p0", prep_client_id: "pc1", kind: "quarter", start_date: "2025-10-01", end_date: "2025-12-31", status: "released" }],
      packets: [],
    },
  });
  await page.goto("/prepare");
  await page.getByLabel("Invite code").fill("abcde-23456");
  await page.getByRole("button", { name: "Link my account" }).click();

  await expect(page.getByTestId("consent-card")).toBeVisible();
  await page.getByLabel(/may store my sales/).check();
  await page.getByLabel(/TINs may be stored encrypted/).check();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByTestId("client-portal")).toContainText("Ligaya Reyes");
  expect(db.tables.client_consents!.map((c) => c.consent_type).sort()).toEqual(["records_storage", "tin"]);

  // Add a sale with the customer's TIN: the record is saved without it, the TIN goes to the encrypted store.
  await page.getByLabel("Date", { exact: true }).fill("2026-03-20");
  await page.getByLabel("Invoice no.").fill("SI-4");
  await page.getByLabel("Customer", { exact: true }).fill("Bright Corp.");
  await page.getByLabel("Amount (₱)").fill("5000");
  await page.getByLabel("Customer TIN (optional)").fill("202-333-444-000");
  await page.getByRole("button", { name: "Add sale" }).click();
  await expect(page.getByTestId("records-table")).toContainText("SI-4");
  const saved = db.tables.records!.find((r) => (r.data as { document_no?: string }).document_no === "SI-4")!;
  expect(JSON.stringify(saved)).not.toMatch(/202-?333/);
  expect(db.tins.get("pc1|customer|bright corp.")).toBe("202333444000");

  await page.getByRole("button", { name: "My records for Q1 2026 are complete" }).click();
  await expect(page.getByTestId("period-status")).toHaveText("Records complete — waiting for the firm");

  // The firm releases a packet (simulated); the client downloads it.
  db.tables.packets!.push({ id: "k1", period_id: "p0", prep_client_id: "pc1", status: "released", prepared_at: "2026-01-20T00:00:00Z", reviewed_by: MOCK_USER_ID, reviewed_at: "2026-01-21T00:00:00Z", released_at: "2026-01-22T00:00:00Z", payload: { client: "Ligaya Reyes", period: { year: 2025, quarter: 4 }, period_label: "Q4 2025", issues: [], documents: [], total_payable: "0.00", not_supported: [] } });
  await page.reload();
  const released = page.getByTestId("released-packet");
  await expect(released).toContainText("Q4 2025");
  const download = page.waitForEvent("download");
  await released.getByRole("button", { name: "Download packet (PDF)" }).click();
  expect((await download).suggestedFilename()).toBe("taxgabay-packet-2025-q4.pdf");
});

test("non-members are kept out of the firm workspace", async ({ page }) => {
  await installMockSupabase(page, { role: null });
  await page.goto("/firm");
  await expect(page.getByTestId("firm-gate")).toContainText("not on Neil Priolo, CPA's firm team");
});

test("client: next records needed, receipt upload and data download", async ({ page }) => {
  const db = await installMockSupabase(page, {
    role: null,
    tables: {
      prep_clients: [{ id: "pc1", name: "Ligaya Reyes", profile, invite_code: "ABCDE23456", archived: false }],
      client_users: [{ prep_client_id: "pc1", user_id: MOCK_USER_ID }],
      client_consents: [{ id: "k1", prep_client_id: "pc1", user_id: MOCK_USER_ID, consent_type: "records_storage", version: "2026-11", withdrawn_at: null }],
      records: RECORDS,
    },
  });
  await page.goto("/prepare");
  await expect(page.getByTestId("next-needed")).toContainText("Records by");

  await page.getByLabel("Attach receipt for 2026-01-10").setInputFiles({ name: "OR 123.jpg", mimeType: "image/jpeg", buffer: Buffer.from("fake-jpeg") });
  await expect(page.getByTestId("records-table").getByRole("button", { name: "View" })).toBeVisible();
  const key = [...db.storage.keys()][0]!;
  expect(key).toMatch(/^receipts\/pc1\/r1\/\d+-or-123\.jpg$/);
  expect(db.tables.records!.find((r) => r.id === "r1")!.attachment_path).toBe(key.slice("receipts/".length));

  // Wrong file type is refused before upload.
  await page.getByLabel("Attach receipt for 2026-02-10").setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("x") });
  await expect(page.getByRole("alert").filter({ hasText: "Upload a photo" })).toBeVisible();

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download my data" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("taxgabay-my-business-data.json");
  const json = JSON.parse(await (await file.createReadStream()).toArray().then((b) => Buffer.concat(b).toString("utf8")));
  expect(json.business.name).toBe("Ligaya Reyes");
  expect(json.records).toHaveLength(4);
});

test("firm: overview by deadline and deleting a client", async ({ page }) => {
  const db = await installMockSupabase(page, {
    role: null,
    tables: {
      firm_members: [{ user_id: MOCK_USER_ID, role: "admin", display_name: "Neil Priolo, CPA" }],
      prep_clients: [
        { id: "pc1", name: "Ligaya Reyes", profile, invite_code: "ABCDE23456", archived: false },
        { id: "pc2", name: "Nena Santos", profile: { ...profile, withholds_expanded: false }, invite_code: "ZXCVB23456", archived: false },
      ],
      records: RECORDS,
    },
  });
  await page.goto("/firm");
  const overview = page.getByTestId("firm-overview");
  await expect(overview).toContainText("Ligaya Reyes");
  await expect(overview).toContainText("Nena Santos");
  await overview.getByRole("button", { name: "Nena Santos" }).click();
  await expect(page.getByTestId("client-detail")).toContainText("Nena Santos");
  page.once("dialog", (d) => d.accept("Nena Santos"));
  await page.getByRole("button", { name: "Delete client and all data" }).click();
  await expect(page.getByTestId("client-list")).not.toContainText("Nena Santos");
  expect(db.tables.prep_clients!.map((c) => c.id)).toEqual(["pc1"]);
});
