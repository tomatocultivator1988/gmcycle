"use client";

import Decimal from "decimal.js";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Bike, Save } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ErrorMessage, SuccessMessage } from "@/components/ui-state";
import { FieldError } from "@/components/field-error";
import { ConfirmModal } from "@/components/confirm-modal";
import { apiRequest } from "@/lib/client-api";
import { formatPeso } from "@/lib/money";
import { createInstallmentAccountSchema } from "@/lib/validation";
import { validateForm, clearFieldError, type FieldErrors } from "@/lib/form-validation";
import type { InstallmentAccountDto } from "@/types/api";

function todayDateOnly() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function InstallmentAccountForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    customerName: "",
    customerPhone: "",
    customerAddress: "",
    brand: "",
    model: "",
    unitDescription: "",
    cashPrice: "",
    installmentPrice: "",
    downPayment: "",
    term: 24,
    startDate: todayDateOnly(),
    dueDayOfMonth: 20,
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);

  function parseDecimal(value: string): Decimal {
    try {
      return new Decimal(value.replace(/[^\d.]/g, "") || "0");
    } catch {
      return new Decimal(0);
    }
  }

  const cashPrice = parseDecimal(form.cashPrice);
  const installmentPrice = parseDecimal(form.installmentPrice);
  const downPayment = parseDecimal(form.downPayment);
  const remainingBalance = installmentPrice.minus(downPayment);
  const monthlyInstallment = remainingBalance.gt(0) && form.term > 0
    ? remainingBalance.div(form.term).toDecimalPlaces(2)
    : new Decimal(0);

  const formValid =
    form.customerName.trim() &&
    form.customerPhone.trim() &&
    form.customerAddress.trim() &&
    form.brand.trim() &&
    form.model.trim() &&
    form.unitDescription.trim() &&
    cashPrice.gt(0) &&
    installmentPrice.gt(0) &&
    downPayment.gt(0) &&
    downPayment.lt(installmentPrice);

  function updateField(field: string, value: string | number) {
    setForm({ ...form, [field]: value });
    if (fieldErrors[field]) {
      clearFieldError(setFieldErrors, field);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const validation = validateForm(createInstallmentAccountSchema, {
      ...form,
      term: form.term,
      dueDayOfMonth: form.dueDayOfMonth,
    });

    if (!validation.success) {
      setFieldErrors(validation.errors);
      return;
    }

    setShowConfirm(true);
  }

  async function confirmCreate() {
    setSaving(true);
    setError("");

    try {
      const data = await apiRequest<{ installmentAccount: InstallmentAccountDto }>(
        "/api/installment-accounts",
        { method: "POST", body: JSON.stringify(form) },
      );
      setSuccess("Account created.");
      router.push(`/installment-accounts/${data.installmentAccount.id}`);
    } catch (requestError) {
      setError((requestError as Error).message);
      setShowConfirm(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="New Installment Account" description="Register a motorcycle installment sale" />

      {error ? <ErrorMessage message={error} /> : null}
      {success ? <SuccessMessage message={success} /> : null}

      <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[420px_1fr]">
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <span className="flex size-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
              <Bike size={20} />
            </span>
            <div>
              <h2 className="text-base font-bold font-heading text-slate-900">Customer Details</h2>
              <p className="text-xs text-slate-500">Buyer information</p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Full Name
                <input
                  required
                  value={form.customerName}
                  onChange={(e) => updateField("customerName", e.target.value)}
                  className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <FieldError error={fieldErrors.customerName} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Phone
                <input
                  required
                  inputMode="numeric"
                  value={form.customerPhone}
                  onChange={(e) => updateField("customerPhone", e.target.value.replace(/\D/g, ""))}
                  className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <FieldError error={fieldErrors.customerPhone} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Address
                <textarea
                  required
                  value={form.customerAddress}
                  onChange={(e) => updateField("customerAddress", e.target.value)}
                  className="mt-1.5 min-h-20 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <FieldError error={fieldErrors.customerAddress} />
            </div>
          </div>

          <div className="mt-8 flex items-center gap-3 mb-6">
            <span className="flex size-10 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
              <Bike size={20} />
            </span>
            <div>
              <h2 className="text-base font-bold font-heading text-slate-900">Motorcycle Details</h2>
              <p className="text-xs text-slate-500">Unit information</p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Brand
                <input
                  required
                  value={form.brand}
                  onChange={(e) => updateField("brand", e.target.value)}
                  className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <FieldError error={fieldErrors.brand} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Model
                <input
                  required
                  value={form.model}
                  onChange={(e) => updateField("model", e.target.value)}
                  className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <FieldError error={fieldErrors.model} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Unit Description
                <textarea
                  required
                  value={form.unitDescription}
                  onChange={(e) => updateField("unitDescription", e.target.value)}
                  placeholder="Color, displacement, year"
                  className="mt-1.5 min-h-20 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <FieldError error={fieldErrors.unitDescription} />
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <span className="flex size-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
              <Bike size={20} />
            </span>
            <div>
              <h2 className="text-base font-bold font-heading text-slate-900">Contract Details</h2>
              <p className="text-xs text-slate-500">Pricing and terms</p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Cash Price
                <input
                  required
                  inputMode="decimal"
                  value={form.cashPrice}
                  onChange={(e) => updateField("cashPrice", e.target.value.replace(/[^\d.]/g, ""))}
                  className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <FieldError error={fieldErrors.cashPrice} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Installment Price
                <input
                  required
                  inputMode="decimal"
                  value={form.installmentPrice}
                  onChange={(e) => updateField("installmentPrice", e.target.value.replace(/[^\d.]/g, ""))}
                  className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <FieldError error={fieldErrors.installmentPrice} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Down Payment
                <input
                  required
                  inputMode="decimal"
                  value={form.downPayment}
                  onChange={(e) => updateField("downPayment", e.target.value.replace(/[^\d.]/g, ""))}
                  className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <FieldError error={fieldErrors.downPayment} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Term (months)
                <select
                  value={form.term}
                  onChange={(e) => updateField("term", Number(e.target.value))}
                  className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value={12}>12 months</option>
                  <option value={24}>24 months</option>
                  <option value={36}>36 months</option>
                  <option value={48}>48 months</option>
                </select>
              </label>
              <FieldError error={fieldErrors.term} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Start Date
                <input
                  required
                  type="date"
                  value={form.startDate}
                  onChange={(e) => updateField("startDate", e.target.value)}
                  className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <FieldError error={fieldErrors.startDate} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Due Day of Month
                <select
                  value={form.dueDayOfMonth}
                  onChange={(e) => updateField("dueDayOfMonth", Number(e.target.value))}
                  className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value={10}>10th</option>
                  <option value={20}>20th</option>
                  <option value={30}>30th</option>
                </select>
              </label>
              <FieldError error={fieldErrors.dueDayOfMonth} />
            </div>
          </div>

          {remainingBalance.gt(0) ? (
            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-5">
              <div className="grid gap-4 text-sm sm:grid-cols-3">
                <div>
                  <div className="text-xs font-semibold font-heading uppercase tracking-wider text-slate-500">Remaining Balance</div>
                  <div className="mt-1 text-lg font-bold text-slate-900">
                    {formatPeso(remainingBalance.toFixed(2))}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold font-heading uppercase tracking-wider text-slate-500">Monthly Installment</div>
                  <div className="mt-1 text-lg font-bold text-slate-900">
                    {formatPeso(monthlyInstallment.toFixed(2))}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold font-heading uppercase tracking-wider text-slate-500">Term</div>
                  <div className="mt-1 text-lg font-bold text-slate-900">{form.term} months</div>
                </div>
              </div>
            </div>
          ) : null}

          <button
            type="submit"
            disabled={!formValid || saving}
            className="mt-6 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-blue-800 px-4 text-sm font-medium text-white shadow-sm transition-all duration-150 hover:bg-blue-700 hover:shadow-md active:scale-[0.98] disabled:bg-slate-300 disabled:shadow-none disabled:active:scale-100"
          >
            <Save size={16} aria-hidden="true" />
            {saving ? "Creating..." : "Create Account"}
          </button>
        </section>
      </form>

      <ConfirmModal
        open={showConfirm}
        title="Create Installment Account?"
        message={`${form.customerName} — ${form.brand} ${form.model}. ₱${formatPeso(remainingBalance.toFixed(2))} over ${form.term} months.`}
        confirmLabel="Yes, create account"
        onConfirm={confirmCreate}
        onCancel={() => setShowConfirm(false)}
        loading={saving}
      />
    </div>
  );
}
