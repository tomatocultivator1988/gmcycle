"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { ErrorMessage, LoadingBlock } from "@/components/ui-state";
import { apiRequest } from "@/lib/client-api";
import { formatPeso } from "@/lib/money";
import type { PaymentDto } from "@/types/api";

type PaymentListResponse = {
  payments: PaymentDto[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};

export default function PaymentsPage() {
  const [payments, setPayments] = useState<PaymentDto[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchPayments = useCallback(async (p: number) => {
    setLoading(true);
    setError("");

    try {
      const data = await apiRequest<PaymentListResponse>(
        `/api/payments?page=${p}&limit=20`,
      );
      setPayments(data.payments);
      setTotalPages(data.pagination.totalPages);
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPayments(page);
  }, [page, fetchPayments]);

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
            <table className="min-w-[900px] w-full text-left text-sm">
              <thead className="bg-slate-100 text-xs font-semibold uppercase text-slate-600">
                <tr>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Method</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Penalty</th>
                  <th className="px-4 py-3">Discount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {payments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-700">{payment.customerName}</td>
                    <td className="px-4 py-3 font-medium text-slate-950">{formatPeso(payment.totalAmount)}</td>
                    <td className="px-4 py-3 text-slate-700">{payment.paymentDate}</td>
                    <td className="px-4 py-3 text-slate-700">{payment.method}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium">
                        {payment.paymentType}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {payment.penaltyAmount !== "0.00" ? (
                        <span className="text-rose-700">{formatPeso(payment.penaltyAmount)}</span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {payment.discountAmount !== "0.00" ? (
                        <span className="text-emerald-700">{formatPeso(payment.discountAmount)}</span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {payments.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-500">No payments yet.</div>
          ) : null}
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      ) : null}
    </div>
  );
}
