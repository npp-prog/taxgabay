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

test("payroll records produce the monthly 1601C and the contributions summary", async ({ page }) => {
  await page.goto("/prepare");
  await page.getByLabel(/I have employees/).check();
  await page.getByRole("tab", { name: /Payroll/ }).click();
  await page.getByLabel("Month's last payday").fill("2026-01-31");
  await page.getByLabel("Employee", { exact: true }).fill("Ana Santos");
  await page.getByLabel("Basic pay for the month (₱)").fill("30000");
  await page.getByRole("button", { name: "Add payroll" }).click();
  await expect(page.getByTestId("records-table")).toContainText("Ana Santos");

  const docs = page.getByTestId("prepared-doc");
  // ₱30,000 less ₱2,450 employee contributions = ₱27,550; 15% of the excess over ₱20,833 = ₱1,007.55.
  await expect(docs.filter({ hasText: "January 2026" }).filter({ hasText: "compensation" })).toContainText("₱1,007.55");
  await expect(docs.filter({ hasText: "Contributions to remit" })).toContainText("₱6,400.00");
});

test("a corporation gets the 1702Q with the higher of regular tax and MCIT", async ({ page }) => {
  await page.goto("/prepare");
  // Retry until the page is interactive (a choice made before hydration is lost).
  await expect(async () => {
    await page.getByLabel("You are a").selectOption("corporation");
    await expect(page.getByLabel("Year operations began")).toBeVisible({ timeout: 1000 });
  }).toPass();
  await page.getByLabel("Year operations began").fill("2021");
  await page.getByLabel("Total assets excl. land (₱)").fill("5000000");
  await page.getByLabel("Date", { exact: true }).fill("2026-02-10");
  await page.getByLabel("Invoice no.").fill("1");
  await page.getByLabel("Customer", { exact: true }).fill("Client");
  await page.getByLabel("Amount (₱)").fill("1000000");
  await page.getByRole("button", { name: "Add sale" }).click();
  const q = page.getByTestId("prepared-doc").filter({ hasText: "Quarterly income tax return (corporations" });
  await expect(q).toContainText("₱200,000.00"); // 20% reduced rate on ₱1,000,000
  await expect(q).toContainText("₱20,000.00"); // MCIT 2% of gross income
});

test("records are posted to books, trial balance and statements", async ({ page }) => {
  await page.goto("/prepare");
  await page.getByRole("button", { name: "Load an example" }).click();
  const books = page.getByTestId("books-section");
  await expect(books).toContainText("Cash receipts book");
  await books.getByRole("tab", { name: "Trial balance" }).click();
  // Cash ₱88,000 + creditable withholding ₱3,500 + rent ₱30,000 = sales ₱120,000 + EWT payable ₱1,500.
  await expect(page.getByTestId("trial-balance")).toContainText("₱121,500.00");
  await books.getByRole("tab", { name: "Statements" }).click();
  await expect(page.getByTestId("statements")).toContainText("₱90,000.00"); // net income before income tax
  const download = page.waitForEvent("download");
  await books.getByRole("button", { name: "Books (PDF)" }).click();
  expect((await download).suggestedFilename()).toBe("taxgabay-books-2026-01-01-2026-03-31.pdf");
});

test("journal entries complete the books, and a monthly packet holds the month's returns", async ({ page }) => {
  await page.goto("/prepare");
  await page.getByRole("button", { name: "Load an example" }).click();
  await page.getByRole("tab", { name: /Journal entries/ }).click();

  // Paid January's expanded withholding (₱500).
  await page.getByLabel("Kind of entry").selectOption("remittance");
  await page.locator("#j-date").fill("2026-02-10");
  await page.getByLabel("What was paid").selectOption("202");
  await page.getByLabel("Amount (₱)").fill("500");
  await page.getByRole("button", { name: "Add entry" }).click();
  await expect(page.getByTestId("records-table")).toContainText("Paid Expanded withholding tax");

  // An unbalanced opening entry is refused.
  await page.getByLabel("Kind of entry").selectOption("opening");
  await page.locator("#j-date").fill("2026-01-01");
  await page.getByLabel("Line 1 debit").fill("50000");
  await page.getByLabel("Line 2 credit").fill("40000");
  await page.getByRole("button", { name: "Add entry" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "not equal" })).toBeVisible();
  await page.getByLabel("Line 2 credit").fill("50000");
  await page.getByRole("button", { name: "Add entry" }).click();
  await expect(page.getByTestId("records-table")).toContainText("Opening balances");

  const books = page.getByTestId("books-section");
  await books.getByRole("tab", { name: "Trial balance" }).click();
  // Before: ₱121,500. Opening cash/capital adds ₱50,000; the ₱500 payment clears EWT payable against cash.
  await expect(page.getByTestId("trial-balance")).toContainText("₱171,000.00");

  await page.getByLabel("Packet", { exact: true }).selectOption("1");
  const docs = page.getByTestId("prepared-doc");
  await expect(docs).toHaveCount(1);
  await expect(docs.first()).toContainText("January 2026");
});

