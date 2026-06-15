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
      { key: "monthly", label: "Per Period", render: (r) => <span>{formatPeso(r.monthlyInstallment)}<span className="text-slate-400 text-[10px] ml-0.5">{r.scheduleType === "SEMI_MONTHLY" ? "/period" : "/mo"}</span></span>, hideOnMobile: true },
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
      { key: "monthly", label: "Per Period", render: (r) => <span>{formatPeso(r.monthlyInstallment)}<span className="text-slate-400 text-[10px] ml-0.5">{r.scheduleType === "SEMI_MONTHLY" ? "/period" : "/mo"}</span></span>, hideOnMobile: true },
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
      { key: "monthly", label: "Per Period", render: (r) => <span>{formatPeso(r.monthlyInstallment)}<span className="text-slate-400 text-[10px] ml-0.5">{r.scheduleType === "SEMI_MONTHLY" ? "/period" : "/mo"}</span></span> },
      { key: "nextAmountDue", label: "Next Due", render: (r) => r.nextAmountDue !== "0.00" ? <span className="font-semibold text-red-800">{formatPeso(r.nextAmountDue)}</span> : <span className="text-slate-400">—</span> },
      { key: "totalPenalties", label: "Penalties", render: (r) => r.totalPenalties !== "0.00" ? <span className="font-medium text-rose-600">{formatPeso(r.totalPenalties)}</span> : <span className="text-slate-300">—</span>, hideOnMobile: true },
      { key: "term", label: "Term", render: (r) => r.scheduleType === "SEMI_MONTHLY" ? `${r.term}mo (${r.term * 2} periods)` : `${r.term}mo`, hideOnMobile: true },
      { key: "dueDay", label: "Due Date", render: (r) => (r.dueDays as number[]).join(", "), hideOnMobile: true },
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

  const [dueModal, setDueModal] = useState<any>(null);

  const columns = slug === "account-master-list"
    ? [
        ...config.columns,
        {
          key: "totalAmountDue",
          label: "Total Amount Due",
          headerClassName: "w-36",
          render: (r: any) => {
            const breakdown = r.dueBreakdown as Array<{ period: number; dueDate: string; amount: string; penalty: string }> | undefined;
            const hasBreakdown = breakdown && breakdown.length > 0;
            const total = r.totalAmountDue !== "0.00" ? r.totalAmountDue : r.nextAmountDue;
            return (
              <button
                type="button"
                className={`inline-flex items-center gap-1 font-bold cursor-pointer hover:underline whitespace-nowrap ${hasBreakdown ? "text-red-800" : "text-slate-700"}`}
                onClick={() => setDueModal(r)}
              >
                {formatPeso(total)}
                {hasBreakdown ? <span className="text-[10px] font-normal text-slate-400">({breakdown.length})</span> : null}
              </button>
            );
          },
        },
      ]
    : config.columns;

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
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-red-800 px-4 text-sm font-medium text-white shadow-sm transition-all duration-150 hover:bg-red-700 hover:shadow-md active:scale-[0.98] print:hidden disabled:opacity-50 disabled:cursor-not-allowed"
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
              columns={columns}
              data={rows}
              rowKey={(row: any, idx: number) => row.id ?? idx}
              emptyMessage="No data for this report."
              mobileAccordion={slug === "account-master-list" || slug === "overdue-accounts" ? { summaryColumns: ["customerName", "status"] } : undefined}
            />
              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} className="print:hidden" />
          </div>
        </>
      ) : null}

      {dueModal ? (() => {
        const r = dueModal;
        const breakdown = (r.dueBreakdown || []) as Array<{ period: number; dueDate: string; amount: string; penalty: string }>;
        const hasBreakdown = breakdown.length > 0;
        const total = r.totalAmountDue !== "0.00" ? r.totalAmountDue : r.nextAmountDue;
        const showTotal = formatPeso(total);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 print:hidden" onClick={() => setDueModal(null)}>
            <div className="rounded-2xl bg-white shadow-2xl p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold font-heading text-slate-900">{r.customerName}</h3>
                  <p className="text-xs text-slate-500">{hasBreakdown ? `${breakdown.length} period${breakdown.length > 1 ? "s" : ""} due` : "Next payment"}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setDueModal(null)}
                  className="flex size-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              </div>
              {hasBreakdown ? (
                <>
                {/* Mobile: Cards */}
                <div className="block sm:hidden space-y-2">
                  {breakdown.map((p: any) => (
                    <div key={p.period} className="rounded-lg border border-slate-200 bg-white p-3 text-xs space-y-1.5">
                      <div className="flex justify-between">
                        <span className="font-medium text-slate-900">#{p.period} · {p.dueDate}</span>
                        <span className="font-semibold text-red-800">{formatPeso((parseFloat(p.amount) + parseFloat(p.penalty || "0")).toFixed(2))}</span>
                      </div>
                      <div className="flex justify-between text-slate-500">
                        <span>Amount</span><span>{formatPeso(p.amount)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Penalty</span><span className="text-rose-600">{p.penalty !== "0.00" ? formatPeso(p.penalty) : "—"}</span>
                      </div>
                    </div>
                  ))}
                  <div className="text-sm font-bold text-red-800 pt-2">Total: {showTotal}</div>
                </div>
                {/* Desktop: Table */}
                <table className="hidden sm:table w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                      <th className="py-1.5 w-8">#</th>
                      <th className="py-1.5">Due Date</th>
                      <th className="py-1.5 text-right">Amount</th>
                      <th className="py-1.5 text-right">Penalty</th>
                      <th className="py-1.5 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {breakdown.map((p: any) => (
                      <tr key={p.period} className="border-b border-slate-50">
                        <td className="py-1.5">{p.period}</td>
                        <td className="py-1.5">{p.dueDate}</td>
                        <td className="py-1.5 text-right">{formatPeso(p.amount)}</td>
                        <td className="py-1.5 text-right text-rose-600">{p.penalty !== "0.00" ? formatPeso(p.penalty) : "—"}</td>
                        <td className="py-1.5 text-right font-semibold">{formatPeso((parseFloat(p.amount) + parseFloat(p.penalty || "0")).toFixed(2))}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-bold text-red-800 text-sm">
                      <td colSpan={4} className="pt-2 text-right">Total Amount Due:</td>
                      <td className="pt-2 text-right">{showTotal}</td>
                    </tr>
                  </tfoot>
                </table>
                </>
              ) : (
                <div className="text-center py-4">
                  <p className="text-2xl font-bold text-slate-800">{showTotal}</p>
                  <p className="text-xs text-slate-400 mt-1">Next installment — no overdue periods</p>
                </div>
              )}
            </div>
          </div>
        );
      })() : null}
    </div>
  );
}
