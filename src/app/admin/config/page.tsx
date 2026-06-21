"use client";

import { FormEvent, useEffect, useState } from "react";
import { Save, Settings, Download, Database } from "lucide-react";
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
  const [penaltyPerDay, setPenaltyPerDay] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [hasPassword, setHasPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [backupPassword, setBackupPassword] = useState("");
  const [backingUp, setBackingUp] = useState(false);
  const [backupError, setBackupError] = useState("");

  useEffect(() => {
    apiRequest<{ config: AdminConfigDto }>("/api/admin/config")
      .then((data) => {
        setConfig(data.config);
        setPenaltyPerDay(data.config.penaltyPerDay);
        setAdminEmail(data.config.adminEmail ?? "");
        setHasPassword(data.config.hasPassword ?? false);
      })
      .catch((requestError: Error) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validation = validateForm(updateAdminConfigSchema, {
      penaltyPerDay,
      adminEmail,
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
          penaltyPerDay,
          adminEmail,
          adminPassword,
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

  function openBackupModal() {
    setBackupPassword("");
    setBackupError("");
    setShowBackupModal(true);
  }

  async function confirmBackup() {
    if (!backupPassword.trim()) {
      setBackupError("Password is required");
      return;
    }
    setBackingUp(true);
    setBackupError("");

    try {
      const res = await fetch(`/api/admin/backup?password=${encodeURIComponent(backupPassword)}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Invalid password" }));
        throw new Error(err.error || "Invalid password");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setShowBackupModal(false);
    } catch (e) {
      setBackupError((e as Error).message);
    } finally {
      setBackingUp(false);
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
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <span className="flex size-10 items-center justify-center rounded-xl bg-red-50 text-red-700">
                <Settings size={20} />
              </span>
              <div>
                <h2 className="text-base font-bold font-heading text-slate-900">Penalty Settings</h2>
                <p className="text-xs text-slate-500">Configure penalty per day for overdue accounts</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Penalty Per Day (₱)
                  <input
                    required
                    inputMode="decimal"
                    value={penaltyPerDay}
                    onChange={(e) => {
                      setPenaltyPerDay(e.target.value.replace(/[^\d.]/g, ""));
                      if (fieldErrors.penaltyPerDay) clearFieldError(setFieldErrors, "penaltyPerDay");
                    }}
                    className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100"
                  />
                </label>
                <FieldError error={fieldErrors.penaltyPerDay} />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Admin Email (for reports)
                  <input
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="admin@example.com"
                    className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100"
                  />
                </label>
                <FieldError error={fieldErrors.adminEmail} />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Admin Password (for closing & editing accounts)
                  <input
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder={hasPassword ? "Leave blank to keep current" : "Set a password"}
                    className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100"
                  />
                </label>
                {hasPassword ? <p className="mt-1 text-xs text-slate-400">Password is set. Leave blank to keep unchanged.</p> : <p className="mt-1 text-xs text-amber-600">No password set. Set one to enable account closing.</p>}
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="mt-6 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-red-800 px-4 text-sm font-medium text-white shadow-sm transition-all duration-150 hover:bg-red-700 hover:shadow-md active:scale-[0.98] disabled:bg-slate-300 disabled:shadow-none disabled:active:scale-100"
            >
              <Save size={16} aria-hidden="true" />
              {saving ? "Saving..." : "Save Configuration"}
            </button>
          </section>
        </form>
      ) : null}

      {!loading ? (
        <section className="max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <span className="flex size-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
              <Database size={20} />
            </span>
            <div>
              <h2 className="text-base font-bold font-heading text-slate-900">Database Backup</h2>
              <p className="text-xs text-slate-500">Export all data to Vercel Blob storage immediately</p>
            </div>
          </div>

          <button
            type="button"
            onClick={openBackupModal}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 text-sm font-medium text-white shadow-sm transition-all duration-150 hover:bg-teal-500 hover:shadow-md active:scale-[0.98]"
          >
            <Download size={16} aria-hidden="true" />
            Download Backup
          </button>
        </section>
      ) : null}

      {showBackupModal ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl">
            <div className="p-6">
              <div className="flex flex-col items-center text-center">
                <span className="flex size-12 items-center justify-center rounded-full bg-teal-100 text-teal-700">
                  <Database size={24} />
                </span>
                <h3 className="mt-4 text-base font-bold font-heading text-slate-900">Download Backup</h3>
                <p className="mt-1.5 text-sm text-slate-500">Enter admin password to export database.</p>
              </div>

              {backupError ? (
                <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{backupError}</p>
              ) : null}

              <div className="mt-4">
                <input
                  type="password"
                  value={backupPassword}
                  onChange={(e) => { setBackupPassword(e.target.value); setBackupError(""); }}
                  placeholder="Admin password"
                  className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100"
                  onKeyDown={(e) => { if (e.key === "Enter") confirmBackup(); }}
                  autoFocus
                />
              </div>

              <div className="mt-6 flex flex-col gap-2">
                <button
                  type="button"
                  disabled={backingUp}
                  onClick={confirmBackup}
                  className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-teal-600 px-4 text-sm font-medium text-white shadow-sm transition-all hover:bg-teal-500 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
                >
                  {backingUp ? "Downloading..." : "Download"}
                </button>
                <button
                  type="button"
                  disabled={backingUp}
                  onClick={() => setShowBackupModal(false)}
                  className="inline-flex h-10 w-full items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmModal
        open={showConfirm}
        title="Save Configuration?"
        message={`Update penalty (₱${penaltyPerDay}/day) settings.`}
        confirmLabel="Yes, save changes"
        onConfirm={confirmSave}
        onCancel={() => setShowConfirm(false)}
        loading={saving}
      />
    </div>
  );
}
