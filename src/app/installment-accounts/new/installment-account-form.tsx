"use client";

import Decimal from "decimal.js";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Smartphone, Save } from "lucide-react";
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
    customerEmail: "",
    customerAddress: "",
    brand: "",
    model: "",
    unitDescription: "",
    cashPrice: "",
    installmentPrice: "",
    downPayment: "",
    pricingType: "FLAT_RATE" as "FLAT_RATE" | "INTEREST_PERCENTAGE",
    interestRate: "",
    term: 24,
    startDate: todayDateOnly(),
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
  const interestRateDecimal = parseDecimal(form.interestRate);
  const hasInterestRate = form.pricingType === "INTEREST_PERCENTAGE" && interestRateDecimal.gt(0);
  const computedInstallmentPrice = hasInterestRate
    ? cashPrice.plus(cashPrice.times(interestRateDecimal.div(100))).toDecimalPlaces(2)
    : parseDecimal(form.installmentPrice);
  const installmentPrice = form.pricingType === "FLAT_RATE" ? parseDecimal(form.installmentPrice) : computedInstallmentPrice;
  const downPayment = parseDecimal(form.downPayment);
  const totalPeriods = form.term * 2;
  const remainingBalance = installmentPrice.minus(downPayment);
  const monthlyInstallment = remainingBalance.gt(0) && form.term > 0
    ? remainingBalance.div(form.term).toDecimalPlaces(2)
    : new Decimal(0);
  const periodAmount = remainingBalance.gt(0) && totalPeriods > 0
    ? remainingBalance.div(totalPeriods).toDecimalPlaces(2)
    : new Decimal(0);

  const formValid =
    form.customerName.trim() &&
    form.customerPhone.trim() &&
    form.customerAddress.trim() &&
    form.brand.trim() &&
    form.model.trim() &&
    form.unitDescription.trim() &&
    cashPrice.gt(0) &&
    (form.pricingType === "FLAT_RATE" ? installmentPrice.gt(0) : interestRateDecimal.gt(0)) &&
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

    const validation = validateForm(createInstallmentAccountSchema, form);

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
      <PageHeader title="New Installment Account" description="Register a gadget installment sale" />

      {error ? <ErrorMessage message={error} /> : null}
      {success ? <SuccessMessage message={success} /> : null}

      <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[420px_1fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <span className="flex size-10 items-center justify-center rounded-xl bg-red-50 text-red-700">
              <Smartphone size={20} />
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
                  className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100"
                />
              </label>
              <FieldError error={fieldErrors.customerName} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Contact
                <input
                  required
                  inputMode="numeric"
                  value={form.customerPhone}
                  onChange={(e) => updateField("customerPhone", e.target.value.replace(/\D/g, ""))}
                  className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100"
                />
              </label>
              <FieldError error={fieldErrors.customerPhone} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Email
                <input
                  type="email"
                  value={form.customerEmail}
                  onChange={(e) => updateField("customerEmail", e.target.value)}
                  className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100"
                />
              </label>
              <FieldError error={fieldErrors.customerEmail} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Address
                <textarea
                  required
                  value={form.customerAddress}
                  onChange={(e) => updateField("customerAddress", e.target.value)}
                  className="mt-1.5 min-h-20 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100"
                />
              </label>
              <FieldError error={fieldErrors.customerAddress} />
            </div>
          </div>

          <div className="mt-8 flex items-center gap-3 mb-6">
            <span className="flex size-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
              <Smartphone size={20} />
            </span>
            <div>
              <h2 className="text-base font-bold font-heading text-slate-900">Device Details</h2>
              <p className="text-xs text-slate-500">Gadget information</p>
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
                  className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100"
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
                  className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100"
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
                    placeholder="Color, storage, condition"
                  className="mt-1.5 min-h-20 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100"
                />
              </label>
              <FieldError error={fieldErrors.unitDescription} />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <Smartphone size={20} />
            </span>
            <div>
              <h2 className="text-base font-bold font-heading text-slate-900">Contract Details</h2>
              <p className="text-xs text-slate-500">Pricing, terms, and payment schedule</p>
            </div>
          </div>
          <div className="mb-5">
            <label className="block text-sm font-medium text-slate-700 mb-2">Pricing Type</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setForm({ ...form, pricingType: "FLAT_RATE", interestRate: "" }); if (fieldErrors.pricingType || fieldErrors.interestRate) clearFieldError(setFieldErrors, "pricingType"); if (fieldErrors.interestRate) clearFieldError(setFieldErrors, "interestRate"); }}
                className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all ${
                  form.pricingType === "FLAT_RATE"
                    ? "border-red-500 bg-red-50 text-red-700"
                    : "border-slate-300 bg-white text-slate-600 hover:border-slate-400"
                }`}
              >
                Flat Rate
              </button>
              <button
                type="button"
                onClick={() => { setForm({ ...form, pricingType: "INTEREST_PERCENTAGE", installmentPrice: "" }); if (fieldErrors.pricingType || fieldErrors.installmentPrice) clearFieldError(setFieldErrors, "pricingType"); }}
                className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all ${
                  form.pricingType === "INTEREST_PERCENTAGE"
                    ? "border-red-500 bg-red-50 text-red-700"
                    : "border-slate-300 bg-white text-slate-600 hover:border-slate-400"
                }`}
              >
                Interest %
              </button>
            </div>
            <FieldError error={fieldErrors.pricingType} />
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
                  className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100"
                />
              </label>
              <FieldError error={fieldErrors.cashPrice} />
            </div>

            {form.pricingType === "FLAT_RATE" ? (
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Installment Price
                  <input
                    required
                    inputMode="decimal"
                    value={form.installmentPrice}
                    onChange={(e) => updateField("installmentPrice", e.target.value.replace(/[^\d.]/g, ""))}
                    className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100"
                  />
                </label>
                <FieldError error={fieldErrors.installmentPrice} />
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Interest Rate (%)
                  <input
                    required
                    inputMode="decimal"
                    value={form.interestRate}
                    onChange={(e) => updateField("interestRate", e.target.value.replace(/[^\d.]/g, ""))}
                    placeholder="e.g. 20"
                    className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100"
                  />
                </label>
                <FieldError error={fieldErrors.interestRate} />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Down Payment
                <input
                  required
                  inputMode="decimal"
                  value={form.downPayment}
                  onChange={(e) => updateField("downPayment", e.target.value.replace(/[^\d.]/g, ""))}
                  className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100"
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
                  className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100"
                >
                  {Array.from({ length: 19 }, (_, i) => i + 6).map((m) => (
                    <option key={m} value={m}>{m} months</option>
                  ))}
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
                  className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100"
                />
              </label>
              <FieldError error={fieldErrors.startDate} />
            </div>
          </div>

          {remainingBalance.gt(0) ? (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="grid gap-4 text-sm sm:grid-cols-4">
                <div>
                  <div className="text-xs font-semibold font-heading uppercase tracking-wider text-slate-500">Remaining Balance</div>
                  <div className="mt-1 text-lg font-bold text-slate-900">
                    {formatPeso(remainingBalance.toFixed(2))}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold font-heading uppercase tracking-wider text-slate-500">Monthly</div>
                  <div className="mt-1 text-lg font-bold text-slate-900">
                    {formatPeso(monthlyInstallment.toFixed(2))}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold font-heading uppercase tracking-wider text-slate-500">Per Period (15th/30th)</div>
                  <div className="mt-1 text-lg font-bold text-emerald-700">
                    {formatPeso(periodAmount.toFixed(2))}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold font-heading uppercase tracking-wider text-slate-500">Term / Total Periods</div>
                  <div className="mt-1 text-lg font-bold text-slate-900">{form.term} mo / {totalPeriods}x</div>
                </div>
              </div>
            </div>
          ) : null}

          <button
            type="submit"
            disabled={!formValid || saving}
            className="mt-6 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-red-800 px-4 text-sm font-medium text-white shadow-sm transition-all duration-150 hover:bg-red-700 hover:shadow-md active:scale-[0.98] disabled:bg-slate-300 disabled:shadow-none disabled:active:scale-100"
          >
            <Save size={16} aria-hidden="true" />
            {saving ? "Creating..." : "Create Account"}
          </button>
        </section>
      </form>

      <ConfirmModal
        open={showConfirm}
        title="Create Installment Account?"
        message={`${form.customerName} — ${form.brand} ${form.model}. ₱${formatPeso(remainingBalance.toFixed(2))} — ${totalPeriods} payments every 15th & 30th.`}
        confirmLabel="Yes, create account"
        onConfirm={confirmCreate}
        onCancel={() => setShowConfirm(false)}
        loading={saving}
      />
    </div>
  );
}
