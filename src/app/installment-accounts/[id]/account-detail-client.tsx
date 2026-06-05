"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  Bike,
  ChevronDown,
  ChevronUp,
  Printer,
  ReceiptText,
  User,
  MapPin,
  Save,
  X,
  Hash,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { FieldError } from "@/components/field-error";
import { ConfirmModal } from "@/components/confirm-modal";
import { ErrorMessage, LoadingBlock, SuccessMessage } from "@/components/ui-state";
import { apiRequest } from "@/lib/client-api";
import { formatPeso } from "@/lib/money";
import { createPaymentSchema } from "@/lib/validation";
import { validateForm, clearFieldError, type FieldErrors } from "@/lib/form-validation";
import type {
  InstallmentAccountDto,
  InstallmentScheduleDto,
  PaymentDto,
  PenaltyRecordDto,
  DiscountRecordDto,
  AccountStatusValue,
  ScheduleStatusValue,
  PaymentMethod,
  PaymentTypeValue,
} from "@/types/api";

type AccountDetailResponse = { installmentAccount: InstallmentAccountDto };
type ScheduleResponse = { schedule: InstallmentScheduleDto[] };
type PaymentsResponse = { payments: PaymentDto[] };
type PenaltiesResponse = { penalties: PenaltyRecordDto[] };
type DiscountsResponse = { discounts: DiscountRecordDto[] };

const scheduleStatusStyles: Record<ScheduleStatusValue, string> = {
  PENDING: "border-slate-200 bg-white",
  PAID: "border-emerald-200 bg-emerald-50",
  OVERDUE: "border-rose-200 bg-rose-50",
  PARTIAL: "border-amber-200 bg-amber-50",
};

function todayDateOnly() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function InfoCard({ icon: Icon, label, value, valueClass }: { icon: any; label: string; value: React.ReactNode; valueClass?: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
        <Icon size={18} />
      </span>
      <div className="min-w-0">
        <div className="text-xs font-semibold font-heading uppercase tracking-wider text-slate-500">{label}</div>
        <div className={`mt-0.5 text-sm font-medium text-slate-900 truncate ${valueClass ?? ""}`}>{value}</div>
      </div>
    </div>
  );
}

function StatCard({ label, value, valueClass = "text-slate-900" }: { label: string; value: React.ReactNode; valueClass?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-semibold font-heading uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`mt-1.5 text-xl font-bold ${valueClass}`}>{value}</div>
    </div>
  );
}

