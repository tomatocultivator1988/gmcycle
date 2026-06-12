import Decimal from "decimal.js";
import { NextResponse } from "next/server";
import { handleApiError, readJson } from "@/lib/api";
import { dateToManilaDateOnly } from "@/lib/dates";
import { sendEmail } from "@/lib/email";
import { decimalToString, formatPeso } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await readJson(request)) as { accountIds?: string[] } | null;
    const where: Record<string, unknown> = {
      status: { in: ["ACTIVE", "OVERDUE", "DUE_TODAY"] as any },
      customerEmail: { not: null },
    };
    if (body?.accountIds?.length) {
      where.id = { in: body.accountIds };
    }

    const [accounts, config] = await Promise.all([
      prisma.installmentAccount.findMany({
        where,
        include: {
          schedule: { orderBy: { periodNumber: "asc" } },
          payments: { orderBy: { paymentDate: "desc" } },
        },
      }),
      prisma.adminConfig.findFirst(),
    ]);

    const penaltyPerDay = new Decimal(config?.penaltyPerDay ?? "50");
    const now = new Date();

    let sent = 0;
    let failed = 0;

    for (const account of accounts) {
      if (!account.customerEmail) continue;

      const unpaidSchedule = account.schedule.filter(
        (s) =>
          (s.status === "PENDING" || s.status === "PARTIAL" || s.status === "OVERDUE") &&
          new Date(s.dueDate) <= now,
      );
      if (unpaidSchedule.length === 0) continue;

      const totalPaid = account.payments
        .filter((p) => !p.voided)
        .reduce((sum, p) => sum.plus(new Decimal(p.totalAmount.toString())), new Decimal(0));

      const periodRows = unpaidSchedule.map((s) => {
        const dueDate = new Date(s.dueDate);
        const daysOverdue = Math.max(
          0,
          Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)),
        );
        const storedPenalty = new Decimal(s.penaltyAmount?.toString() ?? "0");
        const computedPenalty = daysOverdue > 0 && storedPenalty.eq(0)
          ? penaltyPerDay.times(daysOverdue)
          : new Decimal(0);
        const effectivePenalty = storedPenalty.gt(0) ? storedPenalty : computedPenalty;
        const totalDue = new Decimal(s.amount.toString()).plus(effectivePenalty);
        return { period: s.periodNumber, dueDate, amount: s.amount, daysOverdue, effectivePenalty, totalDue };
      });

      const totalDueAll = periodRows.reduce((sum, r) => sum.plus(r.totalDue), new Decimal(0));
      const totalPenaltyAll = periodRows.reduce((sum, r) => sum.plus(r.effectivePenalty), new Decimal(0));

      const rowsHtml = periodRows.map((r) => `
        <tr>
          <td style="padding:4px 8px;border-bottom:1px solid #e2e8f0;">#${r.period}</td>
          <td style="padding:4px 8px;border-bottom:1px solid #e2e8f0;">${dateToManilaDateOnly(r.dueDate)}</td>
          <td style="padding:4px 8px;border-bottom:1px solid #e2e8f0;">${formatPeso(r.amount)}</td>
          <td style="padding:4px 8px;border-bottom:1px solid #e2e8f0;">${r.daysOverdue > 0 ? `${r.daysOverdue}d` : "—"}</td>
          <td style="padding:4px 8px;border-bottom:1px solid #e2e8f0;color:#b91c1c;">${r.effectivePenalty.gt(0) ? formatPeso(r.effectivePenalty) : "—"}</td>
          <td style="padding:4px 8px;border-bottom:1px solid #e2e8f0;font-weight:600;">${formatPeso(r.totalDue)}</td>
        </tr>`).join("");

      const html = `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
          <h2 style="color:#991b1b;">Payment Reminder — MyFaveGadgets</h2>
          <p>Dear <strong>${account.customerName}</strong>,</p>
          <p>This is a reminder for <strong>${account.brand} ${account.model}</strong>.</p>
          <p>You have <strong>${unpaidSchedule.length}</strong> unpaid period${unpaidSchedule.length > 1 ? "s" : ""}:</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:13px;">
            <thead>
              <tr style="background:#f1f5f9;">
                <th style="padding:6px 8px;text-align:left;font-weight:600;color:#475569;">Period</th>
                <th style="padding:6px 8px;text-align:left;font-weight:600;color:#475569;">Due Date</th>
                <th style="padding:6px 8px;text-align:left;font-weight:600;color:#475569;">Amount</th>
                <th style="padding:6px 8px;text-align:left;font-weight:600;color:#475569;">Days</th>
                <th style="padding:6px 8px;text-align:left;font-weight:600;color:#475569;">Penalty</th>
                <th style="padding:6px 8px;text-align:left;font-weight:600;color:#475569;">Total Due</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;">
            <tr><td style="padding:6px 0;color:#64748b;">Total Due</td><td style="padding:6px 0;font-weight:700;font-size:15px;color:#991b1b;">${formatPeso(totalDueAll)} ${totalPenaltyAll.gt(0) ? `(incl. ${formatPeso(totalPenaltyAll)} penalty)` : ""}</td></tr>
            <tr><td style="padding:6px 0;color:#64748b;">Remaining Balance</td><td style="padding:6px 0;font-weight:600;color:#991b1b;">${formatPeso(account.remainingBalance.toString())}</td></tr>
            <tr><td style="padding:6px 0;color:#64748b;">Total Paid</td><td style="padding:6px 0;">${formatPeso(totalPaid.toFixed(2))}</td></tr>
            <tr><td style="padding:6px 0;color:#64748b;">Term</td><td style="padding:6px 0;">${account.term} months &middot; ${formatPeso(account.monthlyInstallment.toString())}/mo</td></tr>
          </table>
          <p style="color:#b91c1c;font-weight:600;">⚠️  Late penalty: ${formatPeso(penaltyPerDay)}/day overdue (if not yet applied).</p>
          <p style="margin-top:24px;color:#64748b;font-size:12px;">MyFaveGadgets — Binan City, Laguna</p>
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
