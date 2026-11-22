import { expect, test, type Page } from "@playwright/test";

const SOLE_PROP = {
  taxpayer_type: "sole_proprietorship",
  vat_status: "non_vat",
  income_tax_option: "graduated_osd",
  has_employees: false,
  withholds_expanded: false,
  filing_channel: "ebirforms",
  efps_group: null,
  fiscal_year_end_month: 12,
  rdo_code: null,
  taxpayer_size: "micro",
  line_of_business: null,
};

/** The single-profile shape saved before multi-client mode existed. */
const OLD_SHAPE = { profile: SOLE_PROP, consentAt: "2026-01-01T00:00:00Z", obligations: {}, roadmap: ["dti-bn"], checklist: [] };

async function seed(page: Page, data: unknown) {
  await page.addInitScript((d) => {
    if (!localStorage.getItem("taxgabay:v1")) localStorage.setItem("taxgabay:v1", JSON.stringify(d));
  }, data);
}

test("an existing single profile becomes the client \"Me\"", async ({ page }) => {
  await seed(page, OLD_SHAPE);
  await page.goto("/clients");
  const rows = page.getByTestId("client-row");
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("Me");
  await expect(rows.first()).toContainText("Sole proprietor");
  await expect(rows.first()).toContainText("next deadline");
  // Progress carried over, and no switcher with a single client.
  await page.goto("/roadmap");
  await expect(page.getByLabel(/Mark step 1 as done/)).toBeChecked();
  await expect(page.getByTestId("client-switcher")).toHaveCount(0);
});

test("add a corporation client, switch, and see different returns", async ({ page }) => {
  await seed(page, OLD_SHAPE);
  await page.goto("/clients");
  await page.getByLabel("Client name").fill("Dela Cruz Trading Corp.");
  await page.getByRole("button", { name: "Add client" }).click();
  await expect(page.getByTestId("client-row")).toHaveCount(2);
  await page.getByRole("button", { name: "Open Dela Cruz Trading Corp." }).click();

  // New client starts with an empty profile.
  await expect(page).toHaveURL(/\/profile/);
  await expect(page.getByLabel("Working on")).toHaveValue(/.+/);
  await page.getByLabel(/^Corporation/).check();
  for (let i = 0; i < 12; i++) {
    const save = page.getByRole("button", { name: /Save and see/ });
    if (await save.isVisible()) break;
    await page.getByRole("button", { name: "Next" }).click();
  }
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: /Save and see/ }).click();
  await expect(page).toHaveURL(/\/profile\/summary/);
  await expect(page.getByTestId("returns-list")).toContainText("1702Q");
  await expect(page.getByTestId("returns-list")).not.toContainText("1701Q");

  // Switch back to "Me": individual returns again.
  const switcher = page.getByLabel("Working on");
  await switcher.selectOption({ label: "Me" });
  await expect(page.getByTestId("returns-list")).toContainText("1701Q");
  await expect(page.getByTestId("returns-list")).not.toContainText("1702Q");
});

test("calendar shows every client's deadlines together and marks them per client", async ({ page }) => {
  await seed(page, {
    version: 2,
    activeClientId: "default",
    clients: [
      { id: "default", name: "Me", profile: SOLE_PROP, consentAt: "2026-01-01T00:00:00Z", obligations: {}, roadmap: [], checklist: [] },
      {
        id: "11111111-2222-4333-8444-555555555555",
        name: "Reyes Bakery",
        profile: { ...SOLE_PROP, has_employees: true },
        consentAt: "2026-01-01T00:00:00Z",
        obligations: {},
        roadmap: [],
        checklist: [],
      },
    ],
  });
  await page.goto("/calendar");
  await expect(page.getByTestId("client-switcher")).toBeVisible();
  await expect(page.getByTestId("obligation-client")).toHaveCount(0);
  await page.getByLabel("Show").selectOption("all");
  await expect(page.getByRole("heading", { name: "Tax calendar: all clients" })).toBeVisible();
  const clientsShown = await page.getByTestId("obligation-client").allTextContents();
  expect(new Set(clientsShown)).toEqual(new Set(["Me", "Reyes Bakery"]));
  // 1601C only applies to the client with employees.
  const bakeryRow = page.getByTestId("obligation").filter({ hasText: "Reyes Bakery" }).filter({ hasText: "1601C" }).first();
  await expect(bakeryRow).toBeVisible();
  await expect(page.getByTestId("obligation").filter({ hasText: "Me" }).filter({ hasText: "1601C" })).toHaveCount(0);

  // Marking a Reyes Bakery deadline does not mark Me's.
  await bakeryRow.getByRole("checkbox").check();
  await expect(bakeryRow).toContainText("Filed & paid");
  await page.getByLabel("Show").selectOption("client");
  await expect(page.getByText("Filed & paid")).toHaveCount(0);
});

test("rename and remove a client with confirmation; the last client cannot be removed", async ({ page }) => {
  await seed(page, OLD_SHAPE);
  await page.goto("/clients");
  await page.getByLabel("Client name").fill("Temp Client");
  await page.getByRole("button", { name: "Add client" }).click();
  await page.getByRole("button", { name: "Rename Temp Client" }).click();
  await page.getByLabel("New name for Temp Client").fill("Santos Clinic");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByTestId("client-row").filter({ hasText: "Santos Clinic" })).toBeVisible();
  await page.getByRole("button", { name: "Remove Santos Clinic" }).click();
  await page.getByRole("button", { name: "Yes, remove Santos Clinic" }).click();
  await expect(page.getByTestId("client-row")).toHaveCount(1);
  await expect(page.getByRole("button", { name: /^Remove/ })).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId("client-row")).toHaveCount(1);
});