test("schedules download as CSV", async ({ page }) => {
  await page.goto("/prepare");
  await page.getByRole("button", { name: "Load an example" }).click();
  const qap = page.getByTestId("prepared-doc").filter({ hasText: "Quarterly alphalist of payees" });
  const download = page.waitForEvent("download");
  await qap.getByRole("button", { name: "Download this list as CSV" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("taxgabay-qap-2026-03-31.csv");
  const text = Buffer.concat(await (await file.createReadStream()).toArray()).toString("utf8");
  expect(text.split("\n")[0]).toBe("TIN,Payee,ATC,Income payment,Rate,Tax withheld");
  expect(text).toContain("Jose Cruz,WI100,30000.00,5%,1500.00");
});

test("a mixed-income earner adds the 2316 and gets the annual 1701", async ({ page }) => {
  await page.goto("/prepare");
  await expect(async () => {
    await page.getByLabel("You are a").selectOption("mixed_income");
    await expect(page.getByRole("tab", { name: /2316s \(salary\)/ })).toBeVisible({ timeout: 1000 });
  }).toPass();
  await page.getByLabel("Date", { exact: true }).fill("2026-11-15");
  await page.getByLabel("Invoice no.").fill("1");
  await page.getByLabel("Customer", { exact: true }).fill("Client");
  await page.getByLabel("Amount (₱)").fill("240000");
  await page.getByRole("button", { name: "Add sale" }).click();
  await page.getByRole("tab", { name: /2316s \(salary\)/ }).click();
  await page.getByLabel("Date received").fill("2027-01-20");
  await page.getByLabel("Employer", { exact: true }).fill("Acme Philippines, Inc.");
  await page.getByLabel("Year of the compensation").fill("2026");
  await page.getByLabel("Taxable compensation (₱)").fill("400000");
  await page.getByLabel("Tax withheld (₱)").fill("22500");
  await page.getByRole("button", { name: "Add 2316" }).click();
  await page.getByLabel("Quarter").selectOption("4");
  const annual = page.getByTestId("prepared-doc").filter({ hasText: "mixed income" });
  await expect(annual).toContainText("₱400,000.00");
  await expect(annual).toContainText("₱41,700.00"); // ₱22,500 on compensation + 8% of ₱240,000
});

test("a corporation on a June fiscal year gets fiscal-quarter returns", async ({ page }) => {
  await page.goto("/prepare");
  await expect(async () => {
    await page.getByLabel("You are a").selectOption("opc");
    await expect(page.getByLabel("Taxable year ends")).toBeVisible({ timeout: 1000 });
  }).toPass();
  await page.getByLabel("Taxable year ends").selectOption("6");
  await page.getByLabel("Year operations began").fill("2015");
  await page.getByLabel("Date", { exact: true }).fill("2026-08-15");
  await page.getByLabel("Invoice no.").fill("1");
  await page.getByLabel("Customer", { exact: true }).fill("Client");
  await page.getByLabel("Amount (₱)").fill("100000");
  await page.getByRole("button", { name: "Add sale" }).click();
  await page.getByLabel(/Fiscal year/).selectOption("2027");
  const q = page.getByTestId("prepared-doc").filter({ hasText: "Quarterly income tax return (corporations" });
  await expect(q).toContainText("Q1 FY2027 (Jul–Sep 2026)");
});
