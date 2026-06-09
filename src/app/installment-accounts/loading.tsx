export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-56 rounded-lg bg-slate-200" />
      <div className="h-10 w-80 rounded-lg bg-slate-200" />
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-4 border-b border-slate-100 px-5 py-3">
            <div className="h-4 flex-1 rounded bg-slate-200" />
            <div className="h-4 w-24 rounded bg-slate-200" />
            <div className="h-4 w-20 rounded bg-slate-200" />
          </div>
        ))}
      </div>
    </div>
  );
}
