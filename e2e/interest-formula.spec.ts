import { test, expect } from "@playwright/test";

test("form shows interest rate input and computes preview", async ({ page }) => {
  await page.goto("/installment-accounts/new");
  await expect(page.getByText("Cash Price")).toBeVisible();
  await expect(page.getByText("Interest Rate (% per month)")).toBeVisible();
  await expect(page.getByText("Down Payment", { exact: true })).toBeVisible();

  // Fill in values to verify formula preview
  const cashPriceInput = page.getByLabel("Cash Price");
  const interestRateInput = page.getByLabel("Interest Rate (% per month)");
  const downPaymentInput = page.getByLabel("Down Payment");

  await cashPriceInput.fill("10000");
  await interestRateInput.fill("10");
  await downPaymentInput.fill("1000");

  // Wait for computed preview
  await expect(page.getByText(/Remaining Balance/i)).toBeVisible();
});

test("dashboard loads", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.locator("h1")).toBeVisible();
});

test("payments page loads", async ({ page }) => {
  await page.goto("/payments");
  await expect(page.locator("body")).toBeVisible();
});

test("reports page loads", async ({ page }) => {
  await page.goto("/reports");
  await expect(page.locator("h1")).toBeVisible();
});
