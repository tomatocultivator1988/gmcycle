"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, ReceiptText } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ErrorMessage, LoadingBlock } from "@/components/ui-state";
import { apiRequest } from "@/lib/client-api";
import { formatPeso } from "@/lib/money";

export default function PaymentsPage() {
  const [payments, setPayments] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    apiRequest<{ collections: any[] }>("/api/reports/collections")
      .then((data) => {
        if (active) setPayments(data.collections as any);
      })
      .catch((requestError: Error) => {
        if (active) setError(requestError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        description="All payment records"
        actions={
          <Link
            href="/payments/new"
            className="inline-flex h-10 items-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-medium text-white hover:bg-slate-800"
          >
            <Plus size={16} aria-hidden="true" />
            New Payment
          </Link>
        }
      />

      {error ? <ErrorMessage message={error} /> : null}
      {loading ? <LoadingBlock label="Loading payments" /> : null}

      {!loading ? (
        <div className="rounded-md border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-[800px] w-full text-left text-sm">
              <thead className="bg-slate-100 text-xs font-semibold uppercase text-slate-600">
                  <tr>
                    <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Method</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                  {payments.map((payment: any) => (
                    <tr key={payment.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-700">{payment.customerName}</td>
                    <td className="px-4 py-3 text-slate-700">{formatPeso(payment.amount)}</td>
                    <td className="px-4 py-3 text-slate-700">{payment.paymentDate}</td>
                    <td className="px-4 py-3 text-slate-700">{payment.method}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {payments.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-500">No payments yet.</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
