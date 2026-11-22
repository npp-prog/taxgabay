import { expect, test } from "@playwright/test";

test("client records become a prepared filing packet", async ({ page }) => {
  await page.goto("/prepare");
  await page.getByRole("button", { name: "Load an example" }).click();
  await expect(page.getByTestId("records-table")).toContainText("SI-0003");

  // Q1 2026: rent withholding (0619E ×2, 1601EQ, QAP, 2307), SAWT, 1701Q at 8%.
  const docs = page.getByTestId("prepared-doc");
  await expect(docs).toHaveCount(7);
  await expect(page.getByTestId("packet-total")).toHaveText("₱1,500.00");
  await expect(docs.filter({ hasText: "Quarterly remittance return of expanded withholding tax" })).toContainText("Tax still due / amount payable");
  await expect(page.getByText("Draft — not yet reviewed by Neil Priolo, CPA")).toBeVisible();

  // Add a sale by hand; the 1701Q updates.
  await page.getByLabel("Date", { exact: true }).fill("2026-03-20");
  await page.getByLabel("Invoice no.").fill("SI-0004");
  await page.getByLabel("Customer", { exact: true }).fill("New Client");
  await page.getByLabel("Amount (₱)").fill("200000");
  await page.getByRole("button", { name: "Add sale" }).click();
  await expect(docs.filter({ hasText: "Quarterly income tax return" })).toContainText("₱320,000.00");

  // Kept across reloads; the packet downloads as a PDF.
  await page.reload();
  await expect(page.getByTestId("records-table")).toContainText("SI-0004");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download packet (PDF)" }).click();
  expect((await download).suggestedFilename()).toBe("taxgabay-packet-2026-q1.pdf");
});

test("imports a CSV and reports bad rows", async ({ page }) => {
  await page.goto("/prepare");
  await page.getByLabel("Import sale CSV").setInputFiles({
    name: "sales.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("date,invoice_no,customer_name,amount\n2026-01-05,A-1,Client,1000\nbad,A-2,Client,1000\n"),
  });
  await expect(page.getByRole("status").filter({ hasText: "Imported 1 record" })).toContainText("Line 3");
  await expect(page.getByTestId("records-table")).toContainText("A-1");
});
