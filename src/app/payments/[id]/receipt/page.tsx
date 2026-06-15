"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import Link from "next/link";
import { apiRequest } from "@/lib/client-api";
import { formatPeso } from "@/lib/money";
import type { PaymentDto } from "@/types/api";
import { ErrorMessage, LoadingBlock } from "@/components/ui-state";

type ReceiptData = PaymentDto & {
  account: {
    customerName: string;
    customerPhone: string;
    customerAddress: string;
    brand: string;
    model: string;
    unitDescription: string;
    monthlyInstallment: string;
    remainingBalance: string;
    scheduleType: string;
    totalPaid: string;
    paidCount: number;
    totalPeriods: number;
  };
};

export default function ReceiptPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<ReceiptData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    apiRequest<{ payment: ReceiptData }>(`/api/payments/${id}`)
      .then((res) => {
        if (active) setData(res.payment);
      })
      .catch((requestError: Error) => {
        if (active) setError(requestError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [id]);

  if (loading) return <LoadingBlock label="Loading receipt" />;
  if (!data) return <ErrorMessage message={error || "Receipt not found"} />;

  return (
    <div className="space-y-4">
      <div className="no-print flex items-center justify-between">
        <Link
          href={`/installment-accounts/${data.installmentAccountId}`}
          className="inline-flex h-10 items-center gap-2 text-sm text-slate-600 hover:text-slate-950"
        >
          <ArrowLeft size={16} />
          Back
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex h-10 items-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-medium text-white hover:bg-slate-800"
        >
          <Printer size={16} />
          Print
        </button>
      </div>

      <div className="mx-auto max-w-md rounded-md border border-slate-200 bg-white p-6 shadow-sm print:border-none print:shadow-none">
        <div className="text-center border-b border-slate-200 pb-4 mb-4">
          <h1 className="text-lg font-bold text-slate-950">MyFaveGadgets</h1>
          <p className="text-xs text-slate-500">Binan City, Laguna • Gadget Installment</p>
          <p className="mt-1 text-base font-semibold text-slate-950">Payment Receipt</p>
        </div>

        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Receipt No.</span>
            <span className="font-medium text-slate-950">{data.id.slice(0, 8).toUpperCase()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Date</span>
            <span className="font-medium text-slate-950">{data.paymentDate}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Payment Type</span>
            <span className="font-medium text-slate-950">{data.paymentType}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Method</span>
            <span className="font-medium text-slate-950">{data.method}</span>
          </div>
        </div>

        <div className="mt-4 border-t border-slate-200 pt-4">
          <h2 className="text-xs font-semibold uppercase text-slate-500 mb-2">Customer</h2>
          <p className="font-medium text-slate-950">{data.account.customerName}</p>
          <p className="text-xs text-slate-500">{data.account.customerAddress}</p>
          <p className="text-xs text-slate-500">{data.account.customerPhone}</p>
        </div>

        <div className="mt-3">
          <h2 className="text-xs font-semibold uppercase text-slate-500 mb-2">Contact</h2>
          <p className="text-sm text-slate-950">
            {data.account.brand} {data.account.model}
          </p>
          <p className="text-xs text-slate-500">{data.account.unitDescription}</p>
          <p className="text-xs text-slate-500 mt-1">
            {data.account.scheduleType === "SEMI_MONTHLY" ? "Per Period" : "Monthly"}: {formatPeso(data.account.monthlyInstallment)}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Payment {data.account.paidCount} of {data.account.totalPeriods} period{data.account.totalPeriods !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="mt-4 border-t border-slate-200 pt-4">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Amount Paid</span>
            <span className="text-base font-bold text-slate-950">{formatPeso(data.totalAmount)}</span>
          </div>
          {data.penaltyAmount !== "0.00" ? (
            <div className="flex justify-between text-sm mt-2">
              <span className="text-rose-700">Late Penalty</span>
              <span className="font-medium text-rose-700">{formatPeso(data.penaltyAmount)}</span>
            </div>
          ) : null}
        </div>

        <div className="mt-3 border-t border-slate-200 pt-3">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Total Paid</span>
            <span className="font-semibold text-emerald-700">{formatPeso(data.account.totalPaid)}</span>
          </div>
          <div className="flex justify-between text-sm mt-2">
            <span className="text-slate-500">Remaining Balance</span>
            <span className="font-semibold text-slate-950">{formatPeso(data.account.remainingBalance)}</span>
          </div>
        </div>

        {data.notes ? (
          <div className="mt-4 border-t border-slate-200 pt-3">
            <h2 className="text-xs font-semibold uppercase text-slate-500 mb-1">Notes</h2>
            <p className="text-xs text-slate-600">{data.notes}</p>
          </div>
        ) : null}

        <div className="mt-6 border-t border-slate-200 pt-4 text-center text-xs text-slate-400">
          <p>Thank you for your payment!</p>
          {data.cashier ? <p className="mt-1">Cashier: {data.cashier}</p> : null}
        </div>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
        }
      `}</style>
    </div>
  );
}
