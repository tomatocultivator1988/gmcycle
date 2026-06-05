"use client";

import { FormEvent, useEffect, useState } from "react";
import { Save, Settings } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { FieldError } from "@/components/field-error";
import { ConfirmModal } from "@/components/confirm-modal";
import { ErrorMessage, LoadingBlock, SuccessMessage } from "@/components/ui-state";
import { apiRequest } from "@/lib/client-api";
import { updateAdminConfigSchema } from "@/lib/validation";
import { validateForm, clearFieldError, type FieldErrors } from "@/lib/form-validation";
import type { AdminConfigDto } from "@/types/api";

export default function AdminConfigPage() {
  const [config, setConfig] = useState<AdminConfigDto | null>(null);
  const [penaltyAmount, setPenaltyAmount] = useState("");
  const [discountAmount, setDiscountAmount] = useState("");
  const [dueDayOptions, setDueDayOptions] = useState<number[]>([10, 20, 30]);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    apiRequest<{ config: AdminConfigDto }>("/api/admin/config")
      .then((data) => {
        setConfig(data.config);
        setPenaltyAmount(data.config.penaltyAmount);
        setDiscountAmount(data.config.discountAmount);
        setDueDayOptions(data.config.dueDayOptions);
      })
      .catch((requestError: Error) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, []);

  function toggleDueDay(day: number) {
    setDueDayOptions((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort(),
    );
    if (fieldErrors.dueDayOptions) {
      clearFieldError(setFieldErrors, "dueDayOptions");
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validation = validateForm(updateAdminConfigSchema, {
      penaltyAmount,
      discountAmount,
      dueDayOptions,
    });

    if (!validation.success) {
      setFieldErrors(validation.errors);
      return;
    }

    setShowConfirm(true);
  }

  async function confirmSave() {
    setSaving(true);
    setError("");

    try {
      const data = await apiRequest<{ config: AdminConfigDto }>("/api/admin/config", {
        method: "PUT",
        body: JSON.stringify({
          penaltyAmount,
          discountAmount,
          dueDayOptions,
        }),
      });
      setConfig(data.config);
      setSuccess("Configuration updated.");
      setShowConfirm(false);
    } catch (requestError) {
      setError((requestError as Error).message);
      setShowConfirm(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Admin configuration" />

      {error ? <ErrorMessage message={error} /> : null}
      {success ? <SuccessMessage message={success} /> : null}

      {loading ? <LoadingBlock label="Loading config" /> : null}

      {!loading ? (
        <form onSubmit={handleSubmit} className="max-w-lg space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <span className="flex size-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                <Settings size={20} />
              </span>
              <div>
                <h2 className="text-base font-bold font-heading text-slate-900">Penalty & Discount</h2>
                <p className="text-xs text-slate-500">Configure automatic penalty and discount amounts</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Penalty Amount (₱)
                  <input
                    required
                    inputMode="decimal"
                    value={penaltyAmount}
                    onChange={(e) => {
                      setPenaltyAmount(e.target.value.replace(/[^\d.]/g, ""));
                      if (fieldErrors.penaltyAmount) clearFieldError(setFieldErrors, "penaltyAmount");
                    }}
                    className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </label>
                <FieldError error={fieldErrors.penaltyAmount} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Discount Amount (₱)
                  <input
                    required
                    inputMode="decimal"
                    value={discountAmount}
                    onChange={(e) => {
                      setDiscountAmount(e.target.value.replace(/[^\d.]/g, ""));
                      if (fieldErrors.discountAmount) clearFieldError(setFieldErrors, "discountAmount");
                    }}
                    className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </label>
                <FieldError error={fieldErrors.discountAmount} />
              </div>
            </div>

            <h2 className="mt-6 text-base font-bold font-heading text-slate-900">Due Day Options</h2>
            <p className="mt-1 text-xs text-slate-500">Select which due days are available for new accounts</p>
            <div className="mt-3 flex gap-3">
              {[10, 20, 30].map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDueDay(day)}
                  className={`inline-flex h-10 items-center justify-center rounded-lg border px-5 text-sm font-medium transition-all ${
                    dueDayOptions.includes(day)
                      ? "border-blue-800 bg-blue-800 text-white shadow-sm"
                      : "border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50 hover:border-slate-400"
                  }`}
                >
                  {day}th
                </button>
              ))}
            </div>
            <FieldError error={fieldErrors.dueDayOptions} />

            <button
              type="submit"
              disabled={saving || dueDayOptions.length === 0}
              className="mt-6 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-blue-800 px-4 text-sm font-medium text-white shadow-sm transition-all duration-150 hover:bg-blue-700 hover:shadow-md active:scale-[0.98] disabled:bg-slate-300 disabled:shadow-none disabled:active:scale-100"
            >
              <Save size={16} aria-hidden="true" />
              {saving ? "Saving..." : "Save Configuration"}
            </button>
          </section>
        </form>
      ) : null}

      <ConfirmModal
        open={showConfirm}
        title="Save Configuration?"
        message={`Update penalty (₱${penaltyAmount}) and discount (₱${discountAmount}) settings.`}
        confirmLabel="Yes, save changes"
        onConfirm={confirmSave}
        onCancel={() => setShowConfirm(false)}
        loading={saving}
      />
    </div>
  );
}
