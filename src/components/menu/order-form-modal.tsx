"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { X, AlertCircle } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { OrderSuccessOverlay } from "@/components/order/order-success-overlay";

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

function getMinArrivalTimeFor(minutes: number): string {
  const now = new Date();
  now.setMinutes(now.getMinutes() + minutes);
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function OrderFormModal({ items, total, onSuccess, onClose }: OrderFormModalProps) {
  const t = useTranslations("orderForm");
  const locale = useLocale();
  const [step, setStep] = useState<1 | 2>(1);
  const [contactNumber, setContactNumber] = useState("");
  const [arrivalDate, setArrivalDate] = useState(getTodayStr());
  const [arrivalTime, setArrivalTime] = useState("");
  const [contactError, setContactError] = useState("");
  const [dateError, setDateError] = useState("");
  const [timeError, setTimeError] = useState("");
  const [slotFullTime, setSlotFullTime] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [orderId, setOrderId] = useState<number | null>(null);
  const [minAdvanceMinutes, setMinAdvanceMinutes] = useState(15);
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Fetch configured minimum advance time from public settings
  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data: { minAdvanceMinutes?: number }) => {
        if (typeof data.minAdvanceMinutes === "number" && data.minAdvanceMinutes >= 1) {
          setMinAdvanceMinutes(data.minAdvanceMinutes);
        }
      })
      .catch(() => {}); // fallback to 15 if fetch fails
  }, []);

  const minTime = useMemo(() => getMinArrivalTimeFor(minAdvanceMinutes), [minAdvanceMinutes]);

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

  function validateDate(value: string): boolean {
    if (!value) {
      setDateError(t("dateRequired"));
      return false;
    }
    setDateError("");
    return true;
  }

  function validateTime(value: string): boolean {
    if (!value) {
      setTimeError(t("arrivalRequired"));
      return false;
    }
    const [h, m] = value.split(":").map(Number);
    const [y, mo, d] = arrivalDate.split("-").map(Number);
    const selected = new Date(y, mo - 1, d, h, m, 0, 0);
    const now = new Date();
    if (selected.getTime() - now.getTime() < (minAdvanceMinutes - 1) * 60 * 1000) {
      setTimeError(t("arrivalTooSoon", { time: getMinArrivalTimeFor(minAdvanceMinutes), minutes: minAdvanceMinutes }));
      return false;
    }
    setTimeError("");
    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const contactOk = validateContact(contactNumber);
    const dateOk = validateDate(arrivalDate);
    const timeOk = validateTime(arrivalTime);
    if (!contactOk || !dateOk || !timeOk) return;

    // Build estimated arrival as ISO timestamp from selected date + time
    const [h, m] = arrivalTime.split(":").map(Number);
    const [y, mo, d] = arrivalDate.split("-").map(Number);
    const arrivalDateTime = new Date(y, mo - 1, d, h, m, 0, 0);

    setSubmitting(true);
    setSlotFullTime(null);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items,
          total,
          contactNumber: contactNumber.replace(/[\s-]/g, ""),
          estimatedArrival: arrivalDateTime.toISOString(),
        }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error: string; nextAvailableSlot?: string; minAdvanceMinutes?: number };
        if (data.error === "slot_full" && data.nextAvailableSlot) {
          setSlotFullTime(data.nextAvailableSlot);
        } else if (data.error === "arrival_too_soon") {
          const serverMin = data.minAdvanceMinutes ?? minAdvanceMinutes;
          setTimeError(t("arrivalTooSoon", { time: getMinArrivalTimeFor(serverMin), minutes: serverMin }));
        } else {
          setTimeError(t("submitError"));
        }
        return;
      }
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

            {/* Estimated Arrival — date + time */}
            <div className="space-y-3">
              <p className="text-sm font-semibold">
                {t("arrivalLabel")} <span className="text-red-500">*</span>
              </p>
              <div className="grid grid-cols-2 gap-2">
                {/* Date */}
                <div className="space-y-1">
                  <label htmlFor="ofm-date" className="block text-xs text-muted-foreground">{t("dateLabel")}</label>
                  <input
                    id="ofm-date"
                    type="date"
                    min={getTodayStr()}
                    value={arrivalDate}
                    onChange={(e) => {
                      setArrivalDate(e.target.value);
                      if (dateError) validateDate(e.target.value);
                    }}
                    aria-invalid={!!dateError}
                    className={`w-full rounded-xl border bg-background px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary ${dateError ? "border-red-500" : ""}`}
                  />
                  {dateError && (
                    <p className="flex items-center gap-1 text-xs text-red-500" role="alert" aria-live="polite">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      {dateError}
                    </p>
                  )}
                </div>
                {/* Time */}
                <div className="space-y-1">
                  <label htmlFor="ofm-arrival" className="block text-xs text-muted-foreground">{t("arrivalLabel")}</label>
                  <input
                    id="ofm-arrival"
                    type="time"
                    min={arrivalDate === getTodayStr() ? minTime : undefined}
                    value={arrivalTime}
                    onChange={(e) => {
                      setArrivalTime(e.target.value);
                      if (timeError) validateTime(e.target.value);
                    }}
                    aria-invalid={!!timeError}
                    aria-describedby={timeError ? "ofm-arrival-error" : "ofm-arrival-hint"}
                    className={`w-full rounded-xl border bg-background px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary ${timeError ? "border-red-500" : ""}`}
                  />
                </div>
              </div>
              <p id="ofm-arrival-hint" className="text-xs text-muted-foreground">{t("arrivalMin", { minutes: minAdvanceMinutes })}</p>
              {timeError && (
                <p id="ofm-arrival-error" className="flex items-center gap-1 text-xs text-red-500" role="alert" aria-live="polite">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  {timeError}
                </p>
              )}
              {slotFullTime && (
                <div className="rounded-xl border border-orange-300 bg-orange-50 p-3 text-sm" role="alert" aria-live="polite">
                  <p className="font-semibold text-orange-800">{t("slotFull")}</p>
                  <p className="text-orange-700 mt-0.5">
                    {t("nextAvailable")}{" "}
                    <strong>
                      {new Date(slotFullTime).toLocaleTimeString(locale === "zh" ? "zh-MY" : locale === "ms" ? "ms-MY" : "en-MY", { hour: "2-digit", minute: "2-digit" })}
                    </strong>
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      const dt = new Date(slotFullTime);
                      setArrivalDate(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`);
                      setArrivalTime(`${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`);
                      setSlotFullTime(null);
                    }}
                    className="mt-2 w-full rounded-lg bg-orange-500 py-2 text-xs font-semibold text-white hover:bg-orange-600 transition-colors"
                  >
                    {t("useThisTime")}
                  </button>
                </div>
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
        ) : orderId !== null ? (
          <OrderSuccessOverlay
            orderId={orderId}
            itemCount={items.reduce((sum, i) => sum + i.quantity, 0)}
            total={total}
            onClose={onClose}
          />
        ) : null}
      </div>
    </>
  );
}
