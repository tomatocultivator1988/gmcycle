"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Bike,
  CalendarCheck,
  ClockAlert,
  TrendingUp,
  Users,
  AlertTriangle,
  CheckCircle2,
  Landmark,
  Percent,
  PiggyBank,
  ArrowUpRight,
  ArrowDownRight,
  Receipt,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ErrorMessage, LoadingBlock } from "@/components/ui-state";
import { apiRequest } from "@/lib/client-api";
import { formatPeso } from "@/lib/money";
import type { DashboardMetricsDto } from "@/types/api";

const metricCards = [
  { key: "totalAccounts", label: "Total Accounts", icon: Users, color: "bg-blue-50 text-blue-700 ring-blue-200", money: false },
  { key: "activeAccounts", label: "Active", icon: CheckCircle2, color: "bg-emerald-50 text-emerald-700 ring-emerald-200", money: false },
  { key: "fullyPaidAccounts", label: "Fully Paid", icon: Bike, color: "bg-sky-50 text-sky-700 ring-sky-200", money: false },
  { key: "overdueAccounts", label: "Overdue", icon: AlertTriangle, color: "bg-rose-50 text-rose-700 ring-rose-200", money: false },
  { key: "dueTodayAccounts", label: "Due Today", icon: ClockAlert, color: "bg-amber-50 text-amber-700 ring-amber-200", money: false },
  { key: "totalInstallmentSales", label: "Installment Sales", icon: TrendingUp, color: "bg-violet-50 text-violet-700 ring-violet-200", money: true },
  { key: "totalDownPayments", label: "Down Payments", icon: ArrowDownRight, color: "bg-teal-50 text-teal-700 ring-teal-200", money: true },
  { key: "totalCollections", label: "Collections", icon: PiggyBank, color: "bg-indigo-50 text-indigo-700 ring-indigo-200", money: true },
  { key: "outstandingBalances", label: "Outstanding", icon: Landmark, color: "bg-orange-50 text-orange-700 ring-orange-200", money: true },
  { key: "totalPenaltiesCollected", label: "Penalties", icon: ArrowUpRight, color: "bg-rose-50 text-rose-700 ring-rose-200", money: true },
  { key: "totalDiscountsGranted", label: "Discounts", icon: Percent, color: "bg-emerald-50 text-emerald-700 ring-emerald-200", money: true },
  { key: "collectionsToday", label: "Today", icon: CalendarCheck, color: "bg-blue-50 text-blue-700 ring-blue-200", money: true },
  { key: "collectionsThisWeek", label: "This Week", icon: CalendarCheck, color: "bg-purple-50 text-purple-700 ring-purple-200", money: true },
  { key: "collectionsThisMonth", label: "This Month", icon: Receipt, color: "bg-pink-50 text-pink-700 ring-pink-200", money: true },
] as const;

const agingLabels = [
  { key: "current", label: "Current", color: "bg-emerald-500" },
  { key: "days1to30", label: "1-30 Days", color: "bg-amber-500" },
  { key: "days31to60", label: "31-60 Days", color: "bg-orange-500" },
  { key: "days61to90", label: "61-90 Days", color: "bg-rose-500" },
  { key: "days90plus", label: "90+ Days", color: "bg-red-600" },
] as const;

export function DashboardClient() {
  const [metrics, setMetrics] = useState<DashboardMetricsDto | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiRequest<{ metrics: DashboardMetricsDto }>("/api/dashboard")
      .then((data) => setMetrics(data.metrics))
      .catch((requestError: Error) => setError(requestError.message));
  }, []);

  const maxAging = metrics
    ? Math.max(metrics.aging.current, metrics.aging.days1to30, metrics.aging.days31to60, metrics.aging.days61to90, metrics.aging.days90plus, 1)
    : 1;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description="GM Cycle — installment monitoring overview"
        actions={
          <Link
            href="/installment-accounts/new"
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-800 px-4 text-sm font-medium text-white shadow-sm transition-all duration-150 hover:bg-blue-700 hover:shadow-md active:scale-[0.98]"
          >
            <Bike size={16} aria-hidden="true" />
            New Account
          </Link>
        }
      />

      {error ? <ErrorMessage message={error} /> : null}
      {!metrics && !error ? <LoadingBlock label="Loading dashboard" /> : null}

      {metrics ? (
        <>
          <section>
            <h2 className="text-sm font-semibold font-heading uppercase tracking-wider text-slate-500 mb-4">Accounts</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {metricCards.slice(0, 5).map((card) => {
                const Icon = card.icon;
                const rawValue = metrics[card.key as keyof DashboardMetricsDto];
                const value = card.money ? formatPeso(String(rawValue)) : rawValue;

                return (
                  <div key={card.key} className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-600">{card.label}</span>
                      <span className={`flex size-9 items-center justify-center rounded-lg ring-1 ${card.color}`}>
                        <Icon size={17} aria-hidden="true" />
                      </span>
                    </div>
                    <div className="mt-3 text-2xl font-bold text-slate-900">{value as string}</div>
                  </div>
                );
              })}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold font-heading uppercase tracking-wider text-slate-500 mb-4">Financials</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {metricCards.slice(5, 11).map((card) => {
                const Icon = card.icon;
                const rawValue = metrics[card.key as keyof DashboardMetricsDto];
                const value = card.money ? formatPeso(String(rawValue)) : rawValue;

                return (
                  <div key={card.key} className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-600">{card.label}</span>
                      <span className={`flex size-9 items-center justify-center rounded-lg ring-1 ${card.color}`}>
                        <Icon size={17} aria-hidden="true" />
                      </span>
                    </div>
                    <div className="mt-3 text-2xl font-bold text-slate-900">{value as string}</div>
                  </div>
                );
              })}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold font-heading uppercase tracking-wider text-slate-500 mb-4">Collections</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              {metricCards.slice(11).map((card) => {
                const Icon = card.icon;
                const rawValue = metrics[card.key as keyof DashboardMetricsDto];
                const value = card.money ? formatPeso(String(rawValue)) : rawValue;

                return (
                  <div key={card.key} className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-600">{card.label}</span>
                      <span className={`flex size-9 items-center justify-center rounded-lg ring-1 ${card.color}`}>
                        <Icon size={17} aria-hidden="true" />
                      </span>
                    </div>
                    <div className="mt-3 text-2xl font-bold text-slate-900">{value as string}</div>
                  </div>
                );
              })}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold font-heading uppercase tracking-wider text-slate-500 mb-4">Aging Report</h2>
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="space-y-4">
                {agingLabels.map((item) => {
                  const value = metrics.aging[item.key as keyof typeof metrics.aging];
                  const pct = (value / maxAging) * 100;

                  return (
                    <div key={item.key}>
                      <div className="flex items-center justify-between text-sm mb-1.5">
                        <span className="font-medium text-slate-700">{item.label}</span>
                        <span className="text-slate-500 font-medium">{value} accounts</span>
                      </div>
                      <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className={`h-2.5 rounded-full transition-all duration-500 ${item.color}`}
                          style={{ width: `${Math.max(pct, 2)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
