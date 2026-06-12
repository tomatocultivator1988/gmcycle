# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: mobile-responsive.spec.ts >> reports page mobile responsive
- Location: e2e\mobile-responsive.spec.ts:53:5

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.goto: Test timeout of 30000ms exceeded.
Call log:
  - navigating to "http://localhost:3000/reports", waiting until "load"

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - banner [ref=e3]:
      - link "MyFaveGadgets MyFaveGadgets" [ref=e5] [cursor=pointer]:
        - /url: /dashboard
        - img "MyFaveGadgets" [ref=e7]
        - generic [ref=e9]: MyFaveGadgets
    - main [ref=e10]:
      - generic [ref=e11]:
        - generic [ref=e12]:
          - generic [ref=e13]:
            - heading "Reports" [level=1] [ref=e14]
            - paragraph [ref=e15]: MyFaveGadgets reports and data exports
          - button "Email Gross Profit" [ref=e17] [cursor=pointer]:
            - img [ref=e18]
            - text: Email Gross Profit
        - generic [ref=e21]:
          - link "Collection Report All collections with customer and unit details" [ref=e22] [cursor=pointer]:
            - /url: /reports/collections
            - generic [ref=e23]:
              - img [ref=e25]
              - generic [ref=e28]:
                - generic [ref=e29]: Collection Report
                - generic [ref=e30]: All collections with customer and unit details
          - link "Daily Collection Report Today's collections summary" [ref=e31] [cursor=pointer]:
            - /url: /reports/daily-collections
            - generic [ref=e32]:
              - img [ref=e34]
              - generic [ref=e37]:
                - generic [ref=e38]: Daily Collection Report
                - generic [ref=e39]: Today's collections summary
          - link "Monthly Collection Report Monthly breakdown of collections" [ref=e40] [cursor=pointer]:
            - /url: /reports/monthly-collections
            - generic [ref=e41]:
              - img [ref=e43]
              - generic [ref=e46]:
                - generic [ref=e47]: Monthly Collection Report
                - generic [ref=e48]: Monthly breakdown of collections
          - link "Due Date Monitoring All active accounts sorted by due date — filter by any date to see who paid and who hasn't" [ref=e49] [cursor=pointer]:
            - /url: /reports/overdue-accounts
            - generic [ref=e50]:
              - img [ref=e52]
              - generic [ref=e54]:
                - generic [ref=e55]: Due Date Monitoring
                - generic [ref=e56]: All active accounts sorted by due date — filter by any date to see who paid and who hasn't
          - link "Penalty Report All penalty records" [ref=e57] [cursor=pointer]:
            - /url: /reports/penalties
            - generic [ref=e58]:
              - img [ref=e60]
              - generic [ref=e62]:
                - generic [ref=e63]: Penalty Report
                - generic [ref=e64]: All penalty records
          - link "Outstanding Balance Report All active accounts with remaining balances" [ref=e65] [cursor=pointer]:
            - /url: /reports/outstanding-balances
            - generic [ref=e66]:
              - img [ref=e68]
              - generic [ref=e70]:
                - generic [ref=e71]: Outstanding Balance Report
                - generic [ref=e72]: All active accounts with remaining balances
          - link "Account Master List All accounts with complete customer, unit, and contract details" [ref=e73] [cursor=pointer]:
            - /url: /reports/account-master-list
            - generic [ref=e74]:
              - img [ref=e76]
              - generic [ref=e79]:
                - generic [ref=e80]: Account Master List
                - generic [ref=e81]: All accounts with complete customer, unit, and contract details
    - navigation [ref=e82]:
      - link "Dashboard" [ref=e83] [cursor=pointer]:
        - /url: /dashboard
        - img [ref=e84]
        - text: Dashboard
      - link "Accounts" [ref=e89] [cursor=pointer]:
        - /url: /installment-accounts
        - img [ref=e90]
        - text: Accounts
      - link "Payments" [ref=e92] [cursor=pointer]:
        - /url: /payments
        - img [ref=e93]
        - text: Payments
      - link "Reports" [ref=e95] [cursor=pointer]:
        - /url: /reports
        - img [ref=e96]
        - text: Reports
      - link "Settings" [ref=e99] [cursor=pointer]:
        - /url: /admin/config
        - img [ref=e100]
        - text: Settings
  - button "Open Next.js Dev Tools" [ref=e108] [cursor=pointer]:
    - img [ref=e109]
  - alert [ref=e112]
```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test";
  2  | 
  3  | const mobileViewport = { width: 375, height: 812 };
  4  | 
  5  | test("new account form mobile responsive", async ({ page }) => {
  6  |   await page.setViewportSize(mobileViewport);
  7  |   await page.goto("/installment-accounts/new");
  8  |   await page.waitForLoadState("networkidle");
  9  |   // Check no horizontal scroll
  10 |   const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  11 |   const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
  12 |   expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
  13 |   // Key elements visible
  14 |   await expect(page.getByText("Cash Price")).toBeVisible();
  15 |   await expect(page.getByText("Interest Rate (% per month)")).toBeVisible();
  16 |   await expect(page.getByText("Down Payment", { exact: true })).toBeVisible();
  17 | });
  18 | 
  19 | test("account detail page mobile responsive", async ({ page }) => {
  20 |   await page.setViewportSize(mobileViewport);
  21 |   await page.goto("/installment-accounts");
  22 |   await page.waitForLoadState("networkidle");
  23 |   // Click first account link
  24 |   const firstLink = page.locator("a[href*='/installment-accounts/']").first();
  25 |   if (await firstLink.isVisible()) {
  26 |     await firstLink.click();
  27 |     await page.waitForLoadState("networkidle");
  28 |     const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  29 |     const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
  30 |     expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
  31 |   }
  32 | });
  33 | 
  34 | test("dashboard mobile responsive", async ({ page }) => {
  35 |   await page.setViewportSize(mobileViewport);
  36 |   await page.goto("/dashboard");
  37 |   await page.waitForLoadState("networkidle");
  38 |   const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  39 |   const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
  40 |   expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
  41 |   await expect(page.locator("body")).toBeVisible();
  42 | });
  43 | 
  44 | test("payments page mobile responsive", async ({ page }) => {
  45 |   await page.setViewportSize(mobileViewport);
  46 |   await page.goto("/payments");
  47 |   await page.waitForLoadState("networkidle");
  48 |   const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  49 |   const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
  50 |   expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
  51 | });
  52 | 
  53 | test("reports page mobile responsive", async ({ page }) => {
  54 |   await page.setViewportSize(mobileViewport);
> 55 |   await page.goto("/reports");
     |              ^ Error: page.goto: Test timeout of 30000ms exceeded.
  56 |   await page.waitForLoadState("networkidle");
  57 |   const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  58 |   const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
  59 |   expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
  60 | });
  61 | 
  62 | test("statement page mobile responsive", async ({ page }) => {
  63 |   await page.setViewportSize(mobileViewport);
  64 |   await page.goto("/installment-accounts");
  65 |   await page.waitForLoadState("networkidle");
  66 |   // Click first account statement link
  67 |   const statementLink = page.locator("a[href*='/statement']").first();
  68 |   if (await statementLink.isVisible()) {
  69 |     await statementLink.click();
  70 |     await page.waitForLoadState("networkidle");
  71 |     const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  72 |     const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
  73 |     expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
  74 |   }
  75 | });
  76 | 
```