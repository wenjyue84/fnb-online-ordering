"use client";

import { useState, useEffect } from "react";
import type { TimeSlotsConfig, TimeSlot } from "@/lib/time-slots-shared";

interface AdminTimeSettingsProps {
  displayCategories: string[];
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function AdminTimeSettings({ displayCategories }: AdminTimeSettingsProps) {
  const [config, setConfig] = useState<TimeSlotsConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/time-slots")
      .then((r) => r.json())
      .then((data: TimeSlotsConfig) => setConfig(data))
      .catch(() => setError("Failed to load time slots config"));
  }, []);

  function updateSlot(idx: number, fields: Partial<TimeSlot>) {
    if (!config) return;
    const slots = config.slots.map((s, i) => (i === idx ? { ...s, ...fields } : s));
    setConfig({ ...config, slots });
  }

  async function save() {
    if (!config) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/time-slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error("Server error");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (error && !config) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  if (!config) {
    return <p className="text-sm text-gray-500">Loading…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Time-Based Menu Display</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            Configure which category is highlighted by default based on Malaysia time (UTC+8).
            The menu page automatically pre-selects the matching category when customers visit.
          </p>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="shrink-0 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
        >
          {saved ? "Saved!" : saving ? "Saving…" : "Save Changes"}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-700">Time Slot</th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">Start (MYT)</th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">End (MYT)</th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">Default Category</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {config.slots.map((slot, idx) => (
              <tr key={slot.id}>
                <td className="px-4 py-3 font-medium text-gray-900">{slot.label}</td>
                <td className="px-4 py-3">
                  <input
                    type="time"
                    value={`${pad(slot.startHour)}:${pad(slot.startMinute)}`}
                    onChange={(e) => {
                      const [h, m] = e.target.value.split(":").map(Number);
                      updateSlot(idx, { startHour: h, startMinute: m });
                    }}
                    className="rounded border border-gray-300 px-2 py-1 text-sm"
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="time"
                    value={`${pad(slot.endHour)}:${pad(slot.endMinute)}`}
                    onChange={(e) => {
                      const [h, m] = e.target.value.split(":").map(Number);
                      updateSlot(idx, { endHour: h, endMinute: m });
                    }}
                    className="rounded border border-gray-300 px-2 py-1 text-sm"
                  />
                </td>
                <td className="px-4 py-3">
                  <select
                    value={slot.defaultCategory}
                    onChange={(e) => updateSlot(idx, { defaultCategory: e.target.value })}
                    className="rounded border border-gray-300 px-2 py-1.5 text-sm"
                  >
                    {displayCategories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400">
        Outside these time windows, the menu defaults to showing all categories.
        A green dot on the category pill indicates it is currently serving.
      </p>
    </div>
  );
}
