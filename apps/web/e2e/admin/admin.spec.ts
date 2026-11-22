import { expect, test } from "@playwright/test";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { installMockSupabase, issuance } from "./mock-supabase";

const SAMPLE = `REPUBLIC OF THE PHILIPPINES
BUREAU OF INTERNAL REVENUE

March 3, 2031

REVENUE REGULATIONS NO. 99-2031

SUBJECT: Amending Revenue Regulations No. 2-98 on Expanded Withholding Tax

SECTION 1. These Regulations implement Republic Act No. 11976. Creditable withholding tax applies.`;

test("non-admins see the gate", async ({ page }) => {
  await installMockSupabase(page, { role: null });
  await page.goto("/admin");
  await expect(page.getByTestId("admin-gate")).toContainText("not an admin");
});

test("dashboard shows workflow counts and the verification overview", async ({ page }) => {
  await installMockSupabase(page, {
    tables: {
      issuances: [
        issuance({ slug: "rr-1-2031", number: "1-2031", title: "A" }),
        issuance({ slug: "rr-2-2031", number: "2-2031", title: "B" }),
        issuance({ slug: "ra-11976", type: "RA", number: "11976", title: "C", workflow_state: "published" }),
      ],
    },
  });
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Admin dashboard" })).toBeVisible();
  await expect(page.getByTestId("count-draft")).toHaveText("2");
  await expect(page.getByTestId("count-published")).toHaveText("1");
  await expect(page.getByText("Tax rules", { exact: true })).toBeVisible();
  await expect(page.getByText("pen-compromise-rmo7-2015")).toBeVisible();
});

test("ingest pasted text → draft → review → publish", async ({ page }) => {
  const db = await installMockSupabase(page, { tables: { issuances: [issuance({ slug: "ra-11976", type: "RA", number: "11976", title: "Ease of Paying Taxes Act", workflow_state: "published" })] } });
  await page.goto("/admin/ingest");
  await page.getByLabel("Issuance text").fill(SAMPLE);
  await page.getByRole("button", { name: "Suggest fields" }).click();
  await expect(page.getByTestId("draft-id")).toHaveText("RR 99-2031");
  await page.getByRole("button", { name: "Open in the editor" }).click();

  await expect(page.getByLabel("Number")).toHaveValue("99-2031");
  await expect(page.getByLabel("Title")).toHaveValue("Amending Revenue Regulations No. 2-98 on Expanded Withholding Tax");
  await expect(page.getByLabel("Date issued")).toHaveValue("2031-03-03");
  await expect(page.getByLabel("Expanded withholding")).toBeChecked();
  await page.getByLabel("Official source link").fill("https://www.bir.gov.ph/rr-99-2031.pdf");
  await page.getByRole("button", { name: "Save as draft" }).click();
  await expect(page).toHaveURL(/edit\?id=/);
  await expect(page.getByTestId("workflow-state")).toHaveText("draft");

  // Review is blocked until a summary is written.
  await expect(page.getByText("Write the plain-language summary.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Mark as reviewed" })).toBeDisabled();
  await page.getByLabel("Plain-language summary").fill("Updates expanded withholding rules (test).");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved.");

  // Suggested link from the source document resolves to the existing RA 11976.
  await page.getByRole("button", { name: "Add link" }).first().click();
  await expect(page.getByTestId("admin-links")).toContainText("This implements RA 11976");

  await page.getByRole("button", { name: "Mark as reviewed" }).click();
  await expect(page.getByTestId("workflow-state")).toHaveText("reviewed");
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByTestId("workflow-state")).toHaveText("published");

  // Editing a published issuance sends it back to draft.
  await page.getByLabel("Title").fill("Amending RR 2-98 (edited)");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("status")).toContainText("went back to draft");
  await expect(page.getByTestId("workflow-state")).toHaveText("draft");

  const inserted = db.requests.find((r) => r.method === "POST" && r.table === "issuances")!.body as Record<string, unknown>;
  expect(inserted).toMatchObject({ slug: "rr-99-2031", type: "RR", workflow_state: "draft" });
});

test("ingest an uploaded PDF (text extracted in the browser)", async ({ page }) => {
  await installMockSupabase(page);
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const p = pdf.addPage();
  SAMPLE.replace("99-2031", "98-2031").split("\n").forEach((line, i) => p.drawText(line, { x: 40, y: 780 - i * 18, size: 11, font }));
  const bytes = Buffer.from(await pdf.save());
  await page.goto("/admin/ingest");
  await page.getByLabel("Upload a PDF, HTML or text file").setInputFiles({ name: "rr-98-2031.pdf", mimeType: "application/pdf", buffer: bytes });
  await expect(page.getByLabel("Issuance text")).toHaveValue(/REVENUE REGULATIONS NO\. 98-2031/);
  await page.getByRole("button", { name: "Suggest fields" }).click();
  await expect(page.getByTestId("draft-id")).toHaveText("RR 98-2031");
});

test("URL fetch rejects non-government links before calling the server", async ({ page }) => {
  await installMockSupabase(page);
  await page.goto("/admin/ingest");
  await page.getByLabel("Or fetch from a link").fill("https://example.com/rr.pdf");
  await page.getByRole("button", { name: "Fetch" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Only https links on bir.gov.ph" })).toBeVisible();
});

test("source route refuses requests without an admin token", async ({ request }) => {
  const res = await request.get("/api/admin/source?url=https://www.bir.gov.ph/x.pdf");
  expect(res.status()).toBe(403);
});

test("add a BIR deadline extension and see it in the audit log", async ({ page }) => {
  const db = await installMockSupabase(page);
  await page.goto("/admin/calendar-data");
  await page.getByLabel("Form").selectOption("1701A");
  await page.getByLabel("Original due date").fill("2027-04-15");
  await page.getByLabel("New due date").fill("2027-05-17");
  await page.getByLabel("Issuance").fill("RMC 00-2027 (test)");
  await page.getByRole("button", { name: "Add extension" }).click();
  await expect(page.getByText("1701A 2027-04-15 → 2027-05-17")).toBeVisible();
  expect(db.tables.deadline_extensions).toHaveLength(1);
  await page.getByRole("link", { name: "Audit log" }).click();
  await expect(page.getByTestId("audit-rows")).toContainText("deadline_extensions");
});
