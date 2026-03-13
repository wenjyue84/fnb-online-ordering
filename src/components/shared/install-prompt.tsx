"use client";

import { useEffect, useState } from "react";
import { X, Download } from "lucide-react";

const DISMISS_KEY = "install_prompt_dismissed_at";
const DISMISS_DAYS = 7;

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Detect standalone mode — hide banner if already installed
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone);
    if (standalone) return;

    // Check if dismissed recently
    const dismissedAt = localStorage.getItem(DISMISS_KEY);
    if (dismissedAt) {
      const diff = Date.now() - parseInt(dismissedAt, 10);
      if (diff < DISMISS_DAYS * 24 * 60 * 60 * 1000) return;
    }

    function handleBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowBanner(true);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShowBanner(false);
      setDeferredPrompt(null);
    }
  }

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setShowBanner(false);
  }

  if (isStandalone || !showBanner) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 flex items-center gap-3 rounded-2xl border border-amber-200 bg-white px-4 py-3 shadow-xl sm:left-auto sm:right-4 sm:max-w-sm">
      {/* App icon */}
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-600 text-white font-black text-sm">
        MM
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900">Install Staff App</p>
        <p className="text-xs text-gray-500 truncate">Add to Home Screen for quick access</p>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={() => void handleInstall()}
          className="flex min-h-[36px] items-center gap-1 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 transition-colors"
        >
          <Download className="h-3.5 w-3.5" />
          Install
        </button>
        <button
          onClick={handleDismiss}
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
