import { expect, test } from "@playwright/test";

test("income tax calculator shows comparison and breakdown with legal basis", async ({ page }) => {
  await page.goto("/calculators/income-tax");
  await page.getByLabel("Taxable year").selectOption("2024");
  await page.getByLabel("Gross sales or receipts").fill("1,000,000");
  await page.getByRole("button", { name: "Compute" }).click();

  const result = page.getByTestId("calc-result");
  await expect(result.getByTestId("headline-amount")).toHaveText("₱60,000.00");
  await expect(result.getByTestId("options")).toContainText("₱92,500.00"); // graduated + OSD + 3% PT
  const steps = result.getByTestId("main-steps");
  await expect(steps).toContainText("Income tax on business at 8%");
  await expect(steps).toContainText("RR 8-2018");
  await expect(result.getByTestId("disclaimer")).toContainText("For guidance only. Verify with BIR issuances or consult a CPA.");
  await expect(result.getByTestId("disclaimer")).toContainText("Last verified: not yet");
});

test("income tax calculator rejects bad input", async ({ page }) => {
  await page.goto("/calculators/income-tax");
  await page.getByRole("button", { name: "Compute" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Enter compensation income" })).toBeVisible();
  await page.getByLabel("Gross sales or receipts").fill("abc");
  await expect(page.getByText("Enter an amount like")).toBeVisible();
});

test("penalty calculator splits interest across the EOPT change", async ({ page }) => {
  await page.goto("/calculators/penalty");
  await page.getByLabel("Taxpayer size").selectOption("micro");
  await page.getByLabel("Original due date").fill("2024-01-10");
  await page.getByLabel("Actual or planned payment date").fill("2024-02-09");
  await page.getByLabel("Basic tax due").fill("100000");
  await page.getByRole("button", { name: "Compute" }).click();
  const result = page.getByTestId("calc-result");
  await expect(result.getByTestId("headline-amount")).toHaveText("₱135,673.97");
  await expect(result).toContainText("Interest 2024-01-11 to 2024-01-21");
  await expect(result).toContainText("Interest 2024-01-22 to 2024-02-09");
});

test("percentage tax and VAT calculators", async ({ page }) => {
  await page.goto("/calculators/percentage-tax");
  await page.getByLabel("Year", { exact: true }).selectOption("2023");
  await page.getByLabel("Quarter", { exact: true }).selectOption("2");
  await page.getByLabel("Gross sales/receipts for the quarter").fill("500000");
  await page.getByRole("button", { name: "Compute" }).click();
  await expect(page.getByTestId("headline-amount")).toHaveText("₱5,000.00");

  await page.goto("/calculators/vat");
  await page.getByLabel("Vatable sales").fill("1120000");
  await page.getByLabel("Vatable purchases").fill("560000");
  await page.getByRole("button", { name: "Compute" }).click();
  await expect(page.getByTestId("headline-amount")).toHaveText("₱60,000.00");
});
