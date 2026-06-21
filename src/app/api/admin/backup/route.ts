import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api";
import { exportAllData } from "@/lib/backup";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

async function getAdminPassword(): Promise<string> {
  const config = await prisma.adminConfig.findFirst();
  return config?.adminPassword || "buratnianjo123";
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const password = searchParams.get("password") || "";
    const adminPassword = await getAdminPassword();
    if (password !== adminPassword) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }

    const data = await exportAllData();
    const dateStr = new Date().toISOString().slice(0, 10);
    const json = JSON.stringify(data, null, 2);
    const filename = `backup-${dateStr}.json`;

    return new NextResponse(json, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
