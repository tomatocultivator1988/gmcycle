import Decimal from "decimal.js";
import { NextResponse } from "next/server";
import { handleApiError, readJson } from "@/lib/api";
import { parseMoney } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { updateAdminConfigSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET() {
  try {
    let config = await prisma.adminConfig.findFirst();

    if (!config) {
      config = await prisma.adminConfig.create({
        data: {
          penaltyPerDay: new Decimal("50.00"),
        },
      });
    }

    return NextResponse.json({
      config: {
        id: config.id,
        penaltyPerDay: config.penaltyPerDay.toFixed(2),
        adminEmail: config.adminEmail ?? null,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const body = updateAdminConfigSchema.parse(await readJson(request));
    const penaltyPerDay = parseMoney(body.penaltyPerDay, "penaltyPerDay");
    const adminEmail = body.adminEmail?.trim() || null;

    let config = await prisma.adminConfig.findFirst();

    if (config) {
      config = await prisma.adminConfig.update({
        where: { id: config.id },
        data: {
          penaltyPerDay: penaltyPerDay.toFixed(2),
          adminEmail,
        },
      });
    } else {
      config = await prisma.adminConfig.create({
        data: {
          penaltyPerDay: penaltyPerDay.toFixed(2),
          adminEmail,
        },
      });
    }

    return NextResponse.json({
      config: {
        id: config.id,
        penaltyPerDay: config.penaltyPerDay.toFixed(2),
        adminEmail: config.adminEmail ?? null,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
