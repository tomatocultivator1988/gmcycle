import nodemailer from "nodemailer";
import { formatPeso } from "@/lib/money";

function getTransporter() {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (!user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
}

interface ReceiptEmailData {
  customerEmail: string;
  customerName: string;
  paymentId: string;
  paymentDate: string;
  paymentType: string;
  method: string;
  totalAmount: string;
  penaltyAmount: string;
  remainingBalance: string;
  totalPaid: string;
  brand: string;
  model: string;
  unitDescription: string;
  monthlyInstallment: string;
  notes: string | null;
  cashier: string | null;
}

function buildReceiptHtml(data: ReceiptEmailData): string {
  const receiptNo = data.paymentId.slice(0, 8).toUpperCase();
  const hasPenalty = parseFloat(data.penaltyAmount) > 0;

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; padding: 24px; margin: 0;">
  <div style="max-width: 420px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 32px; border: 1px solid #e2e8f0;">
    <div style="text-align: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 20px;">
      <h1 style="font-size: 20px; font-weight: 700; color: #0f172a; margin: 0;">MyFaveGadgets</h1>
      <p style="font-size: 12px; color: #64748b; margin: 4px 0 12px;">Binan City, Laguna • Gadget Installment</p>
      <p style="font-size: 15px; font-weight: 600; color: #0f172a; margin: 0;">Payment Receipt</p>
    </div>

    <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
      <tr>
        <td style="color: #64748b; padding: 4px 0;">Receipt No.</td>
        <td style="font-weight: 500; color: #0f172a; text-align: right;">${receiptNo}</td>
      </tr>
      <tr>
        <td style="color: #64748b; padding: 4px 0;">Date</td>
        <td style="font-weight: 500; color: #0f172a; text-align: right;">${data.paymentDate}</td>
      </tr>
      <tr>
        <td style="color: #64748b; padding: 4px 0;">Payment Type</td>
        <td style="font-weight: 500; color: #0f172a; text-align: right;">${data.paymentType}</td>
      </tr>
      <tr>
        <td style="color: #64748b; padding: 4px 0;">Method</td>
        <td style="font-weight: 500; color: #0f172a; text-align: right;">${data.method}</td>
      </tr>
    </table>

    <div style="margin-top: 20px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
      <p style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: #64748b; margin: 0 0 8px;">Customer</p>
      <p style="font-weight: 500; color: #0f172a; margin: 0 0 4px;">${data.customerName}</p>
    </div>

    <div style="margin-top: 16px;">
      <p style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: #64748b; margin: 0 0 8px;">Device</p>
      <p style="font-size: 14px; color: #0f172a; margin: 0;">${data.brand} ${data.model}</p>
      <p style="font-size: 12px; color: #64748b; margin: 4px 0 0;">${data.unitDescription}</p>
      <p style="font-size: 12px; color: #64748b; margin: 4px 0 0;">Monthly: ${formatPeso(data.monthlyInstallment)}</p>
    </div>

    <div style="margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
      <table style="width: 100%;">
        <tr>
          <td style="color: #64748b; font-size: 14px;">Amount Paid</td>
          <td style="font-size: 18px; font-weight: 700; color: #0f172a; text-align: right;">${formatPeso(data.totalAmount)}</td>
        </tr>
        ${hasPenalty ? `
        <tr>
          <td style="color: #be123c; font-size: 14px; padding-top: 8px;">Late Penalty</td>
          <td style="font-weight: 500; color: #be123c; text-align: right; padding-top: 8px;">${formatPeso(data.penaltyAmount)}</td>
        </tr>` : ""}
      </table>
    </div>

    <div style="margin-top: 16px; border-top: 1px solid #e2e8f0; padding-top: 12px;">
      <table style="width: 100%; font-size: 13px;">
        <tr>
          <td style="color: #64748b; padding: 3px 0;">Total Paid</td>
          <td style="font-weight: 500; color: #0f172a; text-align: right;">${formatPeso(data.totalPaid)}</td>
        </tr>
        <tr>
          <td style="color: #64748b; padding: 3px 0;">Remaining Balance</td>
          <td style="font-weight: 600; color: #0f172a; text-align: right;">${formatPeso(data.remainingBalance)}</td>
        </tr>
      </table>
    </div>

    ${data.notes ? `
    <div style="margin-top: 16px; border-top: 1px solid #e2e8f0; padding-top: 12px;">
      <p style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: #64748b; margin: 0 0 6px;">Notes</p>
      <p style="font-size: 12px; color: #475569; margin: 0;">${data.notes}</p>
    </div>` : ""}

    <div style="margin-top: 28px; border-top: 1px solid #e2e8f0; padding-top: 16px; text-align: center;">
      <p style="font-size: 12px; color: #94a3b8; margin: 0;">Thank you for your payment!</p>
      ${data.cashier ? `<p style="font-size: 12px; color: #94a3b8; margin: 4px 0 0;">Cashier: ${data.cashier}</p>` : ""}
    </div>
  </div>
</body>
</html>`;
}

interface DpReceiptData {
  id: string;
  customerEmail: string | null;
  customerName: string;
  customerAddress: string;
  customerPhone: string;
  brand: string;
  model: string;
  unitDescription: string;
  downPayment: string;
  processingFee: string;
  dateGiven: string | null;
  startDate: string;
  term: number;
  monthlyInstallment: string;
}

function buildDpReceiptHtml(data: DpReceiptData): string {
  const receiptNo = data.id.slice(0, 8).toUpperCase();
  const total = (parseFloat(data.downPayment) + parseFloat(data.processingFee)).toFixed(2);

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; padding: 24px; margin: 0;">
  <div style="max-width: 420px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 32px; border: 1px solid #e2e8f0;">
    <div style="text-align: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 20px;">
      <h1 style="font-size: 20px; font-weight: 700; color: #0f172a; margin: 0;">MyFaveGadgets</h1>
      <p style="font-size: 12px; color: #64748b; margin: 4px 0 12px;">Binan City, Laguna &bull; Gadget Installment</p>
      <p style="font-size: 15px; font-weight: 600; color: #0f172a; margin: 0;">Down Payment Receipt</p>
    </div>

    <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
      <tr>
        <td style="color: #64748b; padding: 4px 0;">Receipt No.</td>
        <td style="font-weight: 500; color: #0f172a; text-align: right;">DP-${receiptNo}</td>
      </tr>
      <tr>
        <td style="color: #64748b; padding: 4px 0;">Date Given</td>
        <td style="font-weight: 500; color: #0f172a; text-align: right;">${data.dateGiven ?? data.startDate}</td>
      </tr>
    </table>

    <div style="margin-top: 20px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
      <p style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: #64748b; margin: 0 0 8px;">Customer</p>
      <p style="font-weight: 500; color: #0f172a; margin: 0 0 4px;">${data.customerName}</p>
      <p style="font-size: 12px; color: #64748b; margin: 0;">${data.customerAddress}</p>
      <p style="font-size: 12px; color: #64748b; margin: 2px 0 0;">${data.customerPhone}</p>
      <p style="font-size: 12px; color: #94a3b8; margin: 2px 0 0;">${data.customerEmail}</p>
    </div>

    <div style="margin-top: 16px;">
      <p style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: #64748b; margin: 0 0 8px;">Device</p>
      <p style="font-size: 14px; color: #0f172a; margin: 0;">${data.brand} ${data.model}</p>
      <p style="font-size: 12px; color: #64748b; margin: 4px 0 0;">${data.unitDescription}</p>
      <p style="font-size: 12px; color: #64748b; margin: 4px 0 0;">Term: ${data.term} months &bull; ${formatPeso(data.monthlyInstallment)}/mo</p>
    </div>

    <div style="margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
      <table style="width: 100%;">
        <tr>
          <td style="color: #64748b; font-size: 14px; padding: 4px 0;">Down Payment</td>
          <td style="font-weight: 500; color: #0f172a; text-align: right;">${formatPeso(data.downPayment)}</td>
        </tr>
        <tr>
          <td style="color: #64748b; font-size: 14px; padding: 4px 0;">Processing Fee</td>
          <td style="font-weight: 500; color: #0f172a; text-align: right;">${formatPeso(data.processingFee)}</td>
        </tr>
        <tr>
          <td style="border-top: 1px solid #e2e8f0; padding-top: 12px; font-weight: 600; color: #475569;">Total Paid</td>
          <td style="border-top: 1px solid #e2e8f0; padding-top: 12px; font-size: 18px; font-weight: 700; color: #0f172a; text-align: right;">${formatPeso(total)}</td>
        </tr>
      </table>
    </div>

    <div style="margin-top: 28px; border-top: 1px solid #e2e8f0; padding-top: 16px; text-align: center;">
      <p style="font-size: 12px; color: #94a3b8; margin: 0;">Thank you for your purchase!</p>
      <p style="font-size: 12px; color: #94a3b8; margin: 4px 0 0;">MyFaveGadgets &mdash; Binan City, Laguna</p>
    </div>
  </div>
</body>
</html>`;
}

export async function sendDpReceipt(data: DpReceiptData): Promise<boolean> {
  try {
    const transporter = getTransporter();
    if (!transporter) {
      console.warn("EMAIL_USER / EMAIL_PASS not configured — skipping DP receipt email");
      return false;
    }
    if (!data.customerEmail) {
      console.warn("No customer email — skipping DP receipt");
      return false;
    }

    const receiptNo = data.id.slice(0, 8).toUpperCase();
    const info = await transporter.sendMail({
      from: `MyFaveGadgets <${process.env.EMAIL_USER}>`,
      to: data.customerEmail,
      subject: `Down Payment Receipt — DP-${receiptNo}`,
      html: buildDpReceiptHtml(data),
    });

    console.log(`DP receipt email sent: ${info.messageId}`);
    return true;
  } catch (err) {
    console.error("Failed to send DP receipt:", err);
    return false;
  }
}

export async function sendPaymentReceipt(data: ReceiptEmailData): Promise<boolean> {
  try {
    const transporter = getTransporter();

    if (!transporter) {
      console.warn("EMAIL_USER / EMAIL_PASS not configured — skipping email");
      return false;
    }

    const receiptNo = data.paymentId.slice(0, 8).toUpperCase();

    const info = await transporter.sendMail({
      from: `MyFaveGadgets <${process.env.EMAIL_USER}>`,
      to: data.customerEmail,
      subject: `Payment Receipt — ${receiptNo}`,
      html: buildReceiptHtml(data),
    });

    console.log(`Receipt email sent: ${info.messageId}`);
    return true;
  } catch (err) {
    console.error("Failed to send payment receipt:", err);
    return false;
  }
}

export async function sendEmail(options: {
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  try {
    const transporter = getTransporter();
    if (!transporter) return false;

    const info = await transporter.sendMail({
      from: `MyFaveGadgets <${process.env.EMAIL_USER}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });

    console.log(`Email sent: ${info.messageId}`);
    return true;
  } catch (err) {
    console.error("Failed to send email:", err);
    return false;
  }
}
