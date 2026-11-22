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

test("a VAT-registered client gets the 2550Q and summary lists instead of the 2551Q", async ({ page }) => {
  await page.goto("/prepare");
  await page.getByLabel("Registered name").fill("Studio Malaya");
  await page.getByLabel("VAT registration").selectOption("vat");
  await page.getByLabel("Income tax option chosen for the year").selectOption("graduated_osd");
  await page.getByLabel("Date", { exact: true }).fill("2026-02-10");
  await page.getByLabel("Invoice no.").fill("INV-1");
  await page.getByLabel("Customer", { exact: true }).fill("Kape Co.");
  await page.getByLabel("Invoice total incl. VAT (₱)").fill("112000");
  await page.getByRole("button", { name: "Add sale" }).click();

  const docs = page.getByTestId("prepared-doc");
  const vat = docs.filter({ hasText: "Quarterly VAT return" });
  await expect(vat).toContainText("₱100,000.00"); // vatable sales, net of VAT
  await expect(vat).toContainText("₱12,000.00"); // output tax
  await expect(docs.filter({ hasText: "Summary list of sales" })).toContainText("Kape Co.");
  await expect(docs.filter({ hasText: "Quarterly percentage tax return" })).toHaveCount(0);
});
