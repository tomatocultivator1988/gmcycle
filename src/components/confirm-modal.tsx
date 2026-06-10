"use client";

import { AlertTriangle } from "lucide-react";

type ConfirmModalProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
};

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "Yes, proceed",
  cancelLabel = "Cancel",
  variant = "default",
  onConfirm,
  onCancel,
  loading = false,
}: ConfirmModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl">
        <div className="p-6">
          <div className="flex flex-col items-center text-center">
            <span className={`flex size-12 items-center justify-center rounded-full ${
              variant === "danger" ? "bg-rose-100 text-rose-600" : "bg-red-100 text-red-700"
            }`}>
              <AlertTriangle size={24} />
            </span>
            <h3 className="mt-4 text-base font-bold font-heading text-slate-900">{title}</h3>
            <p className="mt-1.5 text-sm text-slate-500">{message}</p>
          </div>

          <div className="mt-6 flex flex-col gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={onConfirm}
              className={`inline-flex h-10 w-full items-center justify-center rounded-lg px-4 text-sm font-medium shadow-sm transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 ${
                variant === "danger"
                  ? "bg-rose-600 text-white hover:bg-rose-500"
                  : "bg-red-800 text-white hover:bg-red-700"
              }`}
            >
              {loading ? "Processing..." : confirmLabel}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={onCancel}
              className="inline-flex h-10 w-full items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
            >
              {cancelLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
