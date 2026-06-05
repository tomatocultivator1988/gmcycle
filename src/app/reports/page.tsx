import Link from "next/link";
import {
  FileText,
  CalendarCheck,
  AlertTriangle,
  ReceiptText,
  TrendingUp,
  DollarSign,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";

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
    label: "Overdue Accounts Report",
    description: "Accounts past due date",
    icon: AlertTriangle,
  },
  {
    href: "/reports/penalties",
    label: "Penalty Report",
    description: "All penalty records",
    icon: ReceiptText,
  },
  {
    href: "/reports/discounts",
    label: "Discount Report",
    description: "All discount records",
    icon: TrendingUp,
  },
  {
    href: "/reports/outstanding-balances",
    label: "Outstanding Balance Report",
    description: "All active accounts with remaining balances",
    icon: DollarSign,
  },
];

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Reports" description="GM Cycle reports and data exports" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {reportLinks.map((report) => {
          const Icon = report.icon;

          return (
            <Link
              key={report.href}
              href={report.href}
              className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
            >
              <div className="flex items-center gap-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700 ring-1 ring-blue-200 transition-colors group-hover:bg-blue-100">
                  <Icon size={21} aria-hidden="true" />
                </span>
                <div>
                  <div className="text-sm font-bold font-heading text-slate-900 group-hover:text-blue-800 transition-colors">{report.label}</div>
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
