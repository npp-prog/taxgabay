import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const PAGES = ["/", "/profile", "/calendar", "/checklists", "/calculators", "/calculators/income-tax", "/guides", "/guides/1701q", "/business-guide", "/business-guide/books-of-accounts", "/practice", "/practice/freelance-designer", "/prepare", "/learn", "/learn/glossary", "/issuances", "/life-events", "/roadmap", "/search", "/assistant", "/account", "/privacy", "/clients", "/firm"];

for (const path of PAGES) {
  test(`no serious accessibility problems on ${path}`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious.map((v) => `${v.id}: ${v.help} — ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
  });
}
