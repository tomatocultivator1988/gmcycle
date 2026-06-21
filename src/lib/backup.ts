import { prisma } from "@/lib/prisma";

export type BackupData = {
  exportedAt: string;
  accounts: Record<string, unknown>[];
  schedules: Record<string, unknown>[];
  payments: Record<string, unknown>[];
  penalties: Record<string, unknown>[];
  activityLogs: Record<string, unknown>[];
  adminConfig: Record<string, unknown> | null;
};

export async function exportAllData(): Promise<BackupData> {
  const [
    accounts,
    schedules,
    payments,
    penalties,
    activityLogs,
    adminConfig,
  ] = await Promise.all([
    prisma.installmentAccount.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.installmentSchedule.findMany({ orderBy: { periodNumber: "asc" } }),
    prisma.payment.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.penaltyRecord.findMany({ orderBy: { appliedDate: "asc" } }),
    prisma.activityLog.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.adminConfig.findFirst(),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    accounts: accounts.map(a => ({ ...a })),
    schedules: schedules.map(s => ({ ...s })),
    payments: payments.map(p => ({ ...p })),
    penalties: penalties.map(p => ({ ...p })),
    activityLogs: activityLogs.map(l => ({ ...l })),
    adminConfig: adminConfig ? { ...adminConfig } : null,
  };
}
