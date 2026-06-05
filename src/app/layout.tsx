import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import {
  LayoutDashboard,
  Bike,
  ReceiptText,
  Settings,
  FileText,
} from "lucide-react";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
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
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "GM Cycle",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

const navLinks = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/installment-accounts", label: "Accounts", icon: Bike },
  { href: "/payments", label: "Payments", icon: ReceiptText },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/admin/config", label: "Settings", icon: Settings },
];

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
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icon.svg" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body className="min-h-full bg-slate-50 text-slate-950">
        <div className="min-h-screen pb-16 sm:pb-0">
          <header className="hidden border-b border-slate-200 bg-white sm:block">
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
              <nav className="flex gap-2 text-sm font-medium text-slate-600">
                {navLinks.map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex h-10 items-center gap-2 rounded-md px-3 hover:bg-slate-100 hover:text-slate-950"
                  >
                    <Icon size={16} aria-hidden="true" />
                    {label}
                  </Link>
                ))}
              </nav>
            </div>
          </header>

          <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </main>

          <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-slate-200 bg-white sm:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
            {navLinks.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex flex-col items-center gap-0.5 px-2 py-2 text-[10px] font-medium text-slate-500 hover:text-slate-950"
              >
                <Icon size={20} aria-hidden="true" />
                {label}
              </Link>
            ))}
          </nav>
        </div>

        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
