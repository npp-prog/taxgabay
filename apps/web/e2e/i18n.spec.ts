import { expect, test, type Page } from "@playwright/test";

// Legacy single-profile shape; the store migrates it to client "Me".
const PROFILE = {
  profile: {
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
  },
  consentAt: "2026-01-01T00:00:00Z",
  obligations: {},
  roadmap: [],
  checklist: [],
};

const toggle = (page: Page) => page.getByRole("button", { name: /^(Language|Wika):/ });

/** On phones the language switch lives in the menu: open it, check the label, optionally switch, close. */
async function lang(page: Page, expected: string, click = false) {
  const burger = page.locator('button[aria-controls="mobile-nav"]');
  const mobile = await burger.isVisible();
  if (mobile) await burger.click();
  await expect(toggle(page)).toHaveText(expected);
  if (click) await toggle(page).click();
  if (mobile) await page.keyboard.press("Escape");
}

test("switch to Filipino, see translated pages, persist, switch back", async ({ page }) => {
  await page.addInitScript((data) => {
    if (!localStorage.getItem("taxgabay:v1")) localStorage.setItem("taxgabay:v1", JSON.stringify(data));
  }, PROFILE);

  await page.goto("/profile");
  await lang(page, "FIL", true);
  await lang(page, "EN");

  await expect(page.getByRole("heading", { name: "Ang iyong taxpayer profile" })).toBeVisible();
  await expect(page.getByText("Alin ang pinakanaglalarawan sa iyo?")).toBeVisible();
  await page.getByText("Hindi sigurado?", { exact: true }).click();
  await expect(page.getByText(/Piliin ang naglalarawan/)).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "fil");

  await page.goto("/calendar");
  await expect(page.getByRole("heading", { name: "Aking tax calendar" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Aking tax calendar" })).toBeVisible();
  await lang(page, "EN", true);
  await expect(page.getByRole("heading", { name: "My tax calendar" })).toBeVisible();
  await lang(page, "FIL");
});
