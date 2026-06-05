"use client";

import Decimal from "decimal.js";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Bike, Save } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ErrorMessage, SuccessMessage } from "@/components/ui-state";
import { apiRequest } from "@/lib/client-api";
import { formatPeso } from "@/lib/money";
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!formValid) return;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const data = await apiRequest<{ installmentAccount: InstallmentAccountDto }>(
        "/api/installment-accounts",
        { method: "POST", body: JSON.stringify(form) },
      );
      setSuccess("Account created.");
      router.push(`/installment-accounts/${data.installmentAccount.id}`);
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="New Installment Account" description="Register a motorcycle installment sale" />

      {error ? <ErrorMessage message={error} /> : null}
      {success ? <SuccessMessage message={success} /> : null}

      <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[400px_1fr]">
        <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-base font-semibold text-slate-950">Customer Details</h2>
          <div className="mt-4 space-y-4">
            <label className="block text-sm font-medium text-slate-700">
              Full Name
              <input
                required
                value={form.customerName}
                onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-950"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Phone
              <input
                required
                inputMode="numeric"
                value={form.customerPhone}
                onChange={(e) => setForm({ ...form, customerPhone: e.target.value.replace(/\D/g, "") })}
                className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-950"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Address
              <textarea
                required
                value={form.customerAddress}
                onChange={(e) => setForm({ ...form, customerAddress: e.target.value })}
                className="mt-1 min-h-20 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-950"
              />
            </label>
          </div>

          <h2 className="mt-6 text-base font-semibold text-slate-950">Motorcycle Details</h2>
          <div className="mt-4 space-y-4">
            <label className="block text-sm font-medium text-slate-700">
              Brand
              <input
                required
                value={form.brand}
                onChange={(e) => setForm({ ...form, brand: e.target.value })}
                className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-950"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Model
              <input
                required
                value={form.model}
                onChange={(e) => setForm({ ...form, model: e.target.value })}
                className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-950"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Unit Description
              <textarea
                required
                value={form.unitDescription}
                onChange={(e) => setForm({ ...form, unitDescription: e.target.value })}
                placeholder="Color, displacement, year"
                className="mt-1 min-h-20 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-950"
              />
            </label>
          </div>
        </section>

        <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-base font-semibold text-slate-950">Contract Details</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              Cash Price
              <input
                required
                inputMode="decimal"
                value={form.cashPrice}
                onChange={(e) => setForm({ ...form, cashPrice: e.target.value.replace(/[^\d.]/g, "") })}
                className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-950"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Installment Price
              <input
                required
                inputMode="decimal"
                value={form.installmentPrice}
                onChange={(e) => setForm({ ...form, installmentPrice: e.target.value.replace(/[^\d.]/g, "") })}
                className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-950"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Down Payment
              <input
                required
                inputMode="decimal"
                value={form.downPayment}
                onChange={(e) => setForm({ ...form, downPayment: e.target.value.replace(/[^\d.]/g, "") })}
                className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-950"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Term (months)
              <select
                value={form.term}
                onChange={(e) => setForm({ ...form, term: Number(e.target.value) })}
                className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-950"
              >
                <option value={12}>12 months</option>
                <option value={24}>24 months</option>
                <option value={36}>36 months</option>
                <option value={48}>48 months</option>
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Start Date
              <input
                required
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-950"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Due Day of Month
              <select
                value={form.dueDayOfMonth}
                onChange={(e) => setForm({ ...form, dueDayOfMonth: Number(e.target.value) })}
                className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-950"
              >
                <option value={10}>10th</option>
                <option value={20}>20th</option>
                <option value={30}>30th</option>
              </select>
            </label>
          </div>

          {remainingBalance.gt(0) ? (
            <div className="mt-6 rounded-md border border-slate-200 bg-slate-50 p-4">
              <div className="grid gap-3 text-sm sm:grid-cols-3">
                <div>
                  <span className="text-xs font-semibold uppercase text-slate-500">Remaining Balance</span>
                  <div className="mt-1 text-lg font-semibold text-slate-950">
                    {formatPeso(remainingBalance.toFixed(2))}
                  </div>
                </div>
                <div>
                  <span className="text-xs font-semibold uppercase text-slate-500">Monthly Installment</span>
                  <div className="mt-1 text-lg font-semibold text-slate-950">
                    {formatPeso(monthlyInstallment.toFixed(2))}
                  </div>
                </div>
                <div>
                  <span className="text-xs font-semibold uppercase text-slate-500">Term</span>
                  <div className="mt-1 text-lg font-semibold text-slate-950">{form.term} months</div>
                </div>
              </div>
            </div>
          ) : null}

          <button
            type="submit"
            disabled={!formValid || saving}
            className="mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-medium text-white hover:bg-slate-800 disabled:bg-slate-300"
          >
            <Save size={16} aria-hidden="true" />
            {saving ? "Creating..." : "Create Account"}
          </button>
        </section>
      </form>
    </div>
  );
}
