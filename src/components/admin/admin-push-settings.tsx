"use client";

import { useState, useEffect } from "react";
import { Bell, BellOff, CheckCircle, AlertCircle } from "lucide-react";

type PushState = "idle" | "subscribing" | "subscribed" | "unsubscribing" | "unsupported" | "denied";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export function AdminPushSettings() {
  const [state, setState] = useState<PushState>("idle");
  const [error, setError] = useState<string | null>(null);

  // On mount, detect current subscription state
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }
    navigator.serviceWorker.ready.then((reg) =>
      reg.pushManager.getSubscription().then((sub) => {
        setState(sub ? "subscribed" : "idle");
      })
    );
  }, []);

  async function subscribe() {
    setError(null);
    setState("subscribing");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState("denied");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
      });
      const subJson = sub.toJSON() as {
        endpoint: string;
        keys: { p256dh: string; auth: string };
      };
      const res = await fetch("/api/admin/push-subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subJson),
      });
      if (!res.ok) throw new Error("Server failed to save subscription");
      setState("subscribed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Subscription failed");
      setState("idle");
    }
  }

  async function unsubscribe() {
    setError(null);
    setState("unsubscribing");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/admin/push-subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setState("idle");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unsubscribe failed");
      setState("subscribed");
    }
  }

  if (state === "unsupported") {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-2 text-base font-semibold text-gray-900">Push Notifications</h2>
        <p className="text-sm text-gray-500">
          This browser does not support push notifications.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 max-w-md">
      <h2 className="mb-1 text-base font-semibold text-gray-900">Push Notifications</h2>
      <p className="mb-4 text-sm text-gray-500">
        Receive a browser notification whenever a customer sends an order — even if this tab is in the background.
      </p>

      {state === "denied" && (
        <div className="mb-4 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Notifications are blocked by your browser. Open browser settings → Site permissions → Notifications → allow <strong>this site</strong>.
          </span>
        </div>
      )}

      {state === "subscribed" && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          <CheckCircle className="h-4 w-4 shrink-0" />
          <span>Push notifications are <strong>enabled</strong> on this device.</span>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {(state === "subscribed" || state === "unsubscribing") ? (
        <button
          onClick={unsubscribe}
          disabled={state === "unsubscribing"}
          className="flex min-h-[44px] items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          <BellOff className="h-4 w-4" />
          {state === "unsubscribing" ? "Disabling…" : "Disable Push Notifications"}
        </button>
      ) : (
        <button
          onClick={subscribe}
          disabled={state === "subscribing" || state === "denied"}
          className="flex min-h-[44px] items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
        >
          <Bell className="h-4 w-4" />
          {state === "subscribing" ? "Enabling…" : "Enable Push Notifications"}
        </button>
      )}
    </div>
  );
}
