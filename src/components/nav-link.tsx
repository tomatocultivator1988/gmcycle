"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Smartphone,
  ReceiptText,
  FileText,
  Settings,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  Smartphone,
  ReceiptText,
  FileText,
  Settings,
};

export function NavLink({
  href,
  label,
  icon,
  mobile,
}: {
  href: string;
  label: string;
  icon: string;
  mobile?: boolean;
}) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(href + "/");
  const Icon = iconMap[icon];

  if (mobile) {
    return (
      <Link
        href={href}
        className={`flex flex-col items-center gap-0.5 px-3 py-2 text-[10px] font-medium transition-colors duration-150 ${
          isActive ? "text-red-700" : "text-slate-500 hover:text-red-700"
        }`}
      >
        <Icon size={20} aria-hidden="true" />
        {label}
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className={`flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-all duration-150 ${
        isActive
          ? "bg-red-50 text-red-700"
          : "text-slate-600 hover:bg-red-50 hover:text-red-700"
      }`}
    >
      <Icon size={16} aria-hidden="true" />
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
}
