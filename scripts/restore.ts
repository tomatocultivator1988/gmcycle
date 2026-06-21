import * as fs from "fs";
import * as path from "path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import type { BackupData } from "../src/lib/backup";

const backupFile = process.argv[2];
if (!backupFile) {
  console.error("Usage: npx tsx scripts/restore.ts <backup-file.json>");
  process.exit(1);
}

const filePath = path.resolve(backupFile);
if (!fs.existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  process.exit(1);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is required. Set it in .env file.");
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  const raw = fs.readFileSync(filePath, "utf-8");
  const data = JSON.parse(raw) as BackupData;

  console.log(`Restoring from: ${filePath}`);
  console.log(`Exported at: ${data.exportedAt}`);
  console.log(`Accounts: ${data.accounts.length}`);
  console.log(`Schedules: ${data.schedules.length}`);
  console.log(`Payments: ${data.payments.length}`);
  console.log(`Penalties: ${data.penalties.length}`);
  console.log(`Activity Logs: ${data.activityLogs.length}`);

  await prisma.$transaction(async (tx) => {
    console.log("Clearing existing data...");
    await tx.penaltyRecord.deleteMany();
    await tx.activityLog.deleteMany();
    await tx.payment.deleteMany();
    await tx.installmentSchedule.deleteMany();
    await tx.installmentAccount.deleteMany();
    await tx.adminConfig.deleteMany();

    console.log("Restoring admin config...");
    if (data.adminConfig) {
      const cfg = data.adminConfig as Record<string, unknown>;
      await tx.adminConfig.create({ data: cfg as any });
    }

    console.log("Restoring accounts + schedules...");
    for (const account of data.accounts) {
      const accSchedules = data.schedules.filter(
        (s: Record<string, unknown>) => s.installmentAccountId === account.id
      );
      await tx.installmentAccount.create({
        data: {
          ...account,
          schedule: accSchedules.length > 0
            ? { create: accSchedules.map((s: any) => {
                const { installmentAccountId, ...rest } = s;
                return rest;
              }) }
            : undefined,
        } as any,
      });
    }

    console.log("Restoring payments...");
    for (const payment of data.payments) {
      await tx.payment.create({ data: payment as any });
    }

    console.log("Restoring penalties...");
    for (const penalty of data.penalties) {
      await tx.penaltyRecord.create({ data: penalty as any });
    }

    console.log("Restoring activity logs...");
    for (const log of data.activityLogs) {
      await tx.activityLog.create({ data: log as any });
    }
  });

  console.log("Restore complete!");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
