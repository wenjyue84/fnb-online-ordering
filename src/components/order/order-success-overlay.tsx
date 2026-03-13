"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter, useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Copy, Check, Share2 } from "lucide-react";

interface OrderSuccessOverlayProps {
  orderId: number;
  itemCount: number;
  total: number;
  onClose: () => void;
}

const STEPS = ["received", "confirmed", "preparing", "ready"] as const;
const AUTO_REDIRECT_SECONDS = 8;

export function OrderSuccessOverlay({
  orderId,
  itemCount,
  total,
  onClose,
}: OrderSuccessOverlayProps) {
  const router = useRouter();
  const params = useParams();
  const locale = (params.locale as string) ?? "en";
  const t = useTranslations("orderSuccess");
  const [countdown, setCountdown] = useState(AUTO_REDIRECT_SECONDS);
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const navigateToOrder = useCallback(() => {
    onClose();
    router.push(`/${locale}/order/${orderId}`);
  }, [router, locale, orderId, onClose]);

  // Auto-redirect countdown
  useEffect(() => {
    if (countdown <= 0) {
      navigateToOrder();
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown, navigateToOrder]);

  function handleCopy() {
    void navigator.clipboard.writeText(`#${orderId}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleWhatsAppShare() {
    const text = encodeURIComponent(
      `I just ordered from Makan Moments! Order #${orderId}`
    );
    window.open(`https://wa.me/?text=${text}`, "_blank");
  }

  // Progress indicator fraction
  const progress = countdown / AUTO_REDIRECT_SECONDS;
  const circumference = 2 * Math.PI * 18;
  const dashOffset = circumference * progress;

  const content = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl overflow-hidden">
        {/* Animated checkmark */}
        <div className="flex flex-col items-center pt-8 pb-4">
          <div className="relative h-20 w-20">
            <svg
              viewBox="0 0 52 52"
              className="h-20 w-20"
              aria-hidden="true"
            >
              <circle
                className="check-circle"
                cx="26"
                cy="26"
                r="25"
                fill="none"
                stroke="#16a34a"
                strokeWidth="2"
              />
              <path
                className="check-mark"
                fill="none"
                stroke="#16a34a"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M14.1 27.2l7.1 7.2 16.7-16.8"
              />
            </svg>
          </div>

          <h2 className="mt-4 text-xl font-bold text-stone-800">
            {t("title")}
          </h2>
          <p className="mt-1 text-3xl font-black text-amber-700">
            #{orderId}
          </p>
          <p className="mt-1 text-sm text-stone-500">
            {t("subtitle", { count: itemCount, total: `RM ${total.toFixed(2)}` })}
          </p>
        </div>

        {/* Progress stepper */}
        <div className="px-6 pb-4">
          <div className="flex items-center justify-between">
            {STEPS.map((step, idx) => (
              <div key={step} className="flex items-center">
                <div className="flex flex-col items-center gap-1">
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors ${
                      idx === 0
                        ? "border-green-500 bg-green-500 text-white"
                        : "border-stone-300 bg-white text-stone-400"
                    }`}
                  >
                    {idx === 0 ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      idx + 1
                    )}
                  </div>
                  <span
                    className={`text-[10px] leading-tight text-center max-w-[60px] ${
                      idx === 0
                        ? "font-semibold text-green-700"
                        : "text-stone-400"
                    }`}
                  >
                    {t(`step_${step}`)}
                  </span>
                </div>
                {idx < STEPS.length - 1 && (
                  <div
                    className={`h-0.5 w-6 sm:w-8 mx-0.5 ${
                      idx === 0 ? "bg-green-300" : "bg-stone-200"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Action buttons */}
        <div className="border-t px-5 py-4 space-y-2.5">
          {/* Track order — primary */}
          <button
            onClick={navigateToOrder}
            className="w-full min-h-[44px] rounded-xl bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 transition-colors flex items-center justify-center gap-2"
          >
            {t("trackOrder")}
          </button>

          {/* Secondary actions */}
          <div className="flex gap-2">
            <button
              onClick={handleWhatsAppShare}
              className="flex-1 min-h-[44px] rounded-xl border border-stone-300 text-sm font-medium text-stone-700 hover:bg-stone-50 transition-colors flex items-center justify-center gap-1.5"
            >
              <Share2 className="h-3.5 w-3.5" />
              {t("shareWhatsapp")}
            </button>
            <button
              onClick={handleCopy}
              className="flex-1 min-h-[44px] rounded-xl border border-stone-300 text-sm font-medium text-stone-700 hover:bg-stone-50 transition-colors flex items-center justify-center gap-1.5"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-green-600" />
                  <span className="text-green-600">{t("copied")}</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  {t("copyOrderId")}
                </>
              )}
            </button>
          </div>

          {/* Auto-redirect countdown */}
          <div className="flex items-center justify-center gap-2 pt-1">
            <svg className="h-5 w-5 -rotate-90" viewBox="0 0 40 40">
              <circle
                cx="20"
                cy="20"
                r="18"
                fill="none"
                stroke="#e7e5e4"
                strokeWidth="2"
              />
              <circle
                cx="20"
                cy="20"
                r="18"
                fill="none"
                stroke="#b45309"
                strokeWidth="2"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                strokeLinecap="round"
                className="transition-[stroke-dashoffset] duration-1000 ease-linear"
              />
            </svg>
            <span className="text-xs text-stone-400">
              {t("autoRedirect", { seconds: countdown })}
            </span>
          </div>
        </div>
      </div>

      {/* CSS animations for the checkmark */}
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          .check-circle {
            stroke-dasharray: 166;
            stroke-dashoffset: 166;
            animation: check-circle-draw 0.6s ease-in-out forwards;
          }
          .check-mark {
            stroke-dasharray: 48;
            stroke-dashoffset: 48;
            animation: check-mark-draw 0.4s 0.4s ease-in-out forwards;
          }
          @keyframes check-circle-draw {
            to { stroke-dashoffset: 0; }
          }
          @keyframes check-mark-draw {
            to { stroke-dashoffset: 0; }
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .check-circle { stroke-dashoffset: 0; }
          .check-mark { stroke-dashoffset: 0; }
        }
      `}</style>
    </div>
  );

  if (!mounted) return null;
  return createPortal(content, document.body);
}
