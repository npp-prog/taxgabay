import { expect, test } from "@playwright/test";

const PROFILE = {
  profile: {
    taxpayer_type: "sole_proprietorship",
    vat_status: "non_vat",
    income_tax_option: "graduated_osd",
    has_employees: true,
    withholds_expanded: false,
    filing_channel: "ebirforms",
    efps_group: null,
    fiscal_year_end_month: 12,
    rdo_code: null,
    taxpayer_size: "micro",
    line_of_business: null,
  },
  consentAt: "2026-01-01T00:00:00Z",
  obligations: {},
  roadmap: [],
  checklist: [],
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript((data) => {
    if (!localStorage.getItem("taxgabay:v1")) localStorage.setItem("taxgabay:v1", JSON.stringify(data));
  }, PROFILE);
});

test("checklists: score updates and progress persists", async ({ page }) => {
  await page.goto("/checklists");
  await expect(page.getByRole("heading", { name: "Compliance checklists" })).toBeVisible();
  const score = page.getByTestId("score");
  await expect(score).toContainText("0%");
  const items = page.getByTestId("checklist-item");
  const total = await items.count();
  expect(total).toBeGreaterThanOrEqual(4); // books, invoices, 1601C, contributions
  await items.first().getByRole("checkbox").check();
  await expect(score).toContainText(`(1 of ${total})`);
  await page.reload();
  await expect(page.getByTestId("checklist-item").first().getByRole("checkbox")).toBeChecked();

  await page.getByRole("tab", { name: "Quarterly" }).click();
  await expect(page.getByTestId("period-title")).toContainText("Q");
  await page.getByRole("button", { name: "Next →" }).click();
  await page.getByRole("tab", { name: "One-time setup" }).click();
  await expect(page.getByText("Register your books of accounts")).toBeVisible();
});

test("roadmap: switch to the SEC and CDA paths", async ({ page }) => {
  await page.goto("/roadmap");
  await expect(page.getByRole("heading", { name: "Register a sole proprietorship" })).toBeVisible();
  await expect(page.getByText("of 8")).toBeVisible(); // employer step shown: profile has employees
  await page.getByRole("tab", { name: "Partnership / corporation / OPC" }).click();
  await expect(page.getByRole("heading", { name: /partnership, corporation or OPC/ })).toBeVisible();
  await expect(page.getByText("Form 1903", { exact: false }).first()).toBeVisible();
  await page.getByRole("tab", { name: "Cooperative" }).click();
  await expect(page.getByText("Pre-Membership Education Seminar")).toBeVisible();
});

test("life events: index and a detail page with working links", async ({ page }) => {
  await page.goto("/life-events");
  await expect(page.getByRole("link", { name: /Settling an estate/ })).toBeVisible();
  await page.getByRole("link", { name: /Selling real property/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Selling real property");
  await expect(page.getByText("Within 30 days after the sale")).toBeVisible();
  await page.getByRole("link", { name: "Capital gains tax calculator" }).click();
  await expect(page).toHaveURL(/\/calculators\/cgt/);
});

test("account: reminders explain that accounts are needed in local mode", async ({ page }) => {
  await page.goto("/account");
  await expect(page.getByRole("heading", { name: "Reminders" })).toBeVisible();
  await expect(page.getByText(/need an account/)).toBeVisible();
});
