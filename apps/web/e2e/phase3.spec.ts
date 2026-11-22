import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

test("issuances library: search, filter and detail with related graph", async ({ page }) => {
  await page.goto("/issuances");
  await expect(page.getByRole("heading", { name: "BIR issuances library" })).toBeVisible();
  const count = page.getByTestId("result-count");
  await expect(count).toContainText("13 of 13");
  await page.getByLabel("Search issuances").fill("invoicing");
  await expect(count).toContainText("2 of 13");
  await page.getByLabel("Search issuances").fill("");
  await page.getByLabel("Type", { exact: true }).selectOption("RA");
  await expect(count).toContainText("5 of 13");
  await page.getByRole("link", { name: /RA 11976/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ease of Paying Taxes Act");
  await expect(page.getByRole("img", { name: /Related issuances of RA 11976/ })).toBeVisible();
  const related = page.getByTestId("related-list");
  await expect(related).toContainText("Implemented by");
  await related.getByRole("link", { name: /RR 7-2024/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("invoicing");
  await expect(page.getByRole("link", { name: /Read the official text/ })).toHaveAttribute("href", /bir\.gov\.ph/);
});

test("site search finds guides, glossary and issuances", async ({ page }) => {
  await page.goto("/search?q=2307");
  const results = page.getByTestId("search-results");
  await expect(results.locator("li").first()).toBeVisible();
  await page.getByLabel("Search TaxGabay").fill("RR 8-2018");
  await expect(results).toContainText("RR 8-2018");
  await page.getByLabel("Search TaxGabay").fill("resibo");
  await expect(results).toContainText("Glossary");
  await page.getByLabel("Search TaxGabay").fill("percentage tax");
  await page.getByRole("button", { name: /^Filing guide/ }).click();
  await expect(results.locator("li").first()).toContainText("Filing guide");
  await page.getByLabel("Search TaxGabay").fill("qqqzzz");
  await expect(page.getByText("No results")).toBeVisible();
});

test("knowledge hub: articles, glossary filter and FAQs", async ({ page }) => {
  await page.goto("/learn");
  await expect(page.getByRole("heading", { name: "Knowledge hub" })).toBeVisible();
  await page.getByRole("link", { name: /8% or graduated rates/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("8% or graduated rates: how to choose");
  await expect(page.getByTestId("disclaimer")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Related" })).toBeVisible();

  await page.goto("/learn/glossary");
  await page.getByLabel("Filter terms").fill("resibo");
  await expect(page.getByTestId("glossary-term")).toHaveCount(1);
  await expect(page.getByTestId("glossary-term")).toContainText("Invoice");

  await page.goto("/learn/faq");
  await expect(page.getByRole("heading", { name: "Frequently asked questions" })).toBeVisible();
  await expect(page.locator("details").first()).toBeVisible();
});

test("PDF export of a calculator result", async ({ page }) => {
  await page.goto("/calculators/income-tax");
  await page.getByLabel("Taxable year").selectOption("2024");
  await page.getByLabel("Gross sales or receipts").fill("1000000");
  await page.getByRole("button", { name: "Compute" }).click();
  const download = page.waitForEvent("download");
  await page.getByTestId("pdf-button").click();
  const d = await download;
  expect(d.suggestedFilename()).toBe("income-tax-8-vs-graduated-rates.pdf");
  const bytes = readFileSync((await d.path())!);
  expect(bytes.subarray(0, 4).toString()).toBe("%PDF");
  expect(bytes.length).toBeGreaterThan(1500);
});

test("PDF export of the roadmap", async ({ page }) => {
  await page.goto("/roadmap");
  const download = page.waitForEvent("download");
  await page.getByTestId("pdf-button").click();
  expect((await download).suggestedFilename()).toBe("taxgabay-roadmap-dti.pdf");
});

test("admin area explains it needs Supabase in local mode", async ({ page }) => {
  await page.goto("/admin");
  await expect(page.getByTestId("admin-gate")).toContainText("needs Supabase");
});
