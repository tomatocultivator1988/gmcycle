"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, ReceiptText, Save, X, Printer } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { ResponsiveTable, type Column } from "@/components/responsive-table";
import { ErrorMessage, LoadingBlock, SuccessMessage } from "@/components/ui-state";
import { FieldError } from "@/components/field-error";
import { ConfirmModal } from "@/components/confirm-modal";
import { apiRequest } from "@/lib/client-api";
import { formatPeso } from "@/lib/money";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import { createPaymentSchema } from "@/lib/validation";
import { validateForm, clearFieldError, type FieldErrors } from "@/lib/form-validation";
import type { PaymentDto, InstallmentAccountDto, PaymentMethod, PaymentTypeValue } from "@/types/api";

type PaymentListResponse = {
  payments: PaymentDto[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};

type AccountListResponse = {
  installmentAccounts: InstallmentAccountDto[];
};

const paymentTypeStyles: Record<string, string> = {
  REGULAR: "bg-red-50 text-red-700 border-red-200",
  PARTIAL: "bg-amber-50 text-amber-700 border-amber-200",
  ADVANCE: "bg-purple-50 text-purple-700 border-purple-200",
  FULL: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

function todayDateOnly() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<PaymentDto[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<InstallmentAccountDto[]>([]);

  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [postError, setPostError] = useState("");
  const [postSuccess, setPostSuccess] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const [form, setForm] = useState({
    installmentAccountId: "",
    totalAmount: "",
    paymentDate: todayDateOnly(),
    method: "CASH" as PaymentMethod,
    paymentType: "REGULAR" as PaymentTypeValue,
    notes: "",
    cashier: "",
    proofUrl: "",
  });

  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [proofModal, setProofModal] = useState<string | null>(null);

  const columns: Column<PaymentDto>[] = useMemo(() => [
    {
      key: "customer",
      label: "Customer",
      render: (p) => <span className="text-slate-700">{p.customerName}</span>,
    },
    {
      key: "amount",
      label: "Amount",
      render: (p) => <span className="font-semibold text-slate-900">{formatPeso(p.totalAmount)}</span>,
    },
    {
      key: "date",
      label: "Date",
      render: (p) => <span className="text-slate-700">{p.paymentDate}</span>,
    },
    {
      key: "method",
      label: "Method",
      render: (p) => <span className="text-slate-700">{p.method}</span>,
      hideOnMobile: true,
    },
    {
      key: "type",
      label: "Type",
      render: (p) => (
        <span className={`inline-flex items-center rounded-xl border px-2 py-0.5 text-xs font-semibold ${paymentTypeStyles[p.paymentType] || "bg-slate-50 text-slate-700 border-slate-200"}`}>
          {p.paymentType}
        </span>
      ),
    },
    {
      key: "penalty",
      label: "Penalty",
      render: (p) =>
        p.penaltyAmount && p.penaltyAmount !== "0.00" ? (
          <span className="font-medium text-rose-600">{formatPeso(p.penaltyAmount)}</span>
        ) : (
          <span className="text-slate-300">—</span>
        ),
      hideOnMobile: true,
    },
    {
      key: "proof",
      label: "Proof",
      render: (p) =>
        p.proofUrl ? (
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); setProofModal(p.proofUrl); }}
            className="inline-block rounded border border-slate-200 overflow-hidden hover:opacity-80"
          >
            <img src={p.proofUrl} alt="Proof" className="size-8 object-cover" />
          </button>
        ) : (
          <span className="text-slate-300">—</span>
        ),
    },
    {
      key: "actions",
      label: "Receipt",
      render: (p) => (
        <Link
          href={`/payments/${p.id}/receipt`}
          className="inline-flex h-8 sm:h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:border-slate-400 active:scale-[0.98] min-h-[44px] sm:min-h-0"
        >
          <Printer size={13} />
          Receipt
        </Link>
      ),
    },
  ], [setProofModal]);

  const fetchPayments = useCallback(async (p: number) => {
    setLoading(true);
    setError("");

    try {
      const data = await apiRequest<PaymentListResponse>(`/api/payments?page=${p}&limit=20`);
      setPayments(data.payments);
      setTotalPages(data.pagination.totalPages);
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPayments(page);
  }, [page, fetchPayments]);

  useBodyScrollLock(showModal);

  function openModal() {
    setPostError("");
    setPostSuccess("");
    setFieldErrors({});
    setForm({
      installmentAccountId: "",
      totalAmount: "",
      paymentDate: todayDateOnly(),
      method: "CASH",
      paymentType: "REGULAR",
      notes: "",
      cashier: "",
      proofUrl: "",
    });

    setProofFile(null);
    setProofPreview(null);

    apiRequest<AccountListResponse>("/api/installment-accounts?page=1&limit=100")
      .then((data) => setAccounts(data.installmentAccounts.filter((a) => a.status !== "APPLIED")))
      .catch(() => {});

    setShowModal(true);
  }

  function updateField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) clearFieldError(setFieldErrors, field);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPostError("");
    setPostSuccess("");

    const validation = validateForm(createPaymentSchema, {
      ...form,
      paymentType: selectedAccount ? detectedType : form.paymentType,
      notes: form.notes || undefined,
      cashier: form.cashier || undefined,
    });

    if (!validation.success) {
      setFieldErrors(validation.errors);
      return;
    }

    if (proofFile) {
      setUploading(true);
      try {
        const fd = new FormData();
        fd.append("file", proofFile);
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Upload failed");
        setForm((prev) => ({ ...prev, proofUrl: data.url }));
        setUploading(false);
      } catch (uploadError) {
        setPostError((uploadError as Error).message);
        setUploading(false);
        return;
      }
    }

    setShowConfirm(true);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setProofFile(file);
    setProofPreview(URL.createObjectURL(file));
  }

  async function confirmPost() {
    setSaving(true);
    setPostError("");

    try {
      await apiRequest<{ payment: PaymentDto }>("/api/payments", {
        method: "POST",
        body: JSON.stringify({ ...form, paymentType: detectedType }),
      });

      setPostSuccess(selectedAccount?.customerEmail
        ? `Payment posted. Receipt emailed to ${selectedAccount.customerEmail}.`
        : "Payment posted.");
      setShowConfirm(false);
      setFieldErrors({});

      setTimeout(() => {
        setShowModal(false);
        setPostSuccess("");
        fetchPayments(page);
      }, 800);
    } catch (requestError) {
      setPostError((requestError as Error).message);
      setShowConfirm(false);
    } finally {
      setSaving(false);
    }
  }

  const selectedAccount = accounts.find((a) => a.id === form.installmentAccountId);

  const detectedType: PaymentTypeValue = (() => {
    if (!selectedAccount) return form.paymentType;
    const amt = parseFloat(form.totalAmount) || 0;
    const remaining = parseFloat(selectedAccount.remainingBalance);
    const monthly = parseFloat(selectedAccount.monthlyInstallment);
    if (amt >= remaining) return "FULL";
    if (amt < monthly) return "PARTIAL";
    return "REGULAR";
  })();

  const typeLabel = detectedType.charAt(0) + detectedType.slice(1).toLowerCase();

  const typeColors: Record<string, string> = {
    REGULAR: "inline-flex items-center rounded-xl border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700",
    PARTIAL: "inline-flex items-center rounded-xl border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700",
    ADVANCE: "inline-flex items-center rounded-xl border border-purple-200 bg-purple-50 px-2.5 py-1 text-xs font-semibold text-purple-700",
    FULL: "inline-flex items-center rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700",
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        description="All payment records"
        actions={
          <button
            type="button"
            onClick={openModal}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-red-800 px-4 text-sm font-medium text-white shadow-sm transition-all duration-150 hover:bg-red-700 hover:shadow-md active:scale-[0.98]"
          >
            <Plus size={16} aria-hidden="true" />
            New Payment
          </button>
        }
      />

      {error ? <ErrorMessage message={error} /> : null}
      {loading ? <LoadingBlock label="Loading payments" /> : null}

      {!loading ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <ResponsiveTable
              columns={columns}
              data={payments}
              rowKey={(p) => p.id}
              emptyMessage="No payments yet."
              mobileAccordion={{ summaryColumns: ["customer", "type"] }}
            />
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      ) : null}

      {showModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <form onSubmit={handleSubmit} className="w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl">
            <div className="flex-shrink-0 flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-xl bg-red-50 text-red-700">
                  <ReceiptText size={18} />
                </span>
                <div>
                  <h2 className="text-base font-bold font-heading text-slate-900">Post Payment</h2>
                  <p className="text-xs text-slate-500">Record a customer payment</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="flex size-8 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 px-6 py-4">
              {postError ? <ErrorMessage message={postError} /> : null}
              {postSuccess ? <SuccessMessage message={postSuccess} /> : null}

              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Account
                  <select
                    required
                    value={form.installmentAccountId}
                    onChange={(e) => updateField("installmentAccountId", e.target.value)}
                    className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100"
                  >
                    <option value="">Select an account...</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.customerName} — {a.brand} {a.model} ({a.status})
                      </option>
                    ))}
                  </select>
                </label>
                <FieldError error={fieldErrors.installmentAccountId} />
              </div>

              {selectedAccount ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                  Balance: <span className="font-semibold text-slate-900">{formatPeso(selectedAccount.remainingBalance)}</span>
                  &nbsp;·&nbsp; Next due: {selectedAccount.nextDueDate}
                  &nbsp;·&nbsp; {selectedAccount.scheduleType === "SEMI_MONTHLY" ? "Per Period" : "Monthly"}: {formatPeso(selectedAccount.monthlyInstallment)}
                </div>
              ) : null}

              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Amount Paid
                  <input
                    required
                    inputMode="decimal"
                    value={form.totalAmount}
                    onChange={(e) => updateField("totalAmount", e.target.value.replace(/[^\d.]/g, ""))}
                    className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100"
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
                      onChange={(e) => updateField("paymentDate", e.target.value)}
                      className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100"
                    />
                  </label>
                  <FieldError error={fieldErrors.paymentDate} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Payment Type
                    <div className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 flex items-center text-sm">
                      {selectedAccount ? (
                        <span className={typeColors[detectedType]}>{typeLabel}</span>
                      ) : (
                        <span className="text-slate-400">Select account first</span>
                      )}
                    </div>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Method
                    <select
                      value={form.method}
                      onChange={(e) => updateField("method", e.target.value)}
                      className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100"
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
                      onChange={(e) => updateField("cashier", e.target.value)}
                      className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100"
                    />
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Notes
                  <textarea
                    value={form.notes}
                    onChange={(e) => updateField("notes", e.target.value)}
                    className="mt-1.5 min-h-16 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100"
                  />
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Payment Proof (optional)
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="mt-1.5 block w-full text-sm text-slate-500 file:mr-3 file:rounded-xl file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-50"
                  />
                </label>
                {proofPreview ? (
                  <div className="mt-2 rounded-xl border border-slate-200 overflow-hidden relative">
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
              </div>
            </div>

            <div className="flex-shrink-0 flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="inline-flex h-10 items-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-[0.98]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-red-800 px-4 text-sm font-medium text-white shadow-sm transition-all duration-150 hover:bg-red-700 hover:shadow-md active:scale-[0.98]"
              >
                <Save size={16} aria-hidden="true" />
                Post Payment
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <ConfirmModal
        open={showConfirm}
        title="Post Payment?"
        message={`${formatPeso(form.totalAmount || "0")} — ${detectedType} payment ${selectedAccount ? `for ${selectedAccount.customerName}` : ""}.`}
        confirmLabel="Yes, post payment"
        onConfirm={confirmPost}
        onCancel={() => setShowConfirm(false)}
        loading={saving}
      />

      {proofModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4" onClick={() => setProofModal(null)}>
          <div className="relative max-w-2xl max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setProofModal(null)}
              className="absolute top-2 right-2 z-10 flex size-8 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
            >
              <X size={16} />
            </button>
            <img src={proofModal} alt="Payment Proof" className="max-w-full max-h-[85vh] rounded-xl shadow-2xl" />
          </div>
        </div>
      ) : null}
    </div>
  );
}
