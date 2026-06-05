"use client";

import { FormEvent, useEffect, useState } from "react";
import { Save, Settings } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ErrorMessage, LoadingBlock, SuccessMessage } from "@/components/ui-state";
import { apiRequest } from "@/lib/client-api";
import type { AdminConfigDto } from "@/types/api";

export default function AdminConfigPage() {
  const [config, setConfig] = useState<AdminConfigDto | null>(null);
  const [penaltyAmount, setPenaltyAmount] = useState("");
  const [discountAmount, setDiscountAmount] = useState("");
  const [dueDayOptions, setDueDayOptions] = useState<number[]>([10, 20, 30]);
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
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!penaltyAmount || !discountAmount || dueDayOptions.length === 0) return;

    setSaving(true);
    setError("");
    setSuccess("");

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
    } catch (requestError) {
      setError((requestError as Error).message);
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
          <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-base font-semibold text-slate-950">Penalty & Discount</h2>
            <div className="mt-4 space-y-4">
              <label className="block text-sm font-medium text-slate-700">
                Penalty Amount (₱)
                <input
                  required
                  inputMode="decimal"
                  value={penaltyAmount}
                  onChange={(e) => setPenaltyAmount(e.target.value.replace(/[^\d.]/g, ""))}
                  className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-950"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Discount Amount (₱)
                <input
                  required
                  inputMode="decimal"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(e.target.value.replace(/[^\d.]/g, ""))}
                  className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-950"
                />
              </label>
            </div>

            <h2 className="mt-6 text-base font-semibold text-slate-950">Due Day Options</h2>
            <div className="mt-4 flex gap-3">
              {[10, 20, 30].map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDueDay(day)}
                  className={`inline-flex h-10 items-center gap-2 rounded-md border px-4 text-sm font-medium transition-colors ${
                    dueDayOptions.includes(day)
                      ? "border-slate-950 bg-slate-950 text-white"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {day}th
                </button>
              ))}
            </div>

            <button
              type="submit"
              disabled={saving || dueDayOptions.length === 0}
              className="mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-medium text-white hover:bg-slate-800 disabled:bg-slate-300"
            >
              <Save size={16} aria-hidden="true" />
              {saving ? "Saving..." : "Save Configuration"}
            </button>
          </section>
        </form>
      ) : null}
    </div>
  );
}
