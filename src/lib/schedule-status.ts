import { prisma } from "@/lib/prisma";

export async function updateOverdueSchedule(installmentAccountId: string): Promise<void> {
  const todayStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
  }).format(new Date());
  const todayDate = new Date(todayStr + "T00:00:00.000+08:00");

  // Mark overdue: PENDING/PARTIAL with past due date → OVERDUE
  await prisma.installmentSchedule.updateMany({
    where: {
      installmentAccountId,
      status: { in: ["PENDING"] },
      dueDate: { lt: todayDate },
    },
    data: { status: "OVERDUE" },
  });

  // Reset stale OVERDUE back to PENDING when due date is today or future
  // (handles self-healing after adjust-due-dates or day rollover)
  await prisma.installmentSchedule.updateMany({
    where: {
      installmentAccountId,
      status: "OVERDUE",
      paidAmount: null,
      dueDate: { gte: todayDate },
    },
    data: { status: "PENDING" },
  });

  // Reset stale OVERDUE with partial payment back to PARTIAL
  await prisma.installmentSchedule.updateMany({
    where: {
      installmentAccountId,
      status: "OVERDUE",
      paidAmount: { not: null },
      dueDate: { gte: todayDate },
    },
    data: { status: "PARTIAL" },
  });
}
