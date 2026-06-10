"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="max-w-sm text-center">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-red-100 text-red-600 mx-auto mb-4">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h1 className="text-xl font-bold font-heading text-slate-900">Something went wrong</h1>
        <p className="mt-2 text-sm text-slate-500">An unexpected error occurred. Please try again.</p>
        <button
          onClick={reset}
          className="mt-6 inline-flex h-10 items-center rounded-xl bg-red-800 px-6 text-sm font-medium text-white shadow-sm transition-all hover:bg-red-700 active:scale-[0.98]"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
