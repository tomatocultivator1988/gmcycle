import { differenceInCalendarDays } from "date-fns";
import Decimal from "decimal.js";
import { NextResponse } from "next/server";
import { handleApiError, readJson } from "@/lib/api";
import { dateToManilaDateOnly } from "@/lib/dates";
import { sendEmail } from "@/lib/email";
import { NotFoundError } from "@/lib/errors";
import { decimalToString, formatPeso } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    const account = await prisma.installmentAccount.findUnique({
      where: { id },
      include: {
        payments: { where: { voided: false }, orderBy: { paymentDate: "asc" } },
        schedule: { orderBy: { periodNumber: "asc" } },
        penalties: { orderBy: { appliedDate: "asc" } },
      },
    });

    if (!account) {
      throw new NotFoundError("Installment account not found");
    }

    if (!account.customerEmail) {
      return NextResponse.json({ error: "Customer has no email address" }, { status: 400 });
    }

    const totalPayments = account.payments.reduce(
      (sum, p) => sum.plus(new Decimal(p.totalAmount)),
      new Decimal(0),
    );

    const totalPenalties = account.penalties.reduce(
      (sum, p) => sum.plus(new Decimal(p.amount)),
      new Decimal(0),
    );

    const installmentPrice = new Decimal(account.installmentPrice);
    const downPayment = new Decimal(account.downPayment);
    const cashPrice = new Decimal(account.cashPrice);
    const grossProfit = installmentPrice.sub(cashPrice);

    const config = await prisma.adminConfig.findFirst();
    const penaltyPerDay = config?.penaltyPerDay
      ? new Decimal(config.penaltyPerDay.toString())
      : new Decimal("50");

    const todayManila = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

    const scheduleRows = account.schedule.map((s) => {
      const dueStr = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Manila",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(s.dueDate);
      const daysOverdue = s.status === "PAID" ? null : todayManila > dueStr ? differenceInCalendarDays(new Date(todayManila), new Date(dueStr)) : 0;
      const storedPenalty = new Decimal(s.penaltyAmount);
      const computedPenalty = daysOverdue && daysOverdue > 0 && storedPenalty.eq(0)
        ? penaltyPerDay.times(daysOverdue)
        : new Decimal(0);
      const effectivePenalty = storedPenalty.gt(0) ? storedPenalty : computedPenalty;
      const displayAmount = s.status === "PARTIAL" && s.paidAmount
        ? (parseFloat(s.amount.toString()) - parseFloat(s.paidAmount.toString())).toFixed(2)
        : decimalToString(s.amount);
      return {
        period: s.periodNumber,
        dueDate: dateToManilaDateOnly(s.dueDate),
        amount: decimalToString(s.amount),
        displayAmount,
        status: s.status,
        penalty: decimalToString(effectivePenalty),
        daysOverdue,
        paidAmount: s.paidAmount ? decimalToString(s.paidAmount) : null,
      };
    });

    const dueNow = scheduleRows.filter(
      (s) => (s.status === "PENDING" || s.status === "PARTIAL" || s.status === "OVERDUE") && s.dueDate <= todayManila,
    );
    const totalDue = dueNow.reduce(
      (sum, s) => sum.plus(new Decimal(s.displayAmount)).plus(new Decimal(s.penalty)),
      new Decimal(0),
    );
    const totalDuePenalty = dueNow.reduce(
      (sum, s) => sum.plus(new Decimal(s.penalty)),
      new Decimal(0),
    );

    const paymentRowsHtml = account.payments.map((p) => `
      <tr>
        <td style="padding:4px 8px;border-bottom:1px solid #e2e8f0;">${dateToManilaDateOnly(p.paymentDate)}</td>
        <td style="padding:4px 8px;border-bottom:1px solid #e2e8f0;text-align:right;">${formatPeso(p.totalAmount.toString())}</td>
        <td style="padding:4px 8px;border-bottom:1px solid #e2e8f0;">${p.paymentType}</td>
        <td style="padding:4px 8px;border-bottom:1px solid #e2e8f0;text-align:right;color:#b91c1c;">${new Decimal(p.penaltyAmount).gt(0) ? formatPeso(p.penaltyAmount.toString()) : "—"}</td>
      </tr>`).join("");

    const scheduleRowsHtml = scheduleRows.map((s) => `
      <tr${s.status === "OVERDUE" ? ' style="background:#fef2f2;"' : s.status === "PAID" ? ' style="background:#f0fdf4;"' : s.status === "PARTIAL" ? ' style="background:#fffbeb;"' : ""}>
        <td style="padding:4px 8px;border-bottom:1px solid #e2e8f0;">#${s.period}</td>
        <td style="padding:4px 8px;border-bottom:1px solid #e2e8f0;">${s.dueDate}</td>
        <td style="padding:4px 8px;border-bottom:1px solid #e2e8f0;text-align:right;">${s.daysOverdue != null && s.daysOverdue > 0 ? `<span style="color:#b91c1c;">${s.daysOverdue}d</span>` : "—"}</td>
        <td style="padding:4px 8px;border-bottom:1px solid #e2e8f0;text-align:right;">${formatPeso(s.displayAmount)}</td>
        <td style="padding:4px 8px;border-bottom:1px solid #e2e8f0;text-align:right;color:#b91c1c;">${s.penalty !== "0.00" ? formatPeso(s.penalty) : "—"}</td>
        <td style="padding:4px 8px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600;">${formatPeso((parseFloat(s.displayAmount) + parseFloat(s.penalty)).toFixed(2))}</td>
      </tr>`).join("");

    const unpaidOutstanding = scheduleRows.filter((s) => s.status !== "PAID");
    const totalOutstanding = unpaidOutstanding.reduce(
      (sum, s) => sum.plus(new Decimal(s.displayAmount)),
      new Decimal(0),
    );
    const outstandingRowsHtml = unpaidOutstanding.map((s) => `
      <tr>
        <td style="padding:2px 8px;font-size:12px;color:#475569;">#${s.period}</td>
        <td style="padding:2px 8px;font-size:12px;text-align:right;font-weight:500;">${formatPeso(s.displayAmount)}</td>
      </tr>`).join("");
    const outstandingHtml = `
      <h3 style="color:#475569;margin-top:24px;">Total Outstanding Per Period</h3>
      <table style="width:100%;border-collapse:collapse;margin:4px 0 8px;font-size:13px;">
        <tbody>
          ${outstandingRowsHtml}
        </tbody>
        <tfoot>
          <tr style="border-top:2px solid #cbd5e1;font-weight:700;">
            <td style="padding:4px 8px;text-align:right;color:#0f172a;">Total Outstanding:</td>
            <td style="padding:4px 8px;text-align:right;color:#991b1b;">${formatPeso(totalOutstanding.toFixed(2))}</td>
          </tr>
        </tfoot>
      </table>`;

    const dueNowHtml = dueNow.length > 0 ? `
      <h3 style="color:#991b1b;margin-top:24px;">⚠️ Total Amount Due: ${formatPeso(totalDue.toFixed(2))} (${dueNow.length} period${dueNow.length > 1 ? "s" : ""})</h3>
      <table style="width:100%;border-collapse:collapse;margin:8px 0 24px;font-size:13px;">
        <thead>
          <tr style="background:#fef2f2;">
            <th style="padding:6px 8px;text-align:left;font-weight:600;color:#991b1b;">#</th>
            <th style="padding:6px 8px;text-align:left;font-weight:600;color:#991b1b;">Due Date</th>
            <th style="padding:6px 8px;text-align:right;font-weight:600;color:#991b1b;">Days</th>
            <th style="padding:6px 8px;text-align:right;font-weight:600;color:#991b1b;">Amount</th>
            <th style="padding:6px 8px;text-align:right;font-weight:600;color:#991b1b;">Penalty</th>
            <th style="padding:6px 8px;text-align:right;font-weight:600;color:#991b1b;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${dueNow.map((s) => `
            <tr>
              <td style="padding:4px 8px;border-bottom:1px solid #fecaca;">#${s.period}</td>
              <td style="padding:4px 8px;border-bottom:1px solid #fecaca;">${s.dueDate}</td>
              <td style="padding:4px 8px;border-bottom:1px solid #fecaca;text-align:right;">${s.daysOverdue != null && s.daysOverdue > 0 ? s.daysOverdue + "d" : "—"}</td>
              <td style="padding:4px 8px;border-bottom:1px solid #fecaca;text-align:right;">${formatPeso(s.displayAmount)}</td>
              <td style="padding:4px 8px;border-bottom:1px solid #fecaca;text-align:right;color:#b91c1c;">${s.penalty !== "0.00" ? formatPeso(s.penalty) : "—"}</td>
              <td style="padding:4px 8px;border-bottom:1px solid #fecaca;text-align:right;font-weight:600;">${formatPeso((parseFloat(s.displayAmount) + parseFloat(s.penalty)).toFixed(2))}</td>
            </tr>`).join("")}
        </tbody>
        <tfoot>
          <tr style="font-weight:700;color:#991b1b;">
            <td colspan="5" style="padding:6px 8px;text-align:right;">Total Due:</td>
            <td style="padding:6px 8px;text-align:right;">${formatPeso(totalDue.toFixed(2))}${totalDuePenalty.gt(0) ? ` <span style="color:#b91c1c;font-weight:400;font-size:12px;">(incl. ${formatPeso(totalDuePenalty.toFixed(2))} penalty)</span>` : ""}</td>
          </tr>
          <tr>
            <td colspan="5" style="padding:4px 8px;text-align:right;color:#64748b;font-size:12px;">Contract Remaining Balance:</td>
            <td style="padding:4px 8px;text-align:right;font-weight:600;color:#0f172a;">${formatPeso(account.remainingBalance.toString())}</td>
          </tr>
        </tfoot>
      </table>` : "";

    const penaltyRowsHtml = account.penalties.length > 0 ? `
      <h3 style="color:#64748b;margin-top:24px;">Penalty Records</h3>
      <table style="width:100%;border-collapse:collapse;margin:8px 0;font-size:13px;">
        <thead>
          <tr style="background:#f1f5f9;">
            <th style="padding:6px 8px;text-align:left;font-weight:600;color:#475569;">Date</th>
            <th style="padding:6px 8px;text-align:right;font-weight:600;color:#475569;">Amount</th>
            <th style="padding:6px 8px;text-align:left;font-weight:600;color:#475569;">Reason</th>
          </tr>
        </thead>
        <tbody>
          ${account.penalties.map((p) => `
            <tr>
              <td style="padding:4px 8px;border-bottom:1px solid #e2e8f0;">${new Date(p.appliedDate).toLocaleDateString()}</td>
              <td style="padding:4px 8px;border-bottom:1px solid #e2e8f0;text-align:right;color:#b91c1c;">${formatPeso(p.amount.toString())}</td>
              <td style="padding:4px 8px;border-bottom:1px solid #e2e8f0;">${p.reason || "—"}</td>
            </tr>`).join("")}
        </tbody>
      </table>` : "";

    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;background:#fff;padding:24px;">
        <div style="text-align:center;border-bottom:2px solid #991b1b;padding-bottom:16px;margin-bottom:24px;">
          <h1 style="font-size:22px;font-weight:700;color:#0f172a;margin:0;">MyFaveGadgets</h1>
          <p style="font-size:13px;color:#64748b;margin:4px 0 0;">Binan City, Laguna &bull; Gadget Installment</p>
          <p style="font-size:15px;font-weight:600;color:#991b1b;margin:8px 0 0;">Account Statement</p>
        </div>

        <p style="color:#64748b;font-size:13px;">Dear <strong>${account.customerName}</strong>,</p>
        <p style="color:#475569;font-size:13px;">Here is your account statement for <strong>${account.brand} ${account.model}</strong>.</p>

        <h3 style="color:#475569;margin-top:20px;">Contract Summary</h3>
        <table style="width:100%;border-collapse:collapse;margin:8px 0;font-size:13px;">
          <tr><td style="padding:4px 8px;color:#64748b;">Installment Price</td><td style="padding:4px 8px;font-weight:500;">${formatPeso(account.installmentPrice.toString())}</td></tr>
          <tr><td style="padding:4px 8px;color:#64748b;">Down Payment</td><td style="padding:4px 8px;font-weight:500;">${formatPeso(account.downPayment.toString())}</td></tr>
          <tr><td style="padding:4px 8px;color:#64748b;">Term</td><td style="padding:4px 8px;font-weight:500;">${account.scheduleType === "SEMI_MONTHLY" ? `${account.term} months (${account.term * 2} periods)` : `${account.term} months`}</td></tr>
          <tr><td style="padding:4px 8px;color:#64748b;">${account.scheduleType === "SEMI_MONTHLY" ? "Per Period" : "Monthly Installment"}</td><td style="padding:4px 8px;font-weight:500;">${formatPeso(account.monthlyInstallment.toString())}${account.scheduleType === "SEMI_MONTHLY" ? "/period" : "/mo"}</td></tr>
          <tr><td style="padding:4px 8px;color:#64748b;">Remaining Balance</td><td style="padding:4px 8px;font-weight:700;color:#991b1b;">${formatPeso(account.remainingBalance.toString())}</td></tr>
          <tr><td style="padding:4px 8px;color:#64748b;">Total Paid</td><td style="padding:4px 8px;font-weight:500;color:#16a34a;">${formatPeso(totalPayments.toFixed(2))}</td></tr>
          <tr><td style="padding:4px 8px;color:#64748b;">Total Penalties</td><td style="padding:4px 8px;font-weight:500;color:#b91c1c;">${formatPeso(totalPenalties.toFixed(2))}</td></tr>
        </table>

        <h3 style="color:#475569;margin-top:24px;">Payment History</h3>
        ${account.payments.length > 0 ? `
        <table style="width:100%;border-collapse:collapse;margin:8px 0;font-size:13px;">
          <thead>
            <tr style="background:#f1f5f9;">
              <th style="padding:6px 8px;text-align:left;font-weight:600;color:#475569;">Date</th>
              <th style="padding:6px 8px;text-align:right;font-weight:600;color:#475569;">Amount</th>
              <th style="padding:6px 8px;text-align:left;font-weight:600;color:#475569;">Type</th>
              <th style="padding:6px 8px;text-align:right;font-weight:600;color:#475569;">Penalty</th>
            </tr>
          </thead>
          <tbody>
            ${paymentRowsHtml}
          </tbody>
        </table>` : "<p style='color:#94a3b8;font-size:13px;'>No payments yet.</p>"}

        <h3 style="color:#475569;margin-top:24px;">Installment Schedule</h3>
        <table style="width:100%;border-collapse:collapse;margin:8px 0;font-size:13px;">
          <thead>
            <tr style="background:#f1f5f9;">
              <th style="padding:6px 8px;text-align:left;font-weight:600;color:#475569;">Period</th>
              <th style="padding:6px 8px;text-align:left;font-weight:600;color:#475569;">Due</th>
              <th style="padding:6px 8px;text-align:right;font-weight:600;color:#475569;">Days</th>
              <th style="padding:6px 8px;text-align:right;font-weight:600;color:#475569;">Amount</th>
              <th style="padding:6px 8px;text-align:right;font-weight:600;color:#475569;">Penalty</th>
              <th style="padding:6px 8px;text-align:right;font-weight:600;color:#475569;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${scheduleRowsHtml}
          </tbody>
        </table>

        ${outstandingHtml}
        ${dueNowHtml}
        ${penaltyRowsHtml}

        <p style="margin-top:32px;color:#64748b;font-size:12px;text-align:center;border-top:1px solid #e2e8f0;padding-top:16px;">
          MyFaveGadgets — Binan City, Laguna &bull; Gadget Installment Monitoring
        </p>
      </div>`;

    const sent = await sendEmail({
      to: account.customerEmail,
      subject: `Account Statement — ${account.brand} ${account.model}`,
      html,
    });

    return NextResponse.json({
      sent,
      customerEmail: account.customerEmail,
      message: sent ? "Statement sent successfully" : "Failed to send statement",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
