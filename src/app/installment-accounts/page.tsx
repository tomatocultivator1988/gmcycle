"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { StatusBadge } from "@/components/status-badge";
import { ResponsiveTable, type Column } from "@/components/responsive-table";
import { ErrorMessage, LoadingBlock } from "@/components/ui-state";
import { apiRequest } from "@/lib/client-api";
import { formatPeso } from "@/lib/money";
import type { InstallmentAccountDto, AccountStatusValue } from "@/types/api";

type AccountListResponse = {
  installmentAccounts: InstallmentAccountDto[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};

const columns: Column<InstallmentAccountDto>[] = [
  {
    key: "customer",
    label: "Customer",
    render: (a) => (
      <div>
        <div className="font-medium text-slate-900">{a.customerName}</div>
        <div className="text-xs text-slate-500">{a.customerPhone}</div>
      </div>
    ),
  },
  {
    key: "device",
    label: "Device",
    render: (a) => <span className="text-slate-700">{a.brand} {a.model}</span>,
  },
  {
    key: "balance",
    label: "Balance",
    render: (a) => <span className="font-semibold text-slate-900">{formatPeso(a.remainingBalance)}</span>,
    className: "font-semibold text-slate-900",
  },
  {
    key: "monthly",
    label: "Monthly",
    render: (a) => <span className="text-slate-700">{formatPeso(a.monthlyInstallment)}</span>,
  },
  {
    key: "status",
    label: "Status",
    render: (a) => <StatusBadge status={a.status as AccountStatusValue} />,
  },
  {
    key: "nextDue",
    label: "Next Due",
    render: (a) => <span className="text-slate-700">{a.nextDueDate}</span>,
  },
  {
    key: "actions",
    label: "",
    render: (a) => (
      <Link
        href={`/installment-accounts/${a.id}`}
        className="inline-flex h-8 items-center rounded-xl border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:border-slate-400 active:scale-[0.98]"
      >
        View
      </Link>
    ),
    hideOnMobile: false,
    headerClassName: "w-16",
    className: "text-right",
  },
];

export default function InstallmentAccountsPage() {
  const [accounts, setAccounts] = useState<InstallmentAccountDto[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchAccounts = useCallback(async (p: number, search: string) => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({ page: String(p), limit: "20" });
      if (search) params.set("search", search);

      const data = await apiRequest<AccountListResponse>(
        `/api/installment-accounts?${params}`,
      );
      setAccounts(data.installmentAccounts);
      setTotalPages(data.pagination.totalPages);
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts(page, searchTerm);
  }, [page, searchTerm, fetchAccounts]);

  function handleSearch(value: string) {
    setSearchTerm(value);
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Installment Accounts"
        description="All gadget installment accounts"
        actions={
          <Link
            href="/installment-accounts/new"
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-red-800 px-4 text-sm font-medium text-white shadow-sm transition-all duration-150 hover:bg-red-700 hover:shadow-md active:scale-[0.98]"
          >
            <Plus size={16} aria-hidden="true" />
            New Account
          </Link>
        }
      />

      {error ? <ErrorMessage message={error} /> : null}
      {loading ? <LoadingBlock label="Loading accounts" /> : null}

      {!loading ? (
        <>
          <div className="relative max-w-sm">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by customer, brand, or model..."
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100"
            />
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <ResponsiveTable
              columns={columns}
              data={accounts}
              rowKey={(a) => a.id}
              emptyMessage={searchTerm ? "No accounts match your search." : "No accounts yet. Create your first account."}
            />
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        </>
      ) : null}
    </div>
  );
}
