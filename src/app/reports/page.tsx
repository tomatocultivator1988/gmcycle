"use client";

import { useState } from "react";
import Link from "next/link";
import {
  FileText,
  CalendarCheck,
  AlertTriangle,
  ReceiptText,
  TrendingUp,
  DollarSign,
  Mail,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { apiRequest } from "@/lib/client-api";

const reportLinks = [
  {
    href: "/reports/collections",
    label: "Collection Report",
    description: "All collections with customer and unit details",
    icon: FileText,
  },
  {
    href: "/reports/daily-collections",
    label: "Daily Collection Report",
    description: "Today's collections summary",
    icon: CalendarCheck,
  },
  {
    href: "/reports/monthly-collections",
    label: "Monthly Collection Report",
    description: "Monthly breakdown of collections",
    icon: CalendarCheck,
  },
  {
    href: "/reports/overdue-accounts",
    label: "Due Date Monitoring",
    description: "All active accounts sorted by due date — filter by any date to see who paid and who hasn't",
    icon: AlertTriangle,
  },
  {
    href: "/reports/penalties",
    label: "Penalty Report",
    description: "All penalty records",
    icon: ReceiptText,
  },
  {
    href: "/reports/outstanding-balances",
    label: "Outstanding Balance Report",
    description: "All active accounts with remaining balances",
    icon: DollarSign,
  },
];

export default function ReportsPage() {
  const [sendingProfit, setSendingProfit] = useState(false);
  const [profitResult, setProfitResult] = useState<string | null>(null);

  async function sendGrossProfitEmail() {
    setSendingProfit(true);
    setProfitResult(null);
    try {
      const data = await apiRequest<{ message: string }>("/api/reports/gross-profit/email", { method: "POST" });
      setProfitResult(data.message);
    } catch (e) {
      setProfitResult("Failed to send");
    } finally {
      setSendingProfit(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" description="MyFaveGadgets reports and data exports"
        actions={
          <button
            type="button"
            onClick={sendGrossProfitEmail}
            disabled={sendingProfit}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-red-800 px-4 text-sm font-medium text-white shadow-sm transition-all hover:bg-red-700 hover:shadow-md active:scale-[0.98] disabled:opacity-50"
          >
            <Mail size={16} />
            {sendingProfit ? "Sending..." : "Email Gross Profit"}
          </button>
        }
      />

      {profitResult ? <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2">{profitResult}</div> : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {reportLinks.map((report) => {
          const Icon = report.icon;

          return (
            <Link
              key={report.href}
              href={report.href}
              className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
            >
              <div className="flex items-center gap-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-700 ring-1 ring-red-200 transition-colors group-hover:bg-red-100">
                  <Icon size={21} aria-hidden="true" />
                </span>
                <div>
                  <div className="text-sm font-bold font-heading text-slate-900 group-hover:text-red-800 transition-colors">{report.label}</div>
                  <div className="mt-0.5 text-xs text-slate-500">{report.description}</div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
