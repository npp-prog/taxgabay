import { expect, test } from "@playwright/test";

// The e2e server runs with ASSISTANT_ALLOW_UNVERIFIED=1 and ANTHROPIC_BASE_URL pointing at
// e2e/mock-anthropic.mjs, because no content has been verified yet.

test("answers with numbered, linked sources and an unverified warning", async ({ page }) => {
  await page.goto("/assistant");
  await page.getByRole("button", { name: "When is the 1701Q due?" }).click();
  const answer = page.getByTestId("assistant-answer");
  await expect(answer).toContainText("According to TaxGabay's guide");
  await expect(answer.getByRole("link", { name: "Source 1" })).toBeVisible();
  await expect(answer).toContainText("has not verified yet");
  await expect(answer.getByRole("link", { name: /1701Q/ }).first()).toHaveAttribute("href", /\/guides\/1701q/);
  await expect(answer.getByText("Unverified").first()).toBeVisible();
});

test("refuses without calling the model when nothing relevant exists", async ({ page }) => {
  await page.goto("/assistant");
  for (const q of ["How do I get a passport?", "What is the capital of France?"]) {
    await page.getByLabel("Your question").fill(q);
    await page.getByRole("button", { name: "Ask" }).click();
    await expect(page.getByTestId("assistant-refusal").first()).toContainText("none of it covers this question");
  }
});

test("refuses when the model says the documents don't answer, or cites nothing", async ({ page }) => {
  await page.goto("/assistant");
  await page.getByLabel("Your question").fill("Please explain the VAT threshold");
  await page.getByRole("button", { name: "Ask" }).click();
  await expect(page.getByTestId("assistant-refusal")).toContainText("doesn't answer this question");
  await page.getByLabel("Your question").fill("uncited VAT threshold rate");
  await page.getByRole("button", { name: "Ask" }).click();
  await expect(page.getByTestId("assistant-refusal").first()).toContainText("couldn't back an answer");
});

test("API validates input", async ({ request }) => {
  const res = await request.post("/api/assistant", { data: { question: "x" } });
  expect(res.status()).toBe(400);
  expect((await res.json()).message).toMatch(/too short/);
});
