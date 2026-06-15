import type { Metadata, Viewport } from "next";
import { AuthGuard } from "@/components/auth-guard";
import { AppShell } from "@/components/app-shell";
import { InstallPrompt } from "@/components/install-prompt";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import "./globals.css";

export const metadata: Metadata = {
  title: "MyFaveGadgets",
  description: "Gadget Installment Monitoring System",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "MyFaveGadgets",
  },
};

export const viewport: Viewport = {
  themeColor: "#dc2626",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="icon" href="/icon-32x32.png" type="image/png" sizes="32x32" />
        <link rel="apple-touch-icon" href="/icon-192x192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body className="min-h-full bg-slate-50 text-slate-900">
        <AuthGuard>
          <AppShell>
            {children}
          </AppShell>
        </AuthGuard>
        <ServiceWorkerRegister />
        <InstallPrompt />
      </body>
    </html>
  );
}
