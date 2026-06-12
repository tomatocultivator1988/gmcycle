# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: close-account.spec.ts >> Close Account Logic >> should close account with outstanding balance, write off, and log activity
- Location: e2e\close-account.spec.ts:14:7

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 201
Received: 500
```

# Test source

```ts
  1   | import { test, expect } from "@playwright/test";
  2   | import { chromium } from "playwright";
  3   | 
  4   | const API = "http://localhost:3000/api";
  5   | const PASSWORD = "myfave2026";
  6   | 
  7   | type AccountDto = any;
  8   | type PaymentDto = any;
  9   | type ScheduleDto = any;
  10  | 
  11  | test.describe("Close Account Logic", () => {
  12  |   let accountId: string;
  13  | 
  14  |   test("should close account with outstanding balance, write off, and log activity", async ({ request }) => {
  15  |     // 1. Create an account with 6 months term, ₱60,000 cash price, ₱10,000 down
  16  |     const createRes = await request.post(`${API}/installment-accounts`, {
  17  |       data: {
  18  |         customerName: "Close Test Customer",
  19  |         customerPhone: "09100000001",
  20  |         customerEmail: "close@test.com",
  21  |         customerAddress: "Test Address",
  22  |         fbLink: "https://facebook.com/test",
  23  |         brand: "Honda",
  24  |         model: "Test 125",
  25  |         unitDescription: "Test motorcycle for close",
  26  |         cashPrice: "60000",
  27  |         downPayment: "10000",
  28  |         interestRate: "5",
  29  |         term: 6,
  30  |         scheduleType: "MONTHLY",
  31  |         dueDays: [15],
  32  |         firstDueDate: "2026-06-15",
  33  |         dateGiven: "2026-05-15",
  34  |         startDate: "2026-05-15",
  35  |       },
  36  |     });
  37  |     expect(createRes.status()).toBe(201);
  38  |     const created = await createRes.json();
  39  |     accountId = created.installmentAccount.id;
  40  |     console.log("Created account:", accountId);
  41  | 
  42  |     // 2. Activate the account
  43  |     const activateRes = await request.patch(`${API}/installment-accounts/${accountId}/activate`, {
  44  |       data: {},
  45  |     });
  46  |     expect(activateRes.status()).toBe(200);
  47  |     const activated = await activateRes.json();
  48  |     console.log("Activated. Status:", activated.installmentAccount.status);
  49  |     console.log("Remaining balance:", activated.installmentAccount.remainingBalance);
  50  | 
  51  |     const remainingBeforeClose = activated.installmentAccount.remainingBalance;
  52  |     expect(parseFloat(remainingBeforeClose)).toBeGreaterThan(0);
  53  | 
  54  |     // 3. Post one payment (partial payment)
  55  |     const payRes = await request.post(`${API}/payments`, {
  56  |       data: {
  57  |         installmentAccountId: accountId,
  58  |         totalAmount: "5000",
  59  |         paymentDate: "2026-06-15",
  60  |         method: "CASH",
  61  |         paymentType: "REGULAR",
  62  |       },
  63  |     });
> 64  |     expect(payRes.status()).toBe(201);
      |                             ^ Error: expect(received).toBe(expected) // Object.is equality
  65  | 
  66  |     // 4. Get account state before close
  67  |     const beforeRes = await request.get(`${API}/installment-accounts/${accountId}`);
  68  |     expect(beforeRes.status()).toBe(200);
  69  |     const beforeClose = await beforeRes.json();
  70  |     console.log("Before close - Status:", beforeClose.installmentAccount.status);
  71  |     console.log("Before close - Remaining balance:", beforeClose.installmentAccount.remainingBalance);
  72  | 
  73  |     const preCloseBalance = parseFloat(beforeClose.installmentAccount.remainingBalance);
  74  |     expect(preCloseBalance).toBeGreaterThan(0);
  75  | 
  76  |     // 5. Try close with wrong password — should fail
  77  |     const wrongPassRes = await request.patch(`${API}/installment-accounts/${accountId}/close`, {
  78  |       data: { remarks: "Customer stopped paying", password: "wrong" },
  79  |     });
  80  |     expect(wrongPassRes.status()).toBe(401);
  81  |     console.log("Wrong password = 401 ✓");
  82  | 
  83  |     // 6. Try close with correct password
  84  |     const closeRes = await request.patch(`${API}/installment-accounts/${accountId}/close`, {
  85  |       data: { remarks: "Customer stopped paying", password: PASSWORD },
  86  |     });
  87  |     expect(closeRes.status()).toBe(200);
  88  |     const closed = await closeRes.json();
  89  |     console.log("Close response - writtenOff:", closed.writtenOff);
  90  |     console.log("Close response - status:", closed.installmentAccount.status);
  91  |     console.log("Close response - remainingBalance:", closed.installmentAccount.remainingBalance);
  92  | 
  93  |     // 7. Verify account is CLOSED with 0 balance
  94  |     expect(closed.installmentAccount.status).toBe("CLOSED");
  95  |     expect(closed.installmentAccount.remainingBalance).toBe("0.00");
  96  | 
  97  |     // 8. Verify written-off amount matches pre-close balance
  98  |     const writtenOff = parseFloat(closed.writtenOff);
  99  |     expect(writtenOff).toBeGreaterThan(0);
  100 |     expect(Math.abs(writtenOff - preCloseBalance)).toBeLessThan(0.02);
  101 |     console.log("Written off ₱" + closed.writtenOff + " matches pre-close balance ₱" + preCloseBalance.toFixed(2) + " ✓");
  102 | 
  103 |     // 9. Verify remarks contain written off info
  104 |     expect(closed.installmentAccount.remarks).toContain("Written off");
  105 |     console.log("Remarks:", closed.installmentAccount.remarks);
  106 | 
  107 |     // 10. Cannot re-close already closed account
  108 |     const recloseRes = await request.patch(`${API}/installment-accounts/${accountId}/close`, {
  109 |       data: { remarks: "Test", password: PASSWORD },
  110 |     });
  111 |     expect(recloseRes.status()).toBe(400);
  112 |     console.log("Cannot re-close = 400 ✓");
  113 | 
  114 |     console.log("\n✅ ALL CLOSE ACCOUNT LOGIC CHECKS PASSED");
  115 |   });
  116 | });
  117 | 
```