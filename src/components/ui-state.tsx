export function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
      {message}
    </div>
  );
}

export function SuccessMessage({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
      {message}
    </div>
  );
}

export function LoadingBlock({ label = "Loading" }: { label?: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500">
      {label}...
    </div>
  );
}
