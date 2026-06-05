"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  Bike,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Printer,
  ReceiptText,
  User,
  Phone,
  MapPin,
  CreditCard,
  Save,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { ErrorMessage, LoadingBlock, SuccessMessage } from "@/components/ui-state";
import { apiRequest } from "@/lib/client-api";
import { formatPeso } from "@/lib/money";
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

  async function handlePostPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!formValid || !account) return;

    setSaving(true);
    setPostError("");
    setPostSuccess("");

    try {
      await apiRequest<{ payment: PaymentDto }>("/api/payments", {
        method: "POST",
        body: JSON.stringify({
          installmentAccountId: account.id,
          ...form,
        }),
      });

      setPostSuccess("Payment posted successfully.");
      setForm({
        totalAmount: "",
        paymentDate: todayDateOnly(),
        method: "CASH",
          paymentType: "REGULAR",
        notes: "",
        cashier: "",
      });

      setTimeout(() => {
        setShowModal(false);
        setPostSuccess("");
        loadData();
      }, 800);
    } catch (requestError) {
      setPostError((requestError as Error).message);
    } finally {
      setSaving(false);
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
            className="inline-flex h-10 items-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-medium text-white hover:bg-slate-800"
          >
            <ReceiptText size={16} aria-hidden="true" />
            Post Payment
          </button>
        }
      />

      {error ? <ErrorMessage message={error} /> : null}

      <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-xs font-semibold uppercase text-slate-500">Customer Information</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex items-center gap-2 text-sm">
            <User size={16} className="text-slate-400" />
            <span className="font-medium text-slate-950">{account.customerName}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Phone size={16} className="text-slate-400" />
            <span className="text-slate-700">{account.customerPhone}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <MapPin size={16} className="text-slate-400" />
            <span className="text-slate-700">{account.customerAddress}</span>
          </div>

        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase text-slate-500">Account Status</div>
          <div className="mt-2"><StatusBadge status={account.status as AccountStatusValue} /></div>
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase text-slate-500">Remaining Balance</div>
          <div className="mt-2 text-2xl font-semibold text-slate-950">{formatPeso(account.remainingBalance)}</div>
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase text-slate-500">Next Due Date</div>
          <div className="mt-2 flex items-center gap-2 text-lg font-semibold text-slate-950">
            <CalendarDays size={18} aria-hidden="true" />
            {account.nextDueDate}
          </div>
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase text-slate-500">Days Overdue</div>
          <div className="mt-2 text-2xl font-semibold text-slate-950">{daysOverdue}</div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase text-slate-500">Installment Price</div>
          <div className="mt-1 font-semibold text-slate-950">{formatPeso(account.installmentPrice)}</div>
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase text-slate-500">Down Payment</div>
          <div className="mt-1 font-semibold text-slate-950">{formatPeso(account.downPayment)}</div>
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase text-slate-500">Monthly Installment</div>
          <div className="mt-1 font-semibold text-slate-950">{formatPeso(account.monthlyInstallment)}</div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase text-slate-500">Total Payments</div>
          <div className="mt-1 font-semibold text-emerald-700">{formatPeso(totalPaymentsAmount.toString())}</div>
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase text-slate-500">Total Penalties</div>
          <div className="mt-1 font-semibold text-rose-700">{formatPeso(totalPenaltiesAmount.toString())}</div>
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase text-slate-500">Total Discounts</div>
          <div className="mt-1 font-semibold text-emerald-700">{formatPeso(totalDiscountsAmount.toString())}</div>
        </div>
      </div>

      <section className="rounded-md border border-slate-200 bg-white shadow-sm">
        <button
          type="button"
          onClick={() => setShowSchedule(!showSchedule)}
          className="flex w-full items-center justify-between border-b border-slate-200 px-4 py-3 text-left"
        >
          <h2 className="text-base font-semibold text-slate-950">Installment Schedule ({schedule.length} periods)</h2>
          {showSchedule ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
        {showSchedule ? (
          <div className="divide-y divide-slate-200">
            {schedule.map((period) => (
              <div
                key={period.id}
                className={`p-4 ${scheduleStatusStyles[period.status as ScheduleStatusValue]}`}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex size-8 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-700">
                      {period.periodNumber}
                    </span>
                    <div>
                      <div className="font-medium text-slate-950">{formatPeso(period.amount)}</div>
                      <div className="text-sm text-slate-500">Due: {period.dueDate}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={period.status as AccountStatusValue} />
                    {period.penaltyAmount !== "0.00" ? (
                      <span className="text-xs font-medium text-rose-700">Pen: {formatPeso(period.penaltyAmount)}</span>
                    ) : null}
                    {period.discountAmount !== "0.00" ? (
                      <span className="text-xs font-medium text-emerald-700">Disc: {formatPeso(period.discountAmount)}</span>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="rounded-md border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-base font-semibold text-slate-950">Payment History</h2>
        </div>
        <div className="divide-y divide-slate-200">
          {payments.map((payment) => (
            <div key={payment.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="font-medium text-slate-950">{formatPeso(payment.totalAmount)}</div>
                  <div className="text-sm text-slate-500">
                    {payment.paymentDate} — {payment.method}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-medium">
                      {payment.paymentType}
                    </span>
                    {payment.penaltyAmount !== "0.00" ? (
                      <span className="rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 font-medium text-rose-700">
                        Penalty: {formatPeso(payment.penaltyAmount)}
                      </span>
                    ) : null}
                    {payment.discountAmount !== "0.00" ? (
                      <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">
                        Discount: {formatPeso(payment.discountAmount)}
                      </span>
                    ) : null}
                    {payment.cashier ? (
                      <span className="text-slate-400">Cashier: {payment.cashier}</span>
                    ) : null}
                  </div>
                </div>
                <Link
                  href={`/payments/${payment.id}/receipt`}
                  className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 px-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  <Printer size={14} />
                  Print
                </Link>
              </div>
            </div>
          ))}
        </div>
        {payments.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-slate-500">No payments yet.</div>
        ) : null}
      </section>

      {penalties.length > 0 ? (
        <section className="rounded-md border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-base font-semibold text-rose-700">Penalty History</h2>
          </div>
          <div className="divide-y divide-slate-200">
            {penalties.map((penalty) => (
              <div key={penalty.id} className="p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-rose-700">{formatPeso(penalty.amount)}</span>
                  <span className="text-slate-500">{new Date(penalty.appliedDate).toLocaleDateString()}</span>
                </div>
                {penalty.reason ? <div className="text-xs text-slate-400">{penalty.reason}</div> : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {discounts.length > 0 ? (
        <section className="rounded-md border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-base font-semibold text-emerald-700">Discount History</h2>
          </div>
          <div className="divide-y divide-slate-200">
            {discounts.map((discount) => (
              <div key={discount.id} className="p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-emerald-700">{formatPeso(discount.amount)}</span>
                  <span className="text-slate-500">{new Date(discount.appliedDate).toLocaleDateString()}</span>
                </div>
                {discount.reason ? <div className="text-xs text-slate-400">{discount.reason}</div> : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {showModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-slate-950">Post Payment</h2>
                <p className="text-sm text-slate-500">{account.brand} {account.model} — {account.customerName}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="flex size-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handlePostPayment} className="space-y-4 px-5 py-4">
              {postError ? <ErrorMessage message={postError} /> : null}
              {postSuccess ? <SuccessMessage message={postSuccess} /> : null}

              <div className="grid grid-cols-2 gap-4">
                <label className="block text-sm font-medium text-slate-700">
                  Amount Paid
                  <input
                    required
                    inputMode="decimal"
                    value={form.totalAmount}
                    onChange={(e) => setForm({ ...form, totalAmount: e.target.value.replace(/[^\d.]/g, "") })}
                    className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-950"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <label className="block text-sm font-medium text-slate-700">
                  Payment Date
                  <input
                    required
                    type="date"
                    value={form.paymentDate}
                    onChange={(e) => setForm({ ...form, paymentDate: e.target.value })}
                    className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-950"
                  />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Payment Type
                  <select
                    value={form.paymentType}
                    onChange={(e) => setForm({ ...form, paymentType: e.target.value as PaymentTypeValue })}
                    className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-950"
                  >
                    <option value="REGULAR">Regular</option>
                    <option value="PARTIAL">Partial</option>
                    <option value="ADVANCE">Advance</option>
                    <option value="FULL">Full Payment</option>
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <label className="block text-sm font-medium text-slate-700">
                  Method
                  <select
                    value={form.method}
                    onChange={(e) => setForm({ ...form, method: e.target.value as PaymentMethod })}
                    className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-950"
                  >
                    <option value="CASH">Cash</option>
                    <option value="GCASH">GCash</option>
                    <option value="BANK">Bank</option>
                  </select>
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Cashier
                  <input
                    value={form.cashier}
                    onChange={(e) => setForm({ ...form, cashier: e.target.value })}
                    className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-950"
                  />
                </label>
              </div>

              <label className="block text-sm font-medium text-slate-700">
                Notes
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="mt-1 min-h-16 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-950"
                />
              </label>

              <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="inline-flex h-10 items-center rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!formValid || saving}
                  className="inline-flex h-10 items-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-medium text-white hover:bg-slate-800 disabled:bg-slate-300"
                >
                  <Save size={16} aria-hidden="true" />
                  {saving ? "Posting..." : "Post Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
