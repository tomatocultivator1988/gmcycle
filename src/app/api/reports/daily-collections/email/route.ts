import Decimal from "decimal.js";
import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api";
import { getManilaDayRange, dateToManilaDateOnly } from "@/lib/dates";
import { decimalToString, formatPeso } from "@/lib/money";
import { sendEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST() {
  try {
    const { start, end } = getManilaDayRange();

    const payments = await prisma.payment.findMany({
      where: { paymentDate: { gte: start, lt: end }, voided: false },
      orderBy: { paymentDate: "desc" },
      include: {
        installmentAccount: { select: { id: true, brand: true, model: true, customerName: true } },
      },
    });

    const total = payments.reduce(
      (sum, p) => sum.plus(new Decimal(p.totalAmount.toString())),
      new Decimal(0),
    );

    const generatedAt = new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila" });
    const dateLabel = dateToManilaDateOnly(start);

    const rowsHtml = payments.map((p) => `
      <tr>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;">${p.installmentAccount.customerName}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;">${p.installmentAccount.brand} ${p.installmentAccount.model}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:500;">${formatPeso(p.totalAmount.toString())}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:center;">${p.method}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:center;">${p.paymentType}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;">${p.cashier || "\u2014"}</td>
      </tr>`).join("");

    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:640px;margin:0 auto;background:#fff;padding:24px;">
        <div style="text-align:center;border-bottom:2px solid #991b1b;padding-bottom:16px;margin-bottom:20px;">
          <h1 style="font-size:20px;font-weight:700;color:#0f172a;margin:0;">MyFaveGadgets</h1>
          <p style="font-size:12px;color:#64748b;margin:4px 0;">Binan City, Laguna</p>
          <p style="font-size:16px;font-weight:600;color:#991b1b;margin:8px 0 0;">Daily Collection Report</p>
        </div>

        <div style="margin-bottom:20px;">
          <h3 style="font-size:14px;color:#475569;margin:0 0 8px;">Summary</h3>
          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <tr><td style="padding:4px 0;color:#64748b;">Date</td><td style="padding:4px 0;text-align:right;font-weight:700;">${dateLabel}</td></tr>
            <tr><td style="padding:4px 0;color:#64748b;">Today's Total</td><td style="padding:4px 0;text-align:right;font-weight:700;color:#059669;">${formatPeso(total.toFixed(2))}</td></tr>
            <tr><td style="padding:4px 0;color:#64748b;">Transactions</td><td style="padding:4px 0;text-align:right;font-weight:700;">${payments.length}</td></tr>
          </table>
        </div>

        <h3 style="font-size:14px;color:#475569;margin:0 0 8px;">All Collections (${payments.length})</h3>
        ${payments.length > 0 ? `
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead>
            <tr style="background:#f1f5f9;">
              <th style="padding:6px 8px;text-align:left;font-weight:600;color:#475569;">Customer</th>
              <th style="padding:6px 8px;text-align:left;font-weight:600;color:#475569;">Unit</th>
              <th style="padding:6px 8px;text-align:right;font-weight:600;color:#475569;">Amount</th>
              <th style="padding:6px 8px;text-align:center;font-weight:600;color:#475569;">Method</th>
              <th style="padding:6px 8px;text-align:center;font-weight:600;color:#475569;">Type</th>
              <th style="padding:6px 8px;text-align:left;font-weight:600;color:#475569;">Cashier</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>` : "<p style='color:#94a3b8;font-size:13px;'>No collections today.</p>"}

        <p style="margin-top:24px;color:#64748b;font-size:11px;text-align:center;border-top:1px solid #e2e8f0;padding-top:12px;">
          MyFaveGadgets — Gadget Installment Monitoring &bull; Generated: ${generatedAt}
        </p>
      </div>`;

    const config = await prisma.adminConfig.findFirst();
    const toEmail = config?.adminEmail || process.env.ADMIN_EMAIL || process.env.EMAIL_USER || "";

    await sendEmail({
      to: toEmail,
      subject: `Daily Collection Report — ${dateLabel}`,
      html,
    });

    return NextResponse.json({ message: "Daily collection report emailed", total: total.toFixed(2), count: payments.length, date: dateLabel });
  } catch (error) {
    return handleApiError(error);
  }
}
