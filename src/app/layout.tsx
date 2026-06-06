import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Bike } from "lucide-react";
import { NavLink } from "@/components/nav-link";
import { InstallPrompt } from "@/components/install-prompt";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import "./globals.css";

export const metadata: Metadata = {
  title: "GM Cycle",
  description: "Motorcycle Installment Monitoring System",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "GM Cycle",
  },
};

export const viewport: Viewport = {
  themeColor: "#1e40af",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

const navLinks = [
  { href: "/dashboard", label: "Dashboard", icon: "LayoutDashboard" },
  { href: "/installment-accounts", label: "Accounts", icon: "Bike" },
  { href: "/payments", label: "Payments", icon: "ReceiptText" },
  { href: "/reports", label: "Reports", icon: "FileText" },
  { href: "/admin/config", label: "Settings", icon: "Settings" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="shortcut icon" href="/favicon.ico" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="icon" href="/favicon.ico" type="image/x-icon" />
        <link rel="icon" href="/icon-32x32.png" type="image/png" sizes="32x32" />
        <link rel="apple-touch-icon" href="/icon-192x192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body className="min-h-full bg-slate-50 text-slate-900">
        <div className="min-h-screen pb-20 sm:pb-0">
          <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-sm supports-backdrop-blur:bg-white/80">
            <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
              <Link href="/dashboard" className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-lg bg-blue-800 text-white shadow-sm">
                  <Bike size={18} aria-hidden="true" />
                </span>
                <span className="hidden sm:block">
                  <span className="block text-base font-semibold font-heading text-slate-900">GM Cycle</span>
                  <span className="block text-[11px] font-medium text-slate-500 leading-tight">Installment Monitoring</span>
                </span>
              </Link>
              <nav className="flex items-center gap-1">
                {navLinks.map((link) => (
                  <NavLink key={link.href} href={link.href} label={link.label} icon={link.icon} />
                ))}
              </nav>
            </div>
          </header>

          <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 animate-fade-in">
            {children}
          </main>

          <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-slate-200 bg-white sm:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
            {navLinks.map((link) => (
              <NavLink key={link.href} href={link.href} label={link.label} icon={link.icon} mobile />
            ))}
          </nav>
        </div>
        <ServiceWorkerRegister />
        <InstallPrompt />
      </body>
    </html>
  );
}
