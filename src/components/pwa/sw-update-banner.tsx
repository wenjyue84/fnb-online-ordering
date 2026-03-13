"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw, X } from "lucide-react";

interface SwUpdateBannerProps {
  /** When true: shown immediately on SW waiting, no dismiss button (admin/KDS routes) */
  priority?: "high";
}

/**
 * US-611 — Service worker update lifecycle banner.
 * Detects a waiting SW and prompts the user to reload.
 * - Normal (customer): dismissible "Update available" bar at top
 * - High (admin/KDS): non-dismissible, immediate
 */
export function SwUpdateBanner({ priority }: SwUpdateBannerProps) {
  const [show, setShow] = useState(false);
  const regRef = useRef<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const setupUpdateListener = (reg: ServiceWorkerRegistration) => {
      regRef.current = reg;

      // Already waiting (e.g. user navigated back to page)
      if (reg.waiting) {
        setShow(true);
        return;
      }

      reg.addEventListener("updatefound", () => {
        const newSW = reg.installing;
        if (!newSW) return;
        newSW.addEventListener("statechange", () => {
          if (newSW.state === "installed" && navigator.serviceWorker.controller) {
            setShow(true);
          }
        });
      });
    };

    // Register (idempotent) and check for updates
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        setupUpdateListener(reg);
      })
      .catch(() => {
        // SW registration failed — no update banner
      });

    // Re-check when tab becomes visible (catches updates deployed while tab was backgrounded)
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible" && regRef.current) {
        regRef.current.update().catch(() => {});
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  const handleRefresh = () => {
    const reg = regRef.current;
    if (reg?.waiting) {
      // Tell the waiting SW to activate immediately
      reg.waiting.postMessage({ type: "SKIP_WAITING" });
    }
    // Reload once the new SW takes control
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      window.location.reload();
    });
    // Fallback: reload after short delay if controllerchange doesn't fire
    setTimeout(() => window.location.reload(), 500);
  };

  const handleDismiss = () => setShow(false);

  if (!show) return null;

  const isHigh = priority === "high";

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-between gap-3 px-4 py-2.5 text-sm font-medium text-white shadow-md ${
        isHigh ? "bg-orange-600" : "bg-primary"
      }`}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-center gap-2">
        <RefreshCw className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>Update available — tap to refresh</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={handleRefresh}
          className="rounded-lg bg-white/20 px-3 py-1.5 text-xs font-bold hover:bg-white/30 min-h-[36px]"
          aria-label="Refresh to apply update"
        >
          Refresh
        </button>
        {!isHigh && (
          <button
            onClick={handleDismiss}
            className="flex items-center justify-center rounded-lg p-1.5 hover:bg-white/20 min-h-[36px] min-w-[36px]"
            aria-label="Dismiss update notification"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}
