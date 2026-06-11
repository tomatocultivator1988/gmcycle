"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ResponsiveTable, type Column } from "@/components/responsive-table";
import { Pagination } from "@/components/pagination";
import { ErrorMessage, LoadingBlock } from "@/components/ui-state";
import { StatusBadge } from "@/components/status-badge";
import { apiRequest } from "@/lib/client-api";
import { formatPeso } from "@/lib/money";

type ReportConfig = {
  title: string;
  description: string;
  columns: Column<any>[];
  summaryFields: { label: string; getValue: (data: any) => string }[];
};

const reportConfigs: Record<string, ReportConfig> = {
  collections: {
    title: "Collection Report",
    description: "All collections with customer and unit details",
    summaryFields: [
      { label: "Total Collections", getValue: (d) => formatPeso(d.total) },
    ],
    columns: [
      { key: "customerName", label: "Customer", render: (r) => r.customerName },
      { key: "unit", label: "Unit", render: (r) => `${r.brand} ${r.model}` },
      { key: "amount", label: "Amount", render: (r) => <span className="font-semibold text-slate-900">{formatPeso(r.amount)}</span> },
      { key: "paymentDate", label: "Date", render: (r) => r.paymentDate },
      { key: "method", label: "Method", render: (r) => r.method, hideOnMobile: true },
    ],
  },
  "daily-collections": {
    title: "Daily Collection Report",
    description: "Today's collections summary",
    summaryFields: [
      { label: "Date", getValue: (d) => d.date },
      { label: "Today's Total", getValue: (d) => formatPeso(d.total) },
    ],
    columns: [
      { key: "customerName", label: "Customer", render: (r) => r.customerName },
      { key: "unit", label: "Unit", render: (r) => r.unit },
      { key: "amount", label: "Amount", render: (r) => <span className="font-semibold text-slate-900">{formatPeso(r.amount)}</span> },
      { key: "method", label: "Method", render: (r) => r.method, hideOnMobile: true },
      { key: "cashier", label: "Cashier", render: (r) => r.cashier ?? "—", hideOnMobile: true },
    ],
  },
  "monthly-collections": {
    title: "Monthly Collection Report",
    description: "Monthly breakdown of collections",
    summaryFields: [
      { label: "Month", getValue: (d) => d.month },
      { label: "Total", getValue: (d) => formatPeso(d.total) },
      { label: "Transactions", getValue: (d) => String(d.count) },
    ],
    columns: [
      { key: "month", label: "Month", render: (r) => r.month },
      { key: "total", label: "Total", render: (r) => <span className="font-semibold text-slate-900">{formatPeso(r.total)}</span> },
      { key: "count", label: "Transactions", render: (r) => String(r.count) },
    ],
  },
  "overdue-accounts": {
    title: "Due Date Monitoring",
    description: "All active accounts sorted by due date. Filter by a specific date to see who has paid and who hasn't.",
    summaryFields: [
      { label: "Filtered Accounts", getValue: (d) => String(d.totalFiltered) },
      { label: "Total Overdue", getValue: (d) => String(d.totalOverdue) },
    ],
    columns: [
      {
        key: "customerName",
        label: "Customer",
        render: (r) => <Link href={`/installment-accounts/${r.id}`} className="font-medium text-red-800 hover:text-red-600 hover:underline">{r.customerName}</Link>,
      },
      { key: "unit", label: "Unit", render: (r) => `${r.brand} ${r.model}` },
      { key: "phone", label: "Contact", render: (r) => r.customerPhone },
      { key: "nextDueDate", label: "Due Date", render: (r) => r.nextDueDate },
      {
        key: "status",
        label: "Status",
        render: (r) => <StatusBadge status={r.status} />,
      },
      { key: "balance", label: "Balance", render: (r) => <span className="font-semibold text-slate-900">{formatPeso(r.remainingBalance)}</span> },
      { key: "monthly", label: "Monthly", render: (r) => formatPeso(r.monthlyInstallment), hideOnMobile: true },
      {
        key: "lastPaymentDate",
        label: "Last Payment",
        render: (r) => r.lastPaymentDate
          ? <span className="text-xs">{r.lastPaymentDate}<br/><span className="text-slate-500">{formatPeso(r.lastPaymentAmount)}</span></span>
          : <span className="text-slate-400">—</span>,
        hideOnMobile: true,
      },
      {
        key: "dueLabel",
        label: "Days Overdue",
        render: (r) => r.daysOverdue > 0
          ? <span className="font-semibold text-rose-600">{r.daysOverdue}d overdue</span>
          : <span className="text-slate-400">—</span>,
        hideOnMobile: true,
      },
    ],
  },
  penalties: {
    title: "Penalty Report",
    description: "All penalty records",
    summaryFields: [
      { label: "Total Penalties", getValue: (d) => formatPeso(d.total) },
      { label: "Count", getValue: (d) => String(d.count) },
    ],
    columns: [
      { key: "customerName", label: "Customer", render: (r) => r.customerName },
      { key: "unit", label: "Unit", render: (r) => r.unit },
      { key: "amount", label: "Amount", render: (r) => <span className="font-semibold text-rose-600">{formatPeso(r.amount)}</span> },
      { key: "appliedDate", label: "Date", render: (r) => r.appliedDate },
      { key: "reason", label: "Reason", render: (r) => r.reason ?? "—", hideOnMobile: true },
    ],
  },
  "outstanding-balances": {
    title: "Outstanding Balance Report",
    description: "All active accounts with remaining balances",
    summaryFields: [
      { label: "Total Outstanding", getValue: (d) => formatPeso(d.totalOutstanding) },
      { label: "Active Accounts", getValue: (d) => String(d.count) },
    ],
    columns: [
      { key: "customerName", label: "Customer", render: (r) => r.customerName },
      { key: "phone", label: "Contact", render: (r) => r.customerPhone },
      { key: "unit", label: "Unit", render: (r) => `${r.brand} ${r.model}` },
      { key: "balance", label: "Balance", render: (r) => <span className="font-semibold text-slate-900">{formatPeso(r.remainingBalance)}</span> },
      { key: "monthly", label: "Monthly", render: (r) => formatPeso(r.monthlyInstallment), hideOnMobile: true },
      { key: "dueDate", label: "Due Date", render: (r) => r.nextDueDate },
      {
        key: "status",
        label: "Status",
        render: (r) => (
          <span className={`inline-flex items-center rounded-lg px-2 py-0.5 text-xs font-semibold ${
            r.status === "OVERDUE" ? "bg-rose-50 text-rose-700 border border-rose-200" :
            r.status === "DUE_TODAY" ? "bg-amber-50 text-amber-700 border border-amber-200" :
            "bg-emerald-50 text-emerald-700 border border-emerald-200"
          }`}>
            {r.status.replace("_", " ")}
          </span>
        ),
      },
    ],
  },
};

