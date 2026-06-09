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
          penaltyAmount: new Decimal("200.00"),
          dueDayOptions: [10, 20, 30],
        },
      });
    }

    return NextResponse.json({
      config: {
        id: config.id,
        penaltyAmount: config.penaltyAmount.toFixed(2),
        dueDayOptions: config.dueDayOptions,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const body = updateAdminConfigSchema.parse(await readJson(request));
    const penaltyAmount = parseMoney(body.penaltyAmount, "penaltyAmount");

    let config = await prisma.adminConfig.findFirst();

    if (config) {
      config = await prisma.adminConfig.update({
        where: { id: config.id },
        data: {
          penaltyAmount: penaltyAmount.toFixed(2),
          dueDayOptions: body.dueDayOptions,
        },
      });
    } else {
      config = await prisma.adminConfig.create({
        data: {
          penaltyAmount: penaltyAmount.toFixed(2),
          dueDayOptions: body.dueDayOptions,
        },
      });
    }

    return NextResponse.json({
      config: {
        id: config.id,
        penaltyAmount: config.penaltyAmount.toFixed(2),
        dueDayOptions: config.dueDayOptions,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
