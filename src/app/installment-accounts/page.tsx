"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bike, Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { ErrorMessage, LoadingBlock } from "@/components/ui-state";
import { apiRequest } from "@/lib/client-api";
import { formatPeso } from "@/lib/money";
import type { InstallmentAccountDto, AccountStatusValue } from "@/types/api";

export default function InstallmentAccountsPage() {
  const [accounts, setAccounts] = useState<InstallmentAccountDto[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    apiRequest<{ installmentAccounts: InstallmentAccountDto[] }>(
      "/api/installment-accounts",
    )
      .then((data) => {
        if (active) setAccounts(data.installmentAccounts);
      })
      .catch((requestError: Error) => {
        if (active) setError(requestError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, []);

  const filtered = accounts.filter(
    (a) =>
      a.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.model.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Installment Accounts"
        description="All motorcycle installment accounts"
        actions={
          <Link
            href="/installment-accounts/new"
            className="inline-flex h-10 items-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-medium text-white hover:bg-slate-800"
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
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-10 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none focus:border-slate-950"
            />
          </div>

          <div className="rounded-md border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-[900px] w-full text-left text-sm">
                <thead className="bg-slate-100 text-xs font-semibold uppercase text-slate-600">
                  <tr>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Motorcycle</th>
                    <th className="px-4 py-3">Balance</th>
                    <th className="px-4 py-3">Monthly</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Next Due</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filtered.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-950">{a.customerName}</div>
                        <div className="text-xs text-slate-500">{a.customerPhone}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {a.brand} {a.model}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-950">{formatPeso(a.remainingBalance)}</td>
                      <td className="px-4 py-3 text-slate-700">{formatPeso(a.monthlyInstallment)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={a.status as AccountStatusValue} />
                      </td>
                      <td className="px-4 py-3 text-slate-700">{a.nextDueDate}</td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/installment-accounts/${a.id}`}
                          className="inline-flex h-8 items-center rounded-md border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filtered.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-500">
                {searchTerm ? "No accounts match your search." : "No accounts yet. Create your first account."}
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
