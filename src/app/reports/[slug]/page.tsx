"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
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
      {
        key: "customerName",
        label: "Customer",
        render: (r) => <Link href={`/installment-accounts/${r.accountId}`} className="font-medium text-red-800 hover:text-red-600 hover:underline print:text-black">{r.customerName}</Link>,
      },
      { key: "unit", label: "Unit", render: (r) => `${r.brand} ${r.model}` },
      { key: "amount", label: "Amount", render: (r) => <span className="font-semibold text-slate-900">{formatPeso(r.amount)}</span> },
      { key: "paymentDate", label: "Date", render: (r) => r.paymentDate },
      { key: "method", label: "Method", render: (r) => r.method, hideOnMobile: true },
      { key: "paymentType", label: "Type", render: (r) => r.paymentType ? r.paymentType.replace("_", " ") : "—", hideOnMobile: true },
    ],
  },
  "daily-collections": {
    title: "Daily Collection Report",
    description: "Collections for the selected date",
    summaryFields: [
      { label: "Date", getValue: (d) => d.date },
      { label: "Today's Total", getValue: (d) => formatPeso(d.total) },
    ],
    columns: [
      {
        key: "customerName",
        label: "Customer",
        render: (r) => <Link href={`/installment-accounts/${r.accountId}`} className="font-medium text-red-800 hover:text-red-600 hover:underline print:text-black">{r.customerName}</Link>,
      },
      { key: "unit", label: "Unit", render: (r) => r.unit },
      { key: "amount", label: "Amount", render: (r) => <span className="font-semibold text-slate-900">{formatPeso(r.amount)}</span> },
      { key: "method", label: "Method", render: (r) => r.method, hideOnMobile: true },
      { key: "paymentType", label: "Type", render: (r) => r.paymentType ? r.paymentType.replace("_", " ") : "—", hideOnMobile: true },
      { key: "cashier", label: "Cashier", render: (r) => r.cashier ?? "—", hideOnMobile: true },
    ],
  },
  "monthly-collections": {
    title: "Monthly Collection Report",
    description: "Detailed collections for the selected month",
    summaryFields: [
      { label: "Month", getValue: (d) => d.month },
      { label: "Total", getValue: (d) => formatPeso(d.total) },
      { label: "Transactions", getValue: (d) => String(d.count) },
    ],
    columns: [
      {
        key: "customerName",
        label: "Customer",
        render: (r) => <Link href={`/installment-accounts/${r.accountId}`} className="font-medium text-red-800 hover:text-red-600 hover:underline print:text-black">{r.customerName}</Link>,
      },
      { key: "unit", label: "Unit", render: (r) => r.unit },
      { key: "amount", label: "Amount", render: (r) => <span className="font-semibold text-slate-900">{formatPeso(r.amount)}</span> },
      { key: "paymentDate", label: "Date", render: (r) => r.paymentDate },
      { key: "method", label: "Method", render: (r) => r.method, hideOnMobile: true },
      { key: "paymentType", label: "Type", render: (r) => r.paymentType ? r.paymentType.replace("_", " ") : "—", hideOnMobile: true },
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
        render: (r) => <Link href={`/installment-accounts/${r.id}`} className="font-medium text-red-800 hover:text-red-600 hover:underline print:text-black">{r.customerName}</Link>,
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
  "account-master-list": {
    title: "Account Master List",
    description: "All accounts with complete customer, unit, and contract details",
    summaryFields: [
      { label: "Total Accounts", getValue: (d) => String(d.totalAccounts) },
      { label: "Total Balance Outstanding", getValue: (d) => formatPeso(d.totalBalance) },
      { label: "Total Collected", getValue: (d) => formatPeso(d.totalCollected) },
    ],
    columns: [
      {
        key: "customerName",
        label: "Customer",
        render: (r) => <Link href={`/installment-accounts/${r.id}`} className="font-medium text-red-800 hover:text-red-600 hover:underline print:text-black">{r.customerName}</Link>,
      },
      { key: "contact", label: "Contact", render: (r) => r.customerPhone },
      { key: "unit", label: "Unit", render: (r) => `${r.brand} ${r.model}` },
      { key: "cashPrice", label: "Cash Price", render: (r) => formatPeso(r.cashPrice), hideOnMobile: true },
      { key: "downPayment", label: "Down Pmt", render: (r) => formatPeso(r.downPayment), hideOnMobile: true },
      { key: "balance", label: "Balance", render: (r) => <span className="font-semibold text-slate-900">{formatPeso(r.remainingBalance)}</span> },
      { key: "monthly", label: "Monthly", render: (r) => formatPeso(r.monthlyInstallment) },
      { key: "nextAmountDue", label: "Next Due", render: (r) => r.nextAmountDue !== "0.00" ? <span className="font-semibold text-red-800">{formatPeso(r.nextAmountDue)}</span> : <span className="text-slate-400">—</span> },
      { key: "totalPenalties", label: "Penalties", render: (r) => r.totalPenalties !== "0.00" ? <span className="font-medium text-rose-600">{formatPeso(r.totalPenalties)}</span> : <span className="text-slate-300">—</span>, hideOnMobile: true },
      {
        key: "totalAmountDue",
        label: "Total Amount Due",
        render: (r) => {
          const breakdown = r.dueBreakdown as Array<{ period: number; dueDate: string; amount: string; penalty: string }> | undefined;
          const hasBreakdown = breakdown && breakdown.length > 0;
          const total = r.totalAmountDue !== "0.00" ? r.totalAmountDue : r.nextAmountDue;
          const showTotal = formatPeso(total);
          if (!hasBreakdown) return <span className="font-bold text-slate-700">{showTotal}</span>;
          return (
            <details className="relative group">
              <summary className="list-none cursor-pointer inline-flex items-center gap-1 font-bold text-red-800">
                {showTotal}
                <span className="text-[10px] font-normal text-slate-400">({breakdown.length})</span>
              </summary>
              <span className="absolute left-1/2 -translate-x-1/2 top-full mt-1 z-20 rounded-xl border border-slate-200 bg-white shadow-lg p-3 min-w-[240px] max-w-[300px] text-xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-slate-500 text-[11px]">Due Periods</span>
                  <button
                    type="button"
                    className="flex size-5 items-center justify-center rounded-full bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                    onClick={(e) => { e.stopPropagation(); (e.currentTarget.closest("details") as HTMLDetailsElement).open = false; }}
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12"/></svg>
                  </button>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="text-slate-500 border-b border-slate-100">
                      <th className="text-left py-1">#</th>
                      <th className="text-left py-1">Due</th>
                      <th className="text-right py-1">Amt</th>
                      <th className="text-right py-1">Pen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {breakdown.map((p) => (
                      <tr key={p.period} className="border-b border-slate-50">
                        <td className="py-1">{p.period}</td>
                        <td className="py-1">{p.dueDate}</td>
                        <td className="py-1 text-right">{formatPeso(p.amount)}</td>
                        <td className="py-1 text-right text-rose-600">{p.penalty !== "0.00" ? formatPeso(p.penalty) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-semibold">
                      <td colSpan={3} className="pt-1.5 text-right text-slate-600">Total:</td>
                      <td className="pt-1.5 text-right text-red-800">{showTotal}</td>
                    </tr>
                  </tfoot>
                </table>
              </span>
            </details>
          );
        },
      },
      { key: "term", label: "Term", render: (r) => `${r.term}mo`, hideOnMobile: true },
      { key: "dueDay", label: "Due Day", render: (r) => (r.dueDays as number[]).join(", "), hideOnMobile: true },
      { key: "nextDueDate", label: "Due Date", render: (r) => r.nextDueDate },
      {
        key: "status",
        label: "Status",
        render: (r) => <StatusBadge status={r.status} />,
      },
      {
        key: "daysOverdue",
        label: "Days Overdue",
        render: (r) => r.daysOverdue > 0
          ? <span className="font-semibold text-rose-600">{r.daysOverdue}d</span>
          : <span className="text-slate-400">—</span>,
        hideOnMobile: true,
      },
      {
        key: "lastPayment",
        label: "Last Payment",
        render: (r) => r.lastPaymentDate
          ? <span className="text-xs">{r.lastPaymentDate}<br/><span className="text-slate-500">{formatPeso(r.lastPaymentAmount)}</span></span>
          : <span className="text-slate-400">—</span>,
        hideOnMobile: true,
      },
      {
        key: "totalPaid",
        label: "Total Paid",
        render: (r) => <span className="font-semibold text-emerald-700">{formatPeso(r.totalPaid)}</span>,
      },
    ],
  },
};

const listKeys: Record<string, string> = {
  collections: "collections",
  "daily-collections": "collections",
  "monthly-collections": "collections",
  "overdue-accounts": "accounts",
  penalties: "penalties",
  "outstanding-balances": "accounts",
  "account-master-list": "accounts",
};

export default function ReportPage() {
  const { slug } = useParams<{ slug: string }>();
  const config = reportConfigs[slug];
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedPaidStatus, setSelectedPaidStatus] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const hasDateFilter = slug === "overdue-accounts" || slug === "account-master-list";
  const hasDailyFilter = slug === "daily-collections";
  const hasMonthFilter = slug === "monthly-collections";
  const hasStatusFilter = slug === "account-master-list";

  useEffect(() => {
    if (!config) { setLoading(false); return; }

    let active = true;
    setLoading(true);

    let url = `/api/reports/${slug}?page=${page}&limit=50`;
    if (selectedDate) url += `&date=${selectedDate}`;
    if (selectedPaidStatus) url += `&paidStatus=${selectedPaidStatus}`;
    if (selectedMonth) url += `&month=${selectedMonth}`;

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
  }, [slug, config, page, selectedDate, selectedPaidStatus, selectedMonth]);

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
    <div className="space-y-6 print:space-y-4">
      <PageHeader
        title={config.title}
        description={config.description}
        actions={
          <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                disabled={loading}
                className="hidden sm:inline-flex h-10 items-center gap-2 rounded-lg bg-red-800 px-4 text-sm font-medium text-white shadow-sm transition-all duration-150 hover:bg-red-700 hover:shadow-md active:scale-[0.98] print:hidden disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Printer size={16} />
                Print / Export PDF
              </button>
            <Link
              href="/reports"
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:border-slate-400 active:scale-[0.98]"
            >
              <ArrowLeft size={16} /> All Reports
            </Link>
          </div>
        }
      />

      {error ? <ErrorMessage message={error} /> : null}
      {loading ? <LoadingBlock label={`Loading ${config.title}`} /> : null}

      {!loading && data && hasDateFilter ? (
        <div className="flex flex-wrap items-center gap-3 print:hidden">
          <span className="text-xs font-semibold text-slate-500">Due on or before:</span>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => { setSelectedDate(e.target.value); setPage(1); }}
            className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100"
          />
          {selectedDate ? (
            <button
              type="button"
              onClick={() => setSelectedDate("")}
              className="inline-flex h-10 items-center rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-600 hover:bg-slate-50"
            >
              Clear Filter
            </button>
          ) : null}
          <span className="text-xs text-slate-500">
            {rows.length} of {data.pagination?.total ?? 0} accounts
          </span>
        </div>
      ) : null}

      {!loading && data && hasDailyFilter ? (
        <div className="flex flex-wrap items-center gap-3 print:hidden">
          <span className="text-xs font-semibold text-slate-500">Date:</span>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => { setSelectedDate(e.target.value); setPage(1); }}
            className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100"
          />
          {selectedDate ? (
            <button
              type="button"
              onClick={() => { setSelectedDate(""); setPage(1); }}
              className="inline-flex h-10 items-center rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-600 hover:bg-slate-50"
            >
              Clear Filter
            </button>
          ) : null}
          <span className="text-xs text-slate-500">
            {rows.length} of {data.pagination?.total ?? 0} collections
          </span>
        </div>
      ) : null}

      {!loading && data && hasMonthFilter ? (
        <div className="flex flex-wrap items-center gap-3 print:hidden">
          <span className="text-xs font-semibold text-slate-500">Month:</span>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => { setSelectedMonth(e.target.value); setPage(1); }}
            className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100"
          />
          {selectedMonth ? (
            <button
              type="button"
              onClick={() => { setSelectedMonth(""); setPage(1); }}
              className="inline-flex h-10 items-center rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-600 hover:bg-slate-50"
            >
              Clear Filter
            </button>
          ) : null}
          <span className="text-xs text-slate-500">
            {rows.length} of {data.pagination?.total ?? 0} transactions
          </span>
        </div>
      ) : null}

      {!loading && data && hasStatusFilter ? (
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          {[
            { key: "", label: "All", count: data.allCount },
            { key: "paid", label: "Paid", count: data.paidCount },
            { key: "unpaid", label: "Unpaid", count: data.unpaidCount },
          ].map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => { setSelectedPaidStatus(opt.key); setPage(1); }}
              className={`inline-flex h-9 items-center gap-1.5 rounded-xl px-4 text-sm font-semibold transition-all duration-150 active:scale-[0.97] ${
                selectedPaidStatus === opt.key
                  ? "bg-red-800 text-white shadow-sm"
                  : "border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {opt.label}
              {opt.count !== undefined ? (
                <span className={`text-xs tabular-nums ${selectedPaidStatus === opt.key ? "text-red-200" : "text-slate-400"}`}>
                  {opt.count}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}

      {!loading && data && hasDateFilter && selectedDate ? (
        <div className="hidden print:block text-xs text-slate-600 mb-2">
          <span className="font-semibold">Filter:</span> Due on or before <span className="font-semibold">{selectedDate}</span>
          {selectedPaidStatus ? <span> · Status: <span className="font-semibold capitalize">{selectedPaidStatus}</span></span> : null}
          <span className="ml-2 text-slate-400">({data.pagination?.total ?? 0} accounts)</span>
        </div>
      ) : null}

      {!loading && data ? (
        <>
          <div className="flex flex-wrap gap-4 print:gap-3">
            {config.summaryFields.map((field) => (
              <div key={field.label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm min-w-[180px] print:border print:border-slate-300 print:shadow-none print:p-3">
                <div className="text-xs font-semibold font-heading uppercase tracking-wider text-slate-500">{field.label}</div>
                <div className="mt-1.5 text-xl font-bold text-slate-900">{field.getValue(data)}</div>
              </div>
            ))}
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm print:border print:border-slate-300 print:shadow-none print:rounded-none print:overflow-visible">
            <ResponsiveTable
              columns={config.columns}
              data={rows}
              rowKey={(row: any, idx: number) => row.id ?? idx}
              emptyMessage="No data for this report."
              mobileAccordion={slug === "account-master-list" || slug === "overdue-accounts" ? { summaryColumns: ["customerName", "status"] } : undefined}
            />
              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} className="print:hidden" />
          </div>
        </>
      ) : null}
    </div>
  );
}
