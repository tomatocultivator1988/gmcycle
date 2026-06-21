import { NextResponse } from "next/server";
import { list, put, del } from "@vercel/blob";
import { handleApiError } from "@/lib/api";
import { exportAllData } from "@/lib/backup";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

async function getAdminPassword(): Promise<string> {
  const config = await prisma.adminConfig.findFirst();
  return config?.adminPassword || "buratnianjo123";
}

const BACKUP_RETENTION_DAYS = 30;
const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN || "";

export async function GET(request: Request) {
  try {
    const isVercelCron = request.headers.get("x-vercel-cron") === "1"
      || (request.headers.get("user-agent") || "").includes("Vercel-Cron");

    if (!isVercelCron) {
      const { searchParams } = new URL(request.url);
      const password = searchParams.get("password") || "";
      const adminPassword = await getAdminPassword();
      if (password !== adminPassword) {
        return NextResponse.json({ error: "Invalid password" }, { status: 401 });
      }
    }

    if (!BLOB_TOKEN) {
      throw new Error("BLOB_READ_WRITE_TOKEN is not configured");
    }

    const data = await exportAllData();
    const dateStr = new Date().toISOString().slice(0, 10);
    const blobPath = `backups/backup-${dateStr}.json`;
    const json = JSON.stringify(data, null, 2);

    const blob = await put(blobPath, json, {
      access: "public",
      contentType: "application/json",
      token: BLOB_TOKEN,
    });

    let deletedCount = 0;
    try {
      const existing = await list({ prefix: "backups/backup-", token: BLOB_TOKEN });
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - BACKUP_RETENTION_DAYS);

      for (const item of existing.blobs) {
        const uploadedAt = new Date(item.uploadedAt);
        if (uploadedAt < cutoff) {
          try { await del(item.url, { token: BLOB_TOKEN }); deletedCount++; } catch { /* skip */ }
        }
      }
    } catch (cleanupErr) {
      console.warn("Backup cleanup failed (non-fatal):", cleanupErr);
    }

    return NextResponse.json({
      success: true,
      backupUrl: blob.url,
      exportedAt: data.exportedAt,
      stats: {
        accounts: data.accounts.length,
        schedules: data.schedules.length,
        payments: data.payments.length,
        penalties: data.penalties.length,
        activityLogs: data.activityLogs.length,
      },
      cleanup: { deletedOldBlobs: deletedCount },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
