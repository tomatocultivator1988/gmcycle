import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api";
import { dateToManilaDateOnly, getManilaTodayDateString, isBeforeManilaToday } from "@/lib/dates";
import { formatPeso } from "@/lib/money";
import { sendEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");

    const whereBase: Record<string, unknown> = {
      status: { notIn: ["APPLIED", "CLOSED"] as any },
    };
    if (date) {
      whereBase.nextDueDate = { lte: new Date(date + "T23:59:59.999+08:00") };
    }

    const allAccounts = await prisma.installmentAccount.findMany({
      where: whereBase,
      orderBy: { nextDueDate: "asc" },
    });

    const allIds = allAccounts.map((a) => a.id);
    const schedulePeriods = allIds.length > 0
      ? await prisma.installmentSchedule.findMany({
          where: { installmentAccountId: { in: allIds } },
          select: { installmentAccountId: true, dueDate: true, status: true },
        })
      : [];
    const scheduleByAccount = new Map<string, typeof schedulePeriods>();
    for (const s of schedulePeriods) {
      if (!scheduleByAccount.has(s.installmentAccountId)) {
        scheduleByAccount.set(s.installmentAccountId, []);
      }
      scheduleByAccount.get(s.installmentAccountId)!.push(s);
    }

    const now = new Date();
    const todayStr = getManilaTodayDateString();

    const computedAccounts = allAccounts.map((a) => {
      const periods = scheduleByAccount.get(a.id) ?? [];
      const unpaid = periods.filter((s) => s.status !== "PAID");

      let computedStatus = a.status;
      if (unpaid.length === 0 && periods.length > 0) {
        computedStatus = "FULLY_PAID";
      } else if (unpaid.length > 0) {
        const isOverdue = unpaid.some((s) => isBeforeManilaToday(s.dueDate));
        const isDueToday = unpaid.some((s) => dateToManilaDateOnly(s.dueDate) === todayStr);
        computedStatus = isOverdue ? "OVERDUE" : isDueToday ? "DUE_TODAY" : "ACTIVE";
      }

      return { ...a, computedStatus };
    });

    const activeAccounts = computedAccounts.filter(
      (a) => a.computedStatus === "ACTIVE" || a.computedStatus === "OVERDUE" || a.computedStatus === "DUE_TODAY",
    );
    const overdueCount = activeAccounts.filter((a) => a.computedStatus === "OVERDUE").length;
    const accountIds = activeAccounts.map((a) => a.id);

    const overduePeriods = accountIds.length > 0
      ? await prisma.installmentSchedule.groupBy({
          by: ["installmentAccountId"],
          where: {
            installmentAccountId: { in: accountIds },
            status: { in: ["PENDING", "OVERDUE", "PARTIAL"] },
            dueDate: { lt: new Date() },
          },
          _min: { dueDate: true },
        })
      : [];
    const earliestOverdueMap = new Map(
      overduePeriods.map((p) => [p.installmentAccountId, p._min.dueDate]),
    );

    const lastPayments = accountIds.length > 0
      ? await prisma.payment.findMany({
          where: { installmentAccountId: { in: accountIds }, voided: false },
          orderBy: { paymentDate: "desc" },
          distinct: ["installmentAccountId"],
        })
      : [];
    const paymentMap = new Map(lastPayments.map((p) => [p.installmentAccountId, p]));

    const generatedAt = new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila" });

    const rowsHtml = activeAccounts.map((a) => {
      const earliestOverdue = earliestOverdueMap.get(a.id);
      const daysOverdue = earliestOverdue
        ? Math.floor((new Date().getTime() - earliestOverdue.getTime()) / (1000 * 60 * 60 * 24))
        : 0;
      const s = a.computedStatus;
      const statusColor = s === "OVERDUE" ? "#b91c1c" : s === "DUE_TODAY" ? "#d97706" : "#059669";
      const lastPay = paymentMap.get(a.id);
      const perPeriodLabel = a.scheduleType === "SEMI_MONTHLY" ? "/per" : "/mo";
      const lastPayDisplay = lastPay
        ? `${dateToManilaDateOnly(lastPay.paymentDate)} — ${formatPeso(lastPay.totalAmount.toString())}`
        : "\u2014";
      return `
      <tr>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;">${a.customerName}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;">${a.brand} ${a.model}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;">${a.customerPhone}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:right;">${dateToManilaDateOnly(a.nextDueDate)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:center;font-weight:600;color:${statusColor};">${s}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:500;">${formatPeso(a.remainingBalance.toString())}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:right;white-space:nowrap;">${formatPeso(a.monthlyInstallment.toString())}<span style="font-size:10px;color:#94a3b8;">${perPeriodLabel}</span></td>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:right;white-space:nowrap;font-size:11px;">${lastPayDisplay}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:right;">${daysOverdue > 0 ? `<span style="color:#b91c1c;">${daysOverdue}d</span>` : "\u2014"}</td>
      </tr>`;
    }).join("");

    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:700px;margin:0 auto;background:#fff;padding:24px;">
        <div style="text-align:center;border-bottom:2px solid #991b1b;padding-bottom:16px;margin-bottom:20px;">
          <h1 style="font-size:20px;font-weight:700;color:#0f172a;margin:0;">MyFaveGadgets</h1>
          <p style="font-size:12px;color:#64748b;margin:4px 0;">Binan City, Laguna</p>
          <p style="font-size:16px;font-weight:600;color:#991b1b;margin:8px 0 0;">Due Date Monitoring</p>
        </div>

        <div style="margin-bottom:20px;">
          <h3 style="font-size:14px;color:#475569;margin:0 0 8px;">Summary</h3>
          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <tr><td style="padding:4px 0;color:#64748b;">Total Accounts</td><td style="padding:4px 0;text-align:right;font-weight:700;">${activeAccounts.length}</td></tr>
            <tr><td style="padding:4px 0;color:#64748b;">Overdue</td><td style="padding:4px 0;text-align:right;font-weight:700;color:#b91c1c;">${overdueCount}</td></tr>
          </table>
        </div>

        <h3 style="font-size:14px;color:#475569;margin:0 0 8px;">All Accounts (${activeAccounts.length})</h3>
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead>
            <tr style="background:#f1f5f9;">
              <th style="padding:6px 8px;text-align:left;font-weight:600;color:#475569;">Customer</th>
              <th style="padding:6px 8px;text-align:left;font-weight:600;color:#475569;">Unit</th>
              <th style="padding:6px 8px;text-align:left;font-weight:600;color:#475569;">Contact</th>
              <th style="padding:6px 8px;text-align:right;font-weight:600;color:#475569;">Due Date</th>
              <th style="padding:6px 8px;text-align:center;font-weight:600;color:#475569;">Status</th>
              <th style="padding:6px 8px;text-align:right;font-weight:600;color:#475569;">Balance</th>
              <th style="padding:6px 8px;text-align:right;font-weight:600;color:#475569;">Per Period</th>
              <th style="padding:6px 8px;text-align:right;font-weight:600;color:#475569;">Last Payment</th>
              <th style="padding:6px 8px;text-align:right;font-weight:600;color:#475569;">Days</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>

        <p style="margin-top:24px;color:#64748b;font-size:11px;text-align:center;border-top:1px solid #e2e8f0;padding-top:12px;">
          MyFaveGadgets — Gadget Installment Monitoring &bull; Generated: ${generatedAt}
        </p>
      </div>`;

    const config = await prisma.adminConfig.findFirst();
    const toEmail = config?.adminEmail || process.env.ADMIN_EMAIL || process.env.EMAIL_USER || "";

    await sendEmail({
      to: toEmail,
      subject: `Due Date Monitoring — ${todayStr}`,
      html,
    });

    return NextResponse.json({ message: "Due date monitoring report emailed", total: activeAccounts.length, overdue: overdueCount });
  } catch (error) {
    return handleApiError(error);
  }
}
