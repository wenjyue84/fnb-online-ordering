"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Upload, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

interface OrderData {
  id: number;
  status: string;
  total: number;
  items: { name: string; price: number; quantity: number }[];
}

interface TngSettings {
  tngPhone?: string;
  tngQrUrl?: string;
}

export default function PaymentPage() {
  const params = useParams();
  const orderId = params.id as string;
  const locale = params.locale as string;
  const t = useTranslations("paymentPage");

  const [order, setOrder] = useState<OrderData | null>(null);
  const [settings, setSettings] = useState<TngSettings>({});
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchData = useCallback(async () => {
    try {
      const [orderRes, settingsRes] = await Promise.all([
        fetch(`/api/orders/${orderId}`, { cache: "no-store" }),
        fetch("/api/settings"),
      ]);
      if (orderRes.ok) {
        const orderData = (await orderRes.json()) as OrderData;
        setOrder(orderData);
      }
      if (settingsRes.ok) {
        const raw = (await settingsRes.json()) as {
          tng_phone?: string;
          tng_qr_url?: string;
        };
        setSettings({ tngPhone: raw.tng_phone, tngQrUrl: raw.tng_qr_url });
      }
    } catch {
      // ignore fetch errors — page will show with partial data
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;

    if (f.size > 5 * 1024 * 1024) {
      setError(t("fileSizeError"));
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) {
      setError(t("fileTypeError"));
      return;
    }

    setError(null);
    setFile(f);

    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(f);
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setProgress(0);
    setError(null);

    const formData = new FormData();
    formData.append("screenshot", file);

    // Simulate upload progress (fetch doesn't expose progress natively)
    const progressInterval = setInterval(() => {
      setProgress((p) => Math.min(p + 15, 90));
    }, 200);

    try {
      const res = await fetch(`/api/orders/${orderId}/payment`, {
        method: "POST",
        body: formData,
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? t("uploadError"));
      }

      setSuccess(true);
    } catch (err) {
      clearInterval(progressInterval);
      setError(err instanceof Error ? err.message : t("uploadError"));
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
      </div>
    );
  }

  if (success) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12 text-center">
        <CheckCircle2 className="mx-auto mb-4 h-16 w-16 text-green-500" />
        <h1 className="font-display text-2xl font-bold text-stone-800">
          {t("successTitle")}
        </h1>
        <p className="mt-2 text-stone-600">{t("successDesc")}</p>
        <Link
          href={`/${locale}/order/${orderId}`}
          className="mt-6 inline-block rounded-xl bg-amber-600 px-6 py-3 font-medium text-white"
        >
          {t("successCta")}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <p className="text-sm text-stone-500">{t("orderNumber", { id: orderId })}</p>
        <h1 className="mt-1 font-display text-2xl font-bold text-stone-800">
          {t("title")}
        </h1>
        <p className="mt-1 text-sm text-stone-600">{t("subtitle")}</p>
      </div>

      {/* Total amount */}
      {order && (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center">
          <p className="text-sm font-medium text-amber-700">{t("amountToPay")}</p>
          <p className="mt-1 text-4xl font-bold text-amber-800">
            RM {Number(order.total).toFixed(2)}
          </p>
        </div>
      )}

      {/* TnG payment details */}
      <div className="mb-6 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-stone-500">
          {t("tngTitle")}
        </h2>

        {settings.tngPhone && (
          <div className="mb-4">
            <p className="text-xs text-stone-500">{t("tngPhone")}</p>
            <p className="mt-0.5 text-2xl font-bold tracking-wide text-stone-800">
              {settings.tngPhone}
            </p>
          </div>
        )}

        {settings.tngQrUrl && (
          <div className="mt-3">
            <p className="mb-2 text-xs text-stone-500">{t("tngQrCode")}</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={settings.tngQrUrl}
              alt="Touch & Go QR Code"
              className="mx-auto h-52 w-52 rounded-xl border border-stone-200 object-contain"
            />
          </div>
        )}

        {!settings.tngPhone && !settings.tngQrUrl && (
          <p className="text-sm text-stone-500">{t("tngNoDetails")}</p>
        )}
      </div>

      {/* Upload section */}
      <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-stone-500">
          {t("uploadTitle")}
        </h2>

        {error && (
          <div className="mb-3 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Drop zone */}
        <button
          type="button"
          className="w-full cursor-pointer rounded-xl border-2 border-dashed border-stone-300 p-6 text-center transition-colors hover:border-amber-400 hover:bg-amber-50"
          onClick={() => fileRef.current?.click()}
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt="Preview"
              className="mx-auto max-h-52 rounded-lg object-contain"
            />
          ) : (
            <>
              <Upload className="mx-auto mb-2 h-8 w-8 text-stone-400" />
              <p className="text-sm text-stone-600">{t("uploadPlaceholder")}</p>
              <p className="mt-1 text-xs text-stone-400">{t("uploadHint")}</p>
            </>
          )}
        </button>

        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleFileChange}
        />

        {file && (
          <p className="mt-2 text-xs text-stone-500">
            {file.name} ({(file.size / 1024 / 1024).toFixed(1)}MB)
          </p>
        )}

        {/* Progress bar */}
        {uploading && (
          <div className="mt-3">
            <div className="h-2 overflow-hidden rounded-full bg-stone-200">
              <div
                className="h-2 rounded-full bg-amber-500 transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-1 text-center text-xs text-stone-500">
              {t("progressLabel", { progress })}
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={() => void handleUpload()}
          disabled={!file || uploading}
          className="mt-4 min-h-[44px] w-full rounded-xl bg-amber-600 py-3 font-semibold text-white transition-colors hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {uploading ? t("uploading") : t("submitBtn")}
        </button>

        <p className="mt-3 text-xs text-stone-400">
          {t("dataDisclosure")}
        </p>
      </div>

      <div className="mt-6 text-center">
        <Link
          href={`/${locale}/order/${orderId}`}
          className="text-sm text-amber-700 underline"
        >
          {t("backToStatus")}
        </Link>
      </div>
    </div>
  );
}
