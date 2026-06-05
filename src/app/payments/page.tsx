"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { ResponsiveTable, type Column } from "@/components/responsive-table";
import { ErrorMessage, LoadingBlock } from "@/components/ui-state";
import { apiRequest } from "@/lib/client-api";
import { formatPeso } from "@/lib/money";
import type { PaymentDto } from "@/types/api";

type PaymentListResponse = {
  payments: PaymentDto[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};

const paymentTypeStyles: Record<string, string> = {
  REGULAR: "bg-blue-50 text-blue-700 border-blue-200",
  PARTIAL: "bg-amber-50 text-amber-700 border-amber-200",
  ADVANCE: "bg-purple-50 text-purple-700 border-purple-200",
  FULL: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const columns: Column<PaymentDto>[] = [
  {
    key: "customer",
    label: "Customer",
    render: (p) => <span className="text-slate-700">{p.customerName}</span>,
  },
  {
    key: "amount",
    label: "Amount",
    render: (p) => <span className="font-semibold text-slate-900">{formatPeso(p.totalAmount)}</span>,
  },
  {
    key: "date",
    label: "Date",
    render: (p) => <span className="text-slate-700">{p.paymentDate}</span>,
  },
  {
    key: "method",
    label: "Method",
    render: (p) => <span className="text-slate-700">{p.method}</span>,
    hideOnMobile: true,
  },
  {
    key: "type",
    label: "Type",
    render: (p) => (
      <span className={`inline-flex items-center rounded-lg border px-2 py-0.5 text-xs font-semibold ${paymentTypeStyles[p.paymentType] || "bg-slate-50 text-slate-700 border-slate-200"}`}>
        {p.paymentType}
      </span>
    ),
  },
  {
    key: "penalty",
    label: "Penalty",
    render: (p) =>
      p.penaltyAmount && p.penaltyAmount !== "0.00" ? (
        <span className="font-medium text-rose-600">{formatPeso(p.penaltyAmount)}</span>
      ) : (
        <span className="text-slate-300">—</span>
      ),
    hideOnMobile: true,
  },
  {
    key: "discount",
    label: "Discount",
    render: (p) =>
      p.discountAmount && p.discountAmount !== "0.00" ? (
        <span className="font-medium text-emerald-600">{formatPeso(p.discountAmount)}</span>
      ) : (
        <span className="text-slate-300">—</span>
      ),
    hideOnMobile: true,
  },
];

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
      const data = await apiRequest<PaymentListResponse>(`/api/payments?page=${p}&limit=20`);
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
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-800 px-4 text-sm font-medium text-white shadow-sm transition-all duration-150 hover:bg-blue-700 hover:shadow-md active:scale-[0.98]"
          >
            <Plus size={16} aria-hidden="true" />
            New Payment
          </Link>
        }
      />

      {error ? <ErrorMessage message={error} /> : null}
      {loading ? <LoadingBlock label="Loading payments" /> : null}

      {!loading ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <ResponsiveTable
            columns={columns}
            data={payments}
            rowKey={(p) => p.id}
            emptyMessage="No payments yet."
          />
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      ) : null}
    </div>
  );
}
