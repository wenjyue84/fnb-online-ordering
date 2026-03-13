"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Clock, Phone, Wifi, Facebook, Instagram } from "lucide-react";

export interface ContactContent {
  title: string;
  subtitle: string;
  address: string;
  neighborhood: string;
  phone: string;
  hoursDaily: string;
  hoursLastOrder: string;
  googleMapsEmbed: string;
}

interface ContactInlineEditorProps {
  content: ContactContent;
  social: { facebook: string; instagram: string };
  wifiPassword: string;
  cafeName?: string;
}

export function ContactInlineEditor({
  content,
  social,
  wifiPassword,
  cafeName = "Cafe",
}: ContactInlineEditorProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [fields, setFields] = useState<ContactContent>(content);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function setField<K extends keyof ContactContent>(key: K, value: ContactContent[K]) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/admin/content/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      setSaved(true);
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error saving");
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setFields(content);
    setError(null);
    setEditing(false);
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      {/* Admin banner */}
      <div className="mb-6 flex items-center gap-3 rounded-lg border border-amber-400/50 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-300">
        <span className="text-base">✎</span>
        <span>
          <strong>Admin</strong> — you can edit the contact page content.
        </span>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="ml-auto rounded-md bg-amber-600 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-700"
          >
            Edit Mode
          </button>
        )}
        {editing && (
          <div className="ml-auto flex gap-2">
            <button
              onClick={handleCancel}
              className="rounded-md border border-amber-600 px-3 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-100 dark:text-amber-300"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-md bg-amber-600 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        )}
        {saved && !editing && (
          <span className="text-xs font-medium text-green-700 dark:text-green-400">
            Saved!
          </span>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Header */}
      <div className="mb-12">
        {editing ? (
          <>
            <input
              value={fields.title}
              onChange={(e) => setField("title", e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 font-display text-3xl font-bold outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 lg:text-4xl"
            />
            <input
              value={fields.subtitle}
              onChange={(e) => setField("subtitle", e.target.value)}
              className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2 text-lg text-muted-foreground outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
            />
          </>
        ) : (
          <>
            <h1 className="font-display text-3xl font-bold lg:text-4xl">{fields.title}</h1>
            <p className="mt-2 text-lg text-muted-foreground">{fields.subtitle}</p>
          </>
        )}
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Info cards */}
        <div className="space-y-6">
          {/* Address */}
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="mb-3 flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              <h2 className="font-semibold">Address</h2>
            </div>
            {editing ? (
              <>
                <textarea
                  value={fields.address}
                  onChange={(e) => setField("address", e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                />
                <input
                  value={fields.neighborhood}
                  onChange={(e) => setField("neighborhood", e.target.value)}
                  className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                  placeholder="Neighborhood"
                />
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">{fields.address}</p>
                <p className="mt-1 text-sm text-muted-foreground">{fields.neighborhood}</p>
              </>
            )}
          </div>

          {/* Hours */}
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="mb-3 flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              <h2 className="font-semibold">Opening Hours</h2>
            </div>
            {editing ? (
              <>
                <input
                  value={fields.hoursDaily}
                  onChange={(e) => setField("hoursDaily", e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                  placeholder="Daily hours (e.g. 11:00 AM – 11:00 PM)"
                />
                <input
                  value={fields.hoursLastOrder}
                  onChange={(e) => setField("hoursLastOrder", e.target.value)}
                  className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                  placeholder="Last order time"
                />
              </>
            ) : (
              <>
                <p className="text-sm">Daily: {fields.hoursDaily}</p>
                <p className="text-sm text-muted-foreground">Last order: {fields.hoursLastOrder}</p>
              </>
            )}
          </div>

          {/* Phone */}
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="mb-3 flex items-center gap-2">
              <Phone className="h-5 w-5 text-primary" />
              <h2 className="font-semibold">Phone</h2>
            </div>
            {editing ? (
              <input
                value={fields.phone}
                onChange={(e) => setField("phone", e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
              />
            ) : (
              <a
                href={`tel:${fields.phone.replace(/[- ]/g, "")}`}
                className="text-sm text-primary hover:underline"
              >
                {fields.phone}
              </a>
            )}
          </div>

          {/* WiFi (read-only in editor) */}
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="mb-3 flex items-center gap-2">
              <Wifi className="h-5 w-5 text-primary" />
              <h2 className="font-semibold">WiFi</h2>
            </div>
            <p className="text-sm text-muted-foreground">{wifiPassword}</p>
          </div>

          {/* Social (read-only in editor) */}
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-3 font-semibold">Follow Us</h2>
            <div className="flex gap-3">
              <a
                href={social.facebook}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-lg bg-secondary px-4 py-2 text-sm hover:bg-secondary/80"
              >
                <Facebook className="h-4 w-4" /> Facebook
              </a>
              <a
                href={social.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-lg bg-secondary px-4 py-2 text-sm hover:bg-secondary/80"
              >
                <Instagram className="h-4 w-4" /> Instagram
              </a>
            </div>
          </div>
        </div>

        {/* Map + embed URL editor */}
        <div className="space-y-4">
          {editing && (
            <div className="rounded-xl border border-border bg-card p-4">
              <label className="mb-2 block text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Google Maps Embed URL
              </label>
              <textarea
                value={fields.googleMapsEmbed}
                onChange={(e) => setField("googleMapsEmbed", e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
              />
            </div>
          )}
          <div className="overflow-hidden rounded-xl border border-border">
            <iframe
              src={fields.googleMapsEmbed}
              width="100%"
              height="100%"
              style={{ minHeight: "400px", border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title={`${cafeName} location`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
