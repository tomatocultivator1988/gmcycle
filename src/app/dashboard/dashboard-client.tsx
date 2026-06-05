"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Bike,
  CalendarCheck,
  ClockAlert,
  ReceiptText,
  TrendingUp,
  Users,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ErrorMessage, LoadingBlock } from "@/components/ui-state";
import { apiRequest } from "@/lib/client-api";
import { formatPeso } from "@/lib/money";
import type { DashboardMetricsDto } from "@/types/api";

const metricCards = [
  { key: "totalAccounts", label: "Total Accounts", icon: Bike, tone: "text-slate-700 bg-slate-50", money: false },
  { key: "activeAccounts", label: "Active", icon: Users, tone: "text-emerald-700 bg-emerald-50", money: false },
  { key: "fullyPaidAccounts", label: "Fully Paid", icon: CheckCircle2, tone: "text-blue-700 bg-blue-50", money: false },
  { key: "overdueAccounts", label: "Overdue", icon: AlertTriangle, tone: "text-rose-700 bg-rose-50", money: false },
  { key: "dueTodayAccounts", label: "Due Today", icon: ClockAlert, tone: "text-amber-700 bg-amber-50", money: false },
  { key: "totalInstallmentSales", label: "Total Installment Sales", icon: TrendingUp, tone: "text-violet-700 bg-violet-50", money: true },
  { key: "totalDownPayments", label: "Total Down Payments", icon: ReceiptText, tone: "text-teal-700 bg-teal-50", money: true },
  { key: "totalCollections", label: "Total Collections", icon: CalendarCheck, tone: "text-sky-700 bg-sky-50", money: true },
  { key: "outstandingBalances", label: "Outstanding Balances", icon: ReceiptText, tone: "text-orange-700 bg-orange-50", money: true },
  { key: "totalPenaltiesCollected", label: "Total Penalties", icon: AlertTriangle, tone: "text-rose-700 bg-rose-50", money: true },
  { key: "totalDiscountsGranted", label: "Total Discounts", icon: TrendingUp, tone: "text-emerald-700 bg-emerald-50", money: true },
  { key: "collectionsToday", label: "Collected Today", icon: CalendarCheck, tone: "text-indigo-700 bg-indigo-50", money: true },
  { key: "collectionsThisWeek", label: "This Week", icon: CalendarCheck, tone: "text-purple-700 bg-purple-50", money: true },
  { key: "collectionsThisMonth", label: "This Month", icon: CalendarCheck, tone: "text-pink-700 bg-pink-50", money: true },
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
    ? Math.max(
        metrics.aging.current,
        metrics.aging.days1to30,
        metrics.aging.days31to60,
        metrics.aging.days61to90,
        metrics.aging.days90plus,
        1,
      )
    : 1;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="GM Cycle — installment monitoring overview"
        actions={
          <Link
            href="/installment-accounts/new"
            className="inline-flex h-10 items-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-medium text-white hover:bg-slate-800"
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
          <h2 className="text-base font-semibold text-slate-950">Account Metrics</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {metricCards.slice(0, 5).map((card) => {
              const Icon = card.icon;
              const rawValue = metrics[card.key as keyof DashboardMetricsDto];
              const value = card.money ? formatPeso(String(rawValue)) : rawValue;

              return (
                <div key={card.key} className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-slate-600">{card.label}</span>
                    <span className={`flex size-9 items-center justify-center rounded-md ${card.tone}`}>
                      <Icon size={18} aria-hidden="true" />
                    </span>
                  </div>
                  <div className="mt-4 text-2xl font-semibold text-slate-950">{value as string}</div>
                </div>
              );
            })}
          </div>

          <h2 className="text-base font-semibold text-slate-950">Financial Metrics</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {metricCards.slice(5, 11).map((card) => {
              const Icon = card.icon;
              const rawValue = metrics[card.key as keyof DashboardMetricsDto];
              const value = card.money ? formatPeso(String(rawValue)) : rawValue;

              return (
                <div key={card.key} className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-slate-600">{card.label}</span>
                    <span className={`flex size-9 items-center justify-center rounded-md ${card.tone}`}>
                      <Icon size={18} aria-hidden="true" />
                    </span>
                  </div>
                  <div className="mt-4 text-2xl font-semibold text-slate-950">{value as string}</div>
                </div>
              );
            })}
          </div>

          <h2 className="text-base font-semibold text-slate-950">Collection Metrics</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {metricCards.slice(11).map((card) => {
              const Icon = card.icon;
              const rawValue = metrics[card.key as keyof DashboardMetricsDto];
              const value = card.money ? formatPeso(String(rawValue)) : rawValue;

              return (
                <div key={card.key} className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-slate-600">{card.label}</span>
                    <span className={`flex size-9 items-center justify-center rounded-md ${card.tone}`}>
                      <Icon size={18} aria-hidden="true" />
                    </span>
                  </div>
                  <div className="mt-4 text-2xl font-semibold text-slate-950">{value as string}</div>
                </div>
              );
            })}
          </div>

          <h2 className="text-base font-semibold text-slate-950">Aging Report</h2>
          <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
            <div className="space-y-3">
              {agingLabels.map((item) => {
                const value = metrics.aging[item.key as keyof typeof metrics.aging];
                const pct = (value / maxAging) * 100;

                return (
                  <div key={item.key}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-700">{item.label}</span>
                      <span className="text-slate-600">{value} accounts</span>
                    </div>
                    <div className="mt-1 h-3 w-full rounded-full bg-slate-100">
                      <div
                        className={`h-3 rounded-full transition-all ${item.color}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
