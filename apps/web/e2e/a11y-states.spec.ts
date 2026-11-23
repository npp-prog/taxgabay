import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const audit = async (page: Page) => {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return r.violations.map((v) => `${v.impact} ${v.id}: ${v.help} — ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
};

test("interactive states have no accessibility problems", async ({ page, isMobile }) => {
  await page.goto("/");
  if (isMobile) await page.locator('button[aria-controls="mobile-nav"]').click();
  else await page.getByRole("button", { name: "Business" }).click();
  const menu = await audit(page);

  await page.goto("/prepare");
  await page.getByRole("button", { name: "Load an example" }).click();
  await page.getByTestId("books-section").getByRole("tab", { name: "Statements" }).click();
  const prepare = await audit(page);

  await page.goto("/practice/freelance-designer");
  await page.getByRole("tab", { name: /Record transactions|Journalize/ }).click();
  await page.getByTestId("practice-tx").first().getByRole("button", { name: "Show answer" }).click();
  const practice = await audit(page);

  expect({ menu, prepare, practice }).toEqual({ menu: [], prepare: [], practice: [] });
});
