"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { CheckCircle2, Circle, Clock, XCircle, PhoneCall, Upload } from "lucide-react";
import Link from "next/link";
import { fetchWithTimeout } from "@/lib/utils";
import { formatDateTime } from "@/lib/date-utils";
import type { OrderStatus } from "@/types/orders";
import { STATUS_STEPS, TERMINAL_STATUSES } from "@/types/orders";
// Converts a URL-safe base64 string to Uint8Array for VAPID applicationServerKey
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

type PushState = "idle" | "subscribed" | "unsupported";

function PushSubscribeButton({ orderId }: { orderId: string }) {
  const [pushState, setPushState] = useState<PushState>("idle");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof navigator === "undefined" || typeof window === "undefined") return;
    // iOS without PWA install cannot receive push notifications
    const isIOSWithoutPWA =
      /iPad|iPhone|iPod/.test(navigator.userAgent) &&
      !window.matchMedia("(display-mode: standalone)").matches;
    if (isIOSWithoutPWA) setPushState("unsupported");
  }, []);

  if (pushState === "unsupported") {
    return (
      <p className="text-xs text-stone-400">
        We&apos;ll update your status on this page automatically.
      </p>
    );
  }

  async function handleSubscribe() {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setPushState("unsupported");
      return;
    }
    setLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return;
      const reg = await navigator.serviceWorker.ready;
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) return;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as unknown as ArrayBuffer,
      });
      const json = sub.toJSON();
      await fetch(`/api/orders/${orderId}/push-subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
        }),
      });
      setPushState("subscribed");
    } catch {
      // Push is optional — silently ignore errors
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={() => void handleSubscribe()}
      disabled={loading || pushState === "subscribed"}
      className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:cursor-default disabled:opacity-70 transition-colors"
    >
      {pushState === "subscribed" ? (
        <>✓ Notifications on</>
      ) : loading ? (
        "Setting up…"
      ) : (
        <>🔔 Notify me when ready</>
      )}
    </button>
  );
}

// Phone formatted for wa.me (strip non-digits, ensure 60 prefix)
function phoneToWaMe(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("60") ? digits : `60${digits.replace(/^0/, "")}`;
}


interface OrderData {
  id: number;
  status: OrderStatus;
  items: { id: string; name: string; price: number; quantity: number }[];
  total: number;
  contactNumber: string | null;
  estimatedArrival: string | null;
  estimatedReady: string | null;
  rejectionReason: string | null;
  createdAt: string;
}

interface TnGSettings {
  tngPhone: string;
  tngQrUrl: string;
  depositRequired: boolean;
  orderExpiryMinutes: number;
}

type UploadState = "idle" | "uploading" | "success" | "error";

function PaymentSection({
  order,
  tng,
  t,
  onSuccess,
}: {
  order: OrderData;
  tng: TnGSettings;
  t: ReturnType<typeof useTranslations>;
  onSuccess: () => void;
}) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setErrorMsg(null);
    if (!file) { setSelectedFile(null); setPreview(null); return; }
    if (!["image/jpeg", "image/jpg", "image/png"].includes(file.type)) {
      setErrorMsg(t("invalidFileType")); setSelectedFile(null); setPreview(null); return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg(t("fileTooLarge")); setSelectedFile(null); setPreview(null); return;
    }
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function handleUpload() {
    if (!selectedFile) return;
    setUploadState("uploading");
    setUploadProgress(0);
    setErrorMsg(null);
    try {
      const formData = new FormData();
      formData.append("screenshot", selectedFile);
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `/api/orders/${order.id}/payment`);
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) setUploadProgress(Math.round((ev.loaded / ev.total) * 100));
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) { resolve(); return; }
          try {
            const body = JSON.parse(xhr.responseText) as { error?: string };
            reject(new Error(body.error ?? t("uploadFailed")));
          } catch { reject(new Error(t("uploadFailed"))); }
        };
        xhr.onerror = () => reject(new Error(t("uploadFailed")));
        xhr.send(formData);
      });
      setUploadState("success");
      setUploadProgress(100);
      onSuccess();
    } catch (err) {
      setUploadState("error");
      setErrorMsg(err instanceof Error ? err.message : t("uploadFailed"));
    }
  }

  return (
    <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
      <h2 className="mb-3 font-semibold text-amber-900">{t("tngTitle")}</h2>

      {/* Amount */}
      <div className="mb-4 rounded-xl border border-amber-300 bg-white px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-amber-600">{t("tngAmountLabel")}</p>
        <p className="mt-0.5 text-2xl font-bold text-amber-800">RM {Number(order.total).toFixed(2)}</p>
      </div>

      {/* TnG phone */}
      {tng.tngPhone && (
        <div className="mb-3">
          <p className="text-xs font-medium text-amber-700">{t("tngPayToLabel")}</p>
          <p className="mt-0.5 text-lg font-semibold text-stone-800">{tng.tngPhone}</p>
        </div>
      )}

      {/* TnG QR */}
      {tng.tngQrUrl && (
        <div className="mb-4">
          <p className="mb-1 text-xs font-medium text-amber-700">{t("tngScanQrLabel")}</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={tng.tngQrUrl} alt="Touch & Go QR Code" className="h-36 w-36 rounded-xl border border-amber-200 object-contain" />
        </div>
      )}

      {/* File upload */}
      <div className="border-t border-amber-200 pt-4">
        <p className="mb-1 text-sm font-medium text-stone-700">{t("uploadLabel")}</p>
        <p className="mb-3 text-xs text-stone-500">{t("uploadHint")}</p>

        <input ref={fileInputRef} type="file" accept="image/jpeg,image/jpg,image/png" onChange={handleFileChange} className="hidden" />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadState === "uploading" || uploadState === "success"}
          className="flex min-h-[44px] items-center gap-2 rounded-xl border-2 border-dashed border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-700 hover:border-amber-500 hover:bg-amber-50 disabled:opacity-50"
        >
          <Upload className="h-4 w-4" />
          {selectedFile ? selectedFile.name : t("uploadBtn")}
        </button>

        {preview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Preview" className="mt-3 h-24 w-24 rounded-xl border border-stone-200 object-cover" />
        )}

        {errorMsg && <p className="mt-2 text-sm text-red-600">{errorMsg}</p>}

        {uploadState === "uploading" && (
          <div className="mt-3">
            <div className="h-2 w-full overflow-hidden rounded-full bg-amber-100">
              <div className="h-full rounded-full bg-amber-500 transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
            </div>
            <p className="mt-1 text-xs text-amber-700">{t("uploading")} {uploadProgress}%</p>
          </div>
        )}

        {selectedFile && (uploadState === "idle" || uploadState === "error") && (
          <button
            type="button"
            onClick={() => void handleUpload()}
            className="mt-3 flex min-h-[44px] items-center gap-2 rounded-xl bg-amber-600 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-700"
          >
            <Upload className="h-4 w-4" />
            {t("uploadBtn")}
          </button>
        )}
      </div>
    </div>
  );
}

function StepBar({
  currentStatus,
  t,
}: {
  currentStatus: OrderStatus;
  t: ReturnType<typeof useTranslations>;
}) {
  const isRejected =
    currentStatus === "rejected" || currentStatus === "cancelled";
  const currentIndex = isRejected
    ? -1
    : STATUS_STEPS.indexOf(currentStatus as (typeof STATUS_STEPS)[number]);

  return (
    <div className="w-full overflow-x-auto">
      <ol className="flex min-w-max items-start gap-0">
        {STATUS_STEPS.map((step, idx) => {
          const isCompleted = !isRejected && idx < currentIndex;
          const isCurrent = !isRejected && idx === currentIndex;
          const isPending = isRejected || idx > currentIndex;

          return (
            <li key={step} className="flex items-center">
              <div className="flex flex-col items-center gap-1">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors ${
                    isCompleted
                      ? "border-amber-600 bg-amber-600 text-white"
                      : isCurrent
                        ? "border-amber-600 bg-white text-amber-600"
                        : "border-stone-300 bg-white text-stone-400"
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : isCurrent ? (
                    <div className="h-3 w-3 animate-pulse rounded-full bg-amber-600" />
                  ) : (
                    <Circle className="h-5 w-5" />
                  )}
                </div>
                <span
                  className={`max-w-[70px] text-center text-[10px] leading-tight ${
                    isCurrent
                      ? "font-semibold text-amber-700"
                      : isCompleted
                        ? "text-amber-600"
                        : "text-stone-400"
                  } ${isPending && !isCurrent ? "opacity-60" : ""}`}
                >
                  {t(`step_${step}`)}
                </span>
              </div>
              {idx < STATUS_STEPS.length - 1 && (
                <div
                  className={`h-0.5 w-10 flex-shrink-0 transition-colors ${
                    isCompleted ? "bg-amber-600" : "bg-stone-200"
                  }`}
                />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

const MAX_FAIL_COUNT = 40;

export default function OrderStatusPage() {
  const params = useParams();
  const orderId = params.id as string;
  const t = useTranslations("orderStatus");

  const [order, setOrder] = useState<OrderData | null>(null);
  const [tng, setTng] = useState<TnGSettings>({ tngPhone: "", tngQrUrl: "", depositRequired: false, orderExpiryMinutes: 240 });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [secsSince, setSecsSince] = useState(0);
  const [expiryLeft, setExpiryLeft] = useState<{ mins: number; secs: number; urgent: boolean } | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [copyLabel, setCopyLabel] = useState<string | null>(null);

  const failCount = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevStatusRef = useRef<OrderStatus | null>(null);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const fetchOrder = useCallback(async () => {
    try {
      const res = await fetchWithTimeout(`/api/orders/${orderId}`, { cache: "no-store" });
      if (!res.ok) {
        failCount.current += 1;
        if (failCount.current >= MAX_FAIL_COUNT) {
          stopPolling();
          setNotFound(true);
          setLoading(false);
        } else if (res.status === 404) {
          setError(t("notFound"));
        } else {
          setError(t("fetchError"));
        }
        return;
      }
      // Successful response — reset fail counter
      failCount.current = 0;
      const data = (await res.json()) as OrderData;
      // Confetti when status first becomes 'ready'
      if (prevStatusRef.current !== "ready" && data.status === "ready") {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 3000);
      }
      prevStatusRef.current = data.status;
      setOrder(data);
      setLastUpdated(new Date());
      setError(null);
      // Stop polling on terminal statuses
      if (TERMINAL_STATUSES.includes(data.status)) {
        stopPolling();
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setError(t("timeout"));
        setLoading(false);
        return;
      }
      failCount.current += 1;
      if (failCount.current >= MAX_FAIL_COUNT) {
        stopPolling();
        setNotFound(true);
      } else {
        setError(t("fetchError"));
      }
    } finally {
      setLoading(false);
    }
  }, [orderId, t, stopPolling]);

  // Fetch TnG settings once on mount
  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data: TnGSettings) => setTng(data))
      .catch(() => {/* non-critical */});
  }, []);

  useEffect(() => {
    void fetchOrder();
    intervalRef.current = setInterval(() => void fetchOrder(), 15_000);
    return () => stopPolling();
  }, [fetchOrder, stopPolling]);

  // Countdown timer for preparing status
  const estimatedReady = order?.estimatedReady ?? null;
  const orderStatus = order?.status ?? null;
  useEffect(() => {
    if (orderStatus !== "preparing" || !estimatedReady) {
      setCountdown(null);
      return;
    }
    function tick() {
      const diff = new Date(estimatedReady!).getTime() - Date.now();
      if (diff <= 0) {
        setCountdown(t("readySoon"));
      } else {
        const totalSecs = Math.floor(diff / 1000);
        const mins = Math.floor(totalSecs / 60);
        const secs = totalSecs % 60;
        setCountdown(`${mins}:${String(secs).padStart(2, "0")}`);
      }
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [orderStatus, estimatedReady, t]);

  // "Updated Xs ago" counter — resets whenever lastUpdated changes
  useEffect(() => {
    if (!lastUpdated) return;
    setSecsSince(0);
    const id = setInterval(() => setSecsSince((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [lastUpdated]);

  // Expiry countdown — only for pending_approval
  const createdAt = order?.createdAt;
  useEffect(() => {
    if (orderStatus !== "pending_approval" || !createdAt) {
      setExpiryLeft(null);
      return;
    }
    const expiryMs = new Date(createdAt).getTime() + tng.orderExpiryMinutes * 60_000;
    function tick() {
      const diff = expiryMs - Date.now();
      if (diff <= 0) { setExpiryLeft({ mins: 0, secs: 0, urgent: true }); return; }
      const total = Math.floor(diff / 1000);
      setExpiryLeft({ mins: Math.floor(total / 60), secs: total % 60, urgent: Math.floor(total / 60) < 5 });
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [orderStatus, createdAt, tng.orderExpiryMinutes]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-stone-500">
          <Clock className="h-10 w-10 animate-spin" />
          <p>{t("loading")}</p>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-sm">
          <XCircle className="mx-auto mb-3 h-10 w-10 text-stone-400" />
          <p className="font-semibold text-stone-700">{t("maxRetriesTitle")}</p>
          <p className="mt-1 text-sm text-stone-500">{t("maxRetriesMsg")}</p>
          <Link
            href={`https://wa.me/${phoneToWaMe("012-708 8789")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-amber-600 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-700"
          >
            <PhoneCall className="h-4 w-4" />
            {t("contactCafe")}
          </Link>
          <div className="mt-3">
            <Link href="/" className="text-sm text-amber-700 underline">
              {t("backHome")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
          <XCircle className="mx-auto mb-3 h-10 w-10 text-red-400" />
          <p className="font-semibold text-red-700">
            {error ?? t("fetchError")}
          </p>
          <Link
            href="/"
            className="mt-4 inline-block text-sm text-amber-700 underline"
          >
            {t("backHome")}
          </Link>
        </div>
      </div>
    );
  }

  const isRejected =
    order.status === "rejected" || order.status === "cancelled";
  const isExpired = order.status === "expired";
  const isReady = order.status === "ready";

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      {/* CSS confetti — 3s burst on order ready */}
      {showConfetti && (
        <>
          <style>{`@keyframes confetti-fall{from{transform:translateY(-10px) rotate(0deg);opacity:1}to{transform:translateY(100vh) rotate(720deg);opacity:0}}`}</style>
          <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden" aria-hidden="true">
            {(["🎉","🎊","✨","🍽️","⭐","🌟","🎈"] as const).flatMap((emoji, i) =>
              Array.from({ length: 3 }, (_, j) => (
                <span
                  key={`${i}-${j}`}
                  className="absolute text-2xl"
                  style={{
                    left: `${(i * 3 + j) * 4.5 + 1}%`,
                    animation: `confetti-fall ${1.5 + (i + j) * 0.25}s ease-in forwards`,
                    animationDelay: `${(i + j) * 0.08}s`,
                  }}
                >{emoji}</span>
              ))
            )}
          </div>
        </>
      )}

      {/* Header */}
      <div className="mb-6">
        <p className="text-sm text-stone-500">{t("orderNumber", { id: order.id })}</p>
        <h1 className="mt-1 font-display text-2xl font-bold text-stone-800">
          {isRejected
            ? t("titleRejected")
            : isExpired
              ? t("titleExpired")
              : isReady
                ? t("titleReady")
                : t("title")}
        </h1>
        {lastUpdated && (
          <p className="mt-1 text-xs text-stone-400">
            {t("lastUpdatedAgo", { secs: secsSince })}
          </p>
        )}
        {expiryLeft && (
          <p className={`mt-1 text-xs font-semibold ${expiryLeft.urgent ? "text-red-600" : "text-amber-600"}`}>
            {t("expiryCountdown", { mins: expiryLeft.mins, secs: String(expiryLeft.secs).padStart(2, "0") })}
          </p>
        )}
      </div>

      {/* Progress bar */}
      {!isRejected && !isExpired && (
        <div className="mb-8 overflow-hidden rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
          <StepBar currentStatus={order.status} t={t} />
        </div>
      )}

      {/* Rejected / Cancelled state */}
      {isRejected && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-5">
          <div className="flex items-start gap-3">
            <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
            <div className="w-full">
              <p className="font-semibold text-red-700">{t("rejectedTitle")}</p>
              {order.rejectionReason && (
                <p className="mt-1 text-sm text-red-600">{order.rejectionReason}</p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href={`https://wa.me/${phoneToWaMe(process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "60127088789")}?text=${encodeURIComponent(`Hi, my order #${orderId} was rejected. I would like to re-order.`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white"
                >
                  <PhoneCall className="h-4 w-4" />
                  {t("whatsappReorder")}
                </Link>
                <button
                  onClick={() => { void navigator.clipboard.writeText(`#${orderId}`).then(() => { setCopyLabel(t("copied")); setTimeout(() => setCopyLabel(null), 2000); }); }}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-red-300 bg-white px-4 py-2.5 text-sm font-medium text-red-700 hover:bg-red-50"
                >
                  {copyLabel ?? t("copyOrderId", { id: orderId })}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Expired state */}
      {isExpired && (
        <div className="mb-6 rounded-2xl border border-orange-200 bg-orange-50 p-5">
          <div className="flex items-start gap-3">
            <Clock className="mt-0.5 h-5 w-5 flex-shrink-0 text-orange-500" />
            <div className="w-full">
              <p className="font-semibold text-orange-700">{t("expiredTitle")}</p>
              <p className="mt-1 text-sm text-orange-600">{t("expiredWhatsappMsg")}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href={`https://wa.me/${phoneToWaMe(process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "60127088789")}?text=${encodeURIComponent(`Hi, my order #${orderId} expired. I would like to re-order.`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-medium text-white"
                >
                  <PhoneCall className="h-4 w-4" />
                  {t("whatsappReorder")}
                </Link>
                <button
                  onClick={() => { void navigator.clipboard.writeText(`#${orderId}`).then(() => { setCopyLabel(t("copied")); setTimeout(() => setCopyLabel(null), 2000); }); }}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-orange-300 bg-white px-4 py-2.5 text-sm font-medium text-orange-700 hover:bg-orange-50"
                >
                  {copyLabel ?? t("copyOrderId", { id: orderId })}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stage-specific info cards */}
      {/* Inline payment section — shown when approved AND deposit is required */}
      {order.status === "approved" && tng.depositRequired && (
        <PaymentSection
          order={order}
          tng={tng}
          t={t}
          onSuccess={() => void fetchOrder()}
        />
      )}

      {order.status === "approved" && order.estimatedReady && (
        <div className="mb-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-amber-600">
            {t("estimatedReady")}
          </p>
          <p className="mt-1 text-lg font-semibold text-amber-800">
            {formatDateTime(order.estimatedReady)}
          </p>
        </div>
      )}

      {order.status === "payment_uploaded" && (
        <div className="mb-4 rounded-2xl border border-green-200 bg-green-50 p-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <p className="text-sm font-semibold text-green-800">{t("paymentUploaded")}</p>
          </div>
        </div>
      )}

      {order.status === "preparing" && (
        <div className="mb-4 rounded-2xl border border-green-200 bg-green-50 p-4">
          <p className="text-sm font-semibold text-green-800">
            {tng.depositRequired ? t("preparingMsg") : t("preparingConfirmedMsg")}
          </p>
          {order.estimatedReady && (
            <p className="mt-1 text-sm text-green-700">
              {t("readyAt", { time: formatDateTime(order.estimatedReady) })}
            </p>
          )}
          {countdown && (
            <p className="mt-2 text-lg font-bold text-green-800">
              {t("timeRemaining", { countdown })}
            </p>
          )}
        </div>
      )}

      {isReady && (
        <div className="mb-4 rounded-2xl border border-green-300 bg-green-100 p-4 text-center">
          <p className="text-2xl">🎉</p>
          <p className="mt-1 font-semibold text-green-800">{t("readyMsg")}</p>
          <p className="mt-0.5 text-sm text-green-700">{t("readySubMsg")}</p>
          <button
            onClick={() => { void navigator.clipboard.writeText(`#${orderId}`).then(() => { setCopyLabel(t("copied")); setTimeout(() => setCopyLabel(null), 2000); }); }}
            className="mt-3 inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-green-400 bg-white px-4 py-2.5 text-sm font-medium text-green-700 hover:bg-green-50"
          >
            {copyLabel ?? t("copyOrderId", { id: orderId })}
          </button>
        </div>
      )}

      {/* Push notification opt-in — shown for active (non-terminal) orders */}
      {(order.status === "pending_approval" ||
        order.status === "approved" ||
        order.status === "preparing") && (
        <div className="mb-4">
          <PushSubscribeButton orderId={String(order.id)} />
        </div>
      )}

      {/* Order summary */}
      <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-500">
          {t("orderSummary")}
        </h2>
        <ul className="space-y-2">
          {order.items.map((item, idx) => (
            <li key={idx} className="flex items-center justify-between text-sm">
              <span className="text-stone-700">
                {item.name}
                <span className="ml-1 text-stone-400">×{item.quantity}</span>
              </span>
              <span className="font-medium text-stone-800">
                RM {(item.price * item.quantity).toFixed(2)}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-center justify-between border-t border-stone-100 pt-3">
          <span className="font-semibold text-stone-700">{t("total")}</span>
          <span className="font-bold text-amber-700">RM {Number(order.total).toFixed(2)}</span>
        </div>

        {order.estimatedArrival && (
          <p className="mt-3 text-xs text-stone-400">
            {t("arrival")}: {formatDateTime(order.estimatedArrival)}
          </p>
        )}
      </div>

      {/* Back link */}
      <div className="mt-6 text-center">
        <Link href="/" className="text-sm text-amber-700 underline">
          {t("backHome")}
        </Link>
      </div>
    </div>
  );
}
