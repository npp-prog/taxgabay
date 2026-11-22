import { expect, test } from "@playwright/test";

test("header menus open, show grouped links and navigate", async ({ page, isMobile }) => {
  await page.goto("/");
  if (isMobile) {
    await page.locator('button[aria-controls="mobile-nav"]').click();
    const nav = page.locator("#mobile-nav");
    await nav.getByRole("button", { name: "Business" }).click();
    await expect(nav.getByText("Start and run")).toBeVisible();
    await nav.getByRole("link", { name: "Practice sets" }).click();
  } else {
    const trigger = page.getByRole("button", { name: "Business" });
    await trigger.hover();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    const panel = page.locator("#menu-business");
    await expect(panel.getByText("Keep the books of a sample business")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await trigger.click();
    await panel.getByRole("link", { name: /Practice sets/ }).click();
  }
  await expect(page).toHaveURL(/\/practice$/);
  await expect(page.getByRole("heading", { name: "Keep the books of a sample business" })).toBeVisible();
});
