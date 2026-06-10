import Decimal from "decimal.js";
import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api";
import { dateToManilaDateOnly } from "@/lib/dates";
import { sendEmail } from "@/lib/email";
import { decimalToString, formatPeso } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST() {
  try {
    const accounts = await prisma.installmentAccount.findMany({
      where: {
        status: { in: ["ACTIVE", "OVERDUE", "DUE_TODAY"] as any },
        customerEmail: { not: null },
      },
      include: {
        schedule: { orderBy: { periodNumber: "asc" } },
        payments: { orderBy: { paymentDate: "desc" } },
      },
    });

    let sent = 0;
    let failed = 0;

    for (const account of accounts) {
      if (!account.customerEmail) continue;

      const unpaidSchedule = account.schedule.filter(
        (s) => s.status === "PENDING" || s.status === "PARTIAL" || s.status === "OVERDUE",
      );
      const nextPeriod = unpaidSchedule[0];
      if (!nextPeriod) continue;

      const totalPaid = account.payments
        .filter((p) => !p.voided)
        .reduce((sum, p) => sum.plus(new Decimal(p.totalAmount.toString())), new Decimal(0));

      const html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #991b1b;">Payment Reminder — MyFaveGadgets</h2>
          <p>Dear <strong>${account.customerName}</strong>,</p>
          <p>This is a reminder that your payment for <strong>${account.brand} ${account.model}</strong> is due.</p>
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr><td style="padding: 6px 0; color: #64748b;">Next Due Date</td><td style="padding: 6px 0; font-weight: 600;">${dateToManilaDateOnly(nextPeriod.dueDate)}</td></tr>
            <tr><td style="padding: 6px 0; color: #64748b;">Amount Due</td><td style="padding: 6px 0; font-weight: 600;">${formatPeso(nextPeriod.amount)}</td></tr>
            <tr><td style="padding: 6px 0; color: #64748b;">Remaining Balance</td><td style="padding: 6px 0; font-weight: 600; color: #991b1b;">${formatPeso(account.remainingBalance.toString())}</td></tr>
            <tr><td style="padding: 6px 0; color: #64748b;">Total Paid</td><td style="padding: 6px 0;">${formatPeso(totalPaid.toFixed(2))}</td></tr>
            <tr><td style="padding: 6px 0; color: #64748b;">Term</td><td style="padding: 6px 0;">${account.term} months &middot; ${formatPeso(account.monthlyInstallment.toString())}/mo</td></tr>
          </table>
          <p style="color: #b91c1c; font-weight: 600;">⚠️  Late payments incur a penalty of ${formatPeso(String(50))}/day.</p>
          <p style="margin-top: 24px; color: #64748b; font-size: 12px;">MyFaveGadgets — Binan City, Laguna</p>
        </div>`;

      try {
        await sendEmail({
          to: account.customerEmail,
          subject: `Payment Reminder — ${account.brand} ${account.model}`,
          html,
        });
        sent++;
      } catch {
        failed++;
      }
    }

    return NextResponse.json({ sent, failed, total: accounts.length });
  } catch (error) {
    return handleApiError(error);
  }
}
