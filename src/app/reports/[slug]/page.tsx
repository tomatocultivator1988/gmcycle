"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ResponsiveTable, type Column } from "@/components/responsive-table";
import { ErrorMessage, LoadingBlock } from "@/components/ui-state";
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
    title: "Overdue Accounts Report",
    description: "Accounts past due date",
    summaryFields: [
      { label: "Total Overdue", getValue: (d) => String(d.totalOverdue) },
    ],
    columns: [
      { key: "customerName", label: "Customer", render: (r) => r.customerName },
      { key: "phone", label: "Phone", render: (r) => r.customerPhone },
      { key: "unit", label: "Unit", render: (r) => `${r.brand} ${r.model}` },
      { key: "balance", label: "Balance", render: (r) => <span className="font-semibold text-slate-900">{formatPeso(r.remainingBalance)}</span> },
      { key: "monthly", label: "Monthly", render: (r) => formatPeso(r.monthlyInstallment), hideOnMobile: true },
      { key: "dueDate", label: "Due Date", render: (r) => r.nextDueDate },
      { key: "daysOverdue", label: "Days Overdue", render: (r) => <span className="font-semibold text-rose-600">{r.daysOverdue}d</span> },
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
  discounts: {
    title: "Discount Report",
    description: "All discount records",
    summaryFields: [
      { label: "Total Discounts", getValue: (d) => formatPeso(d.total) },
      { label: "Count", getValue: (d) => String(d.count) },
    ],
    columns: [
      { key: "customerName", label: "Customer", render: (r) => r.customerName },
      { key: "unit", label: "Unit", render: (r) => r.unit },
      { key: "amount", label: "Amount", render: (r) => <span className="font-semibold text-emerald-600">{formatPeso(r.amount)}</span> },
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
      { key: "phone", label: "Phone", render: (r) => r.customerPhone },
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
  discounts: "discounts",
  "outstanding-balances": "accounts",
};

export default function ReportPage() {
  const { slug } = useParams<{ slug: string }>();
  const config = reportConfigs[slug];
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!config) { setLoading(false); return; }

    let active = true;

    apiRequest<any>(`/api/reports/${slug}`)
      .then((res) => { if (active) setData(res); })
      .catch((requestError: Error) => { if (active) setError(requestError.message); })
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
  }, [slug, config]);

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
          </div>
        </>
      ) : null}
    </div>
  );
}
