import { test, expect } from "@playwright/test";

const mobileViewport = { width: 375, height: 812 };

test("new account form mobile responsive", async ({ page }) => {
  await page.setViewportSize(mobileViewport);
  await page.goto("/installment-accounts/new");
  await page.waitForLoadState("networkidle");
  // Check no horizontal scroll
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
  // Key elements visible
  await expect(page.getByText("Cash Price")).toBeVisible();
  await expect(page.getByText("Interest Rate (% per month)")).toBeVisible();
  await expect(page.getByText("Down Payment", { exact: true })).toBeVisible();
});

test("account detail page mobile responsive", async ({ page }) => {
  await page.setViewportSize(mobileViewport);
  await page.goto("/installment-accounts");
  await page.waitForLoadState("networkidle");
  // Click first account link
  const firstLink = page.locator("a[href*='/installment-accounts/']").first();
  if (await firstLink.isVisible()) {
    await firstLink.click();
    await page.waitForLoadState("networkidle");
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
  }
});

test("dashboard mobile responsive", async ({ page }) => {
  await page.setViewportSize(mobileViewport);
  await page.goto("/dashboard");
  await page.waitForLoadState("networkidle");
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
  await expect(page.locator("body")).toBeVisible();
});

test("payments page mobile responsive", async ({ page }) => {
  await page.setViewportSize(mobileViewport);
  await page.goto("/payments");
  await page.waitForLoadState("networkidle");
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
});

test("reports page mobile responsive", async ({ page }) => {
  await page.setViewportSize(mobileViewport);
  await page.goto("/reports");
  await page.waitForLoadState("networkidle");
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
});

test("statement page mobile responsive", async ({ page }) => {
  await page.setViewportSize(mobileViewport);
  await page.goto("/installment-accounts");
  await page.waitForLoadState("networkidle");
  // Click first account statement link
  const statementLink = page.locator("a[href*='/statement']").first();
  if (await statementLink.isVisible()) {
    await statementLink.click();
    await page.waitForLoadState("networkidle");
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
  }
});