export function AccountDetailClient({ accountId }: { accountId: string }) {
  const [account, setAccount] = useState<InstallmentAccountDto | null>(null);
  const [schedule, setSchedule] = useState<InstallmentScheduleDto[]>([]);
  const [payments, setPayments] = useState<PaymentDto[]>([]);
  const [penalties, setPenalties] = useState<PenaltyRecordDto[]>([]);
  const [discounts, setDiscounts] = useState<DiscountRecordDto[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [showSchedule, setShowSchedule] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    totalAmount: "",
    paymentDate: todayDateOnly(),
    method: "CASH" as PaymentMethod,
    paymentType: "REGULAR" as PaymentTypeValue,
    notes: "",
    cashier: "",
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [showPaymentConfirm, setShowPaymentConfirm] = useState(false);
  const [postError, setPostError] = useState("");
  const [postSuccess, setPostSuccess] = useState("");

  const loadData = useCallback(() => {
    let active = true;

    Promise.all([
      apiRequest<AccountDetailResponse>(`/api/installment-accounts/${accountId}`),
      apiRequest<ScheduleResponse>(`/api/installment-accounts/${accountId}/schedule`),
      apiRequest<PaymentsResponse>(`/api/installment-accounts/${accountId}/payments`),
      apiRequest<PenaltiesResponse>(`/api/installment-accounts/${accountId}/penalties`),
      apiRequest<DiscountsResponse>(`/api/installment-accounts/${accountId}/discounts`),
    ])
      .then(([a, s, p, pen, disc]) => {
        if (active) {
          setAccount(a.installmentAccount);
          setSchedule(s.schedule);
          setPayments(p.payments);
          setPenalties(pen.penalties);
          setDiscounts(disc.discounts);
        }
      })
      .catch((requestError: Error) => {
        if (active) setError(requestError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [accountId]);

  useEffect(() => {
    const cancel = loadData();
    return cancel;
  }, [loadData]);

  const formValid =
    form.totalAmount.trim() &&
    /^\d+(\.\d{1,2})?$/.test(form.totalAmount) &&
    Number(form.totalAmount) > 0 &&
    form.paymentDate;

  function handlePostPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!account) return;

    setPostError("");
    setPostSuccess("");

    const validation = validateForm(createPaymentSchema, {
      installmentAccountId: account.id,
      totalAmount: form.totalAmount,
      paymentDate: form.paymentDate,
      method: form.method,
      paymentType: form.paymentType,
      notes: form.notes || undefined,
      cashier: form.cashier || undefined,
    });

    if (!validation.success) {
      setFieldErrors(validation.errors);
      return;
    }

    setShowPaymentConfirm(true);
  }

  async function confirmPostPayment() {
    if (!account) return;

    setSaving(true);
    setPostError("");

    try {
      await apiRequest<{ payment: PaymentDto }>("/api/payments", {
        method: "POST",
        body: JSON.stringify({
          installmentAccountId: account.id,
          ...form,
        }),
      });

      setPostSuccess("Payment posted successfully.");
      setFieldErrors({});
      setForm({
        totalAmount: "",
        paymentDate: todayDateOnly(),
        method: "CASH",
        paymentType: "REGULAR",
        notes: "",
        cashier: "",
      });

      setShowPaymentConfirm(false);

      setTimeout(() => {
        setShowModal(false);
        setPostSuccess("");
        loadData();
      }, 800);
    } catch (requestError) {
      setPostError((requestError as Error).message);
      setShowPaymentConfirm(false);
    } finally {
      setSaving(false);
    }
  }

  function updatePaymentField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  function openModal() {
    setPostError("");
    setPostSuccess("");
    setForm((prev) => ({ ...prev, paymentDate: todayDateOnly() }));
    setShowModal(true);
  }

  if (loading) return <LoadingBlock label="Loading account" />;
  if (!account) return <ErrorMessage message={error || "Account not found"} />;

  const totalPaymentsAmount = payments.reduce((s, p) => s + Number(p.totalAmount), 0);
  const totalPenaltiesAmount = penalties.reduce((s, p) => s + Number(p.amount), 0);
  const totalDiscountsAmount = discounts.reduce((s, d) => s + Number(d.amount), 0);

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
  const daysOverdue = account.status === "OVERDUE"
    ? Math.floor(
        (new Date(today).getTime() - new Date(account.nextDueDate).getTime()) /
          (1000 * 60 * 60 * 24),
      )
    : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${account.brand} ${account.model}`}
        description={account.unitDescription}
        actions={
          <button
            type="button"
            onClick={openModal}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-800 px-4 text-sm font-medium text-white shadow-sm transition-all duration-150 hover:bg-blue-700 hover:shadow-md active:scale-[0.98]"
          >
            <ReceiptText size={16} aria-hidden="true" />
            Post Payment
          </button>
        }
      />

      {error ? <ErrorMessage message={error} /> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <InfoCard icon={User} label="Customer" value={
          <div>
            <div className="font-medium">{account.customerName}</div>
            <div className="text-xs text-slate-500 mt-0.5">{account.customerPhone}</div>
          </div>
        } />
        <InfoCard icon={MapPin} label="Address" value={account.customerAddress} />
        <InfoCard icon={Bike} label="Unit" value={`${account.brand} ${account.model}`} />
        <InfoCard icon={Hash} label="Term" value={`${account.term} months`} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Status" value={<StatusBadge status={account.status as AccountStatusValue} />} />
        <StatCard label="Remaining Balance" value={formatPeso(account.remainingBalance)} />
        <StatCard label="Next Due Date" value={account.nextDueDate} />
        <StatCard label="Days Overdue" value={String(daysOverdue)} valueClass={daysOverdue > 0 ? "text-rose-600" : "text-slate-900"} />
      </div>

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Cash Price" value={formatPeso(account.cashPrice)} />
        <StatCard label="Installment Price" value={formatPeso(account.installmentPrice)} />
        <StatCard label="Gross Profit" value={formatPeso(account.grossProfit)} valueClass="text-emerald-700" />
        <StatCard label="Down Payment" value={formatPeso(account.downPayment)} />
        <StatCard label="Monthly" value={formatPeso(account.monthlyInstallment)} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Total Payments" value={formatPeso(totalPaymentsAmount.toString())} valueClass="text-emerald-700" />
        <StatCard label="Total Penalties" value={formatPeso(totalPenaltiesAmount.toString())} valueClass="text-rose-700" />
        <StatCard label="Total Discounts" value={formatPeso(totalDiscountsAmount.toString())} valueClass="text-emerald-700" />
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <button
          type="button"
          onClick={() => setShowSchedule(!showSchedule)}
          className="flex w-full items-center justify-between px-5 py-3.5 text-left transition-colors hover:bg-slate-50"
        >
          <h2 className="text-sm font-semibold font-heading text-slate-900">Installment Schedule ({schedule.length} periods)</h2>
          {showSchedule ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
        </button>
        {showSchedule ? (
          <div className="divide-y divide-slate-100">
            {schedule.map((period) => (
              <div
                key={period.id}
                className={`px-5 py-3.5 transition-colors ${scheduleStatusStyles[period.status as ScheduleStatusValue]}`}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      period.status === "PAID" ? "bg-emerald-200 text-emerald-800" :
                      period.status === "OVERDUE" ? "bg-rose-200 text-rose-800" :
                      period.status === "PARTIAL" ? "bg-amber-200 text-amber-800" :
                      "bg-slate-200 text-slate-700"
                    }`}>
                      {period.periodNumber}
                    </span>
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{formatPeso(period.amount)}</div>
                      <div className="text-xs text-slate-500">Due: {period.dueDate}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusBadge status={period.status as ScheduleStatusValue} />
                    {period.penaltyAmount !== "0.00" ? (
                      <span className="inline-flex items-center rounded-lg border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700">
                        Pen: {formatPeso(period.penaltyAmount)}
                      </span>
                    ) : null}
                    {period.discountAmount !== "0.00" ? (
                      <span className="inline-flex items-center rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        Disc: {formatPeso(period.discountAmount)}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-3.5">
          <h2 className="text-sm font-semibold font-heading text-slate-900">Payment History</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {payments.map((payment) => (
            <div key={payment.id} className="px-5 py-3.5 transition-colors hover:bg-slate-50">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-slate-900">{formatPeso(payment.totalAmount)}</span>
                    <span className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600">
                      {payment.paymentType}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                    <span>{payment.paymentDate}</span>
                    <span>{payment.method}</span>
                    {payment.cashier ? <span>Cashier: {payment.cashier}</span> : null}
                  </div>
                  {payment.penaltyAmount !== "0.00" || payment.discountAmount !== "0.00" ? (
                    <div className="mt-1.5 flex flex-wrap gap-2 text-xs">
                      {payment.penaltyAmount !== "0.00" ? (
                        <span className="font-medium text-rose-600">Penalty: {formatPeso(payment.penaltyAmount)}</span>
                      ) : null}
                      {payment.discountAmount !== "0.00" ? (
                        <span className="font-medium text-emerald-600">Discount: {formatPeso(payment.discountAmount)}</span>
                      ) : null}
                    </div>
                  ) : null}
                  {payment.notes ? (
                    <div className="mt-1 text-xs text-slate-400 italic">{payment.notes}</div>
                  ) : null}
                </div>
                <Link
                  href={`/payments/${payment.id}/receipt`}
                  className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:border-slate-400 active:scale-[0.98]"
                >
                  <Printer size={14} />
                  Print
                </Link>
              </div>
            </div>
          ))}
        </div>
        {payments.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-slate-500">No payments yet.</div>
        ) : null}
      </section>

      {penalties.length > 0 ? (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-3.5">
            <h2 className="text-sm font-semibold font-heading text-rose-700">Penalty History</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {penalties.map((penalty) => (
              <div key={penalty.id} className="px-5 py-3 text-sm transition-colors hover:bg-slate-50">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-rose-700">{formatPeso(penalty.amount)}</span>
                  <span className="text-xs text-slate-500">{new Date(penalty.appliedDate).toLocaleDateString()}</span>
                </div>
                {penalty.reason ? <div className="mt-0.5 text-xs text-slate-400">{penalty.reason}</div> : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {discounts.length > 0 ? (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-3.5">
            <h2 className="text-sm font-semibold font-heading text-emerald-700">Discount History</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {discounts.map((discount) => (
              <div key={discount.id} className="px-5 py-3 text-sm transition-colors hover:bg-slate-50">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-emerald-700">{formatPeso(discount.amount)}</span>
                  <span className="text-xs text-slate-500">{new Date(discount.appliedDate).toLocaleDateString()}</span>
                </div>
                {discount.reason ? <div className="mt-0.5 text-xs text-slate-400">{discount.reason}</div> : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {showModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-base font-bold font-heading text-slate-900">Post Payment</h2>
                <p className="mt-0.5 text-sm text-slate-500">{account.brand} {account.model} — {account.customerName}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="flex size-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handlePostPayment} className="space-y-4 px-6 py-4">
              {postError ? <ErrorMessage message={postError} /> : null}
              {postSuccess ? <SuccessMessage message={postSuccess} /> : null}

              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Amount Paid
                  <input
                    required
                    inputMode="decimal"
                    value={form.totalAmount}
                    onChange={(e) => updatePaymentField("totalAmount", e.target.value.replace(/[^\d.]/g, ""))}
                    className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </label>
                <FieldError error={fieldErrors.totalAmount} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Payment Date
                    <input
                      required
                      type="date"
                      value={form.paymentDate}
                      onChange={(e) => updatePaymentField("paymentDate", e.target.value)}
                      className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </label>
                  <FieldError error={fieldErrors.paymentDate} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Payment Type
                    <select
                      value={form.paymentType}
                      onChange={(e) => updatePaymentField("paymentType", e.target.value)}
                      className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    >
                      <option value="REGULAR">Regular</option>
                      <option value="PARTIAL">Partial</option>
                      <option value="ADVANCE">Advance</option>
                      <option value="FULL">Full Payment</option>
                    </select>
                  </label>
                  <FieldError error={fieldErrors.paymentType} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Method
                    <select
                      value={form.method}
                      onChange={(e) => updatePaymentField("method", e.target.value)}
                      className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    >
                      <option value="CASH">Cash</option>
                      <option value="GCASH">GCash</option>
                      <option value="BANK">Bank</option>
                    </select>
                  </label>
                  <FieldError error={fieldErrors.method} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Cashier
                    <input
                      value={form.cashier}
                      onChange={(e) => updatePaymentField("cashier", e.target.value)}
                      className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Notes
                  <textarea
                    value={form.notes}
                    onChange={(e) => updatePaymentField("notes", e.target.value)}
                    className="mt-1.5 min-h-16 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="inline-flex h-10 items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-[0.98]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-800 px-4 text-sm font-medium text-white shadow-sm transition-all duration-150 hover:bg-blue-700 hover:shadow-md active:scale-[0.98]"
                >
                  <Save size={16} aria-hidden="true" />
                  Post Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <ConfirmModal
        open={showPaymentConfirm}
        title="Post Payment?"
        message={`${formatPeso(form.totalAmount || "0")} — ${form.paymentType} payment for ${account.brand} ${account.model}.`}
        confirmLabel="Yes, post payment"
        onConfirm={confirmPostPayment}
        onCancel={() => setShowPaymentConfirm(false)}
        loading={saving}
      />
    </div>
  );
}
