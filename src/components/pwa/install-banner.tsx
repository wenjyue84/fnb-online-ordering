"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

// BeforeInstallPromptEvent is not in standard TypeScript lib
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED_KEY = "mm_pwa_install_dismissed";
const INTERACTION_KEY = "mm_pwa_interactions";

/**
 * US-610 — PWA Add-to-Home-Screen install prompt banner.
 * - Android/Chrome only (beforeinstallprompt not supported on iOS Safari)
 * - Appears at the bottom after 2 user interactions
 * - Permanently dismissed after accept/reject/close (localStorage)
 * - Does not appear in admin or KDS routes (component only added to [locale]/layout)
 */
export function InstallBanner() {
  const promptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Skip if already dismissed permanently
    if (localStorage.getItem(DISMISSED_KEY)) return;

    // Skip if already running as standalone PWA
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    // iOS Safari: navigator.standalone (no beforeinstallprompt support)
    if ((navigator as { standalone?: boolean }).standalone === true) return;
    // iOS devices: don't show (A2HS requires Share → Add to Home Screen; no JS prompt available)
    if (/iPad|iPhone|iPod/.test(navigator.userAgent)) return;

    // Stash the deferred install prompt
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      promptRef.current = e as BeforeInstallPromptEvent;
      const count = parseInt(sessionStorage.getItem(INTERACTION_KEY) ?? "0", 10);
      if (count >= 2) setShow(true);
    };

    // Hide banner if PWA becomes installed via another mechanism
    const onInstalled = () => {
      setShow(false);
      localStorage.setItem(DISMISSED_KEY, "1");
    };

    // Count user interactions (clicks); show banner after threshold is met
    const onInteraction = () => {
      const current = parseInt(sessionStorage.getItem(INTERACTION_KEY) ?? "0", 10);
      const next = current + 1;
      sessionStorage.setItem(INTERACTION_KEY, String(next));
      if (next >= 2 && promptRef.current) setShow(true);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    document.addEventListener("click", onInteraction, { passive: true });

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
      document.removeEventListener("click", onInteraction);
    };
  }, []);

  const handleInstall = async () => {
    if (!promptRef.current) return;
    await promptRef.current.prompt();
    await promptRef.current.userChoice;
    setShow(false);
    localStorage.setItem(DISMISSED_KEY, "1");
    promptRef.current = null;
  };

  const handleDismiss = () => {
    setShow(false);
    localStorage.setItem(DISMISSED_KEY, "1");
  };

  if (!show) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 p-3 pb-safe sm:p-4"
      role="banner"
      aria-label="Install app prompt"
    >
      <div className="mx-auto flex max-w-sm items-center gap-3 rounded-2xl border border-border bg-background/95 p-3 shadow-xl backdrop-blur-sm">
        <span className="shrink-0 text-2xl" aria-hidden="true">
          🍽️
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight">Add to Home Screen</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Quick access — no app store needed
          </p>
        </div>
        <button
          onClick={handleInstall}
          className="min-h-[44px] min-w-[64px] shrink-0 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
          aria-label="Install app"
        >
          Install
        </button>
        <button
          onClick={handleDismiss}
          className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
          aria-label="Dismiss install prompt"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
