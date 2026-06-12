"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import Link from "next/link";
import { apiRequest } from "@/lib/client-api";
import { formatPeso } from "@/lib/money";
import type { InstallmentAccountDto } from "@/types/api";
import { ErrorMessage, LoadingBlock } from "@/components/ui-state";

export default function DownPaymentReceiptPage() {
  const { id } = useParams<{ id: string }>();
  const [account, setAccount] = useState<InstallmentAccountDto | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    apiRequest<{ installmentAccount: InstallmentAccountDto }>(
      `/api/installment-accounts/${id}`,
    )
      .then((res) => {
        if (active) setAccount(res.installmentAccount);
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
  if (!account) return <ErrorMessage message={error || "Account not found"} />;

  const total = (parseFloat(account.downPayment) + parseFloat(account.processingFee)).toFixed(2);

  return (
    <div className="space-y-4">
      <div className="no-print flex items-center justify-between">
        <Link
          href={`/installment-accounts/${account.id}`}
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
          <p className="text-xs text-slate-500">Binan City, Laguna &bull; Gadget Installment</p>
          <p className="mt-1 text-base font-semibold text-slate-950">Down Payment Receipt</p>
        </div>

        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Receipt No.</span>
            <span className="font-medium text-slate-950">DP-{account.id.slice(0, 8).toUpperCase()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Date Given</span>
            <span className="font-medium text-slate-950">{account.dateGiven ?? account.startDate}</span>
          </div>
        </div>

        <div className="mt-4 border-t border-slate-200 pt-4">
          <h2 className="text-xs font-semibold uppercase text-slate-500 mb-2">Customer</h2>
          <p className="font-medium text-slate-950">{account.customerName}</p>
          <p className="text-xs text-slate-500">{account.customerAddress}</p>
          <p className="text-xs text-slate-500">{account.customerPhone}</p>
          {account.customerEmail ? (
            <p className="text-xs text-slate-400">{account.customerEmail}</p>
          ) : null}
        </div>

        <div className="mt-3">
          <h2 className="text-xs font-semibold uppercase text-slate-500 mb-2">Device</h2>
          <p className="text-sm text-slate-950">
            {account.brand} {account.model}
          </p>
          <p className="text-xs text-slate-500">{account.unitDescription}</p>
          <p className="text-xs text-slate-500 mt-1">Term: {account.term} months &bull; {formatPeso(account.monthlyInstallment)}/mo</p>
        </div>

        <div className="mt-4 border-t border-slate-200 pt-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Down Payment</span>
            <span className="font-medium text-slate-950">{formatPeso(account.downPayment)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Processing Fee</span>
            <span className="font-medium text-slate-950">{formatPeso(account.processingFee)}</span>
          </div>
          <div className="flex justify-between text-sm border-t border-slate-200 pt-2 mt-2">
            <span className="text-slate-700 font-semibold">Total Paid</span>
            <span className="text-base font-bold text-slate-950">{formatPeso(total)}</span>
          </div>
        </div>

        <div className="mt-4 border-t border-slate-200 pt-3">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Remaining Balance</span>
            <span className="font-semibold text-slate-950">{formatPeso(account.remainingBalance)}</span>
          </div>
        </div>

        <div className="mt-6 border-t border-slate-200 pt-4 text-center text-xs text-slate-400">
          <p>Thank you for your purchase!</p>
          <p className="mt-0.5">MyFaveGadgets &mdash; Binan City, Laguna</p>
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
