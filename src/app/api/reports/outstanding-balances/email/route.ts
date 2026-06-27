import Decimal from "decimal.js";
import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api";
import { dateToManilaDateOnly } from "@/lib/dates";
import { decimalToString, formatPeso } from "@/lib/money";
import { sendEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST() {
  try {
    const accounts = await prisma.installmentAccount.findMany({
      where: { status: { in: ["ACTIVE", "OVERDUE", "DUE_TODAY"] as any } },
      orderBy: { remainingBalance: "desc" },
    });

    const totalOutstanding = accounts.reduce(
      (sum, a) => sum.plus(new Decimal(a.remainingBalance.toString())),
      new Decimal(0),
    );

    const generatedAt = new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila" });

    const rowsHtml = accounts.map((a) => {
      const statusColor = a.status === "OVERDUE" ? "#b91c1c" : a.status === "DUE_TODAY" ? "#d97706" : "#059669";
      return `
      <tr>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;">${a.customerName}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;">${a.customerPhone}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;">${a.brand} ${a.model}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:500;">${formatPeso(a.remainingBalance.toString())}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:right;">${formatPeso(a.monthlyInstallment.toString())}<span style="font-size:10px;color:#94a3b8;">${a.scheduleType === "SEMI_MONTHLY" ? "/per" : "/mo"}</span></td>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:right;">${dateToManilaDateOnly(a.nextDueDate)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:center;font-weight:600;color:${statusColor};">${a.status}</td>
      </tr>`;
    }).join("");

    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:680px;margin:0 auto;background:#fff;padding:24px;">
        <div style="text-align:center;border-bottom:2px solid #991b1b;padding-bottom:16px;margin-bottom:20px;">
          <h1 style="font-size:20px;font-weight:700;color:#0f172a;margin:0;">MyFaveGadgets</h1>
          <p style="font-size:12px;color:#64748b;margin:4px 0;">Binan City, Laguna</p>
          <p style="font-size:16px;font-weight:600;color:#991b1b;margin:8px 0 0;">Outstanding Balance Report</p>
        </div>

        <div style="margin-bottom:20px;">
          <h3 style="font-size:14px;color:#475569;margin:0 0 8px;">Summary</h3>
          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <tr><td style="padding:4px 0;color:#64748b;">Total Outstanding</td><td style="padding:4px 0;text-align:right;font-weight:700;color:#b91c1c;">${formatPeso(totalOutstanding.toFixed(2))}</td></tr>
            <tr><td style="padding:4px 0;color:#64748b;">Active Accounts</td><td style="padding:4px 0;text-align:right;font-weight:700;">${accounts.length}</td></tr>
          </table>
        </div>

        <h3 style="font-size:14px;color:#475569;margin:0 0 8px;">All Accounts (${accounts.length})</h3>
        ${accounts.length > 0 ? `
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead>
            <tr style="background:#f1f5f9;">
              <th style="padding:6px 8px;text-align:left;font-weight:600;color:#475569;">Customer</th>
              <th style="padding:6px 8px;text-align:left;font-weight:600;color:#475569;">Contact</th>
              <th style="padding:6px 8px;text-align:left;font-weight:600;color:#475569;">Unit</th>
              <th style="padding:6px 8px;text-align:right;font-weight:600;color:#475569;">Balance</th>
              <th style="padding:6px 8px;text-align:right;font-weight:600;color:#475569;">Per Period</th>
              <th style="padding:6px 8px;text-align:right;font-weight:600;color:#475569;">Due Date</th>
              <th style="padding:6px 8px;text-align:center;font-weight:600;color:#475569;">Status</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>` : "<p style='color:#94a3b8;font-size:13px;'>No outstanding accounts.</p>"}

        <p style="margin-top:24px;color:#64748b;font-size:11px;text-align:center;border-top:1px solid #e2e8f0;padding-top:12px;">
          MyFaveGadgets — Gadget Installment Monitoring &bull; Generated: ${generatedAt}
        </p>
      </div>`;

    const config = await prisma.adminConfig.findFirst();
    const toEmail = config?.adminEmail || process.env.ADMIN_EMAIL || process.env.EMAIL_USER || "";

    await sendEmail({
      to: toEmail,
      subject: "Outstanding Balance Report — MyFaveGadgets",
      html,
    });

    return NextResponse.json({ message: "Outstanding balance report emailed", totalOutstanding: totalOutstanding.toFixed(2), count: accounts.length });
  } catch (error) {
    return handleApiError(error);
  }
}
