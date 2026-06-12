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
  itemType: string;
  cashPrice: string;
  installmentPrice: string;
  downPayment: string;
  remainingBalance: string;
  grossProfit: string;
  interestRate: string | null;
  term: number;
  monthlyInstallment: string;
  status: string;
  startDate: string;
  dateGiven: string | null;
  firstDueDate: string | null;
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

  const generatedDate = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(data.generatedAt));

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 print:px-0 print:py-0">
      {/* Print / Back buttons — hidden when printing */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link
          href={`/installment-accounts/${id}`}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-[0.98]"
        >
          <ArrowLeft size={16} />
          Back to Account
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href={`/installment-accounts/${id}/down-payment-receipt`}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-[0.98]"
          >
            <Printer size={16} />
            DP Receipt
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
            <div><span className="text-slate-500">Net Price:</span> <span className="font-semibold text-red-800">{formatPeso((parseFloat(data.installmentPrice) - parseFloat(data.downPayment)).toFixed(2))}</span></div>
            <div><span className="text-slate-500">Down Payment:</span> <span className="text-slate-700">{formatPeso(data.downPayment)}</span></div>
            <div><span className="text-slate-500">Term:</span> <span className="text-slate-700">{data.term} months</span></div>
            <div><span className="text-slate-500">Monthly:</span> <span className="text-slate-700">{formatPeso(data.monthlyInstallment)}</span></div>
            <div><span className="text-slate-500">First Due:</span> <span className="text-slate-700">{data.firstDueDate ?? "—"}</span></div>
            <div><span className="text-slate-500">Date Given:</span> <span className="text-slate-700">{data.dateGiven ?? "—"}</span></div>
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
        <div className="border-t border-slate-100 px-4 sm:px-8 py-5 print:border-slate-200 print:px-8">
          <h2 className="text-xs font-semibold font-heading uppercase tracking-wider text-slate-500 mb-3">Payment History ({data.payments.length})</h2>
          {data.payments.length > 0 ? (
            <>
              {/* Mobile: Cards */}
              <div className="block sm:hidden space-y-2">
                {data.payments.map((p, i) => (
                  <div key={i} className="rounded-lg border border-slate-200 bg-white p-3 text-xs space-y-1.5">
                    <div className="flex justify-between"><span className="text-slate-500">Date</span><span className="font-medium">{p.date}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Amount</span><span className="font-semibold">{formatPeso(p.amount)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Type</span><span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] font-medium">{p.type}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Method</span><span>{p.method}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Penalty</span><span>{p.penalty !== "0.00" ? <span className="text-rose-600">{formatPeso(p.penalty)}</span> : "—"}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Cashier</span><span>{p.cashier || "—"}</span></div>
                  </div>
                ))}
              </div>
              {/* Desktop: Table */}
              <div className="hidden sm:block">
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
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-400">No payments recorded.</p>
          )}
        </div>

        {/* Schedule Table */}
        <div className="border-t border-slate-100 px-4 sm:px-8 py-5 print:border-slate-200 print:px-8">
          <h2 className="text-xs font-semibold font-heading uppercase tracking-wider text-slate-500 mb-3">Installment Schedule ({data.schedule.length} periods)</h2>
          {/* Mobile: Cards */}
          <div className="block sm:hidden space-y-1.5">
            {data.schedule.map((s) => (
              <div key={s.period} className={`rounded-lg border p-2.5 text-xs space-y-1 ${s.status === "PAID" ? "border-emerald-200 bg-emerald-50/50" : s.status === "OVERDUE" ? "border-rose-200 bg-rose-50/50" : s.status === "PARTIAL" ? "border-amber-200 bg-amber-50/50" : "border-slate-200"}`}>
                <div className="flex justify-between"><span className="text-slate-500">#{s.period} · {s.dueDate}</span><span className={`rounded border px-1 py-px text-[10px] font-medium ${s.status === "PAID" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : s.status === "OVERDUE" ? "border-rose-200 bg-rose-50 text-rose-700" : s.status === "PARTIAL" ? "border-amber-200 bg-amber-50 text-amber-700" : "border-slate-200 bg-white text-slate-600"}`}>{s.status}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Amount Due</span><span className="font-semibold">{formatPeso((parseFloat(s.amount) + parseFloat(s.penalty || "0")).toFixed(2))}</span></div>
                {s.paidAmount ? <div className="flex justify-between"><span className="text-slate-500">Paid</span><span>{formatPeso(s.paidAmount)}</span></div> : null}
                {s.penalty !== "0.00" ? <div className="flex justify-between"><span className="text-slate-500">Penalty</span><span className="text-rose-600">{formatPeso(s.penalty)}</span></div> : null}
              </div>
            ))}
          </div>
          {/* Desktop: Table */}
          <div className="hidden sm:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                  <th className="py-2 pr-3 font-medium">#</th>
                  <th className="py-2 pr-3 font-medium">Due Date</th>
                  <th className="py-2 pr-3 font-medium text-right">Amount Due</th>
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
                    <td className="py-1.5 pr-3 text-right font-semibold">{formatPeso((parseFloat(s.amount) + parseFloat(s.penalty || "0")).toFixed(2))}</td>
                    <td className="py-1.5 pr-3"><span className={`rounded border px-1.5 py-0.5 text-[11px] font-medium ${s.status === "PAID" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : s.status === "OVERDUE" ? "border-rose-200 bg-rose-50 text-rose-700" : s.status === "PARTIAL" ? "border-amber-200 bg-amber-50 text-amber-700" : "border-slate-200 bg-white text-slate-600"}`}>{s.status}</span></td>
                    <td className="py-1.5 pr-3">{s.paidDate || "—"}</td>
                    <td className="py-1.5 pr-3 text-right">{s.paidAmount ? formatPeso(s.paidAmount) : "—"}</td>
                    <td className="py-1.5 pr-3 text-right">{s.penalty !== "0.00" ? formatPeso(s.penalty) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Penalty Records */}
        {data.penalties.length > 0 ? (
            <div className="border-t border-slate-100 px-4 sm:px-8 py-5 print:border-slate-200 print:px-8">
              <h2 className="text-xs font-semibold font-heading uppercase tracking-wider text-slate-500 mb-3">Penalty Records ({data.penalties.length})</h2>
              {/* Mobile: Cards */}
              <div className="block sm:hidden space-y-2">
                {data.penalties.map((p, i) => (
                  <div key={i} className="rounded-lg border border-rose-100 bg-rose-50/50 p-3 text-xs space-y-1.5">
                    <div className="flex justify-between"><span className="text-slate-500">{new Date(p.appliedDate).toLocaleDateString()}</span><span className="font-semibold text-rose-600">{formatPeso(p.amount)}</span></div>
                    {p.reason ? <div className="text-slate-600">{p.reason}</div> : null}
                  </div>
                ))}
              </div>
              {/* Desktop: Table */}
              <div className="hidden sm:block">
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
            </div>
        ) : null}

        {/* Total Amount Due (due on/before today) */}
        {(() => {
          const today = new Date().toISOString().slice(0, 10);
          const dueNow = (data.schedule || []).filter(
            (s: any) => (s.status === "PENDING" || s.status === "PARTIAL" || s.status === "OVERDUE") && s.dueDate <= today
          );
          if (dueNow.length === 0) return null;
          const totalDue = dueNow.reduce((sum: number, s: any) => sum + parseFloat(s.amount) + parseFloat(s.penalty || "0"), 0);
          return (
            <div className="border-t-2 border-red-200 px-4 sm:px-8 py-5 print:border-red-300 print:px-8 bg-red-50/30">
              <h2 className="text-xs font-semibold font-heading uppercase tracking-wider text-red-700 mb-3">Total Amount Due ({dueNow.length} period{dueNow.length > 1 ? "s" : ""} due on or before today)</h2>
              <div className="hidden sm:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-red-100 text-left text-xs text-slate-500">
                      <th className="py-2 pr-3 font-medium">#</th>
                      <th className="py-2 pr-3 font-medium">Due Date</th>
                      <th className="py-2 pr-3 font-medium text-right">Amount</th>
                      <th className="py-2 pr-3 font-medium text-right">Penalty</th>
                      <th className="py-2 pr-3 font-medium text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dueNow.map((s: any) => (
                      <tr key={s.period} className="border-b border-red-100 text-slate-700">
                        <td className="py-1.5 pr-3">{s.period}</td>
                        <td className="py-1.5 pr-3">{s.dueDate}</td>
                        <td className="py-1.5 pr-3 text-right">{formatPeso(s.amount)}</td>
                        <td className="py-1.5 pr-3 text-right text-rose-600">{s.penalty !== "0.00" ? formatPeso(s.penalty) : "—"}</td>
                        <td className="py-1.5 pr-3 text-right font-semibold text-red-800">{formatPeso((parseFloat(s.amount) + parseFloat(s.penalty || "0")).toFixed(2))}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-bold text-red-800">
                      <td colSpan={4} className="pt-2 pr-3 text-right">Total Amount Due:</td>
                      <td className="pt-2 pr-3 text-right">{formatPeso(totalDue.toFixed(2))}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <div className="block sm:hidden space-y-2">
                {dueNow.map((s: any) => (
                  <div key={s.period} className="rounded-lg border border-red-100 bg-white p-3 text-xs space-y-1.5">
                    <div className="flex justify-between"><span className="text-slate-500">#{s.period} · {s.dueDate}</span><span className="font-semibold text-red-800">{formatPeso((parseFloat(s.amount) + parseFloat(s.penalty || "0")).toFixed(2))}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Amount</span><span>{formatPeso(s.amount)}</span></div>
                    {s.penalty !== "0.00" ? <div className="flex justify-between"><span className="text-slate-500">Penalty</span><span className="text-rose-600">{formatPeso(s.penalty)}</span></div> : null}
                  </div>
                ))}
                <div className="text-center text-sm font-bold text-red-800 pt-1">Total: {formatPeso(totalDue.toFixed(2))}</div>
              </div>
            </div>
          );
        })()}

        {/* Footer */}
        <div className="border-t border-slate-200 px-8 py-4 text-center text-[11px] text-slate-400 print:border-slate-300">
          MyFaveGadgets — Gadget Installment Monitoring System — {generatedDate}
        </div>
      </div>
    </div>
  );
}
