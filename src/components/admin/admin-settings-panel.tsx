"use client";

import { useState, useEffect } from "react";
import { DEFAULT_SETTINGS } from "@/lib/site-settings-shared";
import type { SiteSettings } from "@/lib/site-settings-shared";
import { AdminOperatingHours } from "./admin-operating-hours";
import { AdminTimeSettings } from "./admin-time-settings";
import { AdminPushSettings } from "./admin-push-settings";
import { cn } from "@/lib/utils";

interface AdminSettingsPanelProps {
  displayCategories: string[];
}


const SETTINGS_TABS = ["General", "Operating Hours", "Pre-Order", "Notifications"] as const;
type SettingsTab = (typeof SETTINGS_TABS)[number];

export function AdminSettingsPanel({ displayCategories }: AdminSettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("General");
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentInput, setPaymentInput] = useState("");
  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((data: SiteSettings) => {
        setSettings(data);
        setPaymentInput((data.paymentMethods ?? []).join(", "));
      })
      .catch(() => setError("Failed to load settings"))
      .finally(() => setLoading(false));
  }, []);

  function setField<K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const methods = paymentInput
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const payload = { ...settings, paymentMethods: methods };
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setSettings(data.settings);
      setPaymentInput((data.settings.paymentMethods ?? []).join(", "));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-gray-500">Loading settings…</p>;
  }

  const SaveBar = () => (
    <div className="flex items-center gap-4 pt-2">
      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</div>
      )}
      <button
        onClick={handleSave}
        disabled={saving}
        className="min-h-[44px] rounded-lg bg-orange-500 px-6 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save Settings"}
      </button>
      {saved && (
        <span className="text-sm font-medium text-green-700">✓ Settings saved</span>
      )}
    </div>
  );

  return (
    <div className="max-w-2xl">
      {/* Horizontal tab nav */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex gap-1 overflow-x-auto">
          {SETTINGS_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
                activeTab === tab
                  ? "border-orange-500 text-orange-600"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              )}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* General */}
      {activeTab === "General" && (
        <div className="space-y-6">
          <section className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="mb-4 text-base font-semibold text-gray-900">General</h2>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Default Language</label>
                <select
                  value={settings.defaultLocale}
                  onChange={(e) => setField("defaultLocale", e.target.value)}
                  className="w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
                >
                  <option value="en">English (EN)</option>
                  <option value="ms">Bahasa Melayu (MS)</option>
                  <option value="zh">中文 (ZH)</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  New visitors without a language preference will be directed to this language.
                </p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Cafe Display Name</label>
                <input
                  type="text"
                  value={settings.cafeName}
                  onChange={(e) => setField("cafeName", e.target.value)}
                  className="w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
                  placeholder={DEFAULT_SETTINGS.cafeName}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Currency Symbol</label>
                <input
                  type="text"
                  value={settings.currency}
                  onChange={(e) => setField("currency", e.target.value)}
                  className="w-20 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
                  placeholder="RM"
                  maxLength={5}
                />
              </div>
            </div>
          </section>
          <section className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="mb-1 text-base font-semibold text-gray-900">Google Rating (JSON-LD)</h2>
            <p className="mb-4 text-xs text-gray-500">
              Optional. Only use real ratings from a verifiable source (e.g. Google Maps reviews).
              Leave blank to omit from search results.
            </p>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Rating Value (1-5)</label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  step={0.1}
                  value={settings.ratingValue ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "") {
                      setSettings((prev) => {
                        const next = { ...prev };
                        delete next.ratingValue;
                        return next;
                      });
                    } else {
                      const n = parseFloat(v);
                      if (n >= 1 && n <= 5) setField("ratingValue", n);
                    }
                  }}
                  className="w-28 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
                  placeholder="e.g. 4.8"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Review Count</label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={settings.ratingCount ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "") {
                      setSettings((prev) => {
                        const next = { ...prev };
                        delete next.ratingCount;
                        return next;
                      });
                    } else {
                      const n = parseInt(v, 10);
                      if (n >= 1) setField("ratingCount", n);
                    }
                  }}
                  className="w-28 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
                  placeholder="e.g. 47"
                />
                <p className="mt-1 text-xs text-gray-500">Must be at least 1 for Google to display stars.</p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Rating Provider</label>
                <input
                  type="text"
                  value={settings.ratingProvider ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "") {
                      setSettings((prev) => {
                        const next = { ...prev };
                        delete next.ratingProvider;
                        return next;
                      });
                    } else {
                      setField("ratingProvider", v);
                    }
                  }}
                  className="w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
                  placeholder="e.g. Google Maps"
                />
                <p className="mt-1 text-xs text-gray-500">Source of the rating (optional).</p>
              </div>
            </div>
          </section>

          <SaveBar />
        </div>
      )}

      {/* Operating Hours */}
      {activeTab === "Operating Hours" && (
        <div className="space-y-6">
          <section className="rounded-xl border border-gray-200 bg-white p-6">
            <AdminOperatingHours />
          </section>
          <section className="rounded-xl border border-gray-200 bg-white p-6">
            <AdminTimeSettings displayCategories={displayCategories} />
          </section>
        </div>
      )}

      {/* Pre-Order */}
      {activeTab === "Pre-Order" && (
        <div className="space-y-6">
          <section className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="mb-4 text-base font-semibold text-gray-900">Pre-Order System</h2>
            <div className="space-y-4">
              <label className="flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={settings.preOrderEnabled}
                  onChange={(e) => setField("preOrderEnabled", e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-400"
                />
                <div>
                  <span className="text-sm font-medium text-gray-700">Enable pre-ordering</span>
                  <p className="text-xs text-gray-500">When off, the &apos;Send Order&apos; button is hidden from customers.</p>
                </div>
              </label>

              <label className="flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={settings.depositRequired}
                  onChange={(e) => setField("depositRequired", e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-400"
                />
                <div>
                  <span className="text-sm font-medium text-gray-700">Require deposit</span>
                  <p className="text-xs text-gray-500">Customer must upload payment proof before order is confirmed.</p>
                </div>
              </label>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Kitchen Display PIN</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={settings.kitchenPin ?? "1234"}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                    setField("kitchenPin", v);
                  }}
                  className="w-28 rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
                  placeholder="1234"
                  maxLength={6}
                />
                <p className="mt-1 text-xs text-gray-500">4–6 digit PIN for kitchen staff to access the KDS screen at /kds.</p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Accepted payment methods
                </label>
                <input
                  type="text"
                  value={paymentInput}
                  onChange={(e) => setPaymentInput(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
                  placeholder="Touch & Go, Cash on Arrival"
                />
                <p className="mt-1 text-xs text-gray-500">Comma-separated list of accepted methods.</p>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="mb-1 text-base font-semibold text-gray-900">Touch &amp; Go Payment</h2>
            <p className="mb-4 text-xs text-gray-500">
              Shown to customers on the order status page when their order is approved and payment is required.
            </p>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Touch &amp; Go Phone Number</label>
                <input
                  type="text"
                  value={settings.tng_phone ?? ""}
                  onChange={(e) => setField("tng_phone", e.target.value)}
                  className="w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
                  placeholder="e.g. 012-345 6789"
                />
                <p className="mt-1 text-xs text-gray-500">Customer will send payment to this number.</p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Touch &amp; Go QR Code URL</label>
                <input
                  type="text"
                  value={settings.tng_qr_url ?? ""}
                  onChange={(e) => setField("tng_qr_url", e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
                  placeholder="https://... or /images/tng-qr.png"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Link or path to a QR code image. Leave blank to show phone number only.
                </p>
                {settings.tng_qr_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={settings.tng_qr_url}
                    alt="TnG QR preview"
                    className="mt-2 h-24 w-24 rounded-lg border border-gray-200 object-contain"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                )}
              </div>
            </div>
          </section>

          <SaveBar />
        </div>
      )}

      {/* Notifications */}
      {activeTab === "Notifications" && (
        <div className="space-y-6">
          <AdminPushSettings />
        </div>
      )}

    </div>
  );
}
