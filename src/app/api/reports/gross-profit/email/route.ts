import Decimal from "decimal.js";
import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api";
import { sendEmail } from "@/lib/email";
import { formatPeso } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST() {
  try {
    const accounts = await prisma.installmentAccount.findMany({
      where: { status: { notIn: ["CLOSED"] as any } },
    });

    const totalPotential = accounts.reduce(
      (sum, a) => sum.plus(new Decimal(a.installmentPrice.toString()).minus(new Decimal(a.cashPrice.toString()))),
      new Decimal(0),
    );

    const fullyPaid = accounts.filter((a) => a.status === "FULLY_PAID");
    const active = accounts.filter((a) => a.status !== "FULLY_PAID");

    const realizedProfit = fullyPaid.reduce(
      (sum, a) => sum.plus(new Decimal(a.installmentPrice.toString()).minus(new Decimal(a.cashPrice.toString()))),
      new Decimal(0),
    );

    const unrealizedProfit = active.reduce(
      (sum, a) => sum.plus(new Decimal(a.installmentPrice.toString()).minus(new Decimal(a.cashPrice.toString()))),
      new Decimal(0),
    );

    const totalCollected = accounts.reduce(
      (sum, a) => {
        const paid = new Decimal(a.installmentPrice.toString()).minus(new Decimal(a.remainingBalance.toString()));
        return sum.plus(paid);
      },
      new Decimal(0),
    );

    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #991b1b;">Gross Profit Report — MyFaveGadgets</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 10px 0; color: #64748b;">Metric</td>
            <td style="padding: 10px 0; text-align: right; font-weight: 600;">Value</td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 10px 0; color: #64748b;">Total Accounts</td>
            <td style="padding: 10px 0; text-align: right; font-weight: 600;">${accounts.length}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 10px 0; color: #64748b;">Fully Paid</td>
            <td style="padding: 10px 0; text-align: right; font-weight: 600;">${fullyPaid.length}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 10px 0; color: #64748b;">Active / Overdue</td>
            <td style="padding: 10px 0; text-align: right; font-weight: 600;">${active.length}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 10px 0; color: #64748b;">Total Potential Profit</td>
            <td style="padding: 10px 0; text-align: right; font-weight: 600;">${formatPeso(totalPotential.toFixed(2))}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 10px 0; color: #64748b;">Realized Profit (Fully Paid)</td>
            <td style="padding: 10px 0; text-align: right; font-weight: 600; color: #059669;">${formatPeso(realizedProfit.toFixed(2))}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 10px 0; color: #64748b;">Unrealized Profit (Active)</td>
            <td style="padding: 10px 0; text-align: right; font-weight: 600; color: #d97706;">${formatPeso(unrealizedProfit.toFixed(2))}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 10px 0; color: #64748b;">Total Collected</td>
            <td style="padding: 10px 0; text-align: right; font-weight: 600; color: #2563eb;">${formatPeso(totalCollected.toFixed(2))}</td>
          </tr>
        </table>
        <p style="margin-top: 24px; color: #64748b; font-size: 12px;">MyFaveGadgets — Binan City, Laguna</p>
      </div>`;

    const config = await prisma.adminConfig.findFirst();
    const toEmail = config?.adminEmail || process.env.ADMIN_EMAIL || process.env.EMAIL_USER || "";

    await sendEmail({
      to: toEmail,
      subject: "Gross Profit Report — MyFaveGadgets",
      html,
    });

    return NextResponse.json({
      message: "Gross profit report emailed",
      data: {
        totalAccounts: accounts.length,
        fullyPaid: fullyPaid.length,
        active: active.length,
        totalPotentialProfit: totalPotential.toFixed(2),
        realizedProfit: realizedProfit.toFixed(2),
        unrealizedProfit: unrealizedProfit.toFixed(2),
        totalCollected: totalCollected.toFixed(2),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