const listKeys: Record<string, string> = {
  collections: "collections",
  "daily-collections": "collections",
  "monthly-collections": "monthlyBreakdown",
  "overdue-accounts": "accounts",
  penalties: "penalties",
  "outstanding-balances": "accounts",
};

export default function ReportPage() {
  const { slug } = useParams<{ slug: string }>();
  const config = reportConfigs[slug];
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [dueDate, setDueDate] = useState("");

  function todayString() {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Manila",
      year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date());
  }

  useEffect(() => {
    if (!config) { setLoading(false); return; }

    let active = true;
    setLoading(true);

    let url = `/api/reports/${slug}?page=${page}&limit=50`;
    if (slug === "overdue-accounts" && dueDate) {
      url += `&dueDate=${dueDate}`;
    }

    apiRequest<any>(url)
      .then((res) => {
        if (active) {
          setData(res);
          if (res.pagination) setTotalPages(res.pagination.totalPages);
        }
      })
      .catch((requestError: Error) => { if (active) setError(requestError.message); })
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
  }, [slug, config, page, dueDate]);

  if (!config) {
    return (
      <div className="space-y-6">
        <PageHeader title="Report Not Found" description="This report does not exist." />
        <Link href="/reports" className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50">
          <ArrowLeft size={16} /> Back to Reports
        </Link>
      </div>
    );
  }

  const rows = data ? (data[listKeys[slug]] ?? []) : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={config.title}
        description={config.description}
        actions={
          <Link
            href="/reports"
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:border-slate-400 active:scale-[0.98]"
          >
            <ArrowLeft size={16} /> All Reports
          </Link>
        }
      />

      {error ? <ErrorMessage message={error} /> : null}
      {loading ? <LoadingBlock label={`Loading ${config.title}`} /> : null}

      {!loading && data && slug === "overdue-accounts" ? (
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="date"
            value={dueDate}
            onChange={(e) => { setDueDate(e.target.value); setPage(1); }}
            className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100"
          />
          {dueDate ? (
            <button
              type="button"
              onClick={() => { setDueDate(""); setPage(1); }}
              className="inline-flex h-10 items-center rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-600 hover:bg-slate-50"
            >
              Clear Filter
            </button>
          ) : null}
          <span className="text-xs text-slate-500">Showing {data.totalFiltered} accounts{dueDate ? ` due on ${dueDate}` : ""}</span>
        </div>
      ) : null}

      {!loading && data ? (
        <>
          <div className="flex flex-wrap gap-4">
            {config.summaryFields.map((field) => (
              <div key={field.label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm min-w-[180px]">
                <div className="text-xs font-semibold font-heading uppercase tracking-wider text-slate-500">{field.label}</div>
                <div className="mt-1.5 text-xl font-bold text-slate-900">{field.getValue(data)}</div>
              </div>
            ))}
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <ResponsiveTable
              columns={config.columns}
              data={rows}
              rowKey={(row: any, idx: number) => row.id ?? idx}
              emptyMessage="No data for this report."
            />
            {slug !== "monthly-collections" ? (
              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
