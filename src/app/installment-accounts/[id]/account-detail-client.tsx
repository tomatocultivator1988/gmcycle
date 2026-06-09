"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  Smartphone,
  ChevronDown,
  ChevronUp,
  Printer,
  ReceiptText,
  User,
  MapPin,
  Save,
  X,
  Hash,
  AlertTriangle,
  Check,
  UserCheck,
  FileText,
  Pencil,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { FieldError } from "@/components/field-error";
import { ConfirmModal } from "@/components/confirm-modal";
import { ErrorMessage, LoadingBlock, SuccessMessage } from "@/components/ui-state";
import { apiRequest } from "@/lib/client-api";
import { formatPeso } from "@/lib/money";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import { createPaymentSchema } from "@/lib/validation";
import { validateForm, type FieldErrors } from "@/lib/form-validation";
import type {
  InstallmentAccountDto,
  InstallmentScheduleDto,
  PaymentDto,
  PenaltyRecordDto,
  AccountStatusValue,
  ScheduleStatusValue,
  PaymentMethod,
  PaymentTypeValue,
} from "@/types/api";

type AccountDetailResponse = { installmentAccount: InstallmentAccountDto };
type ScheduleResponse = { schedule: InstallmentScheduleDto[] };
type PaymentsResponse = { payments: PaymentDto[] };
type PenaltiesResponse = { penalties: PenaltyRecordDto[] };

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
    <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:shadow-md">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-600">
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
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:shadow-md">
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
    proofUrl: "",
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [showPaymentConfirm, setShowPaymentConfirm] = useState(false);
  const [postError, setPostError] = useState("");
  const [postSuccess, setPostSuccess] = useState("");
  const [penaltyPeriodId, setPenaltyPeriodId] = useState<string | null>(null);
  const [penaltyAmount, setPenaltyAmount] = useState("");
  const [applyingPenalty, setApplyingPenalty] = useState(false);
  const [showPenaltyModal, setShowPenaltyModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [editForm, setEditForm] = useState({
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    customerAddress: "",
    brand: "",
    model: "",
    unitDescription: "",
  });
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [requirements, setRequirements] = useState<Record<string, boolean>>({
    validId: false,
    selfie: false,
    proofOfIncome: false,
    proofOfAddress: false,
    residencePhoto: false,
  });
  const [activating, setActivating] = useState(false);

  const loadData = useCallback(() => {
    let active = true;

    Promise.all([
      apiRequest<AccountDetailResponse>(`/api/installment-accounts/${accountId}`),
      apiRequest<ScheduleResponse>(`/api/installment-accounts/${accountId}/schedule`),
      apiRequest<PaymentsResponse>(`/api/installment-accounts/${accountId}/payments`),
      apiRequest<PenaltiesResponse>(`/api/installment-accounts/${accountId}/penalties`),
    ])
      .then(([a, s, p, pen]) => {
        if (active) {
          setAccount(a.installmentAccount);
          setSchedule(s.schedule);
          setPayments(p.payments);
          setPenalties(pen.penalties);
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

  useBodyScrollLock(showModal || showPenaltyModal || showEditModal);

  async function handlePostPayment(event: FormEvent<HTMLFormElement>) {
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

    // Upload proof file first if present, then confirm
    if (proofFile) {
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", proofFile);
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Upload failed");
        setForm((prev) => ({ ...prev, proofUrl: data.url }));
        setUploading(false);
        setShowPaymentConfirm(true);
      } catch (uploadError) {
        setPostError((uploadError as Error).message);
        setUploading(false);
        return;
      }
    } else {
      setShowPaymentConfirm(true);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setProofFile(file);
    setProofPreview(URL.createObjectURL(file));
  }

  async function uploadProof(): Promise<string | null> {
    if (!proofFile) return null;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", proofFile);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      return data.url as string;
    } catch (uploadError) {
      setPostError((uploadError as Error).message);
      return null;
    } finally {
      setUploading(false);
    }
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
          proofUrl: form.proofUrl || undefined,
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
        proofUrl: "",
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
    setProofFile(null);
    setProofPreview(null);
    setShowModal(true);
  }

  function openPenaltyModal(periodId: string) {
    setPenaltyPeriodId(periodId);
    setPenaltyAmount("200");
    setShowPenaltyModal(true);
  }

  function openEditModal() {
    if (!account) return;
    setEditError("");
    setEditForm({
      customerName: account.customerName,
      customerPhone: account.customerPhone,
      customerEmail: account.customerEmail ?? "",
      customerAddress: account.customerAddress,
      brand: account.brand,
      model: account.model,
      unitDescription: account.unitDescription,
    });
    setShowEditModal(true);
  }

  async function confirmEdit() {
    if (!account) return;
    setEditSaving(true);
    setEditError("");
    try {
      const data = await apiRequest<{ installmentAccount: InstallmentAccountDto }>(
        `/api/installment-accounts/${account.id}`,
        { method: "PATCH", body: JSON.stringify(editForm) },
      );
      setAccount(data.installmentAccount);
      setShowEditModal(false);
    } catch (requestError) {
      setEditError((requestError as Error).message);
    } finally {
      setEditSaving(false);
    }
  }

  async function confirmApplyPenalty() {
    if (!penaltyPeriodId || !account) return;
    setApplyingPenalty(true);
    try {
      await apiRequest(`/api/installment-accounts/${account.id}/apply-penalty`, {
        method: "POST",
        body: JSON.stringify({
          periodId: penaltyPeriodId,
          amount: penaltyAmount,
        }),
      });
      setShowPenaltyModal(false);
      setPenaltyPeriodId(null);
      loadData();
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setApplyingPenalty(false);
    }
  }

  async function handleActivate() {
    if (!account) return;
    setActivating(true);
    try {
      await apiRequest<{ installmentAccount: InstallmentAccountDto }>(
        `/api/installment-accounts/${account.id}/activate`,
        { method: "PATCH" },
      );
      loadData();
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setActivating(false);
    }
  }

  const allRequirementsMet = Object.values(requirements).every(Boolean);

  const requirementsList = [
    { key: "validId" as const, label: "Valid Government ID (UMID, PhilHealth, Driver's License, Passport, National ID)" },
    { key: "selfie" as const, label: "Selfie with ID" },
    { key: "proofOfIncome" as const, label: "Proof of Income (Latest 1 month Payslip, COE, or 2 months Bank Statement)" },
    { key: "proofOfAddress" as const, label: "Proof of Address (Electric or Water Bill)" },
    { key: "residencePhoto" as const, label: "Clear photo showing exterior view of residence" },
  ];

  if (loading) return <LoadingBlock label="Loading account" />;
  if (!account) return <ErrorMessage message={error || "Account not found"} />;

  const totalPaymentsAmount = payments.reduce((s, p) => s + Number(p.totalAmount), 0);
  const totalPenaltiesAmount = penalties.reduce((s, p) => s + Number(p.amount), 0);

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
          <div className="flex items-center gap-2">
            <Link
              href={`/installment-accounts/${account.id}/statement`}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-[0.98]"
            >
              <FileText size={16} aria-hidden="true" />
              Statement
            </Link>
            <button
              type="button"
              onClick={openEditModal}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-[0.98]"
            >
              <Pencil size={16} aria-hidden="true" />
              Edit
            </button>
            {account.status !== "APPLIED" ? (
              <button
                type="button"
                onClick={openModal}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-red-800 px-4 text-sm font-medium text-white shadow-sm transition-all duration-150 hover:bg-red-700 hover:shadow-md active:scale-[0.98]"
              >
                <ReceiptText size={16} aria-hidden="true" />
                Post Payment
              </button>
            ) : null}
          </div>
        }
      />

      {error ? <ErrorMessage message={error} /> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <InfoCard icon={User} label="Customer" value={
          <div>
            <div className="font-medium">{account.customerName}</div>
            <div className="text-xs text-slate-500 mt-0.5">{account.customerPhone}</div>
            {account.customerEmail ? <div className="text-xs text-slate-400 mt-0.5">{account.customerEmail}</div> : null}
          </div>
        } />
        <InfoCard icon={MapPin} label="Address" value={account.customerAddress} />
        <InfoCard icon={Smartphone} label="Device" value={`${account.brand} ${account.model}`} />
        <InfoCard icon={Hash} label="Term" value={`${account.term} months`} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Status" value={<StatusBadge status={account.status as AccountStatusValue} />} />
        <StatCard label="Remaining Balance" value={formatPeso(account.remainingBalance)} />
        <StatCard label="Next Due Date" value={account.nextDueDate} />
        <StatCard label="Days Overdue" value={String(daysOverdue)} valueClass={daysOverdue > 0 ? "text-rose-600" : "text-slate-900"} />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-xs font-semibold font-heading uppercase tracking-wider text-slate-500 mb-2">Pricing</div>
        <div className="inline-flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700">
          {account.pricingType === "INTEREST_PERCENTAGE"
            ? `Interest ${account.interestRate}%`
            : "Flat Rate"}
        </div>
      </div>

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Cash Price" value={formatPeso(account.cashPrice)} />
        <StatCard label="Installment Price" value={formatPeso(account.installmentPrice)} />
        <StatCard label="Gross Profit" value={formatPeso(account.grossProfit)} valueClass="text-emerald-700" />
        <StatCard label="Down Payment" value={formatPeso(account.downPayment)} />
        <StatCard label="Monthly" value={formatPeso(account.monthlyInstallment)} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <StatCard label="Total Payments" value={formatPeso(totalPaymentsAmount.toString())} valueClass="text-emerald-700" />
        <StatCard label="Total Penalties" value={formatPeso(totalPenaltiesAmount.toString())} valueClass="text-rose-700" />
      </div>

      {account.status === "APPLIED" ? (
        <section className="rounded-2xl border border-red-200 bg-gradient-to-br from-red-50 to-red-100/50 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <span className="flex size-10 items-center justify-center rounded-2xl bg-red-100 text-red-700">
              <UserCheck size={20} />
            </span>
            <div>
              <h2 className="text-base font-bold font-heading text-slate-900">Requirements Checklist</h2>
              <p className="text-xs text-slate-500">Tick all requirements to activate this account</p>
            </div>
          </div>
          <div className="space-y-3">
            {requirementsList.map((req) => (
              <label
                key={req.key}
                className={`flex items-start gap-3 rounded-lg border p-3.5 transition-all cursor-pointer ${
                  requirements[req.key]
                    ? "border-emerald-300 bg-emerald-50"
                    : "border-slate-200 bg-white hover:border-red-200"
                }`}
              >
                <input
                  type="checkbox"
                  checked={requirements[req.key]}
                  onChange={(e) =>
                    setRequirements((prev) => ({ ...prev, [req.key]: e.target.checked }))
                  }
                  className="mt-0.5 size-4 shrink-0 rounded border-slate-300 text-red-700 focus:ring-red-500"
                />
                <span className={`text-sm ${requirements[req.key] ? "text-slate-700 line-through decoration-emerald-500" : "text-slate-700"}`}>
                  {req.label}
                </span>
              </label>
            ))}
          </div>
          {allRequirementsMet ? (
            <button
              type="button"
              onClick={handleActivate}
              disabled={activating}
              className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-red-800 px-4 text-sm font-medium text-white shadow-sm transition-all duration-150 hover:bg-red-700 hover:shadow-md active:scale-[0.98] disabled:bg-slate-300"
            >
              <Check size={16} aria-hidden="true" />
              {activating ? "Activating..." : "Activate Account"}
            </button>
          ) : (
            <p className="mt-4 text-xs text-slate-500 text-center">
              Complete all requirements above to activate
            </p>
          )}
        </section>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <button
          type="button"
          onClick={() => setShowSchedule(!showSchedule)}
          className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-slate-50"
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
                    ) : period.status === "OVERDUE" ? (
                      <button
                        type="button"
                        onClick={() => openPenaltyModal(period.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700 transition-all hover:bg-rose-100 hover:border-rose-300 active:scale-[0.98]"
                      >
                        <AlertTriangle size={12} />
                        Apply Penalty
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-bold font-heading text-slate-900">Payment History</h2>
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
                  {payment.penaltyAmount !== "0.00" ? (
                    <div className="mt-1.5 flex flex-wrap gap-2 text-xs">
                      <span className="font-medium text-rose-600">Penalty: {formatPeso(payment.penaltyAmount)}</span>
                    </div>
                  ) : null}
                  {payment.notes ? (
                    <div className="mt-1 text-xs text-slate-400 italic">{payment.notes}</div>
                  ) : null}
                  {payment.proofUrl ? (
                    <a href={payment.proofUrl} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-block max-w-[120px] rounded-lg border border-slate-200 overflow-hidden hover:opacity-80 transition-opacity">
                      <img src={payment.proofUrl} alt="Payment proof" className="w-full h-16 object-cover" />
                    </a>
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
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
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

      {showModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-transparent px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
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
                    className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100"
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
                      className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100"
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
                      className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100"
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
                      className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100"
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
                      className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100"
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
                    className="mt-1.5 min-h-16 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100"
                  />
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Payment Proof (optional)
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileSelect}
                    className="mt-1.5 block w-full text-sm text-slate-500 file:mr-3 file:rounded-lg file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-50"
                  />
                </label>
                {proofPreview ? (
                  <div className="mt-2 rounded-lg border border-slate-200 overflow-hidden relative">
                    <img src={proofPreview} alt="Payment proof preview" className="w-full h-32 object-cover" />
                    <button
                      type="button"
                      onClick={() => { setProofFile(null); setProofPreview(null); }}
                      className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
                    >
                      <X size={12} />
                    </button>
                  </div>
      ) : null}

      {showEditModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-transparent px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-base font-bold font-heading text-slate-900">Edit Account</h2>
                <p className="mt-0.5 text-sm text-slate-500">{account.brand} {account.model} — {account.customerName}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="flex size-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 px-6 py-4">
              {editError ? <ErrorMessage message={editError} /> : null}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Customer Name
                    <input
                      value={editForm.customerName}
                      onChange={(e) => setEditForm((p) => ({ ...p, customerName: e.target.value }))}
                      className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100"
                    />
                  </label>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Contact
                    <input
                      value={editForm.customerPhone}
                      onChange={(e) => setEditForm((p) => ({ ...p, customerPhone: e.target.value.replace(/\D/g, "") }))}
                      className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100"
                    />
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Email
                  <input
                    type="email"
                    value={editForm.customerEmail}
                    onChange={(e) => setEditForm((p) => ({ ...p, customerEmail: e.target.value }))}
                    className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100"
                  />
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Address
                  <textarea
                    value={editForm.customerAddress}
                    onChange={(e) => setEditForm((p) => ({ ...p, customerAddress: e.target.value }))}
                    className="mt-1.5 min-h-16 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100"
                  />
                </label>
              </div>

              <div className="border-t border-slate-100 pt-4">
                <p className="text-xs font-semibold font-heading uppercase tracking-wider text-slate-500 mb-3">Device Info</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700">
                      Brand
                      <input
                        value={editForm.brand}
                        onChange={(e) => setEditForm((p) => ({ ...p, brand: e.target.value }))}
                        className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100"
                      />
                    </label>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700">
                      Model
                      <input
                        value={editForm.model}
                        onChange={(e) => setEditForm((p) => ({ ...p, model: e.target.value }))}
                        className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100"
                      />
                    </label>
                  </div>
                </div>
                <div className="mt-4">
                  <label className="block text-sm font-medium text-slate-700">
                    Unit Description
                    <textarea
                      value={editForm.unitDescription}
                      onChange={(e) => setEditForm((p) => ({ ...p, unitDescription: e.target.value }))}
                      className="mt-1.5 min-h-16 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100"
                    />
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="inline-flex h-10 items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-[0.98]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmEdit}
                  disabled={editSaving || !editForm.customerName.trim()}
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-red-800 px-4 text-sm font-medium text-white shadow-sm transition-all duration-150 hover:bg-red-700 hover:shadow-md active:scale-[0.98] disabled:bg-slate-300"
                >
                  {editSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

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
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-red-800 px-4 text-sm font-medium text-white shadow-sm transition-all duration-150 hover:bg-red-700 hover:shadow-md active:scale-[0.98]"
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

      {showPenaltyModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-transparent px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-base font-bold font-heading text-slate-900">Apply Penalty</h2>
              <button
                type="button"
                onClick={() => setShowPenaltyModal(false)}
                className="flex size-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4 px-6 py-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Penalty Amount (₱)
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={penaltyAmount}
                    onChange={(e) => setPenaltyAmount(e.target.value)}
                    className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100"
                  />
                </label>
              </div>
              <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => setShowPenaltyModal(false)}
                  className="inline-flex h-10 items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-[0.98]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmApplyPenalty}
                  disabled={applyingPenalty || !penaltyAmount || Number(penaltyAmount) <= 0}
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-rose-700 px-4 text-sm font-medium text-white shadow-sm transition-all duration-150 hover:bg-rose-600 hover:shadow-md active:scale-[0.98] disabled:bg-slate-300"
                >
                  {applyingPenalty ? "Applying..." : "Apply Penalty"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
