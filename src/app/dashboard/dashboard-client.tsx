"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Smartphone,
  AlertTriangle,
  CheckCircle2,
  PiggyBank,
  Landmark,
  Users,
  TrendingUp,
  BadgeDollarSign,
  ArrowUpRight,
  Clock,
  FileText,
  BarChart3,
} from "lucide-react";
import { ErrorMessage, LoadingBlock } from "@/components/ui-state";
import { apiRequest } from "@/lib/client-api";
import { formatPeso } from "@/lib/money";
import type { DashboardMetricsDto } from "@/types/api";

function StatCard({ label, value, icon: Icon, trend, color, bgGradient }: {
  label: string; value: string | number; icon: any; trend?: string; color: string; bgGradient: string;
}) {
  return (
    <div className={`relative overflow-hidden rounded-2xl p-6 text-white shadow-lg ${bgGradient}`}>
      <div className="absolute -right-2 -top-2 size-20 rounded-full bg-white/10" />
      <div className="absolute -right-4 -bottom-4 size-24 rounded-full bg-white/5" />
      <div className="relative">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-white/80">{label}</span>
          <div className={`flex size-10 items-center justify-center rounded-xl ${color}`}>
            <Icon size={20} />
          </div>
        </div>
        <div className="mt-4 text-4xl font-bold tracking-tight">{value}</div>
        {trend ? (
          <div className="mt-2 flex items-center gap-1 text-xs font-medium text-white/70">
            <ArrowUpRight size={12} /> {trend}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function CompactCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className={`rounded-xl border-l-4 bg-white p-4 shadow-sm ${color}`}>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

const statuses = [
  { key: "appliedAccounts" as const, label: "Applied", color: "bg-red-500", ring: "ring-red-100", icon: FileText },
  { key: "activeAccounts" as const, label: "Active", color: "bg-emerald-500", ring: "ring-emerald-100", icon: CheckCircle2 },
  { key: "dueTodayAccounts" as const, label: "Due Today", color: "bg-amber-500", ring: "ring-amber-100", icon: Clock },
  { key: "overdueAccounts" as const, label: "Overdue", color: "bg-rose-500", ring: "ring-rose-100", icon: AlertTriangle },
  { key: "fullyPaidAccounts" as const, label: "Paid", color: "bg-slate-500", ring: "ring-slate-100", icon: CheckCircle2 },
];

export function DashboardClient() {
  const [metrics, setMetrics] = useState<DashboardMetricsDto | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiRequest<{ metrics: DashboardMetricsDto }>("/api/dashboard")
      .then((data) => setMetrics(data.metrics))
      .catch((requestError: Error) => setError(requestError.message));
  }, []);

  const now = new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila", year: "numeric", month: "long", day: "numeric", weekday: "long",
  }).format(new Date());

  if (error) return <ErrorMessage message={error} />;
  if (!metrics) return <LoadingBlock label="Loading dashboard" />;

  const overduePct = metrics.totalAccounts > 0
    ? Math.round((metrics.overdueAccounts / metrics.totalAccounts) * 100) : 0;
  const collectionRate = Number(metrics.totalCollections || "0") > 0 && Number(metrics.totalInstallmentSales || "0") > 0
    ? Math.round((Number(metrics.totalCollections) / Number(metrics.totalInstallmentSales)) * 100) : 0;

  return (
    <div className="space-y-8 pb-8">
      {/* ── HEADER ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">{now}</p>
        </div>
        <Link
          href="/installment-accounts/new"
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-red-800 px-5 text-sm font-semibold text-white shadow-lg shadow-red-200 transition-all hover:bg-red-700 hover:shadow-xl hover:shadow-red-200 active:scale-[0.98]"
        >
          <Smartphone size={18} />
          New Account
        </Link>
      </div>

      {/* ── KPI HERO ROW ── */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Accounts" value={metrics.totalAccounts}
          icon={Users} color="bg-white/20" bgGradient="bg-gradient-to-br from-red-600 to-red-800" />
        <StatCard label="Active Accounts" value={metrics.activeAccounts}
          icon={CheckCircle2} color="bg-white/20" bgGradient="bg-gradient-to-br from-emerald-600 to-emerald-800"
          trend={`${overduePct}% overdue`} />
        <StatCard label="Collections (Month)" value={formatPeso(metrics.collectionsThisMonth)}
          icon={PiggyBank} color="bg-white/20" bgGradient="bg-gradient-to-br from-red-700 to-red-900" />
        <StatCard label="Outstanding" value={formatPeso(metrics.outstandingBalances)}
          icon={Landmark} color="bg-white/20" bgGradient="bg-gradient-to-br from-slate-700 to-slate-900"
          trend={collectionRate > 0 ? `${collectionRate}% collected` : undefined} />
      </div>

      {/* ── STATUS BREAKDOWN + FINANCIAL ── */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Status Breakdown */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
          <h3 className="text-sm font-bold text-slate-900">Account Status Breakdown</h3>
          <p className="mt-0.5 text-xs text-slate-500">{metrics.totalAccounts} total accounts</p>
          <div className="mt-5 space-y-3">
            {statuses.map((s) => {
              const val = metrics[s.key];
              const max = Math.max(metrics.totalAccounts, 1);
              const pct = Math.round((val / max) * 100);
              const Icon = s.icon;
              return (
                <div key={s.key}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className={`flex size-5 items-center justify-center rounded-md ${s.color} ${s.ring}`}>
                        <Icon size={11} className="text-white" />
                      </span>
                      <span className="font-medium text-slate-700">{s.label}</span>
                    </div>
                    <span className="font-bold text-slate-900">{val} <span className="text-slate-400 font-normal">({pct}%)</span></span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-2 rounded-full transition-all duration-700 ${s.color}`}
                      style={{ width: `${Math.max(pct, 2)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Financial Summary */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-3">
          <h3 className="text-sm font-bold text-slate-900">Financial Summary</h3>
          <p className="mt-0.5 text-xs text-slate-500">Installment sales, collections, and penalties</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <CompactCard label="Installment Sales" value={formatPeso(metrics.totalInstallmentSales)} color="border-l-red-500" />
            <CompactCard label="Gross Profit" value={formatPeso(metrics.totalInstallmentMargin)} color="border-l-emerald-500" />
            <CompactCard label="Down Payments" value={formatPeso(metrics.totalDownPayments)} color="border-l-red-400" />
            <CompactCard label="Total Collections" value={formatPeso(metrics.totalCollections)} color="border-l-red-600" />
            <CompactCard label="Penalties Collected" value={formatPeso(metrics.totalPenaltiesCollected)} color="border-l-rose-500" />
            <CompactCard label="Outstanding Balance" value={formatPeso(metrics.outstandingBalances)} color="border-l-orange-500" />
          </div>
        </div>
      </div>

      {/* ── COLLECTIONS TIMELINE + AGING ── */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Collections Timeline */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900">Collections</h3>
          <div className="mt-5 grid grid-cols-3 gap-4">
            {[
              { label: "Today", value: formatPeso(metrics.collectionsToday), accent: "text-red-600" },
              { label: "This Week", value: formatPeso(metrics.collectionsThisWeek), accent: "text-amber-600" },
              { label: "This Month", value: formatPeso(metrics.collectionsThisMonth), accent: "text-emerald-600" },
            ].map((c) => (
              <div key={c.label} className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-center">
                <p className="text-xs font-medium text-slate-500">{c.label}</p>
                <p className={`mt-1.5 text-lg font-bold ${c.accent}`}>{c.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Aging */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Delinquency Aging</h3>
              <p className="mt-0.5 text-xs text-slate-500">{metrics.overdueAccounts} overdue accounts</p>
            </div>
            <BarChart3 size={20} className="text-slate-400" />
          </div>
          <div className="mt-5 flex items-end gap-3 h-28">
            {([
              { val: metrics.aging.current, label: "Current", color: "bg-emerald-400" },
              { val: metrics.aging.days1to30, label: "1-30d", color: "bg-amber-400" },
              { val: metrics.aging.days31to60, label: "31-60d", color: "bg-orange-400" },
              { val: metrics.aging.days61to90, label: "61-90d", color: "bg-rose-400" },
              { val: metrics.aging.days90plus, label: "90d+", color: "bg-red-700" },
            ]).map((bar) => {
              const maxVal = Math.max(
                metrics.aging.current, metrics.aging.days1to30, metrics.aging.days31to60,
                metrics.aging.days61to90, metrics.aging.days90plus, 1,
              );
              const h = (bar.val / maxVal) * 100;
              return (
                <div key={bar.label} className="flex-1 flex flex-col items-center justify-end gap-2">
                  <span className="text-xs font-bold text-slate-700">{bar.val}</span>
                  <div className={`w-full rounded-t-lg transition-all duration-700 ${bar.color}`}
                    style={{ height: `${Math.max(h, 4)}%`, minHeight: 4 }} />
                  <span className="text-[10px] font-medium text-slate-500">{bar.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── QUICK ACTIONS ── */}
      <div className="flex flex-wrap gap-3">
        {[
          { href: "/installment-accounts", label: "View All Accounts", icon: Users },
          { href: "/payments", label: "Payment Records", icon: BadgeDollarSign },
          { href: "/reports", label: "Reports & Exports", icon: TrendingUp },
        ].map((link) => (
          <Link key={link.href} href={link.href}
            className="inline-flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-700 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 hover:shadow-md">
            <link.icon size={16} className="text-slate-400" />
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
