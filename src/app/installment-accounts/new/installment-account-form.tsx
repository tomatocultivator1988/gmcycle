"use client";

import Decimal from "decimal.js";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Smartphone, Save, CheckCircle, X, Printer } from "lucide-react";
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
    fbLink: "",
    brand: "",
    model: "",
    unitDescription: "",
    itemType: "GADGET" as "GADGET" | "CASH",
    cashPrice: "",
    downPayment: "",
    processingFee: "",
    interestRate: "",
    term: 24,
    scheduleType: "SEMI_MONTHLY" as "SEMI_MONTHLY" | "MONTHLY",
    firstDueDate: todayDateOnly(),
    dueDay2: "",
    dateGiven: todayDateOnly(),
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [createdAccountId, setCreatedAccountId] = useState<string | null>(null);
  const [customFields, setCustomFields] = useState<{ key: string; value: string }[]>([]);

  function parseDecimal(value: string): Decimal {
    try {
      return new Decimal(value.replace(/[^\d.]/g, "") || "0");
    } catch {
      return new Decimal(0);
    }
  }

  const cashPrice = parseDecimal(form.cashPrice);
  const downPayment = parseDecimal(form.downPayment);
  const interestRateDecimal = parseDecimal(form.interestRate);
  // Financed = Cash Price - Down Payment
  // Monthly Interest = Financed × Rate%
  // Total Interest = Monthly Interest × Term
  // Installment Price = Cash Price + Total Interest
  const financed = cashPrice.minus(downPayment);
  const monthlyInterest = interestRateDecimal.gt(0) ? financed.times(interestRateDecimal.div(100)) : new Decimal(0);
  const totalInterest = form.itemType === "CASH"
    ? monthlyInterest  // one-time for cash
    : monthlyInterest.times(form.term);  // per-month × term for gadgets
  const installmentPrice = cashPrice.plus(totalInterest);
  const totalPeriods = form.scheduleType === "SEMI_MONTHLY" ? form.term * 2 : form.term;
  const remainingBalance = installmentPrice.minus(downPayment);
  const monthlyInstallment = remainingBalance.gt(0) && form.term > 0
    ? remainingBalance.div(form.term).toDecimalPlaces(2)
    : new Decimal(0);
  const periodAmount = remainingBalance.gt(0) && totalPeriods > 0
    ? remainingBalance.div(totalPeriods).toDecimalPlaces(2)
    : new Decimal(0);

  const dueDay1 = form.firstDueDate ? parseInt(form.firstDueDate.slice(8, 10)) || 15 : 15;
  const dueDays = form.scheduleType === "SEMI_MONTHLY"
    ? [dueDay1, parseInt(form.dueDay2) || dueDay1]
    : [dueDay1];

  const formValid =
    form.customerName.trim() &&
    form.customerPhone.trim() &&
    form.customerEmail.trim() &&
    form.customerAddress.trim() &&
    form.fbLink.trim() &&
    form.brand.trim() &&
    form.model.trim() &&
    form.unitDescription.trim() &&
    cashPrice.gt(0) &&
    interestRateDecimal.gt(0) &&
    downPayment.gt(0) &&
    downPayment.lt(installmentPrice) &&
    (form.scheduleType === "MONTHLY" || parseInt(form.dueDay2) >= 1);

  function updateField(field: string, value: string | number) {
    setForm({ ...form, [field]: value });
    if (fieldErrors[field]) {
      clearFieldError(setFieldErrors, field);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProcessing(true);
    setError("");
    setSuccess("");
    setFieldErrors({});

    try {
      const dataToValidate: Record<string, unknown> = {
        customerName: form.customerName,
        customerPhone: form.customerPhone,
        customerEmail: form.customerEmail,
        customerAddress: form.customerAddress,
        fbLink: form.fbLink || undefined,
        brand: form.brand,
        model: form.model,
        unitDescription: form.unitDescription,
        itemType: form.itemType,
        cashPrice: form.cashPrice,
        downPayment: form.downPayment,
        processingFee: form.processingFee || undefined,
        interestRate: form.interestRate,
        term: form.term,
        startDate: form.firstDueDate,
        dateGiven: form.dateGiven || undefined,
        scheduleType: form.scheduleType,
        dueDays,
        firstDueDate: form.firstDueDate,
        customFields: customFields.reduce((acc, { key, value }) => {
          if (key.trim()) acc[key.trim()] = value;
          return acc;
        }, {} as Record<string, string>),
      };
      const validation = validateForm(createInstallmentAccountSchema, dataToValidate);

      if (!validation.success) {
        setFieldErrors(validation.errors);
        setProcessing(false);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      setProcessing(false);
      setShowConfirm(true);
    } catch (err) {
      setError(`Unexpected error: ${(err as Error).message}`);
      setProcessing(false);
    }
  }

  async function confirmCreate() {
    setSaving(true);
    setError("");

    try {
      const body: Record<string, unknown> = {
        customerName: form.customerName,
        customerPhone: form.customerPhone,
        customerEmail: form.customerEmail,
        customerAddress: form.customerAddress,
        fbLink: form.fbLink || undefined,
        brand: form.brand,
        model: form.model,
        unitDescription: form.unitDescription,
        itemType: form.itemType,
        cashPrice: form.cashPrice,
        downPayment: form.downPayment,
        processingFee: form.processingFee || undefined,
        interestRate: form.interestRate,
        term: form.term,
        startDate: form.firstDueDate,
        dateGiven: form.dateGiven || undefined,
        scheduleType: form.scheduleType,
        dueDays,
        firstDueDate: form.firstDueDate,
        customFields: customFields.reduce((acc, { key, value }) => {
          if (key.trim()) acc[key.trim()] = value;
          return acc;
        }, {} as Record<string, string>),
      };
      const data = await apiRequest<{ installmentAccount: InstallmentAccountDto }>(
        "/api/installment-accounts",
        { method: "POST", body: JSON.stringify(body) },
      );
      setSaving(false);
      setShowConfirm(false);
      setCreatedAccountId(data.installmentAccount.id);
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
      {Object.keys(fieldErrors).length > 0 ? (
        <div className="rounded-2xl border-2 border-rose-300 bg-rose-50 p-4">
          <p className="text-sm font-bold text-rose-800 mb-2">Please fix the following errors:</p>
          <ul className="list-disc list-inside space-y-0.5">
            {Object.entries(fieldErrors).map(([field, msg]) => (
              <li key={field} className="text-sm text-rose-700">{msg}</li>
            ))}
          </ul>
        </div>
      ) : null}

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
                autoComplete="name"
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
                  autoComplete="tel"
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
                  autoComplete="email"
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
                  autoComplete="street-address"
                  className="mt-1.5 min-h-20 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100"
                />
              </label>
              <FieldError error={fieldErrors.customerAddress} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Facebook Profile Link <span className="text-slate-400">(optional)</span>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <span className="flex items-center justify-center size-10 rounded-xl border border-slate-300 bg-slate-50 text-blue-600 shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                  </span>
                  <input
                    type="url"
                    value={form.fbLink}
                    onChange={(e) => updateField("fbLink", e.target.value)}
                    placeholder="https://facebook.com/username"
                    className="h-10 flex-1 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100"
                  />
                </div>
              </label>
              <FieldError error={fieldErrors.fbLink} />
            </div>
          </div>

          <div className="mt-8 flex items-center gap-3 mb-6">
            <span className="flex size-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
              <Smartphone size={20} />
            </span>
            <div>
              <h2 className="text-base font-bold font-heading text-slate-900">{form.itemType === "CASH" ? "Cash Details" : "Device Details"}</h2>
              <p className="text-xs text-slate-500">{form.itemType === "CASH" ? "Cash loan information" : "Gadget information"}</p>
            </div>
          </div>

          <div className="mb-5">
            <label className="block text-sm font-medium text-slate-700 mb-2">Item Type</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setForm({ ...form, itemType: "GADGET" })}
                className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all ${
                  form.itemType === "GADGET"
                    ? "border-red-500 bg-red-50 text-red-700"
                    : "border-slate-300 bg-white text-slate-600 hover:border-slate-400"
                }`}
              >
                📱 Gadget
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, itemType: "CASH" })}
                className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all ${
                  form.itemType === "CASH"
                    ? "border-red-500 bg-red-50 text-red-700"
                    : "border-slate-300 bg-white text-slate-600 hover:border-slate-400"
                }`}
              >
                💰 Cash
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {form.itemType === "GADGET" ? (
              <>
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
              </>
            ) : null}
            <div>
              <label className="block text-sm font-medium text-slate-700">
                {form.itemType === "CASH" ? "Description" : "Unit Description"}
                <textarea
                  required
                  value={form.unitDescription}
                  onChange={(e) => updateField("unitDescription", e.target.value)}
                  placeholder={form.itemType === "CASH" ? "Purpose / reason for cash" : "Color, storage, condition"}
                  className="mt-1.5 min-h-20 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100"
                />
              </label>
              <FieldError error={fieldErrors.unitDescription} />
            </div>
          </div>

          <div className="mt-8">
            <p className="text-xs font-semibold font-heading uppercase tracking-wider text-slate-500 mb-2">Custom Fields</p>
            <div className="space-y-2">
              {customFields.map((field, i) => (
                <div key={i} className="flex flex-col sm:flex-row gap-2 items-start">
                  <input
                    placeholder="Field name"
                    value={field.key}
                    onChange={(e) => {
                      const updated = [...customFields];
                      updated[i] = { ...updated[i], key: e.target.value };
                      setCustomFields(updated);
                    }}
                    className="h-10 w-full sm:flex-1 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100"
                  />
                  <div className="flex gap-2 w-full sm:flex-[2]">
                    <input
                      placeholder="Value"
                      value={field.value}
                      onChange={(e) => {
                        const updated = [...customFields];
                        updated[i] = { ...updated[i], value: e.target.value };
                        setCustomFields(updated);
                      }}
                      className="h-10 flex-1 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100"
                    />
                    <button
                      type="button"
                      onClick={() => setCustomFields(customFields.filter((_, j) => j !== i))}
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-300 text-slate-500 hover:bg-slate-50 transition-all"
                    >
                      <X size={16} />
                  </button>
                </div>
              </div>
              ))}
              <button
                type="button"
                onClick={() => setCustomFields([...customFields, { key: "", value: "" }])}
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-dashed border-slate-300 bg-white px-3 text-xs font-medium text-slate-500 hover:border-slate-400 hover:text-slate-700 transition-all"
              >
                + Add Field
              </button>
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
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Interest Rate (% per month)
                <input
                  required
                  inputMode="decimal"
                  value={form.interestRate}
                  onChange={(e) => updateField("interestRate", e.target.value.replace(/[^\d.]/g, ""))}
                  className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100"
                />
              </label>
              <FieldError error={fieldErrors.interestRate} />
            </div>
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
                Processing Fee
                <input
                  inputMode="decimal"
                  value={form.processingFee}
                  onChange={(e) => updateField("processingFee", e.target.value.replace(/[^\d.]/g, ""))}
                  placeholder="0.00"
                  className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100"
                />
              </label>
              <FieldError error={fieldErrors.processingFee} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Term (months)
                <input
                  type="number"
                  min={6}
                  max={48}
                  value={form.term}
                  onChange={(e) => updateField("term", Number(e.target.value))}
                  placeholder="e.g. 24"
                  className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100"
                />
              </label>
              <FieldError error={fieldErrors.term} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">
                First Due Date
                <input
                  required
                  type="date"
                  value={form.firstDueDate}
                  onChange={(e) => updateField("firstDueDate", e.target.value)}
                  className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100"
                />
              </label>
              <FieldError error={fieldErrors.firstDueDate} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Date Given
                <input
                  type="date"
                  value={form.dateGiven}
                  onChange={(e) => updateField("dateGiven", e.target.value)}
                  className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100"
                />
              </label>
              <FieldError error={fieldErrors.dateGiven} />
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs font-semibold font-heading uppercase tracking-wider text-slate-500 mb-3">Schedule</p>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Frequency</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => updateField("scheduleType", "SEMI_MONTHLY")}
                  className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                    form.scheduleType === "SEMI_MONTHLY" ? "border-red-500 bg-red-50 text-red-700" : "border-slate-300 bg-white text-slate-600"
                  }`}
                >
                  Semi-Monthly (2x/month)
                </button>
                <button
                  type="button"
                  onClick={() => updateField("scheduleType", "MONTHLY")}
                  className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                    form.scheduleType === "MONTHLY" ? "border-red-500 bg-red-50 text-red-700" : "border-slate-300 bg-white text-slate-600"
                  }`}
                >
                  Monthly (1x/month)
                </button>
              </div>
            </div>
            {form.scheduleType === "SEMI_MONTHLY" ? (
              <div className="mt-4">
                <label className="block text-sm font-medium text-slate-700">
                  Second Due Day
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={form.dueDay2}
                    onChange={(e) => updateField("dueDay2", e.target.value)}
                    placeholder={String(Math.min(dueDay1 + 15, 28))}
                    className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100"
                  />
                </label>
                <p className="mt-1 text-xs text-slate-400">
                  First due day ({dueDay1}) comes from the First Due Date. Set the second due day manually.
                </p>
              </div>
            ) : null}
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
                  <div className="text-xs font-semibold font-heading uppercase tracking-wider text-slate-500">Per Period</div>
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
            disabled={processing || saving}
            className="mt-6 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-red-800 px-4 text-sm font-medium text-white shadow-sm transition-all duration-150 hover:bg-red-700 hover:shadow-md active:scale-[0.98] disabled:bg-slate-300 disabled:shadow-none disabled:active:scale-100"
          >
            <Save size={16} aria-hidden="true" />
            {processing ? "Checking..." : saving ? "Creating..." : "Create Account"}
          </button>
          {!formValid && !saving ? (
            <p className="mt-2 text-xs text-amber-600 text-center">Fill in all required fields above. Down payment must be less than installment price.</p>
          ) : null}
        </section>
      </form>

      <ConfirmModal
        open={showConfirm}
        title="Create Installment Account?"
        message={`${form.customerName} — ${form.brand} ${form.model}. ₱${formatPeso(remainingBalance.toFixed(2))} — ${totalPeriods} periods, ${form.scheduleType === "SEMI_MONTHLY" ? `semi-monthly (${dueDays.join(", ")})` : "monthly"}.`}
        confirmLabel="Yes, create account"
        onConfirm={confirmCreate}
        onCancel={() => setShowConfirm(false)}
        loading={saving}
      />

      {createdAccountId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl">
            <div className="p-6 text-center">
              <span className="flex size-12 mx-auto items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle size={28} />
              </span>
              <h3 className="mt-4 text-base font-bold font-heading text-slate-900">Account Created</h3>
              <p className="mt-1.5 text-sm text-slate-500">The installment account has been created successfully.</p>
              <button
                type="button"
                onClick={() => router.push(`/installment-accounts/${createdAccountId}`)}
                className="mt-6 inline-flex h-10 w-full items-center justify-center rounded-lg bg-red-800 px-4 text-sm font-medium text-white shadow-sm transition-all hover:bg-red-700 active:scale-[0.98]"
              >
                View Account
              </button>
              <button
                type="button"
                onClick={() => router.push(`/installment-accounts/${createdAccountId}/down-payment-receipt`)}
                className="mt-2 inline-flex h-10 w-full items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-[0.98]"
              >
                <Printer size={16} className="mr-2" />
                Down Payment Receipt
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
