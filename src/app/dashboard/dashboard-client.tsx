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
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ErrorMessage, LoadingBlock } from "@/components/ui-state";
import { apiRequest } from "@/lib/client-api";
import { formatPeso } from "@/lib/money";
import type { DashboardMetricsDto } from "@/types/api";

const agingLabels = [
  { key: "current", label: "Current", color: "bg-emerald-500" },
  { key: "days1to30", label: "1-30 Days", color: "bg-amber-500" },
  { key: "days31to60", label: "31-60 Days", color: "bg-orange-500" },
  { key: "days61to90", label: "61-90 Days", color: "bg-rose-500" },
  { key: "days90plus", label: "90+ Days", color: "bg-red-600" },
] as const;

type MetricCardProps = {
  label: string;
  value: string | number;
  icon: any;
  color: string;
  size?: "normal" | "large";
};

function MetricCard({ label, value, icon: Icon, color, size = "normal" }: MetricCardProps) {
  return (
    <div className={`group rounded-xl border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${size === "large" ? "p-6" : "p-5"}`}>
      <div className="flex items-center justify-between">
        <span className={`font-medium text-slate-600 ${size === "large" ? "text-sm" : "text-sm"}`}>{label}</span>
        <span className={`flex items-center justify-center rounded-lg ring-1 ${color} ${size === "large" ? "size-11" : "size-9"}`}>
          <Icon size={size === "large" ? 20 : 17} aria-hidden="true" />
        </span>
      </div>
      <div className={`font-bold text-slate-900 ${size === "large" ? "mt-4 text-3xl" : "mt-3 text-2xl"}`}>{value}</div>
    </div>
  );
}

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
          {/* ── Account Health ── */}
          <section>
            <h2 className="text-sm font-semibold font-heading uppercase tracking-wider text-slate-500 mb-4">Account Health</h2>

            {/* Top row: Overdue + Due Today (large) side by side */}
            <div className="grid gap-4 sm:grid-cols-2 mb-4">
              <div className="rounded-xl border-2 border-rose-200 bg-rose-50 p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-rose-800">Overdue</span>
                  <span className="flex size-11 items-center justify-center rounded-lg bg-rose-100 text-rose-700 ring-1 ring-rose-300">
                    <AlertTriangle size={20} />
                  </span>
                </div>
                <div className="mt-4 text-3xl font-bold text-rose-900">{metrics.overdueAccounts}</div>
                <p className="mt-1 text-sm text-rose-700">
                  {metrics.overdueAccounts === 1 ? "1 account past due" : `${metrics.overdueAccounts} accounts past due`}
                </p>
              </div>

              <div className="rounded-xl border-2 border-amber-200 bg-amber-50 p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-amber-800">Due Today</span>
                  <span className="flex size-11 items-center justify-center rounded-lg bg-amber-100 text-amber-700 ring-1 ring-amber-300">
                    <ClockAlert size={20} />
                  </span>
                </div>
                <div className="mt-4 text-3xl font-bold text-amber-900">{metrics.dueTodayAccounts}</div>
                <p className="mt-1 text-sm text-amber-700">
                  {metrics.dueTodayAccounts === 1 ? "1 payment due today" : `${metrics.dueTodayAccounts} payments due today`}
                </p>
              </div>
            </div>

            {/* Bottom row: Active + Fully Paid + Total */}
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
              <MetricCard label="Active" value={metrics.activeAccounts} icon={CheckCircle2} color="bg-emerald-50 text-emerald-700 ring-emerald-200" />
              <MetricCard label="Fully Paid" value={metrics.fullyPaidAccounts} icon={Users} color="bg-sky-50 text-sky-700 ring-sky-200" />
              <MetricCard label="Total Accounts" value={metrics.totalAccounts} icon={Bike} color="bg-blue-50 text-blue-700 ring-blue-200" />
            </div>
          </section>

          {/* ── Financial Overview ── */}
          <section>
            <h2 className="text-sm font-semibold font-heading uppercase tracking-wider text-slate-500 mb-4">Financial Overview</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <MetricCard label="Installment Sales" value={formatPeso(metrics.totalInstallmentSales)} icon={TrendingUp} color="bg-violet-50 text-violet-700 ring-violet-200" />
              <MetricCard label="Gross Profit" value={formatPeso(metrics.totalInstallmentMargin)} icon={TrendingUp} color="bg-emerald-50 text-emerald-700 ring-emerald-200" />
              <MetricCard label="Down Payments" value={formatPeso(metrics.totalDownPayments)} icon={ArrowDownRight} color="bg-teal-50 text-teal-700 ring-teal-200" />

              {/* Collections card with mini breakdown */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-600">Collections</span>
                  <span className="flex size-9 items-center justify-center rounded-lg ring-1 bg-indigo-50 text-indigo-700 ring-indigo-200">
                    <PiggyBank size={17} />
                  </span>
                </div>
                <div className="mt-3 text-2xl font-bold text-slate-900">{formatPeso(metrics.totalCollections)}</div>
                <div className="mt-2 space-y-1 border-t border-slate-100 pt-2 text-xs text-slate-500">
                  <div className="flex justify-between">
                    <span>Today</span>
                    <span className="font-medium text-slate-700">{formatPeso(metrics.collectionsToday)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>This Week</span>
                    <span className="font-medium text-slate-700">{formatPeso(metrics.collectionsThisWeek)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>This Month</span>
                    <span className="font-medium text-slate-700">{formatPeso(metrics.collectionsThisMonth)}</span>
                  </div>
                </div>
              </div>

              <MetricCard label="Outstanding" value={formatPeso(metrics.outstandingBalances)} icon={Landmark} color="bg-orange-50 text-orange-700 ring-orange-200" />
              <MetricCard label="Penalties" value={formatPeso(metrics.totalPenaltiesCollected)} icon={ArrowUpRight} color="bg-rose-50 text-rose-700 ring-rose-200" />
              <MetricCard label="Discounts" value={formatPeso(metrics.totalDiscountsGranted)} icon={Percent} color="bg-emerald-50 text-emerald-700 ring-emerald-200" />
            </div>
          </section>

          {/* ── Aging Report ── */}
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
