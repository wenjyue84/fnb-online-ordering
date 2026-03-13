"use client";

import { useState, useCallback } from "react";
import { Printer } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PrintableOrder } from "@/lib/thermal-printer";

interface PrintTicketButtonProps {
  order: PrintableOrder;
  cafeName: string;
  /** Additional CSS classes */
  className?: string;
  /** Compact mode: icon-only for card view */
  compact?: boolean;
}

/**
 * Print Ticket button for POS dashboard.
 * - Uses Web Serial API + ESC/POS for thermal printers (Chrome 89+)
 * - Falls back to window.print() with print-optimised CSS on unsupported browsers
 * - Caches serial connection in-session (subsequent prints skip permission prompt)
 */
export function PrintTicketButton({
  order,
  cafeName,
  className,
  compact = false,
}: PrintTicketButtonProps) {
  const [printing, setPrinting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" } | null>(null);

  const showToast = useCallback((message: string, type: "error" | "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const handlePrint = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      setPrinting(true);

      try {
        // Dynamic import to keep thermal-printer out of the main bundle
        const { isSerialSupported, printTicket } = await import(
          "@/lib/thermal-printer"
        );

        if (!isSerialSupported()) {
          // Fallback: browser print with print-optimised CSS
          window.print();
          setPrinting(false);
          return;
        }

        await printTicket(order, cafeName);
        showToast("Ticket printed", "success");
      } catch (err) {
        const message =
          err instanceof DOMException && err.name === "NotFoundError"
            ? "Printer not connected"
            : err instanceof DOMException && err.name === "SecurityError"
              ? "Serial access denied — use HTTPS"
              : err instanceof Error
                ? err.message
                : "Print failed";

        showToast(message, "error");

        // If serial failed, offer browser print as last resort
        if (
          err instanceof DOMException &&
          (err.name === "NotFoundError" || err.name === "NetworkError")
        ) {
          window.print();
        }
      } finally {
        setPrinting(false);
      }
    },
    [order, cafeName, showToast],
  );

  return (
    <div className="relative">
      <button
        onClick={(e) => void handlePrint(e)}
        disabled={printing}
        title="Print Ticket"
        className={cn(
          "flex items-center justify-center gap-1.5 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors",
          compact ? "min-h-[44px] min-w-[44px] p-2" : "min-h-[44px] w-full px-4 py-2",
          className,
        )}
      >
        <Printer className={cn("h-4 w-4", printing && "animate-pulse")} />
        {!compact && (printing ? "Printing…" : "Print Ticket")}
      </button>

      {/* Inline toast notification */}
      {toast && (
        <div
          className={cn(
            "absolute left-1/2 -translate-x-1/2 bottom-full mb-2 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium shadow-lg z-50 animate-in fade-in slide-in-from-bottom-2",
            toast.type === "error"
              ? "bg-red-600 text-white"
              : "bg-green-600 text-white",
          )}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
