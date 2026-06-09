"use client";

import { use, useEffect, useState } from "react";
import { Printer, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { apiRequest } from "@/lib/client-api";
import { formatPeso } from "@/lib/money";
import { ErrorMessage, LoadingBlock } from "@/components/ui-state";

type StatementData = {
  generatedAt: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  customerAddress: string;
  brand: string;
  model: string;
  unitDescription: string;
  cashPrice: string;
  installmentPrice: string;
  downPayment: string;
  remainingBalance: string;
  grossProfit: string;
  pricingType: string;
  interestRate: string | null;
  term: number;
  monthlyInstallment: string;
  status: string;
  startDate: string;
  nextDueDate: string;
  totalPayments: string;
  totalPenalties: string;
  payments: {
    date: string;
    amount: string;
    type: string;
    method: string;
    penalty: string;
    notes: string | null;
    cashier: string | null;
    proofUrl: string | null;
  }[];
  schedule: {
    period: number;
    dueDate: string;
    amount: string;
    status: string;
    paidDate: string | null;
    paidAmount: string | null;
    penalty: string;
  }[];
  penalties: {
    amount: string;
    appliedDate: string;
    reason: string | null;
  }[];
};

export default function StatementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<StatementData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiRequest<{ statement: StatementData }>(`/api/installment-accounts/${id}/statement`)
      .then((res) => setData(res.statement))
      .catch((e) => setError(e.message));
  }, [id]);

  if (error) return (
    <div className="p-8 print:p-0">
      <ErrorMessage message={error} />
      <Link href={`/installment-accounts/${id}`} className="text-sm text-red-700 underline mt-4 inline-block">Back to Account</Link>
    </div>
  );

  if (!data) return <LoadingBlock label="Generating statement..." />;

  const generatedDate = new Date(data.generatedAt).toLocaleDateString("en-PH", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 print:px-0 print:py-0">
      {/* Print / Back buttons — hidden when printing */}
      <div className="mb-6 flex items-center justify-between print:hidden">
        <Link
          href={`/installment-accounts/${id}`}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-[0.98]"
        >
          <ArrowLeft size={16} />
          Back to Account
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-red-800 px-4 text-sm font-medium text-white shadow-sm transition-all duration-150 hover:bg-red-700 hover:shadow-md active:scale-[0.98]"
        >
          <Printer size={16} />
          Print / Export PDF
        </button>
      </div>

      {/* ── STATEMENT CONTENT ── */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm print:border-none print:shadow-none print:rounded-none">
        {/* Header */}
        <div className="border-b border-slate-200 px-8 py-6 print:border-slate-300">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Account Statement</h1>
              <p className="mt-1 text-sm text-slate-500">MyFaveGadgets — Gadget Installment Monitoring</p>
            </div>
            <div className="text-right text-xs text-slate-500">
              <div>Generated: {generatedDate}</div>
              <div className="mt-0.5">Status: <span className="font-semibold text-slate-700">{data.status}</span></div>
            </div>
          </div>
        </div>

        {/* Customer & Device Info */}
        <div className="grid gap-6 px-8 py-5 sm:grid-cols-2">
          <div>
            <h2 className="text-xs font-semibold font-heading uppercase tracking-wider text-slate-500 mb-3">Customer</h2>
            <div className="space-y-1.5 text-sm">
              <div><span className="text-slate-500">Name:</span> <span className="font-medium text-slate-900">{data.customerName}</span></div>
              <div><span className="text-slate-500">Contact:</span> <span className="text-slate-700">{data.customerPhone}</span></div>
              {data.customerEmail ? <div><span className="text-slate-500">Email:</span> <span className="text-slate-700">{data.customerEmail}</span></div> : null}
              <div><span className="text-slate-500">Address:</span> <span className="text-slate-700">{data.customerAddress}</span></div>
            </div>
          </div>
          <div>
            <h2 className="text-xs font-semibold font-heading uppercase tracking-wider text-slate-500 mb-3">Device</h2>
            <div className="space-y-1.5 text-sm">
              <div><span className="text-slate-500">Brand:</span> <span className="font-medium text-slate-900">{data.brand}</span></div>
              <div><span className="text-slate-500">Model:</span> <span className="text-slate-700">{data.model}</span></div>
              <div><span className="text-slate-500">Description:</span> <span className="text-slate-700">{data.unitDescription}</span></div>
            </div>
          </div>
        </div>

        {/* Contract Summary */}
        <div className="border-t border-slate-100 px-8 py-5 print:border-slate-200">
          <h2 className="text-xs font-semibold font-heading uppercase tracking-wider text-slate-500 mb-3">Contract Details</h2>
          <div className="grid grid-cols-3 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
            <div><span className="text-slate-500">Cash Price:</span> <span className="font-medium text-slate-900">{formatPeso(data.cashPrice)}</span></div>
            <div><span className="text-slate-500">Installment Price:</span> <span className="font-medium text-slate-900">{formatPeso(data.installmentPrice)}</span></div>
            <div><span className="text-slate-500">Down Payment:</span> <span className="text-slate-700">{formatPeso(data.downPayment)}</span></div>
            <div><span className="text-slate-500">Profit:</span> <span className="font-medium text-emerald-700">{formatPeso(data.grossProfit)}</span></div>
            <div><span className="text-slate-500">Term:</span> <span className="text-slate-700">{data.term} months</span></div>
            <div><span className="text-slate-500">Monthly:</span> <span className="text-slate-700">{formatPeso(data.monthlyInstallment)}</span></div>
            <div><span className="text-slate-500">Pricing:</span> <span className="text-slate-700">{data.pricingType === "INTEREST_PERCENTAGE" ? `Interest ${data.interestRate}%` : "Flat Rate"}</span></div>
            <div><span className="text-slate-500">Start:</span> <span className="text-slate-700">{data.startDate}</span></div>
          </div>
        </div>

        {/* Payment Summary */}
        <div className="border-t border-slate-100 px-8 py-5 print:border-slate-200">
          <h2 className="text-xs font-semibold font-heading uppercase tracking-wider text-slate-500 mb-3">Payment Summary</h2>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
            <div><span className="text-slate-500">Total Paid:</span> <span className="font-semibold text-emerald-700">{formatPeso(data.totalPayments)}</span></div>
            <div><span className="text-slate-500">Penalties:</span> <span className="font-semibold text-rose-700">{formatPeso(data.totalPenalties)}</span></div>
            <div><span className="text-slate-500">Remaining:</span> <span className="font-semibold text-slate-900">{formatPeso(data.remainingBalance)}</span></div>
          </div>
        </div>

        {/* Payment History Table */}
        <div className="border-t border-slate-100 px-8 py-5 print:border-slate-200">
          <h2 className="text-xs font-semibold font-heading uppercase tracking-wider text-slate-500 mb-3">Payment History ({data.payments.length})</h2>
          {data.payments.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                  <th className="py-2 pr-3 font-medium">Date</th>
                  <th className="py-2 pr-3 font-medium text-right">Amount</th>
                  <th className="py-2 pr-3 font-medium">Type</th>
                  <th className="py-2 pr-3 font-medium">Method</th>
                  <th className="py-2 pr-3 font-medium text-right">Penalty</th>
                  <th className="py-2 pr-3 font-medium">Cashier</th>
                  <th className="py-2 pr-3 font-medium">Proof</th>
                </tr>
              </thead>
              <tbody>
                {data.payments.map((p, i) => (
                  <tr key={i} className="border-b border-slate-100 text-slate-700">
                    <td className="py-2 pr-3">{p.date}</td>
                    <td className="py-2 pr-3 text-right font-medium">{formatPeso(p.amount)}</td>
                    <td className="py-2 pr-3"><span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] font-medium">{p.type}</span></td>
                    <td className="py-2 pr-3">{p.method}</td>
                    <td className="py-2 pr-3 text-right">{p.penalty !== "0.00" ? <span className="text-rose-600">{formatPeso(p.penalty)}</span> : "—"}</td>
                    <td className="py-2 pr-3">{p.cashier || "—"}</td>
                    <td className="py-2 pr-3">{p.proofUrl ? <a href={p.proofUrl} target="_blank" rel="noopener noreferrer" className="text-red-600 underline text-xs">View</a> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-slate-400">No payments recorded.</p>
          )}
        </div>

        {/* Schedule Table */}
        <div className="border-t border-slate-100 px-8 py-5 print:border-slate-200">
          <h2 className="text-xs font-semibold font-heading uppercase tracking-wider text-slate-500 mb-3">Installment Schedule ({data.schedule.length} periods)</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="py-2 pr-3 font-medium">#</th>
                <th className="py-2 pr-3 font-medium">Due Date</th>
                <th className="py-2 pr-3 font-medium text-right">Amount</th>
                <th className="py-2 pr-3 font-medium">Status</th>
                <th className="py-2 pr-3 font-medium">Paid Date</th>
                <th className="py-2 pr-3 font-medium text-right">Paid</th>
                  <th className="py-2 pr-3 font-medium text-right">Penalty</th>
              </tr>
            </thead>
            <tbody>
              {data.schedule.map((s) => (
                <tr key={s.period} className={`border-b border-slate-100 text-slate-700 ${s.status === "PAID" ? "bg-emerald-50/50" : s.status === "OVERDUE" ? "bg-rose-50/50" : s.status === "PARTIAL" ? "bg-amber-50/50" : ""}`}>
                  <td className="py-1.5 pr-3 font-medium">{s.period}</td>
                  <td className="py-1.5 pr-3">{s.dueDate}</td>
                  <td className="py-1.5 pr-3 text-right">{formatPeso(s.amount)}</td>
                  <td className="py-1.5 pr-3"><span className={`rounded border px-1.5 py-0.5 text-[11px] font-medium ${s.status === "PAID" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : s.status === "OVERDUE" ? "border-rose-200 bg-rose-50 text-rose-700" : s.status === "PARTIAL" ? "border-amber-200 bg-amber-50 text-amber-700" : "border-slate-200 bg-white text-slate-600"}`}>{s.status}</span></td>
                  <td className="py-1.5 pr-3">{s.paidDate || "—"}</td>
                  <td className="py-1.5 pr-3 text-right">{s.paidAmount ? formatPeso(s.paidAmount) : "—"}</td>
                  <td className="py-1.5 pr-3 text-right">{s.penalty !== "0.00" ? formatPeso(s.penalty) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Penalty Records */}
        {data.penalties.length > 0 ? (
          <div className="border-t border-slate-100 px-8 py-5 print:border-slate-200">
            <h2 className="text-xs font-semibold font-heading uppercase tracking-wider text-slate-500 mb-3">Penalty Records ({data.penalties.length})</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                  <th className="py-2 pr-3 font-medium">Date</th>
                  <th className="py-2 pr-3 font-medium text-right">Amount</th>
                  <th className="py-2 pr-3 font-medium">Reason</th>
                </tr>
              </thead>
              <tbody>
                {data.penalties.map((p, i) => (
                  <tr key={i} className="border-b border-slate-100 text-slate-700">
                    <td className="py-1.5 pr-3">{new Date(p.appliedDate).toLocaleDateString()}</td>
                    <td className="py-1.5 pr-3 text-right font-medium text-rose-600">{formatPeso(p.amount)}</td>
                    <td className="py-1.5 pr-3 text-xs">{p.reason || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {/* Footer */}
        <div className="border-t border-slate-200 px-8 py-4 text-center text-[11px] text-slate-400 print:border-slate-300">
          MyFaveGadgets — Gadget Installment Monitoring System — {generatedDate}
        </div>
      </div>
    </div>
  );
}
