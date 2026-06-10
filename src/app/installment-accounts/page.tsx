"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Ban, Plus, Search, ShieldOff } from "lucide-react";
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

const BAD_RECORD_STYLE = "inline-flex items-center rounded sm:rounded-lg border border-red-200 bg-red-50 px-1 sm:px-2 py-0 sm:py-0.5 text-[10px] sm:text-xs font-medium text-red-700";

export default function InstallmentAccountsPage() {
  const [accounts, setAccounts] = useState<InstallmentAccountDto[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [badRecordModal, setBadRecordModal] = useState<InstallmentAccountDto | null>(null);
  const [badRecordRemark, setBadRecordRemark] = useState("");
  const [savingBadRecord, setSavingBadRecord] = useState(false);
  const [sendingReminders, setSendingReminders] = useState(false);
  const [reminderResult, setReminderResult] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

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
    fetchAccounts(page, debouncedSearch);
  }, [page, debouncedSearch, fetchAccounts]);

  function handleSearch(value: string) {
    setSearchTerm(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(1);
    }, 300);
  }

  async function toggleBadRecord(a: InstallmentAccountDto) {
    if (a.badRecord) {
      setSavingBadRecord(true);
      try {
        await apiRequest(`/api/installment-accounts/${a.id}/bad-record`, {
          method: "PATCH",
          body: JSON.stringify({ badRecord: false }),
        });
        fetchAccounts(page, debouncedSearch);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setSavingBadRecord(false);
      }
      return;
    }
    setBadRecordModal(a);
    setBadRecordRemark("");
  }

  async function confirmBadRecord() {
    if (!badRecordModal) return;
    setSavingBadRecord(true);
    try {
      await apiRequest(`/api/installment-accounts/${badRecordModal.id}/bad-record`, {
        method: "PATCH",
        body: JSON.stringify({ badRecord: true, badRecordRemark }),
      });
      setBadRecordModal(null);
      fetchAccounts(page, debouncedSearch);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingBadRecord(false);
    }
  }

  const columns: Column<InstallmentAccountDto>[] = [
    {
      key: "customer",
      label: "Customer",
      render: (a) => (
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-900">{a.customerName}</span>
            {a.badRecord ? (
              <button
                type="button"
                onClick={() => toggleBadRecord(a)}
                className={BAD_RECORD_STYLE + " cursor-pointer hover:bg-red-100"}
              >
                BAD RECORD ✕
              </button>
            ) : null}
          </div>
          <div className="text-xs text-slate-500">{a.customerPhone}</div>
        </div>
      ),
    },
    {
      key: "device",
      label: "Item",
      render: (a) => (
        a.itemType === "CASH"
          ? <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600">Cash</span>
          : <span className="text-slate-700">{a.brand} {a.model}</span>
      ),
    },
    {
      key: "balance",
      label: "Balance",
      render: (a) => <span className="font-semibold text-slate-900">{formatPeso(a.remainingBalance)}</span>,
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
        <div className="flex items-center gap-2 justify-end">
          {a.badRecord ? null : (
            <button
              type="button"
              onClick={() => toggleBadRecord(a)}
              className="inline-flex h-8 items-center rounded-xl border border-red-200 bg-red-50 px-2.5 text-xs font-medium text-red-700 transition-all hover:bg-red-100 active:scale-[0.98]"
            >
              Bad Record
            </button>
          )}
          <Link
            href={`/installment-accounts/${a.id}`}
            className="inline-flex h-8 items-center rounded-xl border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:border-slate-400 active:scale-[0.98]"
          >
            View
          </Link>
        </div>
      ),
      hideOnMobile: false,
      headerClassName: "w-32",
      className: "text-right",
    },
  ];

  async function sendReminders() {
    setSendingReminders(true);
    setReminderResult(null);
    try {
      const data = await apiRequest<{ sent: number; failed: number; total: number }>("/api/installment-accounts/send-reminders", { method: "POST" });
      setReminderResult(`Sent: ${data.sent}, Failed: ${data.failed}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSendingReminders(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Installment Accounts"
        description="All gadget installment accounts"
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={sendReminders}
              disabled={sendingReminders}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-[0.98] disabled:opacity-50"
            >
              {sendingReminders ? "Sending..." : "📧 Send Reminders"}
            </button>
            <Link
              href="/installment-accounts/new"
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-red-800 px-4 text-sm font-medium text-white shadow-sm transition-all duration-150 hover:bg-red-700 hover:shadow-md active:scale-[0.98]"
            >
              <Plus size={16} aria-hidden="true" />
              New Account
            </Link>
          </div>
        }
      />

      {error ? <ErrorMessage message={error} /> : null}
      {reminderResult ? <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2">{reminderResult}</div> : null}
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
              emptyMessage={debouncedSearch ? "No accounts match your search." : "No accounts yet. Create your first account."}
            />
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        </>
      ) : null}

      {badRecordModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl">
            <div className="p-6">
              <div className="flex flex-col items-center text-center">
                <span className="flex size-12 items-center justify-center rounded-full bg-red-100 text-red-600">
                  <ShieldOff size={24} />
                </span>
                <h3 className="mt-4 text-base font-bold font-heading text-slate-900">Mark as Bad Record</h3>
                <p className="mt-1.5 text-sm text-slate-500">
                  {badRecordModal.customerName} — {badRecordModal.brand} {badRecordModal.model}
                </p>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-slate-700">
                  Remark
                  <textarea
                    value={badRecordRemark}
                    onChange={(e) => setBadRecordRemark(e.target.value)}
                    placeholder="Why is this account flagged?"
                    className="mt-1.5 min-h-20 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100"
                  />
                </label>
              </div>

              <div className="mt-6 flex flex-col gap-2">
                <button
                  type="button"
                  disabled={savingBadRecord}
                  onClick={confirmBadRecord}
                  className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-red-800 px-4 text-sm font-medium text-white shadow-sm transition-all hover:bg-red-700 active:scale-[0.98] disabled:bg-slate-300"
                >
                  {savingBadRecord ? "Saving..." : "Mark as Bad Record"}
                </button>
                <button
                  type="button"
                  disabled={savingBadRecord}
                  onClick={() => setBadRecordModal(null)}
                  className="inline-flex h-10 w-full items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-[0.98]"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
