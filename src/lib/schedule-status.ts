import { prisma } from "@/lib/prisma";

export async function updateOverdueSchedule(installmentAccountId: string): Promise<void> {
  const today = new Date();

  await prisma.installmentSchedule.updateMany({
    where: {
      installmentAccountId,
      status: { in: ["PENDING", "PARTIAL"] },
      dueDate: { lt: today },
    },
    data: { status: "OVERDUE" },
  });
}
