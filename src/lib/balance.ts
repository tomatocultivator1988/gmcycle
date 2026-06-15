import Decimal from "decimal.js";
import { decimalToString } from "@/lib/money";

type TxType = {
  installmentSchedule: { findMany: (args: any) => Promise<any[]> };
  installmentAccount: {
    findUnique: (args: any) => Promise<any | null>;
    update: (args: any) => Promise<any>;
  };
};

const protectedStatuses = new Set(["CLOSED", "APPLIED"]);

export async function recalculateBalance(
  tx: TxType,
  installmentAccountId: string,
): Promise<{ balance: Decimal; status: string; nextDueDate: Date | null }> {
  const schedule = await tx.installmentSchedule.findMany({
    where: { installmentAccountId },
  });

  const currentAccount = await tx.installmentAccount.findUnique({
    where: { id: installmentAccountId },
    select: { status: true },
  });

  const newBalance = schedule
    .filter((s) => s.status === "PENDING" || s.status === "PARTIAL" || s.status === "OVERDUE")
    .reduce((sum, s) => {
      const remainingAmt = Decimal.max(0, new Decimal(s.amount).minus(
        s.paidAmount ? new Decimal(s.paidAmount) : 0,
      ));
      return sum.plus(remainingAmt)
        .plus(new Decimal(s.penaltyAmount));
    }, new Decimal(0))
    .toDecimalPlaces(2);

  const unpaid = schedule
    .filter((s) => s.status === "PENDING" || s.status === "PARTIAL" || s.status === "OVERDUE")
    .sort((a, b) => a.periodNumber - b.periodNumber);

  const nextDue = unpaid[0]?.dueDate ?? null;

  let status = "ACTIVE";
  if (newBalance.eq(0)) {
    status = "FULLY_PAID";
  } else if (nextDue) {
    const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
    const dueStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(nextDue);
    if (todayStr > dueStr) status = "OVERDUE";
    else if (todayStr === dueStr) status = "DUE_TODAY";
  }

  // Preserve CLOSED / APPLIED — never overwrite from balance calculation
  if (currentAccount && protectedStatuses.has(currentAccount.status)) {
    status = currentAccount.status;
  }

  const updateData: Record<string, unknown> = {
    remainingBalance: decimalToString(newBalance),
    status,
  };
  if (nextDue) {
    updateData.nextDueDate = nextDue;
  }

  await tx.installmentAccount.update({
    where: { id: installmentAccountId },
    data: updateData,
  });

  return { balance: newBalance, status, nextDueDate: nextDue };
}
