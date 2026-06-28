import Decimal from "decimal.js";
import { NextResponse } from "next/server";
import { handleApiError, readJson } from "@/lib/api";
import { recalculateBalance } from "@/lib/balance";
import { NotFoundError } from "@/lib/errors";
import { decimalToString } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await readJson(request) as { password: string };

    const config = await prisma.adminConfig.findFirst();
    const adminPassword = config?.adminPassword || "buratnianjo123";
    if (!body.password || body.password !== adminPassword) {
      return NextResponse.json({ error: "Incorrect admin password" }, { status: 401 });
    }

    const account = await prisma.installmentAccount.findUnique({
      where: { id },
      include: { schedule: { orderBy: { periodNumber: "asc" } } },
    });

    if (!account) throw new NotFoundError("Installment account not found");

    const payments = await prisma.payment.findMany({
      where: { installmentAccountId: id, voided: false },
      orderBy: [{ paymentDate: "asc" }, { createdAt: "asc" }],
    });

    await prisma.$transaction(async (tx) => {
      // Reset all periods
      await tx.installmentSchedule.updateMany({
        where: { installmentAccountId: id },
        data: { paidAmount: null, paymentId: null, paidDate: null, penaltyAmount: "0", status: "PENDING" },
      });

      // Re-apply each payment from scratch
      for (const payment of payments) {
        const totalAmount = new Decimal(payment.totalAmount.toString());
        let remainingToApply = totalAmount;
        const paymentType = payment.paymentType;
        const penaltyBreakdown = payment.penaltyBreakdown as Record<string, string> | null;
        const principalBreakdown = payment.principalBreakdown as Record<string, string> | null;

        // Mark past-due PENDING as OVERDUE before allocation
        await tx.installmentSchedule.updateMany({
          where: {
            installmentAccountId: id,
            status: "PENDING",
            dueDate: { lt: payment.paymentDate },
          },
          data: { status: "OVERDUE" },
        });

        const schedule = await tx.installmentSchedule.findMany({
          where: { installmentAccountId: id },
          orderBy: { periodNumber: "asc" },
        });

        // Update in-memory statuses
        for (const s of schedule) {
          if (s.status === "PENDING" && s.dueDate < payment.paymentDate) {
            s.status = "OVERDUE";
          }
        }

        const computed: Array<{
          periodId: string;
          newPaidAmount: Decimal;
          newPenaltyAmount: Decimal;
          isPaid: boolean;
          principalCovered: Decimal;
        }> = [];

        let paymentPrincipalBreakdown: Record<string, string> = {};

        for (const period of schedule) {
          if (remainingToApply.lte(0)) break;
          if (period.status === "PAID") continue;

          const periodPenalty = new Decimal(period.penaltyAmount);
          const remainingPeriodAmount = new Decimal(period.amount).minus(
            period.paidAmount ? new Decimal(period.paidAmount) : 0,
          );
          const periodTotalDue = remainingPeriodAmount.plus(periodPenalty);

          const paidForPeriod = Decimal.min(remainingToApply, periodTotalDue);
          const principalCovered = Decimal.min(paidForPeriod, remainingPeriodAmount);
          const penaltyCovered = paidForPeriod.minus(principalCovered);

          if (principalCovered.gt(0)) {
            paymentPrincipalBreakdown[period.id] = decimalToString(principalCovered);
          }

          const newPaidAmount = (period.paidAmount
            ? new Decimal(period.paidAmount)
            : new Decimal(0)
          ).plus(principalCovered);

          const newPenaltyAmount = periodPenalty.minus(penaltyCovered);

          if (paidForPeriod.gt(0)) {
            computed.push({
              periodId: period.id,
              newPaidAmount,
              newPenaltyAmount,
              isPaid: paidForPeriod.gte(periodTotalDue),
              principalCovered,
            });
          }

          remainingToApply = remainingToApply.minus(paidForPeriod);

          if (paymentType === "PARTIAL") break;
        }

        // Write computed periods
        for (const c of computed) {
          await tx.installmentSchedule.update({
            where: { id: c.periodId },
            data: {
              status: c.isPaid ? "PAID" : "PARTIAL",
              paidDate: payment.paymentDate,
              paymentId: payment.id,
              paidAmount: decimalToString(c.newPaidAmount),
              penaltyAmount: decimalToString(c.newPenaltyAmount),
            },
          });
        }

        // Backfill principalBreakdown for this payment
        if (Object.keys(paymentPrincipalBreakdown).length > 0) {
          await tx.payment.update({
            where: { id: payment.id },
            data: { principalBreakdown: paymentPrincipalBreakdown },
          });
        }
      }

      await recalculateBalance(tx, id);
    });

    const fixed = await prisma.installmentAccount.findUnique({ where: { id } });
    return NextResponse.json({
      message: "Account fixed successfully",
      remainingBalance: fixed?.remainingBalance.toString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
