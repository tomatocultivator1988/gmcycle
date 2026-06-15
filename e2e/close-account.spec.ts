import { test, expect } from "@playwright/test";
import { chromium } from "playwright";

const API = "http://localhost:3000/api";
const PASSWORD = "buratnianjo123";

type AccountDto = any;
type PaymentDto = any;
type ScheduleDto = any;

test.describe("Close Account Logic", () => {
  let accountId: string;

  test("should close account with outstanding balance, write off, and log activity", async ({ request }) => {
    // 1. Create an account with 6 months term, ₱60,000 cash price, ₱10,000 down
    const createRes = await request.post(`${API}/installment-accounts`, {
      data: {
        customerName: "Close Test Customer",
        customerPhone: "09100000001",
        customerEmail: "close@test.com",
        customerAddress: "Test Address",
        fbLink: "https://facebook.com/test",
        brand: "Honda",
        model: "Test 125",
        unitDescription: "Test motorcycle for close",
        cashPrice: "60000",
        downPayment: "10000",
        interestRate: "5",
        term: 6,
        scheduleType: "MONTHLY",
        dueDays: [15],
        firstDueDate: "2026-06-15",
        dateGiven: "2026-05-15",
        startDate: "2026-05-15",
      },
    });
    expect(createRes.status()).toBe(201);
    const created = await createRes.json();
    accountId = created.installmentAccount.id;
    console.log("Created account:", accountId);

    // 2. Activate the account
    const activateRes = await request.patch(`${API}/installment-accounts/${accountId}/activate`, {
      data: {},
    });
    expect(activateRes.status()).toBe(200);
    const activated = await activateRes.json();
    console.log("Activated. Status:", activated.installmentAccount.status);
    console.log("Remaining balance:", activated.installmentAccount.remainingBalance);

    const remainingBeforeClose = activated.installmentAccount.remainingBalance;
    expect(parseFloat(remainingBeforeClose)).toBeGreaterThan(0);

    // 3. Post one payment (partial payment)
    const payRes = await request.post(`${API}/payments`, {
      data: {
        installmentAccountId: accountId,
        totalAmount: "5000",
        paymentDate: "2026-06-15",
        method: "CASH",
        paymentType: "REGULAR",
      },
    });
    expect(payRes.status()).toBe(201);

    // 4. Get account state before close
    const beforeRes = await request.get(`${API}/installment-accounts/${accountId}`);
    expect(beforeRes.status()).toBe(200);
    const beforeClose = await beforeRes.json();
    console.log("Before close - Status:", beforeClose.installmentAccount.status);
    console.log("Before close - Remaining balance:", beforeClose.installmentAccount.remainingBalance);

    const preCloseBalance = parseFloat(beforeClose.installmentAccount.remainingBalance);
    expect(preCloseBalance).toBeGreaterThan(0);

    // 5. Try close with wrong password — should fail
    const wrongPassRes = await request.patch(`${API}/installment-accounts/${accountId}/close`, {
      data: { remarks: "Customer stopped paying", password: "wrong" },
    });
    expect(wrongPassRes.status()).toBe(401);
    console.log("Wrong password = 401 ✓");

    // 6. Try close with correct password
    const closeRes = await request.patch(`${API}/installment-accounts/${accountId}/close`, {
      data: { remarks: "Customer stopped paying", password: PASSWORD },
    });
    expect(closeRes.status()).toBe(200);
    const closed = await closeRes.json();
    console.log("Close response - writtenOff:", closed.writtenOff);
    console.log("Close response - status:", closed.installmentAccount.status);
    console.log("Close response - remainingBalance:", closed.installmentAccount.remainingBalance);

    // 7. Verify account is CLOSED with 0 balance
    expect(closed.installmentAccount.status).toBe("CLOSED");
    expect(closed.installmentAccount.remainingBalance).toBe("0.00");

    // 8. Verify written-off amount matches pre-close balance
    const writtenOff = parseFloat(closed.writtenOff);
    expect(writtenOff).toBeGreaterThan(0);
    expect(Math.abs(writtenOff - preCloseBalance)).toBeLessThan(0.02);
    console.log("Written off ₱" + closed.writtenOff + " matches pre-close balance ₱" + preCloseBalance.toFixed(2) + " ✓");

    // 9. Verify remarks contain written off info
    expect(closed.installmentAccount.remarks).toContain("Written off");
    console.log("Remarks:", closed.installmentAccount.remarks);

    // 10. Cannot re-close already closed account
    const recloseRes = await request.patch(`${API}/installment-accounts/${accountId}/close`, {
      data: { remarks: "Test", password: PASSWORD },
    });
    expect(recloseRes.status()).toBe(400);
    console.log("Cannot re-close = 400 ✓");

    console.log("\n✅ ALL CLOSE ACCOUNT LOGIC CHECKS PASSED");
  });
});
