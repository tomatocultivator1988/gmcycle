import type { AccountStatusValue, ScheduleStatusValue } from "@/types/api";

type BadgeStatus = AccountStatusValue | ScheduleStatusValue;

const statusClasses: Record<string, string> = {
  ACTIVE: "border-emerald-200 bg-emerald-50 text-emerald-700",
  DUE_TODAY: "border-amber-200 bg-amber-50 text-amber-700",
  OVERDUE: "border-rose-200 bg-rose-50 text-rose-700",
  FULLY_PAID: "border-slate-200 bg-slate-100 text-slate-700",
  PAID: "border-slate-200 bg-slate-100 text-slate-700",
  PENDING: "border-slate-200 bg-white text-slate-600",
  PARTIAL: "border-amber-200 bg-amber-50 text-amber-700",
};

export function StatusBadge({ status }: { status: BadgeStatus }) {
  return (
    <span
      className={`inline-flex min-w-20 items-center justify-center rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClasses[status] || statusClasses.ACTIVE}`}
    >
      {status === "FULLY_PAID" ? "FULLY PAID" : status === "DUE_TODAY" ? "DUE TODAY" : status}
    </span>
  );
}
