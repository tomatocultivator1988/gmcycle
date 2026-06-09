"use client";

import { useEffect, useState, useCallback } from "react";
import { Smartphone, Download, X } from "lucide-react";

let capturedInstallEvent: Event | null = null;

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !("MSStream" in window);
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in window.navigator &&
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true)
  );
}

export function InstallPrompt() {
  const [installEvent, setInstallEvent] = useState<Event | null>(capturedInstallEvent);
  const [show, setShow] = useState(false);
  const [installed, setInstalled] = useState(false);
  const iOSDevice = isIOS();

  // Show 2s after mount if we already have an install event (e.g., from previous page)
  useEffect(() => {
    if (!installEvent || isStandalone()) return;
    const t = setTimeout(() => setShow(true), iOSDevice ? 2000 : 0);
    return () => clearTimeout(t);
  }, [installEvent, iOSDevice]);

  const dismiss = useCallback(() => {
    setShow(false);
  }, []);

  useEffect(() => {
    if (isStandalone()) return;

    const handler = (e: Event) => {
      e.preventDefault();
      capturedInstallEvent = e;
      setInstallEvent(e);
      setShow(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    if (iOSDevice) {
      const timer = setTimeout(() => {
        setShow(true);
      }, 2000);
      return () => {
        window.removeEventListener("beforeinstallprompt", handler);
        clearTimeout(timer);
      };
    }

    window.addEventListener("appinstalled", () => {
      setInstalled(true);
      setShow(false);
    });

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, [iOSDevice]);

  const handleInstall = async () => {
    if (!installEvent) return;
    const event = installEvent as BeforeInstallPromptEvent;
    event.prompt();
    const result = await event.userChoice;
    if (result.outcome === "accepted") {
      setInstalled(true);
      setShow(false);
    }
    setInstallEvent(null);
  };

  if (!show || installed) return null;

  if (iOSDevice) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 animate-fade-in sm:bottom-4 sm:left-auto sm:right-4 sm:w-80">
        <div className="mx-2 mb-2 rounded-lg border border-red-200 bg-white p-4 shadow-lg sm:mx-0 sm:mb-0">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-red-800 text-white">
              <Smartphone size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">Install MyFaveGadgets</p>
              <p className="mt-0.5 text-xs text-slate-500">
                Tap <strong>Share</strong> <span className="text-red-600">&#x2191;</span> then <strong>Add to Home Screen</strong>
              </p>
            </div>
            <button onClick={dismiss} className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Dismiss">
              <X size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 animate-fade-in">
      <div className="mx-2 mb-2 rounded-lg border border-slate-200 bg-white p-3 shadow-lg sm:mx-auto sm:max-w-md">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-red-800 text-white">
            <Smartphone size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900">Install MyFaveGadgets</p>
            <p className="text-xs text-slate-500">Add to home screen for the best experience</p>
          </div>
          <button
            onClick={handleInstall}
            className="flex items-center gap-1.5 rounded-lg bg-red-800 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-red-900"
          >
            <Download size={15} />
            Install
          </button>
          <button onClick={dismiss} className="shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Dismiss">
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
