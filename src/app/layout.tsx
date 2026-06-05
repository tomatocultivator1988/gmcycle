import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import {
  LayoutDashboard,
  Bike,
  ReceiptText,
  Settings,
  FileText,
} from "lucide-react";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GM Cycle",
  description: "Motorcycle Installment Monitoring System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-slate-50 text-slate-950">
        <div className="min-h-screen">
          <header className="border-b border-slate-200 bg-white">
            <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between gap-4">
                <Link href="/dashboard" className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-md bg-slate-950 text-white">
                    <Bike size={20} aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block text-lg font-semibold">GM Cycle</span>
                    <span className="block text-xs text-slate-500">Installment Monitoring</span>
                  </span>
                </Link>
              </div>
              <nav className="flex gap-2 overflow-x-auto text-sm font-medium text-slate-600">
                <Link
                  href="/dashboard"
                  className="flex h-10 items-center gap-2 rounded-md px-3 hover:bg-slate-100 hover:text-slate-950"
                >
                  <LayoutDashboard size={16} aria-hidden="true" />
                  Dashboard
                </Link>
                <Link
                  href="/installment-accounts"
                  className="flex h-10 items-center gap-2 rounded-md px-3 hover:bg-slate-100 hover:text-slate-950"
                >
                  <Bike size={16} aria-hidden="true" />
                  Accounts
                </Link>
                <Link
                  href="/payments"
                  className="flex h-10 items-center gap-2 rounded-md px-3 hover:bg-slate-100 hover:text-slate-950"
                >
                  <ReceiptText size={16} aria-hidden="true" />
                  Payments
                </Link>

                <Link
                  href="/reports"
                  className="flex h-10 items-center gap-2 rounded-md px-3 hover:bg-slate-100 hover:text-slate-950"
                >
                  <FileText size={16} aria-hidden="true" />
                  Reports
                </Link>
                <Link
                  href="/admin/config"
                  className="flex h-10 items-center gap-2 rounded-md px-3 hover:bg-slate-100 hover:text-slate-950"
                >
                  <Settings size={16} aria-hidden="true" />
                  Settings
                </Link>
              </nav>
            </div>
          </header>
          <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
