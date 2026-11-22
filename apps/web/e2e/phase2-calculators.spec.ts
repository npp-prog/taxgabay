import { expect, test, type Page } from "@playwright/test";

async function compute(page: Page) {
  await page.getByRole("button", { name: "Compute" }).click();
  return page.getByTestId("calc-result");
}

test("corporate: MCIT is payable when higher", async ({ page }) => {
  await page.goto("/calculators/corporate");
  await page.getByLabel("Last day of the taxable year").fill("2024-12-31");
  await page.getByLabel("Year operations began").fill("2015");
  await page.getByLabel("Gross sales", { exact: true }).fill("50000000");
  await page.getByLabel("Cost of sales").fill("40000000");
  await page.getByLabel("Itemized deductions").fill("9800000");
  await page.getByLabel("Total assets excluding land").fill("200000000");
  const r = await compute(page);
  await expect(r.getByTestId("headline-amount")).toHaveText("₱200,000.00");
  await expect(r).toContainText("Income tax due (MCIT)");
  await expect(r.getByTestId("disclaimer")).toBeVisible();
});

test("withholding on compensation: per payroll and year-end", async ({ page }) => {
  await page.goto("/calculators/withholding-compensation");
  await page.getByLabel("Payroll period").selectOption("monthly");
  await page.getByLabel("Pay date").fill("2024-06-30");
  await page.getByLabel("Gross compensation for the period").fill("50000");
  let r = await compute(page);
  await expect(r.getByTestId("headline-amount")).toHaveText("₱5,208.40");

  await page.getByRole("tab", { name: "Year-end" }).click();
  await page.getByLabel("Taxable year").selectOption("2024");
  await page.getByLabel("Basic pay and taxable allowances for the year").fill("600000");
  await page.getByLabel("Mandatory contributions for the year").fill("30000");
  await page.getByLabel("13th month pay and other benefits").fill("100000");
  await page.getByLabel("Tax withheld during the year").fill("50000");
  r = await compute(page);
  await expect(r.getByTestId("headline-amount")).toHaveText("₱8,500.00");
  await expect(r).toContainText("Balance to withhold");
});

test("EWT on a VAT-inclusive professional fee", async ({ page }) => {
  await page.goto("/calculators/ewt");
  await page.getByLabel("Type of payment (ATC)").selectOption("WC011");
  await page.getByLabel("Amount of the payment").fill("112000");
  await page.getByLabel("Amount includes VAT (payee is VAT-registered)").check();
  const r = await compute(page);
  await expect(r.getByTestId("headline-amount")).toHaveText("₱15,000.00");
});

test("estate tax with a conjugal family home", async ({ page }) => {
  await page.goto("/calculators/estate");
  await page.getByLabel("Date of death").fill("2024-05-01");
  await page.getByLabel("Exclusive property of the decedent").fill("3000000");
  await page.getByLabel("Conjugal or community property").fill("20000000");
  await page.getByLabel("Deductions charged to conjugal property").fill("2000000");
  await page.getByLabel("Family home value").fill("12000000");
  await page.getByLabel("The family home is conjugal/community property").check();
  const r = await compute(page);
  await expect(r.getByTestId("headline-amount")).toHaveText("₱60,000.00");
});

test("donor's tax, CGT and DST", async ({ page }) => {
  await page.goto("/calculators/donors");
  await page.getByLabel("Date of the gift").fill("2024-09-01");
  await page.getByLabel("Value of this gift").fill("500000");
  await page.getByLabel("Earlier gifts this year").fill("1000000");
  await page.getByLabel("Donor's tax already paid this year").fill("45000");
  await expect((await compute(page)).getByTestId("headline-amount")).toHaveText("₱30,000.00");

  await page.goto("/calculators/cgt");
  await page.getByLabel("Date of sale").fill("2024-03-01");
  await page.getByLabel("Gross selling price").fill("5000000");
  await page.getByLabel("BIR zonal value").fill("6000000");
  await page.getByLabel("Assessor's fair market value").fill("4000000");
  await expect((await compute(page)).getByTestId("headline-amount")).toHaveText("₱360,000.00");
  await page.getByRole("tab", { name: "Unlisted shares" }).click();
  await page.getByLabel("Date of sale").fill("2024-03-01");
  await page.getByLabel("Selling price of the shares").fill("1000000");
  await page.getByLabel("Cost basis").fill("600000");
  await page.getByLabel("Selling expenses").fill("20000");
  await expect((await compute(page)).getByTestId("headline-amount")).toHaveText("₱57,000.00");

  await page.goto("/calculators/dst");
  await page.getByLabel("Transaction").selectOption("sale_real_property");
  await page.getByLabel("Date of the document").fill("2024-03-01");
  await page.getByLabel("Selling price (consideration)").fill("5000500");
  await page.getByLabel("Fair market value").fill("4000000");
  await expect((await compute(page)).getByTestId("headline-amount")).toHaveText("₱75,015.00");
});

test("calculators index lists all eleven calculators", async ({ page }) => {
  await page.goto("/calculators");
  await expect(page.locator("main a[href^='/calculators/']")).toHaveCount(11);
});
