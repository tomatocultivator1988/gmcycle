import * as fs from "fs";
import * as path from "path";

const backupDir = path.resolve(__dirname, "..", "backups");
const dateStr = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const filePath = path.join(backupDir, `backup-${dateStr}.json`);

async function main() {
  const { exportAllData } = await import("../src/lib/backup");

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  console.log("Exporting database...");
  const data = await exportAllData();
  const json = JSON.stringify(data, null, 2);

  fs.writeFileSync(filePath, json, "utf-8");
  const sizeKB = (Buffer.byteLength(json) / 1024).toFixed(1);

  console.log(`Backup saved: ${filePath}`);
  console.log(`Size: ${sizeKB} KB`);
  console.log(`Accounts: ${data.accounts.length}`);
  console.log(`Schedules: ${data.schedules.length}`);
  console.log(`Payments: ${data.payments.length}`);
  console.log(`Penalties: ${data.penalties.length}`);
  console.log(`Activity Logs: ${data.activityLogs.length}`);
  console.log("Done.");
  process.exit(0);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
