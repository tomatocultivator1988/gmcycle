import { prisma } from "../src/lib/prisma";
import Decimal from "decimal.js";
import { recalculateBalance } from "../src/lib/balance";

async function main() {
  const accountId = "cmqxf4v89000704lababcmon0";

  // Get current schedule
  const periods = await prisma.installmentSchedule.findMany({
    where: { installmentAccountId: accountId },
    orderBy: { periodNumber: "asc" },
  });
  console.log("=== Current Schedule ===");
  for (const p of periods) {
    console.log(`Period ${p.periodNumber}: ${p.status} | amount=${p.amount} | paid=${p.paidAmount} | paymentId=${p.paymentId?.substring(0, 8)}`);
  }

  const payments = await prisma.payment.findMany({
    where: { installmentAccountId: accountId, voided: false },
    orderBy: [{ paymentDate: "asc" }, { createdAt: "asc" }],
  });
  console.log("\n=== Payments ===");
  for (const p of payments) {
    console.log(`Date=${p.paymentDate} | Amount=${p.totalAmount} | Type=${p.paymentType} | ID=${p.id.substring(0, 8)}`);
  }

  console.log("\n=== Fixing ===");

  await prisma.$transaction(async (tx) => {
    await tx.installmentSchedule.updateMany({
      where: { installmentAccountId: accountId },
      data: { paidAmount: null, paymentId: null, paidDate: null, penaltyAmount: "0", status: "PENDING" },
    });

    for (const payment of payments) {
      const totalAmount = new Decimal(payment.totalAmount.toString());
      let remainingToApply = totalAmount;

      await tx.installmentSchedule.updateMany({
        where: { installmentAccountId: accountId, status: "PENDING", dueDate: { lt: payment.paymentDate } },
        data: { status: "OVERDUE" },
      });

      const schedule = await tx.installmentSchedule.findMany({
        where: { installmentAccountId: accountId },
        orderBy: { periodNumber: "asc" },
      });

      for (const s of schedule) {
        if (s.status === "PENDING" && s.dueDate < payment.paymentDate) {
          (s as any).status = "OVERDUE";
        }
      }

      const computed: Array<{ periodId: string; newPaidAmount: string; isPaid: boolean }> = [];
      const principalBreakdown: Record<string, string> = {};

      for (const period of schedule) {
        if (remainingToApply.lte(0)) break;
        if (period.status === "PAID") continue;

        const periodPenalty = new Decimal(period.penaltyAmount.toString());
        const remainingPeriodAmount = new Decimal(period.amount.toString()).minus(
          period.paidAmount ? new Decimal(period.paidAmount.toString()) : 0,
        );
        const periodTotalDue = remainingPeriodAmount.plus(periodPenalty);
        const paidForPeriod = Decimal.min(remainingToApply, periodTotalDue);
        const principalCovered = Decimal.min(paidForPeriod, remainingPeriodAmount);

        if (principalCovered.gt(0)) {
          principalBreakdown[period.id] = principalCovered.toFixed(2);
        }

        const newPaidAmount = (period.paidAmount
          ? new Decimal(period.paidAmount.toString())
          : new Decimal(0)
        ).plus(principalCovered);

        if (paidForPeriod.gt(0)) {
          computed.push({
            periodId: period.id,
            newPaidAmount: newPaidAmount.toFixed(2),
            isPaid: paidForPeriod.gte(periodTotalDue),
          });
        }

        remainingToApply = remainingToApply.minus(paidForPeriod);
        if (payment.paymentType === "PARTIAL") break;
      }

      for (const c of computed) {
        await tx.installmentSchedule.update({
          where: { id: c.periodId },
          data: {
            status: c.isPaid ? "PAID" : "PARTIAL",
            paidDate: payment.paymentDate,
            paymentId: payment.id,
            paidAmount: c.newPaidAmount,
          },
        });
      }

      if (Object.keys(principalBreakdown).length > 0) {
        await tx.payment.update({
          where: { id: payment.id },
          data: { principalBreakdown },
        });
      }
    }
  });

  const fixed = await prisma.installmentSchedule.findMany({
    where: { installmentAccountId: accountId },
    orderBy: { periodNumber: "asc" },
  });
  console.log("\n=== After Fix ===");
  let totalPaid = 0;
  for (const p of fixed) {
    totalPaid += p.paidAmount ? parseFloat(p.paidAmount.toString()) : 0;
    console.log(`Period ${p.periodNumber}: ${p.status} | amount=${p.amount} | paid=${p.paidAmount} | paymentId=${p.paymentId?.substring(0, 8)}`);
  }
  await prisma.$transaction(async (tx) => {
    await recalculateBalance(tx, accountId);
  });

  const account = await prisma.installmentAccount.findUnique({ where: { id: accountId } });
  console.log(`\nRemaining Balance: ${account?.remainingBalance}`);
  console.log(`Total Paid (schedule): ${totalPaid.toFixed(2)}`);
}

main().catch(console.error);
