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
    href: "/api/reports/collections",
    label: "Collection Report",
    description: "All collections with customer and unit details",
    icon: FileText,
    external: true,
  },
  {
    href: "/api/reports/daily-collections",
    label: "Daily Collection Report",
    description: "Today's collections summary",
    icon: CalendarCheck,
    external: true,
  },
  {
    href: "/api/reports/monthly-collections",
    label: "Monthly Collection Report",
    description: "Monthly breakdown of collections",
    icon: CalendarCheck,
    external: true,
  },
  {
    href: "/api/reports/overdue-accounts",
    label: "Overdue Accounts Report",
    description: "Accounts past due date",
    icon: AlertTriangle,
    external: true,
  },
  {
    href: "/api/reports/penalties",
    label: "Penalty Report",
    description: "All penalty records",
    icon: ReceiptText,
    external: true,
  },
  {
    href: "/api/reports/discounts",
    label: "Discount Report",
    description: "All discount records",
    icon: TrendingUp,
    external: true,
  },
  {
    href: "/api/reports/outstanding-balances",
    label: "Outstanding Balance Report",
    description: "All active accounts with remaining balances",
    icon: DollarSign,
    external: true,
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
              {...(report.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className="rounded-md border border-slate-200 bg-white p-4 shadow-sm hover:border-slate-300 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-md bg-slate-100 text-slate-700">
                  <Icon size={20} aria-hidden="true" />
                </span>
                <div>
                  <div className="text-sm font-semibold text-slate-950">{report.label}</div>
                  <div className="text-xs text-slate-500">{report.description}</div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
