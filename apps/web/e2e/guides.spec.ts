import { expect, test } from "@playwright/test";

test("guides index lists the ten Phase 1 forms", async ({ page }) => {
  await page.goto("/guides");
  for (const f of ["1701Q", "1701", "1701A", "2551Q", "2550Q", "1601C", "0619E", "1601EQ", "1604C", "1604E"]) {
    await expect(page.getByText(f, { exact: true })).toBeVisible();
  }
});

test("guide page renders sections and the disclaimer", async ({ page }) => {
  await page.goto("/guides/1701q");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("1701Q");
  for (const s of ["Who must file", "Deadline", "Where to file and pay", "Attachments", "Field-by-field walkthrough", "Common mistakes", "Related calculators", "Legal basis"]) {
    await expect(page.getByRole("heading", { name: s, level: 2 })).toBeVisible();
  }
  await expect(page.getByTestId("disclaimer")).toContainText("For guidance only");
  await page.getByRole("link", { name: "Income tax: 8% vs graduated" }).click();
  await expect(page).toHaveURL(/\/calculators\/income-tax/);
});

test("roadmap progress persists and the employer step toggles", async ({ page }) => {
  await page.goto("/roadmap");
  await expect(page.getByText("0 of 7")).toBeVisible();
  await page.getByLabel(/Mark step 1 as done/).check();
  await expect(page.getByText("1 of 7")).toBeVisible();
  await page.getByLabel("I will hire employees").check();
  await expect(page.getByText("1 of 8")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel(/Mark step 1 as done/)).toBeChecked();
});

test("app is installable: manifest and service worker are served", async ({ request }) => {
  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.ok()).toBe(true);
  expect((await manifest.json()).short_name).toBe("TaxGabay");
  expect((await request.get("/sw.js")).ok()).toBe(true);
});
