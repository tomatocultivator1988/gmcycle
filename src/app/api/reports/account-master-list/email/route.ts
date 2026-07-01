import Decimal from "decimal.js";
import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api";
import { dateToManilaDateOnly, getManilaTodayDateString } from "@/lib/dates";
import { decimalToString, formatPeso } from "@/lib/money";
import { sendEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");
    const paidStatus = searchParams.get("paidStatus");

    const scheduleEndDate = date ? new Date(date + "T23:59:59.999+08:00") : undefined;

    const whereBase: Record<string, unknown> = {
      status: { notIn: ["APPLIED", "CLOSED"] },
    };
    if (scheduleEndDate) {
      whereBase.schedule = { some: { dueDate: { lte: scheduleEndDate } } };
    }

    const allAccounts = await prisma.installmentAccount.findMany({
      where: whereBase,
      orderBy: { customerName: "asc" },
    });

    const accountIds = allAccounts.map((a) => a.id);

    const schedules = accountIds.length > 0
      ? await prisma.installmentSchedule.findMany({
          where: {
            installmentAccountId: { in: accountIds },
            ...(scheduleEndDate ? { dueDate: { lte: scheduleEndDate } } : {}),
          },
        })
      : [];

    const scheduleMap = new Map<string, typeof schedules>();
    for (const s of schedules) {
      if (!scheduleMap.has(s.installmentAccountId)) {
        scheduleMap.set(s.installmentAccountId, []);
      }
      scheduleMap.get(s.installmentAccountId)!.push(s);
    }

    const paidAccounts: typeof allAccounts = [];
    const unpaidAccounts: typeof allAccounts = [];
    for (const a of allAccounts) {
      const accountSchedules = scheduleMap.get(a.id) ?? [];
      if (accountSchedules.length > 0 && accountSchedules.every((s) => s.status === "PAID")) {
        paidAccounts.push(a);
      } else {
        unpaidAccounts.push(a);
      }
    }

    let accounts: typeof allAccounts;
    if (paidStatus === "paid") {
      accounts = paidAccounts;
    } else if (paidStatus === "unpaid") {
      accounts = unpaidAccounts;
    } else {
      accounts = allAccounts;
    }

    const filteredIds = accounts.map((a) => a.id);

    const totalBalance = accounts.reduce(
      (sum, a) => sum.plus(new Decimal(a.remainingBalance.toString())),
      new Decimal(0),
    );

    const paymentWhere: Record<string, unknown> = {
      installmentAccountId: { in: filteredIds.length > 0 ? filteredIds : [""] },
      voided: false,
    };
    const totalCollectedResult = filteredIds.length > 0
      ? await prisma.payment.aggregate({
          where: paymentWhere,
          _sum: { totalAmount: true },
        })
      : null;
    const totalCollected = totalCollectedResult?._sum?.totalAmount
      ? decimalToString(totalCollectedResult._sum.totalAmount)
      : "0.00";

    const todayStr = getManilaTodayDateString();

    const overduePeriods = filteredIds.length > 0
      ? await prisma.installmentSchedule.groupBy({
          by: ["installmentAccountId"],
          where: {
            installmentAccountId: { in: filteredIds },
            status: { in: ["PENDING", "OVERDUE", "PARTIAL"] },
            dueDate: { lt: new Date() },
          },
          _min: { dueDate: true },
        })
      : [];
    const earliestOverdueMap = new Map(
      overduePeriods.map((p) => [p.installmentAccountId, p._min.dueDate]),
    );

    const generatedAt = new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila" });

    const rowsHtml = accounts.map((a) => {
      const earliestOverdue = earliestOverdueMap.get(a.id);
      const daysOverdue = earliestOverdue
        ? Math.floor((new Date().getTime() - earliestOverdue.getTime()) / (1000 * 60 * 60 * 24))
        : 0;
      const statusColor = a.status === "OVERDUE" ? "#b91c1c" : a.status === "FULLY_PAID" ? "#059669" : a.status === "DUE_TODAY" ? "#d97706" : "#0f172a";
      return `
      <tr>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;">${a.customerName}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;">${a.customerPhone}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;">${a.brand} ${a.model}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:500;">${formatPeso(a.remainingBalance.toString())}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:right;">${formatPeso(a.monthlyInstallment.toString())}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:right;">${dateToManilaDateOnly(a.nextDueDate)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:center;font-weight:600;color:${statusColor};">${a.status}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:right;">${daysOverdue > 0 ? `<span style="color:#b91c1c;">${daysOverdue}d</span>` : "\u2014"}</td>
      </tr>`;
    }).join("");

    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:700px;margin:0 auto;background:#fff;padding:24px;">
        <div style="text-align:center;border-bottom:2px solid #991b1b;padding-bottom:16px;margin-bottom:20px;">
          <h1 style="font-size:20px;font-weight:700;color:#0f172a;margin:0;">MyFaveGadgets</h1>
          <p style="font-size:12px;color:#64748b;margin:4px 0;">Binan City, Laguna</p>
          <p style="font-size:16px;font-weight:600;color:#991b1b;margin:8px 0 0;">Account Master List</p>
        </div>

        <div style="margin-bottom:20px;">
          <h3 style="font-size:14px;color:#475569;margin:0 0 8px;">Summary</h3>
          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <tr><td style="padding:4px 0;color:#64748b;">Total Accounts</td><td style="padding:4px 0;text-align:right;font-weight:700;">${accounts.length}</td></tr>
            <tr><td style="padding:4px 0;color:#64748b;">Total Balance Outstanding</td><td style="padding:4px 0;text-align:right;font-weight:700;color:#b91c1c;">${formatPeso(totalBalance.toFixed(2))}</td></tr>
            <tr><td style="padding:4px 0;color:#64748b;">Total Collected</td><td style="padding:4px 0;text-align:right;font-weight:700;color:#059669;">${formatPeso(totalCollected)}</td></tr>
          </table>
        </div>

        <h3 style="font-size:14px;color:#475569;margin:0 0 8px;">All Accounts (${accounts.length})</h3>
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead>
            <tr style="background:#f1f5f9;">
              <th style="padding:6px 8px;text-align:left;font-weight:600;color:#475569;">Customer</th>
              <th style="padding:6px 8px;text-align:left;font-weight:600;color:#475569;">Contact</th>
              <th style="padding:6px 8px;text-align:left;font-weight:600;color:#475569;">Unit</th>
              <th style="padding:6px 8px;text-align:right;font-weight:600;color:#475569;">Balance</th>
              <th style="padding:6px 8px;text-align:right;font-weight:600;color:#475569;">Monthly</th>
              <th style="padding:6px 8px;text-align:right;font-weight:600;color:#475569;">Due Date</th>
              <th style="padding:6px 8px;text-align:center;font-weight:600;color:#475569;">Status</th>
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
      subject: `Account Master List — ${todayStr}`,
      html,
    });

    return NextResponse.json({ message: "Account master list emailed", total: accounts.length, totalBalance: totalBalance.toFixed(2) });
  } catch (error) {
    return handleApiError(error);
  }
}
