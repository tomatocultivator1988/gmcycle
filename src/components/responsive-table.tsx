import { useState } from "react";
import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export type Column<T> = {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
  hideOnMobile?: boolean;
  className?: string;
  headerClassName?: string;
};

type ResponsiveTableProps<T> = {
  columns: Column<T>[];
  data: T[];
  rowKey: ((row: T, index: number) => string | number);
  emptyMessage?: string;
  loading?: boolean;
  error?: string;
  onRowClick?: (row: T) => void;
  mobileAccordion?: {
    summaryColumns: string[];
  };
};

export function ResponsiveTable<T>({
  columns,
  data,
  rowKey,
  emptyMessage = "No data found.",
  onRowClick,
  mobileAccordion,
}: ResponsiveTableProps<T>) {
  const visibleMobile = columns.filter((c) => !c.hideOnMobile);
  const [expandedRows, setExpandedRows] = useState<Set<string | number>>(new Set());

  const toggleRow = (id: string | number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const summaryCols = mobileAccordion
    ? columns.filter((c) => mobileAccordion.summaryColumns.includes(c.key))
    : [];
  const detailCols = mobileAccordion
    ? visibleMobile.filter((c) => !mobileAccordion.summaryColumns.includes(c.key))
    : [];

  return (
    <>
      {/* Mobile: card layout */}
      <div className="block sm:hidden print:hidden space-y-3">
        {data.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500">
            {emptyMessage}
          </div>
        ) : mobileAccordion ? (
          data.map((row, i) => {
            const id = rowKey(row, i);
            const isExpanded = expandedRows.has(id);

            return (
              <div
                key={id}
                className={`rounded-xl border border-slate-200 bg-white shadow-sm ${
                  onRowClick ? "cursor-pointer" : ""
                }`}
              >
                <div
                  className="flex items-center justify-between px-4 py-3 cursor-pointer select-none"
                  onClick={() => toggleRow(id)}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {summaryCols.map((col, ci) => (
                      <div key={col.key} className={ci === 0 ? "truncate font-medium text-slate-900" : ""}>
                        {col.render(row)}
                      </div>
                    ))}
                  </div>
                  <ChevronDown
                    size={16}
                    className={`shrink-0 text-slate-400 transition-transform duration-200 ml-2 ${
                      isExpanded ? "rotate-180" : ""
                    }`}
                  />
                </div>
                {isExpanded && (
                  <div className="border-t border-slate-100 px-4 pb-3 pt-2 space-y-2">
                    {detailCols.map((col) => (
                      <div key={col.key} className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-slate-500 shrink-0">{col.label}</span>
                        <span className="text-right text-sm font-medium text-slate-900">
                          {col.render(row)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          data.map((row, i) => (
            <div
              key={rowKey(row, i)}
              className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${
                onRowClick ? "cursor-pointer transition-colors hover:bg-slate-50" : ""
              }`}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {visibleMobile.map((col, idx) => {
                const value = col.render(row);
                const isFirst = idx === 0;

                return (
                  <div
                    key={col.key}
                    className={`flex items-center justify-between gap-2 ${
                      isFirst ? "" : "border-t border-slate-100 pt-2 mt-2"
                    }`}
                  >
                    <span className="text-xs font-medium text-slate-500 shrink-0">{col.label}</span>
                    <span className={`text-right ${isFirst ? "" : "text-sm font-medium text-slate-900"}`}>
                      {value}
                    </span>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>

      {/* Desktop: table layout */}
      <div className="hidden sm:block print:block">
        <table className="w-full text-left text-[10px] leading-tight print:text-[9px]">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-1 py-2.5 text-[10px] font-semibold font-heading uppercase tracking-wider text-slate-500 whitespace-nowrap print:px-1 print:py-0.5 ${col.headerClassName ?? ""}`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.length === 0 ? null : (
              data.map((row, i) => (
                <tr
                  key={rowKey(row, i)}
                  className={`transition-colors hover:bg-slate-50 ${
                    onRowClick ? "cursor-pointer" : ""
                  }`}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-1 py-2 text-slate-700 print:px-1 print:py-0.5 ${col.className ?? ""}`}
                    >
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
        {data.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-slate-500">{emptyMessage}</div>
        ) : null}
      </div>
    </>
  );
}
