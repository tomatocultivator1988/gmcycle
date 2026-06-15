"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { NavLink } from "@/components/nav-link";
import { LogoutButton } from "@/components/logout-button";

const navLinks = [
  { href: "/dashboard", label: "Dashboard", icon: "LayoutDashboard" },
  { href: "/installment-accounts", label: "Accounts", icon: "Smartphone" },
  { href: "/payments", label: "Payments", icon: "ReceiptText" },
  { href: "/reports", label: "Reports", icon: "FileText" },
  { href: "/admin/config", label: "Settings", icon: "Settings" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";

  if (isLoginPage) return <>{children}</>;

  return (
    <div className="min-h-screen pb-20 sm:pb-0">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-sm supports-backdrop-blur:bg-white/80 print:hidden">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
          <Link href="/dashboard" className="flex items-center gap-3 sm:gap-4 shrink-0">
            <span className="flex size-12 sm:size-16 items-center justify-center">
              <img src="/logo.png" alt="MyFaveGadgets" className="h-10 sm:h-12 w-auto object-contain" />
            </span>
            <span>
              <span className="block text-base sm:text-lg font-bold font-heading text-slate-900">MyFaveGadgets</span>
              <span className="hidden sm:block text-[11px] font-medium text-slate-500 leading-tight">Gadget Installment</span>
            </span>
          </Link>
          <nav className="hidden sm:flex items-center gap-1">
            {navLinks.map((link) => (
              <NavLink key={link.href} href={link.href} label={link.label} icon={link.icon} />
            ))}
            <span className="mx-2 h-5 w-px bg-slate-200" />
            <LogoutButton />
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-slate-200 bg-white sm:hidden print:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        {navLinks.map((link) => (
          <NavLink key={link.href} href={link.href} label={link.label} icon={link.icon} mobile />
        ))}
        <LogoutButton />
      </nav>
    </div>
  );
}
