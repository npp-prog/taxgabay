import { expect, test } from "@playwright/test";

test("profiler → summary → calendar, with progress saved", async ({ page }) => {
  await page.goto("/profile");
  await expect(page.getByRole("heading", { name: "Your taxpayer profile" })).toBeVisible();

  // Step 1: taxpayer type
  await page.getByLabel(/Sole proprietor/).check();
  await page.getByRole("button", { name: "Next" }).click();

  // VAT status — open the "Not sure?" help on this step
  await page.getByText("Not sure?", { exact: true }).click();
  await expect(page.getByText(/Certificate of Registration \(Form 2303\)/)).toBeVisible();
  await page.getByLabel(/non-VAT/).check();
  await page.getByRole("button", { name: "Next" }).click();

  // Income tax option
  await page.getByLabel("8% on gross sales/receipts").check();
  await page.getByRole("button", { name: "Next" }).click();

  // Employees: yes
  await page.getByLabel("Yes").check();
  await page.getByRole("button", { name: "Next" }).click();

  // Expanded withholding: no (default) → channel → size → details
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByLabel("RDO code (optional)").fill("044");
  await page.getByRole("button", { name: "Next" }).click();

  // Consent is required
  await page.getByRole("button", { name: /Save and see/ }).click();
  await expect(page.getByRole("alert").filter({ hasText: "privacy notice" })).toBeVisible();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: /Save and see/ }).click();

  // Summary
  await expect(page).toHaveURL(/\/profile\/summary/);
  await expect(page.getByRole("heading", { name: "Here is what applies to you" })).toBeVisible();
  const returns = page.getByTestId("returns-list");
  await expect(returns).toContainText("1701Q");
  await expect(returns).toContainText("1701A");
  await expect(returns).toContainText("1601C");
  await expect(returns).not.toContainText("2551Q"); // 8% replaces percentage tax

  // Calendar
  await page.getByRole("link", { name: "See my tax calendar" }).click();
  await expect(page.getByRole("heading", { name: "My tax calendar" })).toBeVisible();
  const items = page.getByTestId("obligation");
  await expect(items.first()).toBeVisible();
  expect(await items.count()).toBeGreaterThan(10); // 12 × 1601C plus quarterly/annual returns
  await expect(page.getByText("1701Q").first()).toBeVisible();

  // Mark the first obligation as filed & paid; it survives a reload
  const first = items.first().getByRole("checkbox");
  await first.check();
  await expect(items.first()).toContainText("Filed & paid");
  await page.reload();
  await expect(page.getByTestId("obligation").first().getByRole("checkbox")).toBeChecked();

  // Other views
  await page.getByRole("tab", { name: "By form" }).click();
  await expect(page.getByRole("heading", { name: /1601C/ })).toBeVisible();
  await page.getByRole("tab", { name: "Month" }).click();
  await expect(page.getByRole("button", { name: "Next →" })).toBeVisible();
});

test("calendar without a profile prompts to create one", async ({ page }) => {
  await page.goto("/calendar");
  await expect(page.getByRole("link", { name: "Start my profile" })).toBeVisible();
});
