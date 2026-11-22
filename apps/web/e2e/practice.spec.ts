import { expect, test } from "@playwright/test";

test("practice index lists sets and the track choice is remembered", async ({ page }) => {
  await page.goto("/practice");
  await expect(page.getByRole("heading", { name: "Keep the books of a sample business" })).toBeVisible();
  await page.getByRole("radio", { name: /Accounting student/ }).click();
  await page.getByRole("link", { name: /Ligaya Reyes|freelance/i }).first().click();
  await expect(page).toHaveURL(/\/practice\/freelance-designer/);
  await expect(page.getByRole("tab", { name: "Worksheet" })).toBeVisible();
  await expect(page.getByTestId("disclaimer")).toBeVisible();
});

test("checks entries, posts correct ones to the ledger, and shows answers", async ({ page }) => {
  await page.goto("/practice/freelance-designer");
  await page.getByRole("radio", { name: "Accounting student" }).click();
  await page.getByRole("tab", { name: "Journalize" }).click();
  const first = page.getByTestId("practice-tx").first();

  // Wrong side first: feedback, nothing posted.
  await first.getByLabel("Line 1 account").selectOption("102");
  await first.getByLabel("Line 1 debit").fill("8000");
  await first.getByLabel("Line 2 account").selectOption("501");
  await first.getByLabel("Line 2 credit").fill("8000");
  await first.getByRole("button", { name: "Check" }).click();
  await expect(first.getByTestId("practice-feedback")).not.toContainText("Correct");
  await expect(page.getByTestId("practice-progress")).toHaveText(/^0\//);

  // Fix it.
  await first.getByLabel("Line 1 account").selectOption("501");
  await first.getByLabel("Line 2 account").selectOption("102");
  await first.getByRole("button", { name: "Check" }).click();
  await expect(first.getByTestId("practice-feedback")).toContainText("Correct. Posted to the ledger.");
  await expect(page.getByTestId("practice-progress")).toHaveText(/^1\//);

  // Reveal the second.
  const second = page.getByTestId("practice-tx").nth(1);
  await second.getByRole("button", { name: "Show answer" }).click();
  await expect(second.getByTestId("practice-answer")).toBeVisible();
  await expect(page.getByTestId("practice-progress")).toHaveText(/^2\//);

  // Progress survives a reload.
  await page.reload();
  await expect(page.getByTestId("practice-progress")).toHaveText(/^2\//);

  await page.getByRole("tab", { name: "Trial balance" }).click();
  await expect(page.getByTestId("trial-balance")).toContainText("8,000.00");
  await expect(page.getByText(/entries still to record/)).toBeVisible();
  await page.getByRole("radio", { name: "Answer key" }).click();
  await expect(page.getByText(/entries still to record/)).toHaveCount(0);
});

test("owner track shows books, tax returns and downloads a worked solution", async ({ page }) => {
  await page.goto("/practice/freelance-designer");
  await page.getByRole("radio", { name: "Business owner" }).click();
  await page.getByRole("tab", { name: "Books" }).click();
  await expect(page.getByTestId("books")).toContainText("Cash disbursements book");
  await page.getByRole("tab", { name: "Tax returns" }).click();
  await expect(page.getByTestId("returns")).toContainText("1701Q");
  await page.getByRole("tab", { name: "Worked example" }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Worked solution (PDF)" }).click();
  expect((await download).suggestedFilename()).toBe("freelance-designer-worked-solution.pdf");
});
