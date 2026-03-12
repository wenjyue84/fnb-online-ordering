"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { X, AlertCircle } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";

interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface OrderFormModalProps {
  items: OrderItem[];
  total: number;
  onSuccess: (orderId: number) => void;
  onClose: () => void;
}

const MALAYSIA_PHONE_RE = /^(\+?60|0)1[0-9]{8,9}$/;

function getMinArrivalTime(): string {
  const now = new Date();
  now.setMinutes(now.getMinutes() + 15);
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function OrderFormModal({ items, total, onSuccess, onClose }: OrderFormModalProps) {
  const t = useTranslations("orderForm");
  const locale = useLocale();
  const [step, setStep] = useState<1 | 2>(1);
  const [contactNumber, setContactNumber] = useState("");
  const [arrivalTime, setArrivalTime] = useState("");
  const [contactError, setContactError] = useState("");
  const [timeError, setTimeError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [orderId, setOrderId] = useState<number | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const minTime = useMemo(() => getMinArrivalTime(), []);

  // Save the element that had focus before modal opened, restore on close
  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    return () => {
      previousFocusRef.current?.focus();
    };
  }, []);

  // Move focus into modal on mount and when step changes
  useEffect(() => {
    const modal = modalRef.current;
    if (!modal) return;
    const focusable = modal.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length > 0) {
      focusable[0].focus();
    }
  }, [step]);

  // Focus trap: cycle Tab within modal; Escape closes
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key === "Tab") {
      const modal = modalRef.current;
      if (!modal) return;
      const focusable = modal.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  }, [onClose]);

  function validateContact(value: string): boolean {
    const normalized = value.replace(/[\s-]/g, "");
    if (!normalized) {
      setContactError(t("contactRequired"));
      return false;
    }
    if (!MALAYSIA_PHONE_RE.test(normalized)) {
      setContactError(t("contactInvalid"));
      return false;
    }
    setContactError("");
    return true;
  }

  function validateTime(value: string): boolean {
    if (!value) {
      setTimeError(t("arrivalRequired"));
      return false;
    }
    const [h, m] = value.split(":").map(Number);
    const now = new Date();
    const selected = new Date();
    selected.setHours(h, m, 0, 0);
    // Handle day-wrap: if selected is far in the past it's next day
    if (selected.getTime() < now.getTime() - 12 * 60 * 60 * 1000) {
      selected.setDate(selected.getDate() + 1);
    }
    if (selected.getTime() - now.getTime() < 14 * 60 * 1000) {
      setTimeError(t("arrivalTooSoon", { time: getMinArrivalTime() }));
      return false;
    }
    setTimeError("");
    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const contactOk = validateContact(contactNumber);
    const timeOk = validateTime(arrivalTime);
    if (!contactOk || !timeOk) return;

    // Build estimated arrival as ISO timestamp (today + selected time, with day-wrap)
    const [h, m] = arrivalTime.split(":").map(Number);
    const now = new Date();
    const arrivalDate = new Date();
    arrivalDate.setHours(h, m, 0, 0);
    if (arrivalDate.getTime() < now.getTime() - 12 * 60 * 60 * 1000) {
      arrivalDate.setDate(arrivalDate.getDate() + 1);
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items,
          total,
          contactNumber: contactNumber.replace(/[\s-]/g, ""),
          estimatedArrival: arrivalDate.toISOString(),
        }),
      });
      if (!res.ok) throw new Error("Failed to submit");
      const data = (await res.json()) as { ok: boolean; id: number };
      setOrderId(data.id);
      onSuccess(data.id);
      setStep(2);
    } catch {
      setTimeError(t("submitError"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm"
        onClick={step === 1 ? onClose : undefined}
      />

      {/* Modal */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-modal-heading"
        onKeyDown={handleKeyDown}
        className="fixed inset-x-4 top-1/2 z-[61] -translate-y-1/2 rounded-2xl bg-background shadow-2xl max-w-sm mx-auto"
      >
        <div className="flex items-center justify-between border-b p-4">
          <h2 id="order-modal-heading" className="text-lg font-bold">
            {step === 1 ? t("title") : t("titleConfirm")}
          </h2>
          <button
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-muted transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {step === 1 ? (
          <form onSubmit={handleSubmit} className="p-5 space-y-5">
            {/* Contact number */}
            <div className="space-y-1">
              <label htmlFor="ofm-contact" className="block text-sm font-semibold">
                {t("contactLabel")} <span className="text-red-500">*</span>
              </label>
              <input
                id="ofm-contact"
                type="tel"
                placeholder={t("contactPlaceholder")}
                value={contactNumber}
                onChange={(e) => {
                  setContactNumber(e.target.value);
                  if (contactError) validateContact(e.target.value);
                }}
                aria-invalid={!!contactError}
                aria-describedby={contactError ? "ofm-contact-error" : undefined}
                className={`w-full rounded-xl border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary ${contactError ? "border-red-500" : ""}`}
              />
              {contactError && (
                <p id="ofm-contact-error" className="flex items-center gap-1 text-xs text-red-500" role="alert" aria-live="polite">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  {contactError}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                {t.rich("dataDisclosure", {
                  privacyLink: (chunks) => (
                    <a href={`/${locale}/privacy`} target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">
                      {chunks}
                    </a>
                  ),
                })}
              </p>
            </div>

            {/* Arrival time */}
            <div className="space-y-1">
              <label htmlFor="ofm-arrival" className="block text-sm font-semibold">
                {t("arrivalLabel")} <span className="text-red-500">*</span>
              </label>
              <input
                id="ofm-arrival"
                type="time"
                min={minTime}
                value={arrivalTime}
                onChange={(e) => {
                  setArrivalTime(e.target.value);
                  if (timeError) validateTime(e.target.value);
                }}
                aria-invalid={!!timeError}
                aria-describedby={timeError ? "ofm-arrival-error" : "ofm-arrival-hint"}
                className={`w-full rounded-xl border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary ${timeError ? "border-red-500" : ""}`}
              />
              <p id="ofm-arrival-hint" className="text-xs text-muted-foreground">{t("arrivalMin")}</p>
              {timeError && (
                <p id="ofm-arrival-error" className="flex items-center gap-1 text-xs text-red-500" role="alert" aria-live="polite">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  {timeError}
                </p>
              )}
            </div>

            {/* Order summary */}
            <div className="rounded-xl bg-muted/40 p-3 space-y-1 text-sm">
              {items.map((item) => (
                <div key={item.id} className="flex justify-between">
                  <span>
                    {item.quantity}× {item.name}
                  </span>
                  <span>RM {(item.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
              <div className="flex justify-between font-bold pt-2 border-t border-border/40">
                <span>Total</span>
                <span>RM {total.toFixed(2)}</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-full bg-primary py-4 text-primary-foreground font-bold text-base hover:bg-primary/90 disabled:opacity-70 transition-colors active:scale-[0.98]"
            >
              {submitting ? t("submitting") : t("submit")}
            </button>
          </form>
        ) : (
          <div className="p-5 space-y-5 text-center">
            <div className="text-5xl">🎉</div>
            <div>
              <p className="font-bold text-xl">
                {t("orderNumber", { id: orderId ?? "" })}
              </p>
              <p className="text-muted-foreground text-sm mt-1">
                {t("awaitingConfirmation")}
              </p>
            </div>
            <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 p-4 text-sm text-amber-800 dark:text-amber-200 text-left">
              <p className="font-semibold">{t("whatNext")}</p>
              <p className="mt-1">{t("whatNextDesc")}</p>
            </div>
            <button
              onClick={onClose}
              className="w-full rounded-full bg-primary py-4 text-primary-foreground font-bold text-base hover:bg-primary/90 transition-colors active:scale-[0.98]"
            >
              {t("done")}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
